# Architecture

## Goal
Build a browser-based shogi game with a strict separation between UI and game rules.

## Modules
- `app`: React UI and interaction handling.
- `core`: Pure game logic and rules.
- `bot`: CPU player logic.
- `server` (planned): API + realtime sync + persistence.

## Data Flow
1. UI sends command to `server`.
2. `server` validates actor/turn/session and calls `core.applyMove`.
3. `server` persists new state and emits realtime event.
4. UI re-renders from server snapshot/event.

## Testing Strategy
- Prioritize tests under `core/tests`.
- Add UI tests only for interaction smoke checks.
