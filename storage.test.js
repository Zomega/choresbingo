/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { Storage } from "./storage.js";

describe("Storage Wrapper", () => {
  beforeEach(() => {
    // Manual mock for localStorage
    let store = {};
    global.localStorage = {
      getItem: vi.fn((key) => store[key] || null),
      setItem: vi.fn((key, value) => {
        store[key] = value.toString();
      }),
      clear: vi.fn(() => {
        store = {};
      }),
      removeItem: vi.fn((key) => {
        delete store[key];
      }),
    };
  });

  it("should store and retrieve player ID with correct key", () => {
    Storage.setPlayerId("p-123");
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "player_id",
      "p-123",
    );
    expect(Storage.getPlayerId()).toBe("p-123");
  });

  it("should store and retrieve player name with correct key", () => {
    Storage.setPlayerName("Dust Bunny");
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "player_name",
      "Dust Bunny",
    );
    expect(Storage.getPlayerName()).toBe("Dust Bunny");
  });

  it("should handle board JSON serialization with correct key", () => {
    const board = [true, false, true, false];
    Storage.setBoard(board);
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "my_board",
      JSON.stringify(board),
    );
    expect(Storage.getBoard()).toEqual(board);
  });

  it("should store and retrieve hosted room ID with correct key", () => {
    Storage.setHostedRoomId("room-abc");
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "hosted_room_id",
      "room-abc",
    );
    expect(Storage.getHostedRoomId()).toBe("room-abc");
  });

  it("should store and retrieve player icon with correct key", () => {
    Storage.setPlayerIcon("🏃");
    expect(global.localStorage.setItem).toHaveBeenCalledWith(
      "player_icon",
      "🏃",
    );
    expect(Storage.getPlayerIcon()).toBe("🏃");
  });

  it("should return empty array for non-existent board", () => {
    expect(Storage.getBoard()).toEqual([]);
  });

  it("should clear all data", () => {
    Storage.setPlayerName("Jane Doe");
    Storage.clear();
    expect(Storage.getPlayerName()).toBeNull();
  });
});
