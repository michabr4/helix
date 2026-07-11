CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE SCHEMA IF NOT EXISTS mgm;
CREATE SCHEMA IF NOT EXISTS cisco;
CREATE SCHEMA IF NOT EXISTS audit;

CREATE TABLE IF NOT EXISTS mgm.users (
  user_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email TEXT UNIQUE NOT NULL,
  full_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin','sdm','tam','csm','engineer','manager','viewer')),
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.properties (
  property_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  property_type TEXT NOT NULL CHECK (property_type IN ('hotel','casino','resort','venue')),
  it_manager_user_id UUID REFERENCES mgm.users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.devices (
  device_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES mgm.properties(property_id),
  hostname TEXT NOT NULL,
  ip_address INET,
  ipv6_address INET,
  mac_address TEXT,
  serial_number TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','inactive','maintenance','decommissioned','failed')),
  dna_device_id TEXT,
  dna_managed BOOLEAN DEFAULT FALSE,
  health_score NUMERIC(5,2),
  contract_number TEXT,
  contract_type TEXT,
  contract_start_date DATE,
  contract_expiry DATE,
  warranty_expiry DATE,
  eol_date DATE,
  eos_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.incidents (
  incident_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_number TEXT UNIQUE,
  parent_incident_id UUID REFERENCES mgm.incidents(incident_id),
  property_id UUID NOT NULL REFERENCES mgm.properties(property_id),
  device_id UUID REFERENCES mgm.devices(device_id),
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  priority TEXT NOT NULL CHECK (priority IN ('P1','P2','P3','P4')),
  status TEXT NOT NULL CHECK (status IN ('open','acknowledged','investigating','in-progress','pending','resolved','closed','cancelled')),
  reported_by UUID NOT NULL REFERENCES mgm.users(user_id),
  assigned_to UUID REFERENCES mgm.users(user_id),
  tac_case_number TEXT,
  tac_case_id UUID,
  tac_severity TEXT CHECK (tac_severity IN ('1','2','3','4')),
  resolution_time INTERVAL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.incident_updates (
  update_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID NOT NULL REFERENCES mgm.incidents(incident_id),
  user_id UUID NOT NULL REFERENCES mgm.users(user_id),
  content TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cisco.technologies (
  technology_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('Network Infrastructure','Security','Wireless','Collaboration','Data Center','Observability','Cloud')),
  product_manager UUID REFERENCES mgm.users(user_id),
  tech_lead UUID REFERENCES mgm.users(user_id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.property_technology_adoption (
  adoption_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES mgm.properties(property_id),
  technology_id UUID NOT NULL REFERENCES cisco.technologies(technology_id),
  owner_user_id UUID REFERENCES mgm.users(user_id),
  deployment_phase TEXT CHECK (deployment_phase IN ('planning','design','pilot','deployment','production','complete')),
  devices_deployed INTEGER DEFAULT 0,
  health_score NUMERIC(5,2),
  health_status TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.adoption_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  adoption_id UUID NOT NULL REFERENCES mgm.property_technology_adoption(adoption_id),
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deployment_phase TEXT,
  health_score NUMERIC(5,2),
  devices_deployed INTEGER
);

CREATE TABLE IF NOT EXISTS cisco.licenses (
  license_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  owner_user_id UUID REFERENCES mgm.users(user_id),
  sku TEXT NOT NULL,
  product_name TEXT NOT NULL,
  license_model TEXT CHECK (license_model IN ('perpetual','subscription','term','consumption')),
  quantity_purchased INTEGER DEFAULT 0,
  quantity_consumed INTEGER DEFAULT 0,
  compliance_status TEXT,
  smart_account TEXT,
  virtual_account TEXT,
  start_date DATE,
  expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cisco.license_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  license_id UUID NOT NULL REFERENCES cisco.licenses(license_id),
  user_id UUID REFERENCES mgm.users(user_id),
  event_type TEXT NOT NULL,
  quantity_change INTEGER,
  old_expiry_date DATE,
  new_expiry_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.property_license_usage (
  usage_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES mgm.properties(property_id),
  license_id UUID NOT NULL REFERENCES cisco.licenses(license_id),
  quantity_used INTEGER DEFAULT 0,
  device_count INTEGER DEFAULT 0,
  user_count INTEGER DEFAULT 0,
  last_sync TIMESTAMPTZ,
  sync_source TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.sla_metrics (
  metric_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID NOT NULL REFERENCES mgm.properties(property_id),
  metric_type TEXT NOT NULL CHECK (metric_type IN ('daily','weekly','monthly','quarterly','annual')),
  availability_percent NUMERIC(5,2),
  uptime_minutes INTEGER,
  downtime_minutes INTEGER,
  tac_cases_opened INTEGER DEFAULT 0,
  tac_cases_closed INTEGER DEFAULT 0,
  tac_avg_response_minutes INTEGER,
  tac_avg_resolution_hours INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.changes (
  change_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  change_number TEXT UNIQUE,
  parent_change_id UUID REFERENCES mgm.changes(change_id),
  property_id UUID NOT NULL REFERENCES mgm.properties(property_id),
  requested_by UUID REFERENCES mgm.users(user_id),
  approved_by UUID REFERENCES mgm.users(user_id),
  implemented_by UUID REFERENCES mgm.users(user_id),
  reviewed_by UUID REFERENCES mgm.users(user_id),
  change_type TEXT CHECK (change_type IN ('standard','normal','emergency','pre-approved')),
  risk_level TEXT CHECK (risk_level IN ('low','medium','high','critical')),
  title TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cisco.tac_cases (
  tac_case_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  incident_id UUID REFERENCES mgm.incidents(incident_id),
  property_id UUID REFERENCES mgm.properties(property_id),
  device_id UUID REFERENCES mgm.devices(device_id),
  owner_user_id UUID REFERENCES mgm.users(user_id),
  case_number TEXT UNIQUE NOT NULL,
  severity TEXT CHECK (severity IN ('1','2','3','4')),
  status TEXT CHECK (status IN ('open','in-progress','pending-customer','pending-cisco','resolved','closed')),
  contract_number TEXT,
  related_bug_ids TEXT[],
  webex_space_id TEXT,
  war_room_url TEXT,
  last_update_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS cisco.tac_case_updates (
  update_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tac_case_id UUID NOT NULL REFERENCES cisco.tac_cases(tac_case_id),
  update_type TEXT,
  content TEXT,
  author TEXT,
  author_type TEXT CHECK (author_type IN ('customer','tac','system')),
  attachments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.teams_channels (
  teams_channel_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES mgm.properties(property_id),
  incident_id UUID REFERENCES mgm.incidents(incident_id),
  owner_user_id UUID REFERENCES mgm.users(user_id),
  external_channel_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.webex_spaces (
  webex_space_row_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  property_id UUID REFERENCES mgm.properties(property_id),
  incident_id UUID REFERENCES mgm.incidents(incident_id),
  tac_case_id UUID REFERENCES cisco.tac_cases(tac_case_id),
  webex_space_id TEXT NOT NULL,
  space_title TEXT,
  meeting_url TEXT,
  participants JSONB DEFAULT '[]'::jsonb,
  recording_urls JSONB DEFAULT '[]'::jsonb,
  started_at TIMESTAMPTZ,
  ended_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.notifications (
  notification_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES mgm.users(user_id),
  notification_type TEXT NOT NULL CHECK (notification_type IN ('incident','tac_case','change','sla_breach','license_expiry','system','alert')),
  message TEXT NOT NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.dashboards (
  dashboard_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES mgm.users(user_id),
  name TEXT NOT NULL,
  layout JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.reports (
  report_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES mgm.users(user_id),
  name TEXT NOT NULL,
  report_format TEXT CHECK (report_format IN ('pdf','excel','csv','json')),
  config JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS mgm.report_history (
  history_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  report_id UUID NOT NULL REFERENCES mgm.reports(report_id),
  user_id UUID NOT NULL REFERENCES mgm.users(user_id),
  status TEXT NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audit.activity_log (
  activity_id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  event_type TEXT NOT NULL,
  user_id UUID,
  ip_address TEXT,
  user_agent TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE SEQUENCE IF NOT EXISTS mgm.incident_number_seq START 1;
CREATE SEQUENCE IF NOT EXISTS mgm.change_number_seq START 1;

CREATE OR REPLACE FUNCTION mgm.generate_incident_number_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.incident_number IS NULL THEN
    NEW.incident_number := 'INC-' || LPAD(nextval('mgm.incident_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mgm.generate_change_number_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.change_number IS NULL THEN
    NEW.change_number := 'CHG-' || LPAD(nextval('mgm.change_number_seq')::TEXT, 6, '0');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mgm.calculate_resolution_time_fn()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'resolved' AND OLD.status IS DISTINCT FROM 'resolved' THEN
    NEW.resolution_time := NOW() - NEW.created_at;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION mgm.set_updated_at_fn()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS generate_incident_number ON mgm.incidents;
CREATE TRIGGER generate_incident_number
BEFORE INSERT ON mgm.incidents
FOR EACH ROW EXECUTE FUNCTION mgm.generate_incident_number_fn();

DROP TRIGGER IF EXISTS generate_change_number ON mgm.changes;
CREATE TRIGGER generate_change_number
BEFORE INSERT ON mgm.changes
FOR EACH ROW EXECUTE FUNCTION mgm.generate_change_number_fn();

DROP TRIGGER IF EXISTS calculate_resolution_time ON mgm.incidents;
CREATE TRIGGER calculate_resolution_time
BEFORE UPDATE ON mgm.incidents
FOR EACH ROW EXECUTE FUNCTION mgm.calculate_resolution_time_fn();

DROP TRIGGER IF EXISTS update_users_updated_at ON mgm.users;
CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON mgm.users
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_properties_updated_at ON mgm.properties;
CREATE TRIGGER update_properties_updated_at BEFORE UPDATE ON mgm.properties
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_devices_updated_at ON mgm.devices;
CREATE TRIGGER update_devices_updated_at BEFORE UPDATE ON mgm.devices
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_incidents_updated_at ON mgm.incidents;
CREATE TRIGGER update_incidents_updated_at BEFORE UPDATE ON mgm.incidents
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_changes_updated_at ON mgm.changes;
CREATE TRIGGER update_changes_updated_at BEFORE UPDATE ON mgm.changes
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_property_technology_adoption_updated_at ON mgm.property_technology_adoption;
CREATE TRIGGER update_property_technology_adoption_updated_at BEFORE UPDATE ON mgm.property_technology_adoption
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_property_license_usage_updated_at ON mgm.property_license_usage;
CREATE TRIGGER update_property_license_usage_updated_at BEFORE UPDATE ON mgm.property_license_usage
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_dashboards_updated_at ON mgm.dashboards;
CREATE TRIGGER update_dashboards_updated_at BEFORE UPDATE ON mgm.dashboards
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_reports_updated_at ON mgm.reports;
CREATE TRIGGER update_reports_updated_at BEFORE UPDATE ON mgm.reports
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_licenses_updated_at ON cisco.licenses;
CREATE TRIGGER update_licenses_updated_at BEFORE UPDATE ON cisco.licenses
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();

DROP TRIGGER IF EXISTS update_tac_cases_updated_at ON cisco.tac_cases;
CREATE TRIGGER update_tac_cases_updated_at BEFORE UPDATE ON cisco.tac_cases
FOR EACH ROW EXECUTE FUNCTION mgm.set_updated_at_fn();
