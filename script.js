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
const SAVED_HOST_ID = Storage.getHostedRoomId();

// Decision Logic:
// If we have a SAVED_HOST_ID, and it matches the URL (or URL is empty), we are the Host.
// This prevents the Host from becoming a Guest just because the URL has ?room=...
const isHost = !JOIN_ID || JOIN_ID === SAVED_HOST_ID;

let ROOM_ID = JOIN_ID;
if (isHost) {
  ROOM_ID = SAVED_HOST_ID || generateHumanReadableUniqueId();
  Logger.log(`[App] Decided to be HOST. Room: ${ROOM_ID}`);
  Storage.setHostedRoomId(ROOM_ID);
} else {
  Logger.log(`[App] Decided to be GUEST. Joining Room: ${ROOM_ID}`);
}

let PLAYER_ID = Storage.getPlayerId() || generateHumanReadableUniqueId();
PLAYER_ID = PLAYER_ID.replace(/\s+/g, "-").toLowerCase();
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

  game.addPlayer(PLAYER_ID, myName, myIcon);

  multiplayer = new Multiplayer({
    isHost,
    roomId: ROOM_ID,
    playerId: PLAYER_ID,
    playerName: myName,
    playerIcon: myIcon,
    getScore: () => game.calculateLocalScore(),
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
  UI.initOnboarding(Storage);

  // Load Board State
  const saved = Storage.getBoard();
  const tiles = document.querySelectorAll(".tile");
  Logger.log(
    `[App] Loading board state. Saved: ${saved.length}, DOM tiles: ${tiles.length}`,
  );
  saved.forEach((done, i) => {
    if (done && tiles[i] && !tiles[i].classList.contains("free")) {
      tiles[i].classList.add("completed");
    }
  });

  initMultiplayer();

  const initialScore = game.calculateLocalScore();
  Logger.log(`[App] Initial score calculated: ${initialScore}`);
  game.addPlayer(PLAYER_ID, myName, myIcon, initialScore);

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
      multiplayer.updateProfile(myName, myIcon);
      multiplayer.broadcast({
        type: "PROFILE_UPDATE",
        id: PLAYER_ID,
        name: myName,
        icon: myIcon,
        score,
        lastSeen: Date.now(),
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

  // Nuke Button
  const nukeBtn = document.getElementById("nuke-button");
  if (nukeBtn) {
    nukeBtn.onclick = () => {
      if (
        confirm("Permanently delete ALL local data? This cannot be undone.")
      ) {
        window.fullReset();
      }
    };
  }

  // Privacy Policy Modal Logic
  const privacyLink = document.getElementById("privacy-link");
  if (privacyLink) {
    privacyLink.onclick = async () => {
      const target = document.getElementById("privacy-content-target");
      UI.toggleModal("privacy-modal", true);

      try {
        if (target.innerHTML.includes("Loading")) {
          const response = await fetch("privacy.html");
          const html = await response.text();
          // Extract content between <body> tags or specific container
          const parser = new DOMParser();
          const doc = parser.parseFromString(html, "text/html");
          const content = doc.querySelector(".privacy-container") || doc.body;

          // Remove the "Back to Bingo" link if it exists in the fetched content
          const backLink = content.querySelector(".back-link");
          if (backLink) backLink.remove();

          target.innerHTML = content.innerHTML;
        }
      } catch (e) {
        target.innerHTML =
          "<p>Error loading privacy policy. Please try again later.</p>";
      }
    };
  }

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
    multiplayer.broadcast({
      type: "SCORE",
      id: PLAYER_ID,
      name: myName,
      icon: myIcon,
      score,
      lastSeen: Date.now(),
    });
  };
});

window.fullReset = () => {
  Storage.clear();
  window.location.href = window.location.origin + window.location.pathname;
};
