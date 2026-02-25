# shogi_game

Browser shogi game project.
[![CI Quality Gate](https://github.com/drumsuko1113/codex_test_creategame/actions/workflows/ci.yml/badge.svg)](https://github.com/drumsuko1113/codex_test_creategame/actions/workflows/ci.yml)

## Setup
1. Install dependencies: `npm install`
2. Start dev server: `npm run dev`
3. Run tests: `npm run test`

## CI
- This repository uses GitHub Actions as a quality gate.
- On every `pull_request` and `push`, CI runs:
  1. `npm ci`
  2. `npm run test`
  3. `npm run build`

## Structure
- `app/`: Browser UI (React + TypeScript)
- `core/`: Game rule engine
- `bot/`: CPU player logic
- `server/`: Backend API server (TypeScript)
- `docs/`: Design and rule documents
