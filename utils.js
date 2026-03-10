import {
  uniqueNamesGenerator,
  adjectives,
  colors,
  animals,
} from "https://esm.sh/unique-names-generator";

export const defaultChores = [
  { label: "Empty Trash", color: "green" },
  { label: "Clean Spices" },
  { label: "Vacuum Rug", color: "blue" },
  { label: "Dust TV" },
  { label: "Wipe Remote", color: "red" },

  { label: "Shred Mail" },
  { label: "Donate Coat", color: "green" },
  { label: "Clean Sink" },
  { label: "Toss Cans" },
  { label: "Water Plants" },

  { label: "Organize Shoes" },
  { label: "Clear Desk" },
  { label: "FREE SPACE", isFree: true },
  { label: "Scrub Tub" },
  { label: "Mop Kitchen" },

  { label: "Wipe Mirrors" },
  { label: "Laundry" },
  { label: "Fold Blankets" },
  { label: "Clean Oven" },
  { label: "Sweep Porch" },

  { label: "Empty Dishwasher" },
  { label: "Scrub Toilets" },
  { label: "Fix Lightbulbs" },
  { label: "Sanitize Handles" },
  { label: "Take Out Recycling" },
];

export const iconList = [
  "🏃‍♀️",
  "🏃‍♂️",
  "🚶‍♂️",
  "🛹",
  "🚲",
  "🛵",
  "🏎️",
  "🚁",
  "🚀",
  "🛸",
  "🦄",
  "🦖",
  "🐙",
  "🐝",
  "👻",
  "🤖",
  "🧙‍♂️",
  "🧜‍♀️",
  "🐱",
  "🐶",
];

export function generateHumanReadableUniqueId() {
  return uniqueNamesGenerator({
    dictionaries: [adjectives, colors, adjectives, animals],
    separator: "-",
    length: 4,
    style: "lowerCase",
  });
}
