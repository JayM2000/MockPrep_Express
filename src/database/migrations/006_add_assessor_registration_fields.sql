-- Migration 006: Add Assessor Registration & Profile Fields
-- Tracks whether a user has explicitly registered/activated the Assessor persona
-- and captures organizational context (company/team, professional title).

ALTER TABLE app.user_roles
  ADD COLUMN IF NOT EXISTS is_assessor_registered BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS organization VARCHAR(255),
  ADD COLUMN IF NOT EXISTS title VARCHAR(255);

-- Ensure any user who already has the assessor role is grandfathered in as registered
UPDATE app.user_roles
SET is_assessor_registered = TRUE
WHERE role = 'assessor';
