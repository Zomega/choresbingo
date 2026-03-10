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
