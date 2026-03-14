import { calculateScore } from "./scoring.js";
import { Logger } from "./utils.js";

export class Game {
  constructor(options = {}) {
    this.playerId = options.playerId;
    this.playerName = options.playerName;
    this.playerIcon = options.playerIcon;
    this.isHost = options.isHost;

    this.players = {};
    this.onPlayerUpdate = options.onPlayerUpdate || (() => {});
    this.onReset = options.onReset || (() => {});
    this.getTilesState = options.getTilesState || (() => []);
  }

  addPlayer(id, name, icon, score = 0, lastSeen = Date.now()) {
    const isMe = id === this.playerId;
    const existingPlayer = this.players[id];

    // If it's me, use existing score if available, else recalculate.
    // Otherwise, use passed score, or existing score, or 0.
    let currentScore;
    if (isMe) {
      currentScore = existingPlayer
        ? existingPlayer.score
        : calculateScore(this.getTilesState());
    } else {
      currentScore = score !== undefined ? score : existingPlayer?.score || 0;
    }

    Logger.log(
      `[Game] addPlayer: id=${id}, name=${name}, score=${currentScore}, isMe=${isMe}`,
    );

    if (!existingPlayer) {
      this.players[id] = {
        name,
        icon,
        score: currentScore,
        lastSeen,
      };
    } else {
      this.players[id].name = name;
      this.players[id].icon = icon;
      this.players[id].score = currentScore;
      this.players[id].lastSeen = lastSeen;
    }

    this.onPlayerUpdate(id, this.players[id], isMe);
    return this.players[id];
  }

  updatePlayerScore(id, score) {
    if (this.players[id]) {
      this.players[id].score = score;
      this.onPlayerUpdate(id, this.players[id], id === this.playerId);
    }
  }

  handleData(data, isHost, sendSync, broadcast) {
    Logger.log(`[Game] Received ${data.type} from peer.`, data);
    switch (data.type) {
      case "HEARTBEAT_GUEST":
        if (isHost && this.players[data.id]) {
          this.players[data.id].lastSeen = Date.now();
        }
        break;

      case "HEARTBEAT_HOST":
        const now = Date.now();
        Object.entries(data.heartbeats).forEach(([id, relativeMs]) => {
          if (this.players[id]) {
            this.players[id].lastSeen = now - relativeMs;
          }
        });
        break;

      case "JOIN":
        this.addPlayer(
          data.id,
          data.name,
          data.icon,
          data.score,
          data.lastSeen,
        );
        if (isHost) {
          sendSync({ type: "SYNC", playerData: this.players });
          broadcast(data);
        }
        break;

      case "SYNC":
        Object.entries(data.playerData).forEach(([id, pData]) => {
          if (id !== this.playerId) {
            this.addPlayer(
              id,
              pData.name,
              pData.icon,
              pData.score,
              pData.lastSeen,
            );
          }
        });
        break;

      case "SCORE":
        if (this.players[data.id]) {
          this.players[data.id].lastSeen = data.lastSeen || Date.now();
          this.updatePlayerScore(data.id, data.score);
        } else {
          // If player doesn't exist yet, add them (prevents lost updates)
          this.addPlayer(
            data.id,
            data.name || `Player ${data.id}`,
            data.icon || "🏃",
            data.score !== undefined ? data.score : 0,
            data.lastSeen || Date.now(),
          );
        }
        if (isHost) broadcast(data);
        break;

      case "PROFILE_UPDATE":
        this.addPlayer(
          data.id,
          data.name,
          data.icon,
          data.score !== undefined
            ? data.score
            : this.players[data.id]?.score || 0,
          data.lastSeen,
        );
        if (isHost) broadcast(data);
        break;

      case "RESET_COMMAND":
        this.onReset();
        break;
    }
  }

  getLocalPlayer() {
    return this.players[this.playerId];
  }

  calculateLocalScore() {
    return calculateScore(this.getTilesState());
  }
}
