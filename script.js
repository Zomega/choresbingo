import confetti from "https://esm.sh/canvas-confetti";
import QRCode from "https://esm.sh/qrcode";
import lilGui from "https://esm.sh/lil-gui";
import { Multiplayer } from "./multiplayer.js";
import { Storage } from "./storage.js";
import { UI } from "./ui.js";
import { Game } from "./game.js";
import {
  iconList,
  generateHumanReadableUniqueId,
  getDefaultChores,
} from "./utils.js";

import { initI18n } from "./i18n.js";

// --- CONFIG & STATE ---
const urlParams = new URLSearchParams(window.location.search);
const JOIN_ID = urlParams.get("room");
const isHost = !JOIN_ID;

let ROOM_ID = JOIN_ID;
if (isHost) {
  ROOM_ID = Storage.getHostedRoomId() || generateHumanReadableUniqueId();
  Storage.setHostedRoomId(ROOM_ID);
}

const PLAYER_ID = Storage.getPlayerId() || generateHumanReadableUniqueId();
Storage.setPlayerId(PLAYER_ID);

let myName = Storage.getPlayerName() || PLAYER_ID;
Storage.setPlayerName(myName);

let myIcon = Storage.getPlayerIcon();
if (!myIcon) {
  myIcon = iconList[Math.floor(Math.random() * iconList.length)];
  Storage.setPlayerIcon(myIcon);
}

let multiplayer;
let game;

// --- MULTIPLAYER ---

function initMultiplayer() {
  game = new Game({
    playerId: PLAYER_ID,
    playerName: myName,
    playerIcon: myIcon,
    isHost,
    getTilesState: UI.getTilesState,
    onPlayerUpdate: (id, data, isMe) => {
      UI.addPlayerToList(id, data.name);
      UI.updatePlayerInList(id, data.name);
      UI.ensureRacer(id, data.name, data.icon);
      UI.updateRacer(
        id,
        data.score,
        data.name,
        data.icon,
        game.players,
        isMe,
        (name) => {
          UI.triggerVictory(name, confetti);
        },
      );
    },
    onReset: () => location.reload(),
  });

  multiplayer = new Multiplayer({
    isHost,
    roomId: ROOM_ID,
    playerId: PLAYER_ID,
    playerName: myName,
    playerIcon: myIcon,
    onStatusChange: (isOnline, message) => {
      UI.updateStatus(isOnline, isHost, message);
      if (isOnline) {
        ROOM_ID = multiplayer.roomId;
        UI.refreshShareUI(ROOM_ID, QRCode);
      }
    },
    onData: (conn, data) => {
      game.handleData(
        data,
        isHost,
        (syncMsg) => multiplayer.sendTo(conn, syncMsg),
        (broadcastMsg) => multiplayer.broadcast(broadcastMsg),
      );
    },
  });

  if (isHost) {
    game.addPlayer(PLAYER_ID, myName, myIcon);
  }

  multiplayer.init();

  setInterval(() => {
    if (game.players[PLAYER_ID]) game.players[PLAYER_ID].lastSeen = Date.now();
    if (isHost) {
      const now = Date.now();
      const heartbeatMap = {};
      Object.keys(game.players).forEach((id) => {
        heartbeatMap[id] = now - game.players[id].lastSeen;
      });
      multiplayer.broadcast({
        type: "HEARTBEAT_HOST",
        heartbeats: heartbeatMap,
      });
    }
    UI.refreshPlayerStatusUI(game.players);
  }, 5000);
}

// --- INIT ---

document.addEventListener("DOMContentLoaded", async () => {
  await initI18n();
  UI.renderBoard(getDefaultChores());
  initMultiplayer();

  UI.initModals({
    isHost,
    roomId: ROOM_ID,
    multiplayer,
    game,
    storage: Storage,
    iconList,
    lilGui,
    onProfileUpdate: (newName, newIcon) => {
      if (newName !== null) {
        myName = newName;
        Storage.setPlayerName(myName);
      }
      if (newIcon) {
        myIcon = newIcon;
        Storage.setPlayerIcon(myIcon);
      }

      const score = game.calculateLocalScore();
      game.addPlayer(PLAYER_ID, myName, myIcon, score);
      multiplayer.broadcast({
        type: "PROFILE_UPDATE",
        id: PLAYER_ID,
        name: myName,
        icon: myIcon,
        score,
      });
    },
  });

  // FAB Handlers
  document.getElementById("connection-fab").onclick = () =>
    UI.toggleModal("connection-modal");
  document.getElementById("profile-fab").onclick = () =>
    UI.toggleModal("profile-modal");
  document.getElementById("settings-fab").onclick = () =>
    UI.toggleModal("settings-modal");

  // Load Board State
  const saved = Storage.getBoard();
  const tiles = document.querySelectorAll(".tile");
  saved.forEach((done, i) => {
    if (done && !tiles[i].classList.contains("free")) {
      tiles[i].classList.add("completed");
    }
  });

  // Bingo Grid Logic
  document.querySelector(".bingo-grid").onclick = (e) => {
    const tile = e.target.closest(".tile");
    if (!tile || tile.classList.contains("free")) return;
    tile.classList.toggle("completed");

    Storage.setBoard(
      Array.from(tiles).map((t) => t.classList.contains("completed")),
    );

    const score = game.calculateLocalScore();
    game.updatePlayerScore(PLAYER_ID, score);
    multiplayer.broadcast({ type: "SCORE", id: PLAYER_ID, score });
  };

  const initialScore = game.calculateLocalScore();
  game.addPlayer(PLAYER_ID, myName, myIcon, initialScore);
});

window.fullReset = () => {
  Storage.clear();
  window.location.href = window.location.origin + window.location.pathname;
};
