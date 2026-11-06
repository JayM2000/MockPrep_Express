-- Migration: 001_create_projects.sql
-- Establishes the isolated 'app' schema and the 'projects' table owned by Express.

CREATE SCHEMA IF NOT EXISTS app;

CREATE TABLE IF NOT EXISTS app.projects (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(255) NOT NULL,
  description TEXT,
  difficulty VARCHAR(32) NOT NULL DEFAULT 'medium',
  tech_stack TEXT[] NOT NULL DEFAULT '{}',
  repository_url VARCHAR(512),
  created_by VARCHAR(128) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_projects_created_by ON app.projects(created_by);
