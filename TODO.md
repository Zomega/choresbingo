# Chores Bingo Roadmap

## Privacy & Data

- [x] Create `privacy.html` and link from app (Philosophy: Decentralized & Privacy-First).
- [x] Add "Nuke" button in Settings labeled "Delete All Local Data" (clears all storage/cache).
- [ ] Research/Implement Encryption at Rest for sensitive local data.
- [ ] Review TURN server providers for metadata/IP privacy.
- [x] Onboarding: "How your data works" (Privacy Promise slide).
- [x] Ensure full functionality in Offline Mode (consent is optional).

## Multiplayer & P2P

- [x] Extract multiplayer logic into a separate module (`multiplayer.js`).
- [x] Harden reconnection logic (ID re-acquisition and Guest Peer recycling).
- [ ] Add player latency/heartbeat visualization.
- [ ] Mock `Multiplayer` class for automated testing.

## Game Features

- [ ] Store game settings in local storage.
- [ ] Refactor game settings UI to handle abandoned changes correctly.
- [ ] Custom bingo card generation.
- [ ] "Lockout Mode" implementation (Fix placeholder settings).
- [ ] Track themes (Neon, Retro, Dark).
- [ ] Victory screen improvements with confetti.

## Infrastructure

- [x] Host on GitHub Pages (chores.bingo).
- [x] Set up Prettier for code formatting.
- [x] Local development server on port 8005.
- [ ] Automated CI/CD for deployments.

## UI/UX

- [ ] Stylize connection players list (add max height and scroll).
- [x] Improve modal styling and accessibility.
- [ ] Responsive design for all screen sizes.
- [x] Add tooltips for action buttons.
