import { t } from "./i18n.js";

export function getThemeColor(varName) {
  return getComputedStyle(document.documentElement)
    .getPropertyValue(varName)
    .trim();
}

export const UI = {
  renderBoard: (chores) => {
    const grid = document.querySelector(".bingo-grid");
    if (!grid) return;
    grid.innerHTML = "";
    chores.forEach((chore) => {
      const tile = document.createElement("div");
      tile.className = "tile";
      if (chore.color) tile.classList.add(chore.color);
      if (chore.isFree) tile.classList.add("free");
      tile.innerText = chore.label;
      grid.appendChild(tile);
    });
  },

  getTilesState: () => {
    const tiles = document.querySelectorAll(".tile");
    return Array.from(tiles).map((tile) => ({
      isFree: tile.classList.contains("free"),
      isCompleted: tile.classList.contains("completed"),
    }));
  },

  refreshShareUI: (roomId, QRCode) => {
    const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
    window.history.replaceState({}, "", `?room=${roomId}`);
    const roomDisplay = document.getElementById("connection-room-code");
    if (roomDisplay) roomDisplay.innerText = roomId;
    UI.renderQR(url, QRCode);
  },

  updateStatus: (isOnline, isHost, message) => {
    const dot = document.querySelector("#connection-status-dot");
    const text = document.querySelector("#connection-status-text");
    if (!dot || !text) return;

    if (isOnline) {
      dot.classList.add("online");
      text.innerText = message || (isHost ? t("status.hosting") : t("status.connected"));
    } else {
      dot.classList.remove("online");
      text.innerText = message || t("status.offline");
    }
  },

  refreshPlayerStatusUI: (players) => {
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
  },

  updateRacer: (id, score, name, icon, players, isLocalPlayer, onVictory) => {
    const racer = document.querySelector(`.racer-icon[data-id="${id}"]`);
    if (racer) {
      racer.style.left = score + "%";
      const iconSpan = racer.querySelector("span:first-child");
      if (iconSpan) iconSpan.innerText = icon;
      const labelSpan = racer.querySelector(".racer-label");
      if (labelSpan) labelSpan.innerText = name;
    }

    if (score >= 100 && onVictory) {
      onVictory(name);
    }

    if (isLocalPlayer) {
      const progressBar = document.querySelector(".progress");
      if (progressBar) progressBar.style.width = `${score}%`;
    }
  },

  ensureRacer: (id, name, icon) => {
    if (document.querySelector(`.racer-icon[data-id="${id}"]`)) return;

    const track = document.querySelector(".track");
    const div = document.createElement("div");
    div.className = "racer-icon";
    div.setAttribute("data-id", id);
    div.style.left = "0%";
    div.innerHTML = `<span>${icon}</span><span class="racer-label">${name}</span>`;
    track.appendChild(div);
  },

  addPlayerToList: (id, name) => {
    if (document.getElementById(`li-${id}`)) return;
    const li = document.createElement("li");
    li.id = `li-${id}`;
    li.innerHTML = `
      <div class="status-dot online" id="player-status-dot-${id}"></div>
      <span class="player-name-text">${name}</span>
    `;
    document.getElementById("player-list").appendChild(li);
  },

  updatePlayerInList: (id, name) => {
    const nameSpan = document.querySelector(`#li-${id} .player-name-text`);
    if (nameSpan) nameSpan.innerText = name;
  },

  triggerVictory: (name, confetti) => {
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
  },

  renderQR: async (url, QRCode) => {
    const qrContainer = document.getElementById("connection-qrcode");
    qrContainer.innerHTML = "";
    const canvas = document.createElement("canvas");
    qrContainer.appendChild(canvas);

    try {
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
      qrContainer.innerHTML = `<a href="${url}" target="_blank">${t("connection.join_link")}</a>`;
    }
  },

  toggleModal: (id, show = null) => {
    const modal = document.getElementById(id);
    if (!modal) {
      console.warn(`Modal element with id "${id}" not found.`);
      return;
    }
    if (show === null) {
      modal.classList.toggle("hidden");
    } else if (show) {
      modal.classList.remove("hidden");
    } else {
      modal.classList.add("hidden");
    }
  },

  initModals: (options) => {
    const {
      isHost,
      roomId,
      multiplayer,
      game,
      storage,
      onProfileUpdate,
      lilGui,
    } = options;

    // Settings Modal
    if (!isHost) {
      document.getElementById("settings-lil-gui").innerHTML =
        `<p>${t("modals.settings.restricted")}</p>`;
    } else {
      const gui = new lilGui({
        container: document.getElementById("settings-lil-gui"),
        title: t("modals.settings.title"),
      });
      window.gameSettings = {
        lockoutMode: false,
        trackTheme: "standard",
        difficulty: "normal",
        winningLineCount: 1,
        broadcastRules: function () {
          multiplayer.broadcast({
            type: "RULE_CHANGE",
            settings: {
              lockoutMode: this.lockoutMode,
              trackTheme: this.trackTheme,
            },
          });
        },
      };

      gui.add(window.gameSettings, "lockoutMode").name(t("modals.settings.lockout_mode"));
      gui
        .add(window.gameSettings, "trackTheme", [
          "standard",
          "neon",
          "retro",
          "dark",
        ])
        .name(t("modals.settings.track_style"))
        .onChange((val) => {
          document.body.setAttribute("data-theme", val);
        });
      gui
        .add(window.gameSettings, "difficulty", ["easy", "normal", "hard"])
        .name(t("modals.settings.difficulty"));

      document.getElementById("settings-save-button").onclick = () => {
        window.gameSettings.broadcastRules();
        UI.toggleModal("settings-modal", false);
      };
    }

    // Connection Modal
    const shareBtn = document.getElementById("connection-share-button");
    const shareIcon = document.getElementById("connection-share-icon");
    const canShare = !!navigator.share;
    if (!canShare) {
      shareIcon.innerText = "content_copy";
      shareBtn.setAttribute("data-tooltip", t("modals.connection.copy_tooltip"));
    }
    shareBtn.onclick = async () => {
      const url = `${window.location.origin}${window.location.pathname}?room=${roomId}`;
      if (canShare) {
        try {
          await navigator.share({
            title: t("app.title"),
            text: t("app.invite_message", { roomId }),
            url,
          });
        } catch (err) {
          if (err.name !== "AbortError") console.error(err);
        }
      } else {
        try {
          await navigator.clipboard.writeText(url);
          const originalIcon = shareIcon.innerText;
          shareIcon.innerText = "check";
          setTimeout(() => (shareIcon.innerText = originalIcon), 2000);
        } catch (err) {
          console.error("Copy failed", err);
        }
      }
    };

    // Profile Modal
    const iconGrid = document.getElementById("profile-icon-selector");
    const nameInput = document.getElementById("profile-name-input");
    nameInput.value = storage.getPlayerName();

    options.iconList.forEach((icon) => {
      const span = document.createElement("span");
      span.className = `icon-option ${icon === storage.getPlayerIcon() ? "selected" : ""}`;
      span.innerText = icon;
      span.onclick = () => {
        document
          .querySelectorAll(".icon-option")
          .forEach((el) => el.classList.remove("selected"));
        span.classList.add("selected");
        onProfileUpdate(null, icon);
      };
      iconGrid.appendChild(span);
    });

    document.getElementById("profile-save-button").onclick = () => {
      onProfileUpdate(nameInput.value.trim());
      UI.toggleModal("profile-modal", false);
    };

    // Global Close Buttons
    document.querySelectorAll(".close-btn").forEach((btn) => {
      btn.onclick = (e) => {
        const modal = e.currentTarget.closest(".modal");
        if (modal) modal.classList.add("hidden");
      };
    });
  },
};
