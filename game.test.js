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
      getTilesState: () => {
        const board = new Array(25)
          .fill(null)
          .map(() => ({ isFree: false, isCompleted: false }));
        board[12] = { isFree: true, isCompleted: false };
        return board;
      },
    });
  });

  it("should add a local player correctly", () => {
    game.addPlayer(PLAYER_ID, "My Name", "🏃", 0);
    const p = game.getLocalPlayer();
    expect(p.name).toBe("My Name");
    expect(p.score).toBe(0);
  });

  it("should calculate local score when adding self", () => {
    game.getTilesState = () => {
      const board = new Array(25).fill({ isFree: false, isCompleted: false });
      for (let i = 0; i < 5; i++)
        board[i] = { isFree: false, isCompleted: true };
      return board;
    };
    game.addPlayer(PLAYER_ID, "Me", "🏃", 0);
    expect(game.players[PLAYER_ID].score).toBe(100);
  });

  it("should handle JOIN message from a guest (as host)", () => {
    const sendSync = vi.fn();
    const broadcast = vi.fn();
    const joinData = {
      type: "JOIN",
      id: GUEST_ID,
      name: "Guest",
      icon: "🚀",
      score: 10,
    };

    game.handleData(joinData, true, sendSync, broadcast);

    expect(game.players[GUEST_ID]).toBeDefined();
    expect(sendSync).toHaveBeenCalledWith({
      type: "SYNC",
      playerData: game.players,
    });
    expect(broadcast).toHaveBeenCalledWith(joinData);
  });

  it("should handle JOIN message from another guest (as guest)", () => {
    const sendSync = vi.fn();
    const broadcast = vi.fn();
    const joinData = {
      type: "JOIN",
      id: GUEST_ID,
      name: "Guest",
      icon: "🚀",
      score: 10,
    };

    game.handleData(joinData, false, sendSync, broadcast);

    expect(game.players[GUEST_ID]).toBeDefined();
    expect(sendSync).not.toHaveBeenCalled();
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("should handle SCORE message (as host)", () => {
    game.addPlayer(GUEST_ID, "Guest", "🚀", 0);
    const broadcast = vi.fn();
    const scoreData = { type: "SCORE", id: GUEST_ID, score: 50 };

    game.handleData(scoreData, true, vi.fn(), broadcast);

    expect(game.players[GUEST_ID].score).toBe(50);
    expect(broadcast).toHaveBeenCalledWith(scoreData);
  });

  it("should NOT broadcast SCORE if not host", () => {
    game.addPlayer(GUEST_ID, "Guest", "🚀", 0);
    const broadcast = vi.fn();
    game.handleData(
      { type: "SCORE", id: GUEST_ID, score: 50 },
      false, // NOT host
      vi.fn(),
      broadcast,
    );

    expect(game.players[GUEST_ID].score).toBe(50);
    expect(broadcast).not.toHaveBeenCalled();
  });

  it("should handle SYNC message strictly", () => {
    const hostData = {
      playerData: {
        host: { name: "Host", icon: "👑", score: 80, lastSeen: 1000 },
      },
    };

    game.handleData({ type: "SYNC", ...hostData }, false, vi.fn(), vi.fn());

    expect(game.players["host"]).toEqual({
      name: "Host",
      icon: "👑",
      score: 80,
      lastSeen: 1000,
    });
  });

  it("should handle PROFILE_UPDATE message (as host)", () => {
    game.addPlayer(GUEST_ID, "Old", "🏃", 0, 1000);
    const broadcast = vi.fn();
    const updateData = {
      type: "PROFILE_UPDATE",
      id: GUEST_ID,
      name: "New",
      icon: "🚀",
      score: 20,
      lastSeen: 1500,
    };

    game.handleData(updateData, true, vi.fn(), broadcast);

    expect(game.players[GUEST_ID].name).toBe("New");
    expect(game.players[GUEST_ID].lastSeen).toBe(1500);
    expect(broadcast).toHaveBeenCalledWith(updateData);
  });

  it("should handle HEARTBEAT_GUEST message (as host)", () => {
    game.addPlayer(GUEST_ID, "Guest", "🚀", 0, 1000);
    const now = 2000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    game.handleData(
      { type: "HEARTBEAT_GUEST", id: GUEST_ID },
      true,
      vi.fn(),
      vi.fn(),
    );

    expect(game.players[GUEST_ID].lastSeen).toBe(now);
    vi.restoreAllMocks();
  });

  it("should NOT update lastSeen on guest heartbeat if not host", () => {
    game.addPlayer(GUEST_ID, "Guest", "🚀", 0, 1000);
    vi.spyOn(Date, "now").mockReturnValue(2000);

    game.handleData(
      { type: "HEARTBEAT_GUEST", id: GUEST_ID },
      false,
      vi.fn(),
      vi.fn(),
    );

    expect(game.players[GUEST_ID].lastSeen).toBe(1000);
    vi.restoreAllMocks();
  });

  it("should NOT update lastSeen if player does not exist (as host)", () => {
    const initialPlayers = { ...game.players };
    game.handleData(
      { type: "HEARTBEAT_GUEST", id: "non-existent" },
      true,
      vi.fn(),
      vi.fn(),
    );
    expect(game.players["non-existent"]).toBeUndefined();
    expect(game.players).toEqual(initialPlayers);
  });

  it("should calculateLocalScore using provided getTilesState", () => {
    game.getTilesState = () =>
      new Array(25).fill({ isFree: true, isCompleted: true });
    expect(game.calculateLocalScore()).toBe(100);
  });

  it("should handle HEARTBEAT_HOST message strictly", () => {
    game.addPlayer(PLAYER_ID, "Me", "🏃", 0, 1000);
    const now = 2000;
    vi.spyOn(Date, "now").mockReturnValue(now);

    const heartbeats = { [PLAYER_ID]: 500 };
    game.handleData(
      { type: "HEARTBEAT_HOST", heartbeats },
      false,
      vi.fn(),
      vi.fn(),
    );

    expect(game.players[PLAYER_ID].lastSeen).toBe(1500); // 2000 - 500
    vi.restoreAllMocks();
  });

  it("should handle RESET_COMMAND message", () => {
    const onReset = vi.fn();
    game.onReset = onReset;
    game.handleData({ type: "RESET_COMMAND" }, false, vi.fn(), vi.fn());
    expect(onReset).toHaveBeenCalled();
  });

  it("should correctly identify local player update", () => {
    const onPlayerUpdate = vi.fn();
    game.onPlayerUpdate = onPlayerUpdate;
    game.addPlayer(PLAYER_ID, "Me", "🏃", 0);
    game.updatePlayerScore(PLAYER_ID, 75);

    expect(onPlayerUpdate).toHaveBeenCalledWith(
      PLAYER_ID,
      expect.objectContaining({ score: 75 }),
      true, // isMe = true
    );
  });

  it("should correctly identify guest player update", () => {
    const onPlayerUpdate = vi.fn();
    game.onPlayerUpdate = onPlayerUpdate;
    game.addPlayer(GUEST_ID, "Guest", "🚀", 0);
    game.updatePlayerScore(GUEST_ID, 25);

    expect(onPlayerUpdate).toHaveBeenCalledWith(
      GUEST_ID,
      expect.objectContaining({ score: 25 }),
      false, // isMe = false
    );
  });

  it("should update existing player in addPlayer and keep reference", () => {
    game.addPlayer(GUEST_ID, "Name 1", "icon1", 10);
    const initialRef = game.players[GUEST_ID];
    game.addPlayer(GUEST_ID, "Name 2", "icon2", 20);
    expect(game.players[GUEST_ID]).toBe(initialRef);
    expect(game.players[GUEST_ID].name).toBe("Name 2");
  });

  it("should use default no-op callbacks if not provided", () => {
    const minimalGame = new Game({ playerId: "me" });
    minimalGame.addPlayer("guest", "Name", "Icon", 10);
    minimalGame.updatePlayerScore("guest", 20);
    minimalGame.handleData({ type: "RESET_COMMAND" }, false, vi.fn(), vi.fn());
    expect(minimalGame.calculateLocalScore()).toBe(0);
  });

  it("should NOT create player on HEARTBEAT_HOST if they don't exist", () => {
    const heartbeats = { unknown: 500 };
    game.handleData(
      { type: "HEARTBEAT_HOST", heartbeats },
      false,
      vi.fn(),
      vi.fn(),
    );
    expect(game.players["unknown"]).toBeUndefined();
  });

  it("should NOT overwrite local player during SYNC", () => {
    // Set mock to return 100 score
    game.getTilesState = () =>
      new Array(25).fill({ isFree: true, isCompleted: true });
    game.addPlayer(PLAYER_ID, "Me", "🏃", 0); // score becomes 100

    const hostData = {
      playerData: {
        [PLAYER_ID]: { name: "Host's version of Me", icon: "🤡", score: 0 },
      },
    };
    game.handleData({ type: "SYNC", ...hostData }, false, vi.fn(), vi.fn());
    expect(game.players[PLAYER_ID].name).toBe("Me");
    expect(game.players[PLAYER_ID].score).toBe(100);
  });
});
