-- Migration 009: Add raw_token column to app.invites
-- Stores the original unhashed token string so Assessors can copy and distribute candidate invites anytime.

ALTER TABLE app.invites
  ADD COLUMN IF NOT EXISTS raw_token VARCHAR(128);

CREATE INDEX IF NOT EXISTS idx_invites_raw_token ON app.invites(raw_token);
