/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UI } from "./ui.js";

vi.mock("./i18n.js", () => ({
  t: vi.fn((key) => `T_${key}`), // Prefix makes every key unique and identifiable
  initI18n: vi.fn().mockResolvedValue(undefined),
}));

describe("UI Module", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="connection-status-dot"></div>
      <div id="connection-status-text"></div>
      <ul id="player-list"></ul>
      <div class="track"></div>
      <div class="progress" style="width: 0%;"></div>
      <div id="profile-modal" class="hidden modal">
        <button class="close-btn"></button>
      </div>
      <div id="settings-modal" class="hidden modal">
        <button class="close-btn"></button>
      </div>
      <div class="bingo-grid"></div>
      <div id="settings-lil-gui"></div>
      <button id="settings-save-button"></button>
      <button id="connection-share-button"></button>
      <span id="connection-share-icon"></span>
      <div id="connection-qrcode"></div>
      <p id="connection-room-code"></p>
      <div id="profile-icon-selector"></div>
      <input id="profile-name-input" />
      <button id="profile-save-button"></button>
    `;

    global.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (prop) => `#${prop === "--text" ? "000000" : "ffffff"}`,
    });

    Object.defineProperty(global.navigator, "share", {
      value: vi.fn(),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global.navigator, "clipboard", {
      value: { writeText: vi.fn() },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should update connection status with unique i18n strings", () => {
    const text = document.getElementById("connection-status-text");
    UI.updateStatus(true, true);
    expect(text.innerText).toBe("T_status.hosting");

    UI.updateStatus(true, false);
    expect(text.innerText).toBe("T_status.connected");

    UI.updateStatus(false, false);
    expect(text.innerText).toBe("T_status.offline");
  });

  it("should render bingo board correctly", () => {
    UI.renderBoard([{ label: "Task", color: "red", isFree: false }]);
    const tile = document.querySelector(".tile");
    expect(tile.innerText).toBe("Task");
    expect(tile.classList.contains("red")).toBe(true);
    expect(tile.classList.contains("free")).toBe(false);
  });

  it("should handle profile update strictly", () => {
    const onProfileUpdate = vi.fn();
    UI.initModals({
      storage: { getPlayerName: () => "User", getPlayerIcon: () => "🏃" },
      iconList: ["🏃"],
      onProfileUpdate,
    });
    const input = document.getElementById("profile-name-input");
    input.value = "  TrimMe  ";
    document.getElementById("profile-save-button").click();
    expect(onProfileUpdate).toHaveBeenCalledWith("TrimMe");
    expect(document.getElementById("profile-modal").classList.contains("hidden")).toBe(true);
  });

  it("should handle close buttons strictly", () => {
    UI.initModals({ storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() }, iconList: [] });
    const modal = document.getElementById("settings-modal");
    modal.classList.remove("hidden");
    modal.querySelector(".close-btn").click();
    expect(modal.classList.contains("hidden")).toBe(true);
  });

  it("should handle settings save with strict constants", () => {
    const broadcast = vi.fn();
    UI.initModals({
      isHost: true,
      multiplayer: { broadcast },
      lilGui: vi.fn().mockImplementation((cfg) => {
        expect(cfg.title).toBe("T_modals.settings.title");
        return {
          add: vi.fn().mockReturnThis(),
          name: vi.fn().mockReturnThis(),
          onChange: vi.fn().mockReturnThis(),
        };
      }),
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });
    document.getElementById("settings-save-button").click();
    expect(broadcast).toHaveBeenCalledWith({
      type: "RULE_CHANGE",
      settings: expect.objectContaining({ lockoutMode: false }),
    });
  });

  it("should handle sharing logic with strict messages", async () => {
    const options = {
      roomId: "room123",
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    };
    UI.initModals(options);
    await document.getElementById("connection-share-button").onclick();
    expect(global.navigator.share).toHaveBeenCalledWith({
      title: "T_app.title",
      text: "T_app.invite_message",
      url: expect.stringContaining("room123"),
    });
  });

  it("should handle racer updates and victory strictly", () => {
    UI.ensureRacer("p1", "User", "🏃");
    const onVictory = vi.fn();
    const players = { p1: { name: "User", icon: "🏃", score: 100 } };
    
    UI.updateRacer("p1", 100, "User", "🏃", players, true, onVictory);
    
    const racer = document.querySelector('.racer-icon[data-id="p1"]');
    expect(racer.style.left).toBe("100%");
    expect(racer.querySelector("span:first-child").innerText).toBe("🏃");
    expect(racer.querySelector(".racer-label").innerText).toBe("User");
    expect(onVictory).toHaveBeenCalledWith("User");
  });

  it("should handle victory confetti with strict colors", () => {
    const confetti = vi.fn();
    UI.triggerVictory("Winner", confetti);
    expect(confetti).toHaveBeenCalledWith(
      expect.objectContaining({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 },
        colors: ["#ffffff", "#ffffff", "#ffffff"],
      }),
    );
  });

  it("should handle QR rendering with strict constants", async () => {
    const QRCode = { toCanvas: vi.fn().mockResolvedValue(undefined) };
    await UI.renderQR("url", QRCode);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      "url",
      expect.objectContaining({ width: 160, errorCorrectionLevel: "Q" })
    );
  });

  it("should handle missing racer gracefully", () => {
    // Should not throw even if racer not in DOM
    expect(() => UI.updateRacer("unknown", 50, "N", "I", {}, false)).not.toThrow();
  });

  it("should handle duplicate racers gracefully", () => {
    UI.ensureRacer("p1", "User", "🏃");
    const initialCount = document.querySelectorAll(".racer-icon").length;
    UI.ensureRacer("p1", "User", "🏃");
    expect(document.querySelectorAll(".racer-icon").length).toBe(initialCount);
  });

  it("should handle toggleModal when element exists", () => {
    const modal = document.getElementById("profile-modal");
    UI.toggleModal("profile-modal", true);
    expect(modal.classList.contains("hidden")).toBe(false);
    UI.toggleModal("profile-modal", false);
    expect(modal.classList.contains("hidden")).toBe(true);
    UI.toggleModal("profile-modal", null); // Toggle
    expect(modal.classList.contains("hidden")).toBe(false);
  });

  it("should add player to list and update it", () => {
    UI.addPlayerToList("p1", "Old Name");
    const li = document.getElementById("li-p1");
    expect(li).not.toBeNull();
    expect(li.querySelector(".player-name-text").innerText).toBe("Old Name");

    UI.updatePlayerInList("p1", "New Name");
    expect(li.querySelector(".player-name-text").innerText).toBe("New Name");
  });

  it("should refresh player status dots", () => {
    const now = Date.now();
    const players = {
      p1: { lastSeen: now - 1000 },
      p2: { lastSeen: now - 15000 },
    };
    document.body.innerHTML += `
      <div id="player-status-dot-p1"></div>
      <div id="player-status-dot-p2"></div>
    `;
    UI.refreshPlayerStatusUI(players);
    expect(document.getElementById("player-status-dot-p1").classList.contains("online")).toBe(true);
    expect(document.getElementById("player-status-dot-p2").classList.contains("lagging")).toBe(true);
  });

  it("should show restricted settings if not host", () => {
    UI.initModals({
      isHost: false,
      storage: { getPlayerName: () => "User", getPlayerIcon: () => "🏃" },
      iconList: [],
    });
    expect(document.getElementById("settings-lil-gui").innerHTML).toContain("T_modals.settings.restricted");
  });
});
