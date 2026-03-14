import { describe, it, expect, beforeEach, vi } from "vitest";
import i18next from "i18next";

// Mock the backend specifically for i18next
vi.mock("i18next-http-backend", () => ({
  default: {
    type: "backend",
    init: vi.fn(),
    read: (lng, ns, callback) => {
      callback(null, {
        test: {
          key: "Value",
          vars: "Hello {{name}}",
        },
      });
    },
  },
}));

import { initI18n, t } from "./i18n.js";

describe("i18n Module", () => {
  beforeEach(async () => {
    // Reset i18next state
    if (i18next.isInitialized) {
      // i18next doesn't have a great 'reset' but we can re-init
    }
  });

  it("should handle translations once initialized", async () => {
    // Mock fetch just in case, though backend class should handle it
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve({}),
    });

    await initI18n("en");

    expect(t("test.key")).toBe("Value");
    expect(t("test.vars", { name: "World" })).toBe("Hello World");
  });

  it("should return the key if not found", async () => {
    await initI18n("en");
    expect(t("missing.key")).toBe("missing.key");
  });
});
