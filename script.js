import confetti from "https://esm.sh/canvas-confetti";
import QRCode from "https://esm.sh/qrcode";
import { Peer } from "https://esm.sh/peerjs";
import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "https://esm.sh/unique-names-generator";
import lilGui from "https://esm.sh/lil-gui";

// e.g. dependent-emerald-youngest-python
function generateHumanReadableUniqueId() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, adjectives, animals],
    separator: "-",
    length: 4,
    style: "lowerCase",
  });
}

const getThemeColor = (varName) => {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
};

// --- HOST SETTINGS STATE ---
// TODO: We should get / store this in local settings.
// TODO: These specific settings are nonsense.
const gameSettings = {
  lockoutMode: false,
  trackLength: 100,
  showPlayerLabels: true,
  resetRace: function () {
    if (confirm("Reset race for everyone?")) {
      broadcast({ type: "RESET_COMMAND" });
      location.reload();
    }
  },
};

// --- CONFIG & STATE ---
const urlParams = new URLSearchParams(window.location.search);
const JOIN_ID = urlParams.get("room"); // The target room from the URL
const isHost = !JOIN_ID;

let ROOM_ID = JOIN_ID; // This will hold the active room name
const savedHostId = localStorage.getItem("hosted_room_id");

if (isHost) {
  ROOM_ID = savedHostId || generateHumanReadableUniqueId();
  localStorage.setItem("hosted_room_id", ROOM_ID);
}

let PLAYER_ID =
  localStorage.getItem("player_id") ||
  uniqueNamesGenerator({
    dictionaries: [adjectives, animals],
    separator: " ",
    style: "capital",
  });
localStorage.setItem("player_id", PLAYER_ID);

let myName = localStorage.getItem("player_name") || PLAYER_ID;
localStorage.setItem("player_name", myName);

const iconList = [
  "🏃‍♀️",
  "🏃‍♂️",
  "🚶‍♂️",
  "🛹",
  "🚲",
  "🛵",
  "🏎️",
  "🚁",
  "🚀",
  "🛸",
  "🦄",
  "🦖",
  "🐙",
  "🐝",
  "👻",
  "🤖",
  "🧙‍♂️",
  "🧜‍♀️",
  "🐱",
  "🐶",
];
let myIcon = localStorage.getItem("player_icon");
if (!myIcon) {
  // Pick a random one once and save it forever
  myIcon = iconList[Math.floor(Math.random() * iconList.length)];
  localStorage.setItem("player_icon", myIcon);
}

let peer,
  connections = [];
let players = {};
let heartbeatInterval = null;
let reconnectionInterval = null;
const HEARTBEAT_MS = 5000;

// --- MULTIPLAYER CORE ---

function getCleanUrl() {
  return window.location.origin + window.location.pathname;
}

function refreshShareUI() {
  if (!ROOM_ID) return;

  const baseUrl = getCleanUrl();
  const joinLink = `${baseUrl}?room=${ROOM_ID}`;

  // 1. Sync URL so it can be refreshed safely
  window.history.replaceState({}, "", `?room=${ROOM_ID}`);

  // 2. Update the room text
  const roomDisplay = document.getElementById("connection-room-code");
  if (roomDisplay) roomDisplay.innerText = ROOM_ID;

  renderQR(joinLink);
}

function updateStatus(isOnline, message) {
  const dot = document.querySelector("#connection-status-dot");
  const text = document.querySelector("#connection-status-text");
  if (!dot || !text) return;

  if (isOnline) {
    dot.classList.add("online");
    text.innerText = message || (isHost ? "Hosting" : "Connected");
  } else {
    dot.classList.remove("online");
    text.innerText = message || "Offline";
  }
}

function refreshPlayerStatusUI() {
  const now = Date.now();
  Object.keys(players).forEach((id) => {
    const dot = document.getElementById(`player-status-dot-${id}`);
    if (!dot) return;

    const msSinceSeen = now - players[id].lastSeen;

    dot.classList.remove("online", "lagging");
    if (msSinceSeen < 10000) {
      dot.classList.add("online");
    } else if (msSinceSeen < 25000) {
      dot.classList.add("lagging");
    }
  });
}

function startHeartbeat() {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(() => {
    players[PLAYER_ID].lastSeen = Date.now();

    if (isHost) {
      const now = Date.now();
      const heartbeatMap = {};

      Object.keys(players).forEach((id) => {
        heartbeatMap[id] = now - players[id].lastSeen;
      });

      broadcast({
        type: "HEARTBEAT_HOST",
        heartbeats: heartbeatMap,
      });
    } else {
      const hostConn = connections.find((c) => c.peer === ROOM_ID);
      if (hostConn && hostConn.open) {
        hostConn.send({ type: "HEARTBEAT_GUEST", id: PLAYER_ID });
      }
    }
    refreshPlayerStatusUI();
  }, HEARTBEAT_MS);
}

function initMultiplayer() {
  // If we are a host, we claim our specific ROOM_ID.
  // If we are a guest, we pass 'null' to get a random unique ID.
  const myPeerId = isHost ? ROOM_ID : null;

  const peerOptions = {
    //debug: 3,
    host: "0.peerjs.com",
    secure: true,
    port: 443,
    pingInterval: 3000,
    config: {
      // Adding Google's public STUN servers helps bypass firewalls/NAT
      iceServers: [{ urls: "stun:stun.l.google.com:19302" }],
    },
  };

  if (peer) peer.destroy();
  peer = new Peer(myPeerId, peerOptions);

  peer.on("open", (id) => {
    console.log("My Personal ID is:", id);
    clearInterval(reconnectionInterval);
    reconnectionInterval = null;

    if (isHost) {
      ROOM_ID = id;
      addPlayer(PLAYER_ID, myName, myIcon);
    } else {
      console.log(`Connecting to Host: ${ROOM_ID}`);
      const conn = peer.connect(ROOM_ID, { reliable: true });
      setupConn(conn);
    }
    startHeartbeat();
    refreshShareUI();
    updateStatus(true);
  });

  peer.on("connection", setupConn);

  // Signaling server disconnected (e.g. Wi-Fi blip)
  peer.on("disconnected", () => {
    updateStatus(false, "Server Disconnected");
    // TODO: Put this on an interval...
    peer.reconnect();
  });

  peer.on("error", (err) => {
    updateStatus(false, "Connection Error");
    console.error("PeerJS Error:", err.type);

    // If Host's ID is taken (or still locked from a refresh),
    // or if Guest failed to find the Peer, start the 10s retry loop.
    if (!reconnectionInterval) {
      console.log("Starting 10s reconnection loop...");
      reconnectionInterval = setInterval(() => {
        console.log("Attempting to re-acquire connection...");
        initMultiplayer();
      }, 10000);
    }
  });
}

function setupConn(conn) {
  // Prevent duplicate connections from piling up
  if (connections.find((c) => c.peer === conn.peer)) return;
  connections.push(conn);

  conn.on("open", () => {
    if (!isHost && reconnectionInterval) {
      clearInterval(reconnectionInterval);
      reconnectionInterval = null;
    }

    updateStatus(true);
    conn.send({
      type: "JOIN",
      id: PLAYER_ID,
      name: myName,
      icon: myIcon,
      score: calculateScore(),
    });
  });

  conn.on("data", (data) => {
    console.log("Peer Data Received:", data.type, data);

    switch (data.type) {
      case "HEARTBEAT_GUEST":
        if (isHost && players[data.id]) {
          players[data.id].lastSeen = Date.now();
        }
        break;

      case "HEARTBEAT_HOST":
        // Guests receive relative timing from host
        const now = Date.now();
        Object.entries(data.heartbeats).forEach(([id, relativeMs]) => {
          if (players[id]) {
            players[id].lastSeen = now - relativeMs;
          }
        });
        break;
      case "JOIN":
        addPlayer(data.id, data.name, data.icon, data.score);
        if (isHost) {
          // 1. Tell the new person about everyone else
          conn.send({ type: "SYNC", playerData: players });
          // 2. Tell existing guests about the new person
          broadcast(data);
        }
        break;

      case "SYNC":
        // Guests receive the full player list from the Host
        Object.entries(data.playerData).forEach(([id, pData]) => {
          if (id !== PLAYER_ID) {
            addPlayer(id, pData.name, pData.icon, pData.score);
          }
        });
        break;

      case "SCORE":
        updateRacer(data.id, data.score);
        if (isHost) broadcast(data); // Propagate to other guests
        break;

      case "PROFILE_UPDATE":
        // Since we use static IDs, we just update the existing racer
        addPlayer(data.id, data.name, data.icon, data.score || 0);
        if (isHost) broadcast(data); // Propagate to other guests
        break;
    }
  });

  conn.on("close", () => {
    updateStatus(false, "Connection Lost");
    connections = connections.filter((c) => c !== conn);

    if (!isHost) {
      if (reconnectionInterval) return;

      console.log("Starting Guest Reconnection Loop...");
      reconnectionInterval = setInterval(() => {
        console.log("Guest: Attempting to find Host...");
        // We don't call initMultiplayer() here because the Peer is still fine,
        // just the connection to the Host is dead.
        const newConn = peer.connect(ROOM_ID, { reliable: true });
        setupConn(newConn);
      }, 10000);
    }
  });
}

function broadcast(msg) {
  console.log("Broadcasting", msg);
  connections = connections.filter((c) => c.open);
  connections.forEach((c) => c.send(msg));
}

// --- GAME LOGIC ---

function getAllChains(onlyFree = false) {
  const tiles = Array.from(document.querySelectorAll(".tile"));
  const gridSize = 5;
  const grid = [];

  for (let i = 0; i < gridSize; i++) {
    grid.push(
      tiles.slice(i * gridSize, i * gridSize + gridSize).map((tile) => {
        if (onlyFree) return tile.classList.contains("free");
        return (
          tile.classList.contains("completed") ||
          tile.classList.contains("free")
        );
      }),
    );
  }

  const paths = [];
  const getCount = (arr) => arr.filter(Boolean).length;

  for (let r = 0; r < gridSize; r++) paths.push(getCount(grid[r]));
  for (let c = 0; c < gridSize; c++)
    paths.push(getCount(grid.map((row) => row[c])));
  paths.push(getCount(grid.map((row, i) => row[i])));
  paths.push(getCount(grid.map((row, i) => row[gridSize - 1 - i])));

  return paths.sort((a, b) => b - a);
}

function calculateScore() {
  let currentChains = getAllChains(false);
  let freeChains = getAllChains(true);

  const getRawScore = (chains) => {
    let base = chains[0] * 20;
    let tieBreaker = 0;
    for (let i = 1; i < chains.length; i++) {
      tieBreaker += 20 * (chains[i] / Math.pow(2, i) / chains[0]);
    }
    return base + tieBreaker;
  };

  if (currentChains[0] >= 5) return 100;

  const currentRaw = getRawScore(currentChains);
  const startOffset = getRawScore(freeChains);
  let progress = ((currentRaw - startOffset) / (100 - startOffset)) * 100;

  return Math.min(99, Math.max(0, progress));
}

function updateRacer(id, score, name, icon) {
  // If the player isn't on the track yet, add them
  if (!players[id]) {
    addPlayer(id, name || "Unknown", icon || "🏃", score);
  }

  const data = players[id];
  // Update state with any new info provided in the arguments
  if (score !== undefined) data.score = score;
  if (name) data.name = name;
  if (icon) data.icon = icon;

  const racer = document.querySelector(`.racer-icon[data-id="${id}"]`);
  if (racer) {
    // 1. Move the racer
    racer.style.left = data.score + "%";

    // 2. Update the emoji (first span)
    const iconSpan = racer.querySelector("span:first-child");
    if (iconSpan) iconSpan.innerText = data.icon;

    // 3. Update the name (the label span)
    const labelSpan = racer.querySelector(".racer-label");
    if (labelSpan) labelSpan.innerText = data.name;
  }

  if (data.score >= 100) triggerVictory(data.name);

  // Update the green progress bar ONLY if it's the local player
  if (id === PLAYER_ID) {
    const progressBar = document.querySelector(".progress");
    if (progressBar) progressBar.style.width = `${data.score}%`;
  }
}

function ensureRacer(id, name, icon) {
  // Check if this racer already exists by ID
  if (document.querySelector(`.racer-icon[data-id="${id}"]`)) return;

  const track = document.querySelector(".track");
  const div = document.createElement("div");
  div.className = "racer-icon";
  div.setAttribute("data-id", id); // Use the stable ID here
  div.style.left = "0%";

  // order: 1. Icon Emoji, 2. Name Label
  div.innerHTML = `<span>${icon}</span><span class="racer-label">${name}</span>`;
  track.appendChild(div);
}

function addPlayer(id, name, icon, score = 0) {
  // Use local score if this is me
  score = id === PLAYER_ID ? calculateScore() : score;

  // 1. Update or Create the state object
  if (!players[id]) {
    players[id] = {
      name,
      icon,
      score,
      lastSeen: Date.now(),
    };

    // 2. Add to the UI List (only if new)
    const li = document.createElement("li");
    li.id = `li-${id}`;
    // Added a span for the status dot and a span for the name
    li.innerHTML = `
      <div class="status-dot online" id="player-status-dot-${id}"></div>
      <span class="player-name-text">${name}</span>
    `;
    document.getElementById("player-list").appendChild(li);
  } else {
    // Just update existing state
    players[id].name = name;
    players[id].icon = icon;
    players[id].score = score;

    const nameSpan = document.querySelector(`#li-${id} .player-name-text`);
    if (nameSpan) nameSpan.innerText = name;
  }

  // 3. Update the track
  ensureRacer(id, name, icon);
  updateRacer(id, score, name, icon);
}

async function renderQR(url) {
  const qrContainer = document.getElementById("connection-qrcode");
  qrContainer.innerHTML = ""; // Clear loader/previous code

  // 1. Create a canvas element
  const canvas = document.createElement("canvas");
  qrContainer.appendChild(canvas);

  try {
    // 2. Use the modern async API
    await QRCode.toCanvas(canvas, url, {
      width: 160,
      margin: 2,
      color: {
        dark: getThemeColor("--text") || "#000",
        light: getThemeColor("--bg-color") || "#fff",
      },
      errorCorrectionLevel: "Q",
    });
  } catch (e) {
    console.error("QR Generation failed:", e);
    qrContainer.innerHTML = `<a href="${url}" target="_blank">Click here for Join Link</a>`;
  }
}

function triggerVictory(name) {
  confetti({
    particleCount: 150,
    spread: 70,
    origin: { y: 0.6 },
    colors: [
      getThemeColor("--tile-red-fill"),
      getThemeColor("--tile-green-fill"),
      getThemeColor("--tile-blue-fill"),
    ],
  });
}

// --- INIT ---

document.addEventListener("DOMContentLoaded", () => {
  initMultiplayer();
  initConnectionModal();
  initProfileModal();
  initSettingsModal();

  // Load Local State
  const saved = JSON.parse(localStorage.getItem("my_board") || "[]");
  const tiles = document.querySelectorAll(".tile");
  saved.forEach(
    (done, i) =>
      done &&
      !tiles[i].classList.contains("free") &&
      tiles[i].classList.add("completed"),
  );

  const grid = document.querySelector(".bingo-grid");
  grid.addEventListener("click", (e) => {
    const tile = e.target.closest(".tile");
    if (!tile || tile.classList.contains("free")) return;
    tile.classList.toggle("completed");

    // Save state
    const state = Array.from(tiles).map((t) =>
      t.classList.contains("completed"),
    );
    localStorage.setItem("my_board", JSON.stringify(state));

    const score = calculateScore();
    updateRacer(PLAYER_ID, score);
    broadcast({ type: "SCORE", id: PLAYER_ID, score: score });
  });

  const initialScore = calculateScore();
  addPlayer(PLAYER_ID, myName, myIcon, initialScore);
  updateRacer(PLAYER_ID, initialScore);
});

document.querySelectorAll(".close-btn").forEach((btn) => {
  btn.addEventListener("click", (e) => {
    e.currentTarget.closest(".modal").classList.add("hidden");
  });
});

document.getElementById("connection-fab").addEventListener("click", () => {
  console.log("Invite FAB clicked.");

  const modal = document.getElementById("connection-modal");
  modal.classList.toggle("hidden");
});

document.getElementById("profile-fab").addEventListener("click", () => {
  console.log("Profile FAB clicked.");

  const modal = document.getElementById("profile-modal");
  modal.classList.toggle("hidden");
});

document.getElementById("settings-fab").addEventListener("click", () => {
  console.log("Settings FAB clicked.");

  const modal = document.getElementById("settings-modal");
  modal.classList.toggle("hidden");
});

function initSettingsModal() {
  // Even if not the host, we might want local settings later
  // but for now, we can hide the FAB or the content if not isHost
  if (!isHost) {
    document.getElementById("settings-lil-gui").innerHTML =
      "<p>Only the Host can modify game rules.</p>";
    return;
  }

  const gui = new lilGui({
    container: document.getElementById("settings-lil-gui"),
    title: "Game Rules",
  });

  // --- Settings State ---
  window.gameSettings = {
    lockoutMode: false,
    trackTheme: "standard",
    difficulty: "normal",
    winningLineCount: 1, // Require 1 bingo, or maybe 3?
    broadcastRules: function () {
      // TODO: Is this really the correct way to handle this? How do we reset the values if changes are abandoned?
      broadcast({
        type: "RULE_CHANGE",
        settings: {
          lockoutMode: this.lockoutMode,
          trackTheme: this.trackTheme,
        },
      });
    },
  };

  // --- Add Controls ---
  gui.add(window.gameSettings, "lockoutMode").name("Lockout Mode");

  gui
    .add(window.gameSettings, "trackTheme", [
      "standard",
      "neon",
      "retro",
      "dark",
    ])
    .name("Track Style")
    .onChange((val) => {
      // Local visual update for the host
      document.body.setAttribute("data-theme", val);
    });

  gui
    .add(window.gameSettings, "difficulty", ["easy", "normal", "hard"])
    .name("Difficulty");

  // --- Trigger Logic ---
  document.getElementById("settings-save-button").onclick = () => {
    window.gameSettings.broadcastRules();
    document.getElementById("settings-modal").classList.add("hidden");
  };
}

function initConnectionModal() {
  const shareBtn = document.getElementById("connection-share-button");
  const shareIcon = document.getElementById("connection-share-icon");

  // Check if Web Share API is available
  const canShare = !!navigator.share;

  if (!canShare) {
    // Swap to Copy icon and update tooltip
    shareIcon.innerText = "content_copy";
    shareBtn.setAttribute("data-tooltip", "Copy Link");
  }

  shareBtn.addEventListener("click", async () => {
    const baseUrl = getCleanUrl();
    const fullUrl = `${baseUrl}?room=${ROOM_ID}`;

    if (canShare) {
      try {
        await navigator.share({
          title: "Cleaning Bingo!",
          text: `Join my cleaning crew! Room: ${ROOM_ID}`,
          url: fullUrl,
        });
      } catch (err) {
        // If user cancelled share, we don't need to do anything
        if (err.name !== "AbortError") console.error(err);
      }
    } else {
      // Fallback: Copy to Clipboard
      try {
        await navigator.clipboard.writeText(fullUrl);

        // Visual feedback for copy
        const originalIcon = shareIcon.innerText;
        shareIcon.innerText = "check";
        setTimeout(() => (shareIcon.innerText = originalIcon), 2000);
      } catch (err) {
        console.error("Copy failed", err);
      }
    }
  });
}

function fullReset() {
  localStorage.clear();
  const cleanUrl = window.location.origin + window.location.pathname;
  window.history.replaceState({}, document.title, cleanUrl);
  window.location.reload();
}
window.fullReset = fullReset;

function initProfileModal() {
  const grid = document.getElementById("profile-icon-selector");
  const nameInput = document.getElementById("profile-name-input");
  nameInput.value = myName;

  // Render Icons
  iconList.forEach((icon) => {
    const span = document.createElement("span");
    span.className = `icon-option ${icon === myIcon ? "selected" : ""}`;
    span.innerText = icon;
    span.onclick = () => {
      document
        .querySelectorAll(".icon-option")
        .forEach((el) => el.classList.remove("selected"));
      span.classList.add("selected");
      myIcon = icon;
    };
    grid.appendChild(span);
  });

  document.getElementById("profile-save-button").onclick = () => {
    const newName = nameInput.value.trim() || "Player";

    myName = newName;
    localStorage.setItem("player_name", myName);
    localStorage.setItem("player_icon", myIcon);

    // Use updateRacer to handle the local UI update correctly
    updateRacer(PLAYER_ID, calculateScore(), myName, myIcon);

    broadcast({
      type: "PROFILE_UPDATE",
      id: PLAYER_ID,
      name: myName,
      icon: myIcon,
      score: calculateScore(),
    });

    document.getElementById("profile-modal").classList.add("hidden");
  };
}

window.addEventListener("beforeunload", () => {
  if (peer) {
    peer.destroy();
  }
});
