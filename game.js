import { calculateScore } from "./scoring.js";

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

  addPlayer(id, name, icon, score = 0) {
    const isMe = id === this.playerId;
    const currentScore = isMe ? calculateScore(this.getTilesState()) : score;

    if (!this.players[id]) {
      this.players[id] = {
        name,
        icon,
        score: currentScore,
        lastSeen: Date.now(),
      };
    } else {
      this.players[id].name = name;
      this.players[id].icon = icon;
      this.players[id].score = currentScore;
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
        this.addPlayer(data.id, data.name, data.icon, data.score);
        if (isHost) {
          sendSync({ type: "SYNC", playerData: this.players });
          broadcast(data);
        }
        break;

      case "SYNC":
        Object.entries(data.playerData).forEach(([id, pData]) => {
          if (id !== this.playerId) {
            this.addPlayer(id, pData.name, pData.icon, pData.score);
          }
        });
        break;

      case "SCORE":
        this.updatePlayerScore(data.id, data.score);
        if (isHost) broadcast(data);
        break;

      case "PROFILE_UPDATE":
        this.addPlayer(data.id, data.name, data.icon, data.score || 0);
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
