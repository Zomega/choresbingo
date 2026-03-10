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
    const template = document.getElementById("tile-template");
    if (!template) return;

    grid.innerHTML = "";
    chores.forEach((chore) => {
      const clone = template.content.cloneNode(true);
      const tile = clone.querySelector(".tile");
      if (chore.color) tile.classList.add(chore.color);
      if (chore.isFree) tile.classList.add("free");
      tile.innerText = chore.label;
      grid.appendChild(clone);
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
      text.innerText =
        message || (isHost ? t("status.hosting") : t("status.connected"));
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
      const iconSpan = racer.querySelector(".racer-emoji");
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
    const template = document.getElementById("racer-template");
    if (!template) return;

    const track = document.querySelector(".track");
    const clone = template.content.cloneNode(true);
    const div = clone.querySelector(".racer-icon");
    div.setAttribute("data-id", id);
    div.style.left = "0%";

    clone.querySelector(".racer-emoji").innerText = icon;
    clone.querySelector(".racer-label").innerText = name;

    track.appendChild(clone);
  },

  addPlayerToList: (id, name) => {
    if (document.getElementById(`li-${id}`)) return;
    const template = document.getElementById("player-list-item-template");
    if (!template) return;

    const clone = template.content.cloneNode(true);
    const li = clone.querySelector("li");
    li.id = `li-${id}`;

    const dot = clone.querySelector(".status-dot");
    dot.id = `player-status-dot-${id}`;
    dot.classList.add("online");

    const nameSpan = clone.querySelector(".player-name-text");
    nameSpan.innerText = name;

    document.getElementById("player-list").appendChild(clone);
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
    if (!qrContainer) return;
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
    const settingsLilGui = document.getElementById("settings-lil-gui");
    if (settingsLilGui) {
      if (!isHost) {
        settingsLilGui.innerHTML = `<p>${t("modals.settings.restricted")}</p>`;
      } else {
        const gui = new lilGui({
          container: settingsLilGui,
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

        gui
          .add(window.gameSettings, "lockoutMode")
          .name(t("modals.settings.lockout_mode"));
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

        const saveBtn = document.getElementById("settings-save-button");
        if (saveBtn) {
          saveBtn.onclick = () => {
            window.gameSettings.broadcastRules();
            UI.toggleModal("settings-modal", false);
          };
        }
      }
    }

    // Connection Modal
    const shareBtn = document.getElementById("connection-share-button");
    const shareIcon = document.getElementById("connection-share-icon");
    const canShare = !!navigator.share;
    if (shareBtn && shareIcon) {
      if (!canShare) {
        shareIcon.innerText = "content_copy";
        shareBtn.setAttribute(
          "data-tooltip",
          t("modals.connection.copy_tooltip"),
        );
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
    }

    // Profile Modal
    const iconGrid = document.getElementById("profile-icon-selector");
    const nameInput = document.getElementById("profile-name-input");
    const profileSaveBtn = document.getElementById("profile-save-button");

    if (iconGrid && nameInput && profileSaveBtn) {
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

      profileSaveBtn.onclick = () => {
        onProfileUpdate(nameInput.value.trim());
        UI.toggleModal("profile-modal", false);
      };
    }

    // Global Close Buttons
    document.querySelectorAll(".close-btn").forEach((btn) => {
      btn.onclick = (e) => {
        const modal = e.currentTarget.closest(".modal");
        if (modal) modal.classList.add("hidden");
      };
    });
  },
};
