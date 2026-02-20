# Backend MVP Plan

## Fixed Decisions
- Auth: guest-only
- Database: PostgreSQL
- Match mode: online 1v1

## Product Goal
- Run shogi matches between two online players.
- Keep game state on server so reconnect does not lose progress.
- Persist game records for later retrieval.

## Functional Requirements (MVP)
1. Create a match with time-control settings.
2. Join a match as black/white with a temporary display name.
3. Submit moves to server; server validates using `core.applyMove`.
4. Broadcast match updates in real time to both players.
5. Support resignation and timeout result handling.
6. Persist move history and final result.
7. Allow player reconnect and state recovery.

## Non-Functional Requirements (MVP)
- Consistency: reject concurrent conflicting moves.
- Security baseline: input validation, simple rate limit, server-side turn ownership checks.
- Availability baseline: process restart should not lose committed matches.
- Observability: structured logs by `gameId` and `requestId`.

## API Draft

### REST
- `POST /api/games`
  - request: `{ "mainMinutes": number, "byoSeconds": number }`
  - response: `{ "gameId": string, "joinToken": string }`
- `POST /api/games/{gameId}/join`
  - request: `{ "name": string, "seat": "black" | "white" }`
  - response: `{ "guestId": string, "sessionToken": string, "seat": "black" | "white" }`
- `GET /api/games/{gameId}`
  - response: current game snapshot (board, hands, turn, clocks, status)
- `POST /api/games/{gameId}/moves`
  - request: move payload (`BoardMove | DropMove`)
  - auth: `sessionToken`
  - response: updated snapshot
- `POST /api/games/{gameId}/resign`
  - request: empty
  - auth: `sessionToken`
  - response: updated snapshot
- `GET /api/games/{gameId}/records`
  - response: move list + result metadata

### WebSocket
- `GET /api/games/{gameId}/events` (WS upgrade)
- server events:
  - `game.updated`
  - `game.finished`
  - `player.joined`

## Data Model Draft

### `games`
- `id` (uuid, pk)
- `status` (`waiting` | `active` | `finished`)
- `turn` (`black` | `white`)
- `state_sfen` (text)
- `main_seconds_black`, `main_seconds_white` (int)
- `byo_seconds_black`, `byo_seconds_white` (int)
- `result_type` (`checkmate` | `resign` | `timeout` | `repetition` | null)
- `winner` (`black` | `white` | null)
- `created_at`, `updated_at` (timestamp)

### `game_players`
- `id` (uuid, pk)
- `game_id` (fk -> games.id)
- `seat` (`black` | `white`)
- `guest_id` (uuid)
- `display_name` (varchar 20)
- `session_token_hash` (text)
- `joined_at` (timestamp)
- unique: (`game_id`, `seat`)

### `moves`
- `id` (bigserial, pk)
- `game_id` (fk -> games.id)
- `ply` (int)
- `actor_seat` (`black` | `white`)
- `move_json` (jsonb)
- `sfen_after` (text)
- `created_at` (timestamp)
- unique: (`game_id`, `ply`)

## Validation Rules
- Display name: 2..20 chars, trimmed.
- `byoSeconds`: 0 or multiples of 10.
- Move submission:
  - player belongs to the game
  - player's seat equals current turn
  - game status is `active`
  - `core.applyMove` returns `ok`

## Milestones
1. Project bootstrap (`server/` TypeScript app, health endpoint, DB connection).
2. PostgreSQL schema + migration.
3. Guest join/session endpoints.
4. Game creation/get + move submit pipeline with `core`.
5. WS event delivery.
6. App integration and end-to-end smoke test.
