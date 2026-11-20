-- Migration 005: Create app.project_bookmarks table
-- Candidates can bookmark public projects to revisit later.
-- Uses a composite unique constraint so each user can bookmark a project only once.

CREATE TABLE IF NOT EXISTS app.project_bookmarks (
  id             VARCHAR(64)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  clerk_user_id  VARCHAR(255) NOT NULL,
  project_id     VARCHAR(64)  NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  UNIQUE (clerk_user_id, project_id)
);

-- Fast lookup of all bookmarks for a given user
CREATE INDEX IF NOT EXISTS idx_project_bookmarks_user
  ON app.project_bookmarks(clerk_user_id);

-- Migration 005b: Create app.session_invites table (stub — logic in Phase 9)
-- Assessors generate invite codes that link candidates to a specific project session.

CREATE TABLE IF NOT EXISTS app.session_invites (
  id            VARCHAR(64)  PRIMARY KEY DEFAULT gen_random_uuid()::text,
  invite_code   VARCHAR(16)  NOT NULL UNIQUE,
  project_id    VARCHAR(64)  NOT NULL REFERENCES app.projects(id) ON DELETE CASCADE,
  created_by    VARCHAR(255) NOT NULL,
  max_uses      INTEGER      NOT NULL DEFAULT 1,
  use_count     INTEGER      NOT NULL DEFAULT 0,
  expires_at    TIMESTAMPTZ  NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_session_invites_project
  ON app.session_invites(project_id);
