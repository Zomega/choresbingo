import { describe, it, expect, vi } from "vitest";
import * as fc from "fast-check";

// Mock Logger globally for the imported Game module
global.Logger = {
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  debug: vi.fn(),
};

import { Game } from "./game.js";

vi.mock("./utils.js", () => ({
  Logger: {
    log: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

/**
 * A Simulator that mimics the P2P Star Topology of Chores Bingo.
 */
class NetworkSimulator {
  constructor() {
    this.peers = {}; // Map of id -> { game, isOnline }
    this.hostId = null;
  }

  addPeer(id, isHost = false) {
    const game = new Game({
      playerId: id,
      playerName: `Player ${id}`,
      playerIcon: "🏃",
      isHost,
      getTilesState: () => [], // Simplified for integration test
    });

    this.peers[id] = { game, isOnline: true };
    if (isHost) this.hostId = id;

    // Add self to own game state
    game.addPlayer(id, `Player ${id}`, "🏃", 0);
  }

  // Mimics Multiplayer.broadcast() and Game.handleData() logic
  deliver(fromId, data) {
    const fromPeer = this.peers[fromId];
    if (!fromPeer || !fromPeer.isOnline) return;

    Object.entries(this.peers).forEach(([toId, toPeer]) => {
      if (toId === fromId || !toPeer.isOnline) return;

      const isToHost = toId === this.hostId;
      const isFromHost = fromId === this.hostId;

      // In a Star Topology:
      // 1. Guests only send to Host
      // 2. Host sends to everyone (broadcast)
      if (isFromHost || isToHost) {
        toPeer.game.handleData(
          data,
          toPeer.game.isHost,
          (syncMsg) => this.deliver(toId, syncMsg),
          (broadcastMsg) => this.deliver(toId, broadcastMsg),
        );
      }
    });
  }

  updateScore(id, score) {
    const peer = this.peers[id];
    peer.game.updatePlayerScore(id, score);
    this.deliver(id, { type: "SCORE", id, score });
  }

  disconnect(id) {
    this.peers[id].isOnline = false;
  }

  reconnect(id) {
    const peer = this.peers[id];
    peer.isOnline = true;

    if (id !== this.hostId) {
      // Guest sends JOIN on reconnect
      const localPlayer = peer.game.getLocalPlayer();
      this.deliver(id, {
        type: "JOIN",
        id,
        name: localPlayer.name,
        icon: localPlayer.icon,
        score: localPlayer.score,
        lastSeen: Date.now(),
      });
    }
  }
}

describe("P2P State Convergence (Integration)", () => {
  it("should reach identical state across all peers regardless of score churn", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom("UPDATE_SCORE", "DISCONNECT", "RECONNECT"),
            peerIdx: fc.integer({ min: 0, max: 3 }), // 1 Host + 3 Guests
            value: fc.integer({ min: 0, max: 100 }),
          }),
          { minLength: 10, maxLength: 50 },
        ),
        (actions) => {
          const sim = new NetworkSimulator();
          const ids = ["HOST", "G1", "G2", "G3"];
          sim.addPeer("HOST", true);
          sim.addPeer("G1");
          sim.addPeer("G2");
          sim.addPeer("G3");

          actions.forEach((action) => {
            const id = ids[action.peerIdx];
            if (action.type === "UPDATE_SCORE") {
              sim.updateScore(id, action.value);
            } else if (action.type === "DISCONNECT") {
              sim.disconnect(id);
            } else {
              sim.reconnect(id);
            }
          });

          // FINAL SYNC PHASE
          ids.forEach((id) => sim.reconnect(id));
          const hostPeer = sim.peers["HOST"];
          sim.deliver("HOST", {
            type: "SYNC",
            playerData: hostPeer.game.players,
          });

          const hostPlayers = hostPeer.game.players;
          ids.forEach((id) => {
            const peerPlayers = sim.peers[id].game.players;
            expect(Object.keys(peerPlayers).length).toBe(
              Object.keys(hostPlayers).length,
            );
            Object.keys(hostPlayers).forEach((pId) => {
              expect(peerPlayers[pId].score).toBe(hostPlayers[pId].score);
            });
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  it("should synchronize profile updates (names and icons) correctly", () => {
    fc.assert(
      fc.property(
        fc.array(
          fc.record({
            type: fc.constantFrom("UPDATE_PROFILE", "DISCONNECT", "RECONNECT"),
            peerIdx: fc.integer({ min: 0, max: 3 }),
            name: fc.string({ minLength: 1 }),
            icon: fc.constantFrom("🏃", "🚀", "🦄"),
          }),
          { minLength: 10, maxLength: 50 },
        ),
        (actions) => {
          const sim = new NetworkSimulator();
          const ids = ["HOST", "G1", "G2", "G3"];
          sim.addPeer("HOST", true);
          sim.addPeer("G1");
          sim.addPeer("G2");
          sim.addPeer("G3");

          actions.forEach((action) => {
            const id = ids[action.peerIdx];
            if (action.type === "UPDATE_PROFILE") {
              const peer = sim.peers[id];
              peer.game.addPlayer(
                id,
                action.name,
                action.icon,
                peer.game.getLocalPlayer().score,
              );
              sim.deliver(id, {
                type: "PROFILE_UPDATE",
                id,
                name: action.name,
                icon: action.icon,
                score: peer.game.getLocalPlayer().score,
                lastSeen: Date.now(),
              });
            } else if (action.type === "DISCONNECT") {
              sim.disconnect(id);
            } else {
              sim.reconnect(id);
            }
          });

          ids.forEach((id) => sim.reconnect(id));
          const hostPeer = sim.peers["HOST"];
          sim.deliver("HOST", {
            type: "SYNC",
            playerData: hostPeer.game.players,
          });

          const hostPlayers = hostPeer.game.players;
          ids.forEach((id) => {
            const peerPlayers = sim.peers[id].game.players;
            Object.keys(hostPlayers).forEach((pId) => {
              expect(peerPlayers[pId].name).toBe(hostPlayers[pId].name);
              expect(peerPlayers[pId].icon).toBe(hostPlayers[pId].icon);
            });
          });
        },
      ),
      { numRuns: 50 },
    );
  });

  it("should handle host reloads by re-syncing from joining guests", () => {
    const sim = new NetworkSimulator();
    sim.addPeer("HOST", true);
    sim.addPeer("G1");

    sim.updateScore("G1", 50);
    expect(sim.peers["HOST"].game.players["G1"].score).toBe(50);

    // Host reloads (clear state)
    sim.addPeer("HOST", true);
    expect(sim.peers["HOST"].game.players["G1"]).toBeUndefined();

    // G1 reconnects/joins
    sim.reconnect("G1");

    // Host should have reconstructed G1 from the JOIN packet
    expect(sim.peers["HOST"].game.players["G1"].score).toBe(50);
    expect(sim.peers["HOST"].game.players["G1"].name).toBe("Player G1");
  });
});
