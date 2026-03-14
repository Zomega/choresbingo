/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Define Logger globally for top-level script.js execution
global.Logger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

// Pre-mock all dependencies
vi.mock("https://esm.sh/canvas-confetti", () => ({ default: vi.fn() }));
vi.mock("https://esm.sh/qrcode", () => ({ default: { toCanvas: vi.fn() } }));
vi.mock("https://esm.sh/lil-gui", () => ({ default: vi.fn() }));

vi.mock("./multiplayer.js", () => ({
  Multiplayer: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    broadcast: vi.fn(),
    sendTo: vi.fn(),
    updateProfile: vi.fn(),
  })),
}));

vi.mock("./storage.js", () => ({
  Storage: {
    getHostedRoomId: vi.fn(),
    setHostedRoomId: vi.fn(),
    getPlayerId: vi.fn(),
    setPlayerId: vi.fn(),
    getPlayerName: vi.fn(),
    setPlayerName: vi.fn(),
    getPlayerIcon: vi.fn(),
    setPlayerIcon: vi.fn(),
    getBoard: vi.fn().mockReturnValue([]),
    setBoard: vi.fn(),
    clear: vi.fn(),
  },
}));

vi.mock("./ui.js", () => ({
  UI: {
    renderBoard: vi.fn(),
    initOnboarding: vi.fn(),
    initModals: vi.fn(),
    updateStatus: vi.fn(),
    refreshShareUI: vi.fn(),
    addPlayerToList: vi.fn(),
    updatePlayerInList: vi.fn(),
    ensureRacer: vi.fn(),
    updateRacer: vi.fn(),
    toggleModal: vi.fn(),
    refreshPlayerStatusUI: vi.fn(),
    getTilesState: vi.fn().mockReturnValue([]),
    renderQR: vi.fn(),
  },
}));

vi.mock("./game.js", () => ({
  Game: vi.fn().mockImplementation(() => ({
    addPlayer: vi.fn(),
    handleData: vi.fn(),
    calculateLocalScore: vi.fn().mockReturnValue(0),
    updatePlayerScore: vi.fn(),
    players: {},
  })),
}));

vi.mock("./i18n.js", () => ({
  initI18n: vi.fn().mockResolvedValue(undefined),
  t: vi.fn((key) => key),
}));

// The critical mock
vi.mock("./utils.js", () => ({
  iconList: ["🏃‍♀️"],
  getDefaultChores: vi.fn().mockReturnValue([{ label: "Test", color: "blue" }]),
  generateHumanReadableUniqueId: vi.fn().mockReturnValue("test-room"),
  Logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

describe("Main Orchestrator (script.js)", () => {
  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();

    document.body.innerHTML = `
      <div id="connection-fab"></div>
      <div id="profile-fab"></div>
      <div id="settings-fab"></div>
      <div class="bingo-grid"></div>
      <div id="connection-room-code"></div>
      <div id="settings-lil-gui"></div>
      <button id="settings-save-button"></button>
      <button id="connection-share-button"></button>
      <span id="connection-share-icon"></span>
      <div id="profile-icon-selector"></div>
      <input id="profile-name-input" />
      <button id="profile-save-button"></button>
      <button id="nuke-button"></button>
      <button id="privacy-link"></button>
      <div id="privacy-modal" class="hidden modal">
        <div id="privacy-content-target"></div>
      </div>
    `;
  });

  it("should initialize the application on DOMContentLoaded", async () => {
    // Import inside test AFTER mocks are fully established
    await import("./script.js");

    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const { Multiplayer } = await import("./multiplayer.js");
    const { UI } = await import("./ui.js");

    expect(Multiplayer).toHaveBeenCalled();
    expect(UI.initModals).toHaveBeenCalled();
  });

  it("should handle tile clicks", async () => {
    await import("./script.js");
    document.dispatchEvent(new Event("DOMContentLoaded"));
    await new Promise((resolve) => setTimeout(resolve, 0));

    const grid = document.querySelector(".bingo-grid");
    const tile = document.createElement("div");
    tile.className = "tile";
    grid.appendChild(tile);

    tile.click();

    const { Storage } = await import("./storage.js");
    expect(Storage.setBoard).toHaveBeenCalled();
  });
});
