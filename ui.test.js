/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UI } from "./ui.js";

vi.mock("./i18n.js", () => ({
  t: vi.fn((key) => `T_${key}`),
  initI18n: vi.fn().mockResolvedValue(undefined),
}));

describe("UI Module", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <template id="tile-template"><div class="tile"></div></template>
      <template id="player-list-item-template">
        <li><div class="status-dot"></div><span class="player-name-text"></span></li>
      </template>
      <template id="racer-template">
        <div class="racer-icon"><span class="racer-emoji"></span><span class="racer-label"></span></div>
      </template>

      <div id="connection-status-dot"></div>
      <div id="connection-status-text"></div>
      <ul id="player-list"></ul>
      <div class="track"></div>
      <div class="progress" style="width: 0%;"></div>
      
      <div id="profile-modal" class="hidden modal">
        <div id="profile-icon-selector"></div>
        <input id="profile-name-input" />
        <button id="profile-save-button"></button>
        <button class="close-btn"></button>
      </div>
      
      <div id="settings-modal" class="hidden modal">
        <div id="settings-lil-gui"></div>
        <button id="settings-save-button"></button>
        <button class="close-btn"></button>
      </div>

      <div class="bingo-grid"></div>
      
      <button id="connection-share-button"></button>
      <span id="connection-share-icon"></span>
      <div id="connection-qrcode"></div>
      <p id="connection-room-code"></p>
    `;

    global.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (prop) => `#${prop.replace("--", "")}`,
    });

    Object.defineProperty(global.navigator, "share", {
      value: vi.fn().mockResolvedValue(undefined),
      configurable: true,
      writable: true,
    });
    Object.defineProperty(global.navigator, "clipboard", {
      value: { writeText: vi.fn().mockResolvedValue(undefined) },
      configurable: true,
      writable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should update connection status strictly", () => {
    const text = document.getElementById("connection-status-text");
    const dot = document.getElementById("connection-status-dot");
    UI.updateStatus(true, true);
    expect(text.innerText).toBe("T_status.hosting");
    expect(dot.classList.contains("online")).toBe(true);

    UI.updateStatus(false, false, "Err");
    expect(text.innerText).toBe("Err");
    expect(dot.classList.contains("online")).toBe(false);
  });

  it("should render bingo board from template with all properties", () => {
    UI.renderBoard([{ label: "Task", color: "red", isFree: true }]);
    const tile = document.querySelector(".tile");
    expect(tile.innerText).toBe("Task");
    expect(tile.classList.contains("red")).toBe(true);
    expect(tile.classList.contains("free")).toBe(true);
  });

  it("should add player to list and update strictly", () => {
    UI.addPlayerToList("p1", "User");
    const li = document.getElementById("li-p1");
    expect(li).not.toBeNull();

    // dot.id was set to `player-status-dot-${id}` in ui.js
    const dot = document.getElementById("player-status-dot-p1");
    expect(dot).not.toBeNull();
    expect(dot.classList.contains("online")).toBe(true);

    UI.updatePlayerInList("p1", "NewName");
    const nameSpan = li.querySelector(".player-name-text");
    expect(nameSpan.innerText).toBe("NewName");
  });

  it("should update racer strictly and handle victory", () => {
    UI.ensureRacer("p1", "User", "🏃");
    const onVictory = vi.fn();
    const players = { p1: { name: "User", icon: "🏃", score: 100 } };
    UI.updateRacer("p1", 100, "User", "🏃", players, true, onVictory);

    const racer = document.querySelector('.racer-icon[data-id="p1"]');
    expect(racer.style.left).toBe("100%");
    expect(racer.querySelector(".racer-emoji").innerText).toBe("🏃");
    expect(onVictory).toHaveBeenCalledWith("User");
    expect(document.querySelector(".progress").style.width).toBe("100%");
  });

  it("should handle profile updates strictly, including trimming", () => {
    const onProfileUpdate = vi.fn();
    UI.initModals({
      storage: { getPlayerName: () => "Old", getPlayerIcon: () => "🏃" },
      iconList: ["🏃", "🚀"],
      onProfileUpdate,
    });

    // Test Icon Selection strictly
    const icons = document.querySelectorAll(".icon-option");
    icons[1].click();
    expect(onProfileUpdate).toHaveBeenCalledWith(null, "🚀");
    expect(icons[1].classList.contains("selected")).toBe(true);
    expect(icons[0].classList.contains("selected")).toBe(false);

    // Test Save strictly with spaces
    document.getElementById("profile-name-input").value = "  TrimmedName  ";
    document.getElementById("profile-save-button").click();
    expect(onProfileUpdate).toHaveBeenCalledWith("TrimmedName");
    expect(
      document.getElementById("profile-modal").classList.contains("hidden"),
    ).toBe(true);
  });

  it("should handle settings rules and toggle theme strictly", () => {
    const broadcast = vi.fn();
    let themeChangeHandler;
    const lilGui = vi.fn().mockImplementation(() => ({
      add: vi.fn().mockReturnThis(),
      name: vi.fn().mockReturnThis(),
      onChange: vi.fn().mockImplementation((fn) => {
        themeChangeHandler = fn;
        return { name: vi.fn() };
      }),
    }));

    UI.initModals({
      isHost: true,
      multiplayer: { broadcast },
      lilGui,
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });

    // Test theme change
    themeChangeHandler("dark");
    expect(document.body.getAttribute("data-theme")).toBe("dark");

    // Test broadcast
    document.getElementById("settings-save-button").click();
    expect(broadcast).toHaveBeenCalledWith({
      type: "RULE_CHANGE",
      settings: { lockoutMode: false, trackTheme: "standard" },
    });
    expect(
      document.getElementById("settings-modal").classList.contains("hidden"),
    ).toBe(true);
  });

  it("should handle sharing logic strictly", async () => {
    vi.useFakeTimers();
    const options = {
      roomId: "room123",
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    };
    UI.initModals(options);

    const shareBtn = document.getElementById("connection-share-button");
    const shareIcon = document.getElementById("connection-share-icon");

    // 1. Share API strictly
    await shareBtn.onclick();
    expect(global.navigator.share).toHaveBeenCalledWith({
      title: "T_app.title",
      text: "T_app.invite_message",
      url: expect.stringContaining("room123"),
    });

    // 2. Clipboard Fallback strictly
    delete global.navigator.share;
    UI.initModals(options);
    shareIcon.innerText = "original";
    await shareBtn.onclick();
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("room123"),
    );
    expect(shareIcon.innerText).toBe("check");

    vi.advanceTimersByTime(2000);
    expect(shareIcon.innerText).toBe("original");
    vi.useRealTimers();
  });

  it("should handle close buttons for all modals strictly", () => {
    UI.initModals({
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });
    ["profile-modal", "settings-modal"].forEach((id) => {
      const modal = document.getElementById(id);
      modal.classList.remove("hidden");
      modal.querySelector(".close-btn").click();
      expect(modal.classList.contains("hidden")).toBe(true);
    });
  });

  it("should show restricted settings if not host", () => {
    UI.initModals({
      isHost: false,
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });
    expect(document.getElementById("settings-lil-gui").innerHTML).toContain(
      "T_modals.settings.restricted",
    );
  });

  it("should handle QR rendering and failures strictly", async () => {
    const QRCode = { toCanvas: vi.fn().mockResolvedValue(undefined) };
    await UI.renderQR("url", QRCode);
    expect(QRCode.toCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      "url",
      expect.objectContaining({ width: 160, errorCorrectionLevel: "Q" }),
    );

    QRCode.toCanvas.mockRejectedValue(new Error("Fail"));
    await UI.renderQR("url", QRCode);
    expect(document.getElementById("connection-qrcode").innerHTML).toContain(
      "T_connection.join_link",
    );
  });

  it("should refresh player status dots strictly", () => {
    const now = 50000;
    const players = {
      p1: { lastSeen: now - 1000 }, // online
      p2: { lastSeen: now - 15000 }, // lagging
      p3: { lastSeen: now - 30000 }, // offline
    };
    vi.spyOn(Date, "now").mockReturnValue(now);
    document.body.innerHTML += `
      <div id="player-status-dot-p1"></div>
      <div id="player-status-dot-p2"></div>
      <div id="player-status-dot-p3"></div>
    `;
    UI.refreshPlayerStatusUI(players);
    expect(
      document
        .getElementById("player-status-dot-p1")
        .classList.contains("online"),
    ).toBe(true);
    expect(
      document
        .getElementById("player-status-dot-p2")
        .classList.contains("lagging"),
    ).toBe(true);
    expect(
      document
        .getElementById("player-status-dot-p3")
        .classList.contains("online"),
    ).toBe(false);
    expect(
      document
        .getElementById("player-status-dot-p3")
        .classList.contains("lagging"),
    ).toBe(false);
    vi.restoreAllMocks();
  });

  it("should handle missing elements gracefully", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    UI.toggleModal("missing-id", true);
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("not found"));

    // Ensure methods don't throw if elements missing
    document.body.innerHTML = "";
    expect(() => UI.renderBoard([])).not.toThrow();
    expect(() => UI.addPlayerToList("id", "name")).not.toThrow();
    spy.mockRestore();
  });
});
