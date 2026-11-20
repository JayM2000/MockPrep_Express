-- Migration 003: Create app.user_roles table
-- Maps each Clerk user ID to a role ('candidate' or 'assessor')
-- and stores optional profile metadata.

CREATE TABLE IF NOT EXISTS app.user_roles (
  clerk_user_id  VARCHAR(255) PRIMARY KEY,
  role           VARCHAR(32)  NOT NULL DEFAULT 'candidate',
  display_name   VARCHAR(128),
  bio            TEXT,
  avatar_url     TEXT,
  created_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  CONSTRAINT chk_user_role CHECK (role IN ('candidate', 'assessor'))
);

-- Fast lookups when filtering all users by role
CREATE INDEX IF NOT EXISTS idx_user_roles_role ON app.user_roles(role);
