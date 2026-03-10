# Chores Bingo Roadmap

## Multiplayer & P2P

- [x] Extract multiplayer logic into a separate module (`multiplayer.js`).
- [ ] Implement robust reconnection logic (Move signaling server reconnection to an interval).
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
- [ ] Improve modal styling and accessibility.
- [ ] Responsive design for all screen sizes.
- [ ] Add tooltips for action buttons.
