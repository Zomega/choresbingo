import { describe, it, expect } from "vitest";
import * as fc from "fast-check";
import { calculateScore } from "./scoring.js";

describe("Scoring Logic (Property-based tests)", () => {
  // Helper to convert a boolean array to the tile state object scoring.js expects
  const toTileState = (bools) =>
    bools.map((isCompleted, i) => ({
      isCompleted,
      isFree: i === 12, // Middle tile is free
    }));

  it("should have a score that increases monotonically as tiles are completed", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 25, maxLength: 25 }),
        fc.integer({ min: 0, max: 24 }),
        (boardBools, indexToComplete) => {
          // Skip if the index is the free space or already completed
          if (indexToComplete === 12 || boardBools[indexToComplete])
            return true;

          const initialTiles = toTileState(boardBools);
          const initialScore = calculateScore(initialTiles);

          const updatedBools = [...boardBools];
          updatedBools[indexToComplete] = true;
          const updatedTiles = toTileState(updatedBools);
          const updatedScore = calculateScore(updatedTiles);

          // The updated score must be >= initial score
          expect(updatedScore).toBeGreaterThanOrEqual(initialScore);
        },
      ),
      { numRuns: 1000 },
    );
  });

  it("should always return 100 if a full row is completed", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), (rowIdx) => {
        const bools = new Array(25).fill(false);
        // Fill a specific row
        for (let i = 0; i < 5; i++) {
          bools[rowIdx * 5 + i] = true;
        }
        const tiles = toTileState(bools);
        expect(calculateScore(tiles)).toBe(100);
      }),
    );
  });

  it("should always return 100 if a full column is completed", () => {
    fc.assert(
      fc.property(fc.integer({ min: 0, max: 4 }), (colIdx) => {
        const bools = new Array(25).fill(false);
        // Fill a specific column
        for (let i = 0; i < 5; i++) {
          bools[i * 5 + colIdx] = true;
        }
        const tiles = toTileState(bools);
        expect(calculateScore(tiles)).toBe(100);
      }),
    );
  });

  it("should return 0 for a board with only the free space", () => {
    const tiles = toTileState(new Array(25).fill(false));
    expect(calculateScore(tiles)).toBe(0);
  });

  it("should calculate correct score for multiple chains (tie-breaker)", () => {
    const bools = new Array(25).fill(false);
    bools[0] = true;
    bools[1] = true;
    bools[5] = true;
    const tiles = toTileState(bools);
    const score = calculateScore(tiles);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
    expect(score.toFixed(4)).toBe("31.8750");
  });

  it("should return a high score for 4 in a row", () => {
    const bools = new Array(25).fill(false);
    for (let i = 0; i < 4; i++) bools[i] = true;
    const tiles = toTileState(bools);
    expect(calculateScore(tiles).toFixed(4)).toBe("81.9375");
  });

  it("should cap progress at 99 if no bingo is reached", () => {
    const bools = new Array(25).fill(true);
    // Block all rows by blocking first tile of each row
    bools[0] = false;
    bools[5] = false;
    bools[10] = false;
    bools[15] = false;
    bools[20] = false;
    // Block all columns by blocking first tile of each column
    bools[1] = false;
    bools[2] = false;
    bools[3] = false;
    bools[4] = false;
    // index 0 already blocks Col 0

    // Diagonals:
    // Diag 1: 0, 6, 12, 18, 24 (0 is blocked)
    // Diag 2: 4, 8, 12, 16, 20 (4 and 20 are blocked)

    const tiles = toTileState(bools);
    const score = calculateScore(tiles);
    expect(score).toBe(99);
  });

  it("should cap progress at 99 even if calculation exceeds it", () => {
    const bools = new Array(25).fill(true);
    // Block tiles to ensure NO bingo but high raw score
    // Block: 0, 1, 2, 3, 4 (Row 0)
    // Block: 5, 10, 15, 20 (Col 0)
    // Remaining: 16 tiles.
    for (let i = 0; i < 5; i++) {
      bools[i] = false; // Row 0
      bools[i * 5] = false; // Col 0
    }
    // Block index 6 to break Diagonal 1: 0, 6, 12, 18, 24
    bools[6] = false;
    // Block index 8 to break Diagonal 2: 4, 8, 12, 16, 20
    bools[8] = false;

    const tiles = toTileState(bools);
    const score = calculateScore(tiles);
    // This board has many chains of 4, progress will be capped at 99
    expect(score).toBe(99);
  });

  it("should cap progress at 0 even if calculation is negative", () => {
    // This is hard to reach with current math as startOffset is base score of free space
    // but we test it anyway
    const tiles = toTileState(new Array(25).fill(false));
    expect(calculateScore(tiles)).toBe(0);
  });

  it("should stay within 0-100 range", () => {
    fc.assert(
      fc.property(
        fc.array(fc.boolean(), { minLength: 25, maxLength: 25 }),
        (bools) => {
          const score = calculateScore(toTileState(bools));
          expect(score).toBeGreaterThanOrEqual(0);
          expect(score).toBeLessThanOrEqual(100);
        },
      ),
    );
  });
});
