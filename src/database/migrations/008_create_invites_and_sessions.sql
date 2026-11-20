-- Migration 008: Create app.invites and app.sessions tables
-- Implements email-bound single-use invites, public links with limits, and candidate sessions.

CREATE TABLE IF NOT EXISTS app.invites (
  id              VARCHAR(64)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  project_id      VARCHAR(64)  NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  created_by      VARCHAR(255) NOT NULL,
  token_hash      VARCHAR(64)  NOT NULL UNIQUE,
  raw_token_hint  VARCHAR(16),
  type            VARCHAR(32)  NOT NULL DEFAULT 'email', -- 'email' | 'public_link'
  email           VARCHAR(255),                          -- NULL for public links
  message         TEXT,
  max_uses        INTEGER      NOT NULL DEFAULT 1,
  use_count       INTEGER      NOT NULL DEFAULT 0,
  expires_at      TIMESTAMPTZ  NOT NULL,
  revoked_at      TIMESTAMPTZ,
  status          VARCHAR(32)  NOT NULL DEFAULT 'sent',  -- 'sent' | 'opened' | 'accepted' | 'in_progress' | 'completed' | 'expired' | 'revoked'
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_invites_project ON app.invites(project_id);
CREATE INDEX IF NOT EXISTS idx_invites_token_hash ON app.invites(token_hash);
CREATE INDEX IF NOT EXISTS idx_invites_email ON app.invites(email);

CREATE TABLE IF NOT EXISTS app.sessions (
  id              VARCHAR(64)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invite_id       VARCHAR(64)  REFERENCES app.invites(id) ON DELETE SET NULL,
  candidate_id    VARCHAR(255) NOT NULL,
  candidate_email VARCHAR(255),
  project_id      VARCHAR(64)  NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  environment_id  VARCHAR(64),
  status          VARCHAR(32)  NOT NULL DEFAULT 'ready', -- 'ready' | 'in_progress' | 'completed' | 'expired'
  started_at      TIMESTAMPTZ,
  ends_at         TIMESTAMPTZ,
  duration_mins   INTEGER      NOT NULL DEFAULT 120,
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON app.sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_candidate ON app.sessions(candidate_id);
