-- Migration 007: Add Assessor Extended Profile Fields
-- Captures optional evaluation track, candidate target seniority level, and portfolio/org link.

ALTER TABLE app.user_roles
  ADD COLUMN IF NOT EXISTS evaluation_track VARCHAR(100),
  ADD COLUMN IF NOT EXISTS target_level VARCHAR(50),
  ADD COLUMN IF NOT EXISTS website_or_linkedin VARCHAR(255);
