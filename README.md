# ROCKS 2.0 — The Cinematic Elimination Draw

A static browser-based elimination draw for Discord ORGs, with a tribal-inspired cinematic reveal.

## Run

Open `index.html` in a modern browser, or publish this folder to GitHub Pages. No build process or backend is required.

## Features

- Fair, cryptographically secure unbiased Fisher–Yates shuffle with rejection sampling
- Exactly one purple rock, locked before the first reveal
- Automated opening, player introduction, rock toss, safe reveals, final-two suspense, elimination
- Three timing presets, with Standard targeting about one minute for ordinary rosters
- Synthesized cinematic audio cues, opt-in via Sound toggle
- Fullscreen presentation of the arena for screen sharing
- Replay of the same outcome without rerandomization
- Last 25 completed draws stored locally in browser localStorage
- Player editing locked during draw and until returning to roster
- Reduced-motion support

## Notes

Browser autoplay policies require a user gesture to enable sound. Sound is disabled by default. Draw history is local to the current browser and can be cleared. The app does not send player names to a server. Timing is approximate and varies with roster size and device performance.

## Validation

Run `node --check app.js` for a syntax check. Verify a two-player draw, a large roster, replay, fullscreen, sound toggle, and history persistence manually in a browser.
