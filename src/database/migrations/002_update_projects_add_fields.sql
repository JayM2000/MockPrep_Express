-- Migration: 002_update_projects_add_fields.sql
-- Aligns app.projects with the frontend's CreateProjectDto / Project interface.
-- Adds: category, frontend_tech, backend_tech, database_tech, tags, status.
-- Normalises difficulty values to beginner/intermediate/advanced (matches frontend's "complexity").

-- New columns
ALTER TABLE app.projects ADD COLUMN IF NOT EXISTS category VARCHAR(128);
ALTER TABLE app.projects ADD COLUMN IF NOT EXISTS frontend_tech VARCHAR(255);
ALTER TABLE app.projects ADD COLUMN IF NOT EXISTS backend_tech VARCHAR(255);
ALTER TABLE app.projects ADD COLUMN IF NOT EXISTS database_tech VARCHAR(255);
ALTER TABLE app.projects ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';
ALTER TABLE app.projects ADD COLUMN IF NOT EXISTS status VARCHAR(32) NOT NULL DEFAULT 'draft';

-- Align difficulty values with frontend terminology
ALTER TABLE app.projects ALTER COLUMN difficulty SET DEFAULT 'intermediate';
UPDATE app.projects SET difficulty = 'beginner'     WHERE difficulty = 'easy';
UPDATE app.projects SET difficulty = 'intermediate'  WHERE difficulty = 'medium';
UPDATE app.projects SET difficulty = 'advanced'      WHERE difficulty = 'hard';
