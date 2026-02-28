ALTER TABLE games
ADD COLUMN IF NOT EXISTS join_token_hash TEXT NOT NULL DEFAULT '';

ALTER TABLE games
ADD COLUMN IF NOT EXISTS turn_started_at_ms BIGINT NOT NULL DEFAULT 0;

UPDATE games
SET turn_started_at_ms = (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT
WHERE turn_started_at_ms = 0;
