# Architecture

## Goal
Build a browser-based shogi game with a strict separation between UI and game rules.

## Modules
- `app`: React UI and interaction handling.
- `core`: Pure game logic and rules.
- `bot`: CPU player logic.

## Data Flow
1. UI sends selected move to `core.applyMove`.
2. `core` validates and returns a new immutable game state.
3. UI re-renders from returned state.

## Testing Strategy
- Prioritize tests under `core/tests`.
- Add UI tests only for interaction smoke checks.
