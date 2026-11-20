-- Migration 004: Add visibility, share_token, expiry_days, expires_at to app.projects
-- Enables Assessors to control who can see their projects and for how long.

ALTER TABLE app.projects
  ADD COLUMN IF NOT EXISTS visibility  VARCHAR(16)  NOT NULL DEFAULT 'private',
  ADD COLUMN IF NOT EXISTS share_token VARCHAR(64),
  ADD COLUMN IF NOT EXISTS expiry_days INTEGER      NOT NULL DEFAULT 7,
  ADD COLUMN IF NOT EXISTS expires_at  TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days');

-- Enforce allowed values
ALTER TABLE app.projects
  DROP CONSTRAINT IF EXISTS chk_visibility,
  DROP CONSTRAINT IF EXISTS chk_expiry_days;

ALTER TABLE app.projects
  ADD CONSTRAINT chk_visibility   CHECK (visibility IN ('public', 'private')),
  ADD CONSTRAINT chk_expiry_days  CHECK (expiry_days >= 1 AND expiry_days <= 30);

-- share_token must be globally unique (NULLs are excluded from unique index automatically)
CREATE UNIQUE INDEX IF NOT EXISTS idx_projects_share_token
  ON app.projects(share_token)
  WHERE share_token IS NOT NULL;

-- Perf indexes for the two most common filters
CREATE INDEX IF NOT EXISTS idx_projects_visibility ON app.projects(visibility);
CREATE INDEX IF NOT EXISTS idx_projects_expires_at ON app.projects(expires_at);
