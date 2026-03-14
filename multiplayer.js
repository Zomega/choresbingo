import { Peer } from "https://esm.sh/peerjs";
import { Logger } from "./utils.js";

export class Multiplayer {
  constructor(options = {}) {
    this.isHost = options.isHost;
    this.roomId = options.roomId;
    this.playerId = options.playerId;
    this.playerName = options.playerName;
    this.playerIcon = options.playerIcon;
    this.getScore = options.getScore || (() => 0);
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onData = options.onData || (() => {});

    this.peer = null;
    this.connections = [];
    this.reconnectionInterval = null;
    this.heartbeatInterval = null;
    this.HEARTBEAT_MS = 5000;
    this.connectionAttempts = 0;

    this.cleanup = this.cleanup.bind(this);
  }

  init() {
    this.stopIntervals();

    // We don't fully destroy here if we're retrying an ID collision,
    // but for a fresh init we want a clean slate.
    if (this.peer && !this.peer.destroyed) {
      this.peer.destroy();
    }

    const myPeerId = this.isHost ? this.roomId : null;

    Logger.log(
      `[Multiplayer] Init: isHost=${this.isHost}, myPeerId=${myPeerId}`,
    );

    const peerOptions = {
      host: "0.peerjs.com",
      secure: true,
      port: 443,
      pingInterval: 3000,
      config: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    };

    Logger.log(
      `[Multiplayer] Initializing as ${this.isHost ? "Host" : "Guest"} (Target ID: ${this.roomId})...`,
    );
    this.peer = new Peer(myPeerId, peerOptions);

    this.peer.on("open", (id) => {
      Logger.log(`[Multiplayer] Signaling connection open. My ID: ${id}`);
      this.connectionAttempts = 0;

      if (this.isHost) {
        this.roomId = id;
        Logger.log(`[Multiplayer] Now Hosting Room: ${id}`);
      } else {
        this.connectToHost();
      }

      this.startHeartbeat();
      this.onStatusChange(true);
    });

    this.peer.on("connection", (conn) => {
      Logger.log(`[Multiplayer] Incoming guest connection: ${conn.peer}`);
      this.setupConn(conn);
    });

    this.peer.on("disconnected", () => {
      Logger.warn("[Multiplayer] Signaling server disconnected.");
      this.onStatusChange(false, "Offline (Signal Lost)");
      this.peer.reconnect();
    });

    this.peer.on("error", (err) => {
      Logger.error(`[Multiplayer] PeerJS Error: ${err.type}`, err);

      if (err.type === "unavailable-id" && this.isHost) {
        Logger.warn(
          "[Multiplayer] ID still in use by old session. Retrying in 2s...",
        );
        this.onStatusChange(false, "Waiting for ID release...");
        setTimeout(() => this.init(), 2000);
        return;
      }

      if (err.type === "peer-unavailable" || err.type === "network") {
        this.scheduleReconnection();
      }

      this.onStatusChange(false, `Error: ${err.type}`);
    });

    window.addEventListener("beforeunload", this.cleanup);
  }

  connectToHost() {
    if (!this.roomId || !this.peer || this.peer.destroyed || !this.peer.open)
      return;

    Logger.log(
      `[Multiplayer] Attempting connection to Host: ${this.roomId}...`,
    );

    // Safety: If Guest Peer object gets weird after many failures, recycle it
    if (++this.connectionAttempts > 10) {
      Logger.warn(
        "[Multiplayer] Persistent guest connection failure. Recycling Peer...",
      );
      this.init();
      return;
    }

    const conn = this.peer.connect(this.roomId, { reliable: true });
    this.setupConn(conn);
  }

  setupConn(conn) {
    if (this.connections.find((c) => c.peer === conn.peer)) {
      conn.close();
      return;
    }

    this.connections.push(conn);

    conn.on("open", () => {
      Logger.log(`[Multiplayer] Data channel open with: ${conn.peer}`);
      this.connectionAttempts = 0;
      this.onStatusChange(true);

      if (this.reconnectionInterval) {
        clearInterval(this.reconnectionInterval);
        this.reconnectionInterval = null;
      }

      if (!this.isHost) {
        const initialScore = this.getScore();
        Logger.log(
          `[Multiplayer] Sending JOIN. Name: ${this.playerName}, Score: ${initialScore}`,
        );
        conn.send({
          type: "JOIN",
          id: this.playerId,
          name: this.playerName,
          icon: this.playerIcon,
          score: initialScore,
          lastSeen: Date.now(),
        });
      }
    });

    conn.on("data", (data) => {
      this.onData(conn, data);
    });

    conn.on("close", () => {
      Logger.warn(`[Multiplayer] Data connection closed: ${conn.peer}`);
      this.connections = this.connections.filter((c) => c !== conn);

      if (!this.isHost && conn.peer === this.roomId) {
        this.onStatusChange(false, "Host Offline");
        this.scheduleReconnection();
      }
    });

    conn.on("error", (err) => {
      Logger.error(`[Multiplayer] Data connection error:`, err);
      conn.close();
    });
  }

  scheduleReconnection() {
    if (this.reconnectionInterval || this.isHost) return;

    Logger.log("[Multiplayer] Host not found. Entering polling mode...");
    this.reconnectionInterval = setInterval(() => {
      if (this.peer && !this.peer.destroyed && this.peer.open) {
        this.connectToHost();
      }
    }, 4000);
  }

  updateProfile(name, icon) {
    this.playerName = name;
    this.playerIcon = icon;
  }

  broadcast(msg) {
    this.connections = this.connections.filter((c) => c.open);
    this.connections.forEach((c) => c.send(msg));
  }

  sendTo(conn, msg) {
    if (conn && conn.open) {
      conn.send(msg);
    }
  }

  startHeartbeat() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    this.heartbeatInterval = setInterval(() => {
      if (!this.isHost) {
        const hostConn = this.connections.find((c) => c.peer === this.roomId);
        if (hostConn && hostConn.open) {
          hostConn.send({ type: "HEARTBEAT_GUEST", id: this.playerId });
        }
      }
    }, this.HEARTBEAT_MS);
  }

  stopIntervals() {
    if (this.heartbeatInterval) clearInterval(this.heartbeatInterval);
    if (this.reconnectionInterval) clearInterval(this.reconnectionInterval);
    this.heartbeatInterval = null;
    this.reconnectionInterval = null;
  }

  cleanup() {
    Logger.log("[Multiplayer] Force cleaning up Peer session...");
    window.removeEventListener("beforeunload", this.cleanup);
    this.stopIntervals();
    if (this.peer) {
      this.connections.forEach((c) => c.close());
      this.peer.destroy(); // This is the crucial bit for signaling server release
      this.peer = null;
    }
    this.connections = [];
  }
}
