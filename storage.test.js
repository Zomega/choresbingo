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

  it("should store and retrieve player ID", () => {
    Storage.setPlayerId("p-123");
    expect(Storage.getPlayerId()).toBe("p-123");
  });

  it("should store and retrieve player name", () => {
    Storage.setPlayerName("Dust Bunny");
    expect(Storage.getPlayerName()).toBe("Dust Bunny");
  });

  it("should handle board JSON serialization", () => {
    const board = [true, false, true, false];
    Storage.setBoard(board);
    expect(Storage.getBoard()).toEqual(board);
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
