-- 002_user_properties.sql
-- Grants users access to specific properties for row-level data scoping.
-- Admin/sdm/tam/manager/csm/engineer roles bypass this table and see all rows.
-- Viewer-role users only see incidents and devices for their assigned properties.

CREATE TABLE IF NOT EXISTS mgm.user_properties (
  user_id     UUID NOT NULL REFERENCES mgm.users(user_id)       ON DELETE CASCADE,
  property_id UUID NOT NULL REFERENCES mgm.properties(property_id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_user_properties_user_id ON mgm.user_properties (user_id);
