import { describe, it, expect, vi, beforeEach } from "vitest";
import { Game } from "./game.js";

describe("Game State Machine", () => {
  let game;
  const PLAYER_ID = "me";
  const GUEST_ID = "guest";

  beforeEach(() => {
    game = new Game({
      playerId: PLAYER_ID,
      playerName: "My Name",
      playerIcon: "🏃",
      isHost: true,
      getTilesState: () => [
        { isFree: true, isCompleted: false }, // Simplest mock board
      ],
    });
  });

  it("should add a local player correctly", () => {
    game.addPlayer(PLAYER_ID, "My Name", "🏃", 0);
    const p = game.getLocalPlayer();
    expect(p.name).toBe("My Name");
    expect(p.score).toBe(0); // Score depends on getTilesState mock
  });

  it("should handle JOIN message from a guest", () => {
    const sendSync = vi.fn();
    const broadcast = vi.fn();

    game.handleData(
      { type: "JOIN", id: GUEST_ID, name: "Guest", icon: "🚀", score: 10 },
      true, // isHost
      sendSync,
      broadcast,
    );

    expect(game.players[GUEST_ID]).toBeDefined();
    expect(game.players[GUEST_ID].name).toBe("Guest");
    expect(game.players[GUEST_ID].score).toBe(10);
    expect(sendSync).toHaveBeenCalledWith(
      expect.objectContaining({ type: "SYNC" }),
    );
    expect(broadcast).toHaveBeenCalled();
  });

  it("should update player score on SCORE message", () => {
    game.addPlayer(GUEST_ID, "Guest", "🚀", 0);
    game.handleData(
      { type: "SCORE", id: GUEST_ID, score: 50 },
      true,
      vi.fn(),
      vi.fn(),
    );

    expect(game.players[GUEST_ID].score).toBe(50);
  });

  it("should handle SYNC message from host", () => {
    const hostData = {
      playerData: {
        host: { name: "Host", icon: "👑", score: 80, lastSeen: Date.now() },
        other: { name: "Other", icon: "👤", score: 20, lastSeen: Date.now() },
      },
    };

    game.handleData({ type: "SYNC", ...hostData }, false, vi.fn(), vi.fn());

    expect(game.players["host"]).toBeDefined();
    expect(game.players["host"].name).toBe("Host");
    expect(game.players["other"]).toBeDefined();
    expect(game.players["other"].score).toBe(20);
  });

  it("should update lastSeen on heartbeat", () => {
    game.addPlayer(GUEST_ID, "Guest", "🚀", 0);
    const initialSeen = game.players[GUEST_ID].lastSeen;

    // Simulate some time passing
    vi.useFakeTimers();
    vi.advanceTimersByTime(1000);

    game.handleData(
      { type: "HEARTBEAT_GUEST", id: GUEST_ID },
      true,
      vi.fn(),
      vi.fn(),
    );

    expect(game.players[GUEST_ID].lastSeen).toBeGreaterThan(initialSeen);
    vi.useRealTimers();
  });
});
