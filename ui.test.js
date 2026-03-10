/** @vitest-environment happy-dom */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { UI } from "./ui.js";

describe("UI Module", () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="connection-status-dot"></div>
      <div id="connection-status-text"></div>
      <ul id="player-list"></ul>
      <div class="track"></div>
      <div class="progress" style="width: 0%;"></div>
      <div id="profile-modal" class="hidden"></div>
    `;

    // Mock getComputedStyle for theme colors
    global.getComputedStyle = vi.fn().mockReturnValue({
      getPropertyValue: (prop) => "#000000",
    });
  });

  it("should update connection status for Host", () => {
    UI.updateStatus(true, true, "Hosting Now");
    const dot = document.getElementById("connection-status-dot");
    const text = document.getElementById("connection-status-text");
    expect(dot.classList.contains("online")).toBe(true);
    expect(text.innerText).toBe("Hosting Now");
  });

  it("should add player to list if not present", () => {
    UI.addPlayerToList("p1", "Duster");
    const li = document.getElementById("li-p1");
    expect(li).not.toBeNull();
    expect(li.innerHTML).toContain("Duster");
  });

  it("should update player name in list", () => {
    UI.addPlayerToList("p1", "Duster");
    UI.updatePlayerInList("p1", "Scrub Master");
    const nameSpan = document.querySelector("#li-p1 .player-name-text");
    expect(nameSpan.innerText).toBe("Scrub Master");
  });

  it("should ensure a racer exists on the track", () => {
    UI.ensureRacer("p1", "Duster", "🏃");
    const racer = document.querySelector('.racer-icon[data-id="p1"]');
    expect(racer).not.toBeNull();
    expect(racer.innerHTML).toContain("Duster");
    expect(racer.innerHTML).toContain("🏃");
  });

  it("should update racer position and label", () => {
    UI.ensureRacer("p1", "Duster", "🏃");
    const players = { p1: { name: "New Name", icon: "🚀", score: 50 } };

    UI.updateRacer("p1", 50, "New Name", "🚀", players, false);

    const racer = document.querySelector('.racer-icon[data-id="p1"]');
    expect(racer.style.left).toBe("50%");
    expect(racer.querySelector(".racer-label").innerText).toBe("New Name");
    expect(racer.querySelector("span:first-child").innerText).toBe("🚀");
  });

  it("should toggle modal visibility", () => {
    UI.toggleModal("profile-modal", true);
    expect(
      document.getElementById("profile-modal").classList.contains("hidden"),
    ).toBe(false);

    UI.toggleModal("profile-modal", false);
    expect(
      document.getElementById("profile-modal").classList.contains("hidden"),
    ).toBe(true);
  });
});
