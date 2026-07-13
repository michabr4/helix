-- 013_cisco_licenses_property_link.sql
--
-- Root-cause fix for the Cisco IQ adoption sync (see docs/DEVELOPMENT_PLAN.md
-- adoption tracking gap): cisco.licenses had no way to resolve which
-- mgm.properties row a given smart_account's entitlements belong to, and
-- mgm.property_technology_adoption / mgm.property_license_usage had no
-- unique constraint to upsert against. Both are minimal, additive fixes —
-- no existing column semantics change.

ALTER TABLE cisco.licenses
  ADD COLUMN IF NOT EXISTS property_id UUID REFERENCES mgm.properties(property_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_pta_property_technology
  ON mgm.property_technology_adoption (property_id, technology_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_plu_property_license
  ON mgm.property_license_usage (property_id, license_id);
