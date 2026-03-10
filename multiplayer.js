import { Peer } from "https://esm.sh/peerjs";

export class Multiplayer {
  constructor(options = {}) {
    this.isHost = options.isHost;
    this.roomId = options.roomId;
    this.playerId = options.playerId;
    this.playerName = options.playerName;
    this.playerIcon = options.playerIcon;
    this.onStatusChange = options.onStatusChange || (() => {});
    this.onData = options.onData || (() => {});
    this.onPlayerUpdate = options.onPlayerUpdate || (() => {});

    this.peer = null;
    this.connections = [];
    this.reconnectionInterval = null;
    this.heartbeatInterval = null;
    this.HEARTBEAT_MS = 5000;
  }

  init() {
    const myPeerId = this.isHost ? this.roomId : null;
    const peerOptions = {
      host: "0.peerjs.com",
      secure: true,
      port: 443,
      pingInterval: 3000,
      config: {
        iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
      },
    };

    if (this.peer) this.peer.destroy();
    this.peer = new Peer(myPeerId, peerOptions);

    this.peer.on("open", (id) => {
      console.log("My Personal ID is:", id);
      clearInterval(this.reconnectionInterval);
      this.reconnectionInterval = null;

      if (this.isHost) {
        this.roomId = id;
      } else {
        console.log(`Connecting to Host: ${this.roomId}`);
        const conn = this.peer.connect(this.roomId, { reliable: true });
        this.setupConn(conn);
      }
      this.startHeartbeat();
      this.onStatusChange(true);
    });

    this.peer.on("connection", (conn) => this.setupConn(conn));

    this.peer.on("disconnected", () => {
      this.onStatusChange(false, "Server Disconnected");
      this.peer.reconnect();
    });

    this.peer.on("error", (err) => {
      this.onStatusChange(false, "Connection Error");
      console.error("PeerJS Error:", err.type);

      if (!this.reconnectionInterval) {
        this.reconnectionInterval = setInterval(() => {
          this.init();
        }, 10000);
      }
    });
  }

  setupConn(conn) {
    if (this.connections.find((c) => c.peer === conn.peer)) return;
    this.connections.push(conn);

    conn.on("open", () => {
      if (!this.isHost && this.reconnectionInterval) {
        clearInterval(this.reconnectionInterval);
        this.reconnectionInterval = null;
      }

      this.onStatusChange(true);
      conn.send({
        type: "JOIN",
        id: this.playerId,
        name: this.playerName,
        icon: this.playerIcon,
        score: 0, // Initial score, will be updated by caller
      });
    });

    conn.on("data", (data) => {
      this.onData(conn, data);
    });

    conn.on("close", () => {
      this.onStatusChange(false, "Connection Lost");
      this.connections = this.connections.filter((c) => c !== conn);

      if (!this.isHost && !this.reconnectionInterval) {
        this.reconnectionInterval = setInterval(() => {
          const newConn = this.peer.connect(this.roomId, { reliable: true });
          this.setupConn(newConn);
        }, 10000);
      }
    });
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
      if (this.isHost) {
        // Host logic for heartbeats handled by caller or here
      } else {
        const hostConn = this.connections.find((c) => c.peer === this.roomId);
        if (hostConn && hostConn.open) {
          hostConn.send({ type: "HEARTBEAT_GUEST", id: this.playerId });
        }
      }
    }, this.HEARTBEAT_MS);
  }
}
