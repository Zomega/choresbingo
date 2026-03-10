/** @vitest-environment happy-dom */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock external dependencies
vi.mock("https://esm.sh/canvas-confetti", () => ({
  default: vi.fn(),
}));
vi.mock("https://esm.sh/qrcode", () => ({
  default: { toCanvas: vi.fn() },
}));
vi.mock("https://esm.sh/lil-gui", () => ({
  default: vi.fn(),
}));

// Mock local modules
vi.mock("./multiplayer.js", () => ({
  Multiplayer: vi.fn().mockImplementation(() => ({
    init: vi.fn(),
    broadcast: vi.fn(),
    sendTo: vi.fn(),
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

vi.mock("./utils.js", () => ({
  iconList: ["🏃‍♀️"],
  defaultChores: [{ label: "Test Chore", color: "blue" }],
  generateHumanReadableUniqueId: vi.fn().mockReturnValue("test-room"),
}));

describe("Main Orchestrator (script.js)", () => {
  beforeEach(async () => {
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
    `;

    // Import script.js. Since it adds a listener to DOMContentLoaded,
    // we must ensure it's loaded before we dispatch the event.
    await import("./script.js");
  });

  it("should initialize the application on DOMContentLoaded", async () => {
    document.dispatchEvent(new Event("DOMContentLoaded"));

    const { Multiplayer } = await import("./multiplayer.js");
    const { Game } = await import("./game.js");
    const { UI } = await import("./ui.js");

    expect(Multiplayer).toHaveBeenCalled();
    expect(Game).toHaveBeenCalled();
    expect(UI.initModals).toHaveBeenCalled();

    // Verify FABs
    document.getElementById("connection-fab").click();
    expect(UI.toggleModal).toHaveBeenCalledWith("connection-modal");
  });

  it("should handle tile clicks", async () => {
    document.dispatchEvent(new Event("DOMContentLoaded"));

    const grid = document.querySelector(".bingo-grid");
    const tile = document.createElement("div");
    tile.className = "tile";
    grid.appendChild(tile);

    tile.click();

    const { Storage } = await import("./storage.js");
    expect(Storage.setBoard).toHaveBeenCalled();
  });
});
