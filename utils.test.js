import { describe, it, expect, vi } from "vitest";

// Mock the external ESM dependencies locally
vi.mock("https://esm.sh/unique-names-generator", () => ({
  uniqueNamesGenerator: vi.fn().mockReturnValue("mock-name"),
  adjectives: {},
  colors: {},
  animals: {},
}));

vi.mock("./i18n.js", () => ({
  t: vi.fn((key) => `localized_${key}`),
}));

import {
  generateHumanReadableUniqueId,
  getDefaultChores,
  iconList,
} from "./utils.js";

describe("Utils Module", () => {
  it("should generate a human readable ID", () => {
    const id = generateHumanReadableUniqueId();
    expect(id).toBe("mock-name");
  });

  it("should return a list of 25 default chores with localized labels", () => {
    const chores = getDefaultChores();
    expect(chores.length).toBe(25);
    expect(chores[0].label).toBe("localized_chores.empty_trash");
    expect(chores[12].isFree).toBe(true);
  });

  it("should export a non-empty icon list", () => {
    expect(iconList.length).toBeGreaterThan(0);
    expect(typeof iconList[0]).toBe("string");
  });
});
