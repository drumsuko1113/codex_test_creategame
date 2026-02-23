CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY,
  status VARCHAR(16) NOT NULL CHECK (status IN ('waiting', 'active', 'finished')),
  turn VARCHAR(8) NOT NULL CHECK (turn IN ('black', 'white')),
  state_json JSONB NOT NULL,
  main_seconds_black INTEGER NOT NULL CHECK (main_seconds_black >= 0),
  main_seconds_white INTEGER NOT NULL CHECK (main_seconds_white >= 0),
  byo_seconds_black INTEGER NOT NULL CHECK (byo_seconds_black >= 0),
  byo_seconds_white INTEGER NOT NULL CHECK (byo_seconds_white >= 0),
  result_type VARCHAR(16),
  winner VARCHAR(8),
  version INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS game_players (
  id UUID PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  seat VARCHAR(8) NOT NULL CHECK (seat IN ('black', 'white')),
  guest_id UUID NOT NULL,
  display_name VARCHAR(20) NOT NULL,
  session_token_hash TEXT NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, seat)
);

CREATE TABLE IF NOT EXISTS moves (
  id BIGSERIAL PRIMARY KEY,
  game_id UUID NOT NULL REFERENCES games(id) ON DELETE CASCADE,
  ply INTEGER NOT NULL CHECK (ply >= 1),
  actor_seat VARCHAR(8) NOT NULL CHECK (actor_seat IN ('black', 'white')),
  move_json JSONB NOT NULL,
  state_json_after JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (game_id, ply)
);

CREATE INDEX IF NOT EXISTS idx_games_status_updated_at ON games(status, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_moves_game_ply ON moves(game_id, ply);
