/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { UI } from "./ui.js";

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
      <div id="profile-icon-selector"></div>
      <input id="profile-name-input" />
      <button id="profile-save-button"></button>
    `;

    // Mock getComputedStyle
    global.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (prop) => "#000000",
    });

    // Mock navigator
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

  it("should update connection status with correct messages", () => {
    const text = document.getElementById("connection-status-text");
    const dot = document.getElementById("connection-status-dot");

    UI.updateStatus(true, true);
    expect(text.innerText).toBe("Hosting");
    expect(dot.classList.contains("online")).toBe(true);

    UI.updateStatus(true, false);
    expect(text.innerText).toBe("Connected");

    UI.updateStatus(false, false, "Custom Error");
    expect(text.innerText).toBe("Custom Error");
    expect(dot.classList.contains("online")).toBe(false);
  });

  it("should render bingo board with colors and free space", () => {
    UI.renderBoard([
      { label: "G", color: "green" },
      { label: "F", isFree: true },
    ]);
    const tiles = document.querySelectorAll(".tile");
    expect(tiles[0].classList.contains("green")).toBe(true);
    expect(tiles[1].classList.contains("free")).toBe(true);
    expect(tiles[1].innerText).toBe("F");
  });

  it("should handle profile update and trim name", () => {
    const onProfileUpdate = vi.fn();
    const modal = document.getElementById("profile-modal");
    modal.classList.remove("hidden");

    UI.initModals({
      storage: { getPlayerName: () => "Old", getPlayerIcon: () => "🏃" },
      iconList: ["🏃"],
      onProfileUpdate,
    });

    const input = document.getElementById("profile-name-input");
    input.value = "  New Name  ";
    document.getElementById("profile-save-button").click();

    expect(onProfileUpdate).toHaveBeenCalledWith("New Name");
    expect(modal.classList.contains("hidden")).toBe(true);
  });

  it("should handle icon selection and update class", () => {
    const onProfileUpdate = vi.fn();
    const storage = {
      getPlayerName: () => "User",
      getPlayerIcon: () => "🏃",
    };

    UI.initModals({
      storage,
      iconList: ["🚀"],
      onProfileUpdate,
    });

    const iconSpan = document.querySelector(".icon-option");
    iconSpan.click();

    expect(onProfileUpdate).toHaveBeenCalledWith(null, "🚀");
    expect(iconSpan.classList.contains("selected")).toBe(true);
  });

  it("should handle close buttons for any modal", () => {
    UI.initModals({
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });

    const settingsModal = document.getElementById("settings-modal");
    settingsModal.classList.remove("hidden");
    settingsModal.querySelector(".close-btn").click();
    expect(settingsModal.classList.contains("hidden")).toBe(true);
  });

  it("should handle settings save and hide modal", () => {
    const broadcast = vi.fn();
    const modal = document.getElementById("settings-modal");
    modal.classList.remove("hidden");

    UI.initModals({
      isHost: true,
      multiplayer: { broadcast },
      lilGui: vi.fn().mockImplementation(() => ({
        add: vi.fn().mockReturnThis(),
        name: vi.fn().mockReturnThis(),
        onChange: vi.fn().mockReturnThis(),
      })),
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });

    document.getElementById("settings-save-button").click();
    expect(broadcast).toHaveBeenCalledWith(
      expect.objectContaining({ type: "RULE_CHANGE" }),
    );
    expect(modal.classList.contains("hidden")).toBe(true);
  });

  it("should warn if toggleModal target is missing", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
    UI.toggleModal("missing-id");
    expect(spy).toHaveBeenCalledWith(expect.stringContaining("not found"));
    spy.mockRestore();
  });

  it("should handle sharing logic", async () => {
    const options = {
      roomId: "room123",
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    };

    UI.initModals(options);
    const shareBtn = document.getElementById("connection-share-button");

    // 1. Share API
    await shareBtn.onclick();
    expect(global.navigator.share).toHaveBeenCalledWith(
      expect.objectContaining({ url: expect.stringContaining("room123") }),
    );

    // 2. Clipboard Fallback
    delete global.navigator.share;
    UI.initModals(options);
    await shareBtn.onclick();
    expect(global.navigator.clipboard.writeText).toHaveBeenCalledWith(
      expect.stringContaining("room123"),
    );
  });

  it("should show restricted settings if not host", () => {
    const options = {
      isHost: false,
      storage: { getPlayerName: () => "User", getPlayerIcon: () => "🏃" },
      iconList: [],
    };
    UI.initModals(options);
    expect(document.getElementById("settings-lil-gui").innerHTML).toContain(
      "Only the Host",
    );
  });

  it("should refresh player status classes based on time seen", () => {
    const now = Date.now();
    const players = {
      p1: { lastSeen: now - 1000 },
      p2: { lastSeen: now - 15000 },
      p3: { lastSeen: now - 30000 },
    };

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
    const dot3 = document.getElementById("player-status-dot-p3");
    expect(dot3.classList.contains("online")).toBe(false);
    expect(dot3.classList.contains("lagging")).toBe(false);
  });

  it("should update racer and trigger victory", () => {
    UI.ensureRacer("p1", "User", "🏃");
    const onVictory = vi.fn();
    const players = { p1: { name: "User", icon: "🏃", score: 100 } };

    UI.updateRacer("p1", 100, "User", "🏃", players, true, onVictory);

    const racer = document.querySelector('.racer-icon[data-id="p1"]');
    expect(racer.style.left).toBe("100%");
    expect(onVictory).toHaveBeenCalledWith("User");
    expect(document.querySelector(".progress").style.width).toBe("100%");
  });

  it("should update player name in list", () => {
    UI.addPlayerToList("p1", "Old Name");
    UI.updatePlayerInList("p1", "New Name");
    expect(document.querySelector("#li-p1 .player-name-text").innerText).toBe(
      "New Name",
    );
  });

  it("should render QR code", async () => {
    const QRCodeMock = { toCanvas: vi.fn().mockResolvedValue(undefined) };
    document.body.innerHTML += '<div id="connection-qrcode"></div>';

    await UI.renderQR("https://link.com", QRCodeMock);

    expect(QRCodeMock.toCanvas).toHaveBeenCalledWith(
      expect.any(HTMLCanvasElement),
      "https://link.com",
      expect.any(Object),
    );
  });

  it("should handle QR generation failure", async () => {
    const QRCodeMock = {
      toCanvas: vi.fn().mockRejectedValue(new Error("Fail")),
    };
    document.body.innerHTML += '<div id="connection-qrcode"></div>';

    await UI.renderQR("https://link.com", QRCodeMock);

    expect(document.getElementById("connection-qrcode").innerHTML).toContain(
      "Join Link",
    );
  });

  it("should change theme when settings modified", () => {
    let onChangeHandler;
    const lilGuiMock = vi.fn().mockImplementation(() => ({
      add: vi.fn().mockReturnThis(),
      name: vi.fn().mockReturnThis(),
      onChange: vi.fn().mockImplementation((handler) => {
        onChangeHandler = handler;
        return { name: vi.fn() };
      }),
    }));

    UI.initModals({
      isHost: true,
      lilGui: lilGuiMock,
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });

    onChangeHandler("neon");
    expect(document.body.getAttribute("data-theme")).toBe("neon");
  });

  it("should handle sharing clipboard success and visual feedback", async () => {
    delete global.navigator.share;
    const writeTextSpy = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(global.navigator, "clipboard", {
      value: { writeText: writeTextSpy },
      configurable: true,
    });

    vi.useFakeTimers();
    UI.initModals({
      roomId: "r1",
      storage: { getPlayerName: vi.fn(), getPlayerIcon: vi.fn() },
      iconList: [],
    });

    const icon = document.getElementById("connection-share-icon");
    icon.innerText = "content_copy";

    await document.getElementById("connection-share-button").onclick();

    expect(icon.innerText).toBe("check");
    vi.advanceTimersByTime(2000);
    expect(icon.innerText).toBe("content_copy");
    vi.useRealTimers();
  });
});
