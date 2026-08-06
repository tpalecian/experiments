# AGENTS.md

## Cursor Cloud specific instructions

This is a fully client-side browser game (Vite + TypeScript + Three.js). There is no backend, database, or external service — everything runs in the browser.

### Services

- Single service: the Vite dev server. Start it with `npm run dev` (serves on `http://localhost:5173/`, already configured with `host: true` in `vite.config.ts` so it is reachable inside the VM). Hot module reload is on by default.

### Lint / test / build / run

- No dedicated lint script. Type checking is the lint gate: `npx tsc --noEmit` (also runs as the first step of `npm run build`).
- Tests: `npm run smoke` runs a headless engine/atmosphere/tween/style smoke test via `tsx` (no browser needed). This is the fastest way to validate the game engine logic.
- Build: `npm run build` (`tsc && vite build`). The Three.js bundle is ~640 kB; the "chunks larger than 500 kB" Vite warning is expected and not an error.
- Run (dev): `npm run dev`. Preview a production build with `npm run preview`.

### Notes

- The game is local hotseat only. To reach playable state in the UI you must first pick a map size and player count in the lobby, then click "Start Game" before the board renders.
