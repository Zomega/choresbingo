import { Logger } from "./utils.js";

export function getAllChains(tiles, gridSize = 5, onlyFree = false) {
  const grid = [];

  for (let i = 0; i < gridSize; i++) {
    grid.push(
      tiles.slice(i * gridSize, i * gridSize + gridSize).map((tile) => {
        const isFree = tile.isFree;
        const isCompleted = tile.isCompleted;
        if (onlyFree) return isFree;
        return isCompleted || isFree;
      }),
    );
  }

  const paths = [];
  const getCount = (arr) => arr.filter(Boolean).length;

  for (let r = 0; r < gridSize; r++) paths.push(getCount(grid[r]));
  for (let c = 0; c < gridSize; c++)
    paths.push(getCount(grid.map((row) => row[c])));
  paths.push(getCount(grid.map((row, i) => row[i])));
  paths.push(getCount(grid.map((row, i) => row[gridSize - 1 - i])));

  return paths.sort((a, b) => b - a);
}

export function calculateScore(tiles, gridSize = 5) {
  let currentChains = getAllChains(tiles, gridSize, false);
  let freeChains = getAllChains(tiles, gridSize, true);

  Logger.log(
    `[Scoring] currentChains: ${currentChains}, freeChains: ${freeChains}`,
  );

  const getRawScore = (chains) => {
    if (chains[0] === 0) return 0;
    let base = chains[0] * 20;
    let tieBreaker = 0;
    for (let i = 1; i < chains.length; i++) {
      tieBreaker += 20 * (chains[i] / Math.pow(2, i) / chains[0]);
    }
    return base + tieBreaker;
  };

  if (currentChains[0] >= 5) return 100;

  const currentRaw = getRawScore(currentChains);
  const startOffset = getRawScore(freeChains);
  let progress = ((currentRaw - startOffset) / (100 - startOffset)) * 100;

  return Math.min(99, Math.max(0, progress));
}
