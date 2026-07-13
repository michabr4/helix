-- Password for all rows: ChangeMe123!  Hash from bcryptjs (12 rounds), verified with bcrypt.compare in Node.
-- Regenerate if needed: node -e "require('bcryptjs').hash('ChangeMe123!',12).then(console.log)"
INSERT INTO mgm.users (user_id, email, full_name, role, password_hash)
VALUES
  ('11111111-1111-1111-1111-111111111111', 'admin@serviceflow.local', 'Admin User', 'admin', '$2a$12$T9YXY6e9/gRufylmcU09huCqkHTvyAGxjk0tT0pLl.KIaVzCkpxFm'),
  ('22222222-2222-2222-2222-222222222222', 'sdm@serviceflow.local', 'Service Delivery Manager', 'sdm', '$2a$12$T9YXY6e9/gRufylmcU09huCqkHTvyAGxjk0tT0pLl.KIaVzCkpxFm'),
  ('33333333-3333-3333-3333-333333333333', 'engineer@serviceflow.local', 'Network Engineer', 'engineer', '$2a$12$T9YXY6e9/gRufylmcU09huCqkHTvyAGxjk0tT0pLl.KIaVzCkpxFm')
ON CONFLICT (email) DO UPDATE SET
  password_hash = EXCLUDED.password_hash,
  full_name = EXCLUDED.full_name,
  role = EXCLUDED.role;

INSERT INTO mgm.properties (property_id, name, property_type, it_manager_user_id)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'MGM Grand', 'resort', '22222222-2222-2222-2222-222222222222'),
  ('bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'Bellagio', 'hotel', '22222222-2222-2222-2222-222222222222')
ON CONFLICT DO NOTHING;

INSERT INTO mgm.devices (device_id, property_id, hostname, ip_address, serial_number, status, dna_managed, health_score)
VALUES
  ('cccccccc-cccc-cccc-cccc-cccccccccccc', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'core-sw-01', '10.20.0.10', 'FDO1234ABC', 'active', TRUE, 95.5),
  ('dddddddd-dddd-dddd-dddd-dddddddddddd', 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb', 'edge-rtr-01', '10.20.1.10', 'FDO9876XYZ', 'maintenance', TRUE, 84.0)
ON CONFLICT DO NOTHING;

INSERT INTO cisco.technologies (technology_id, name, category, product_manager, tech_lead)
VALUES
  ('eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee', 'Cisco DNA Center', 'Network Infrastructure', '22222222-2222-2222-2222-222222222222', '33333333-3333-3333-3333-333333333333')
ON CONFLICT DO NOTHING;

INSERT INTO cisco.licenses (license_id, owner_user_id, sku, product_name, license_model, quantity_purchased, quantity_consumed, compliance_status, smart_account, virtual_account, property_id)
VALUES
  ('ffffffff-ffff-ffff-ffff-ffffffffffff', '22222222-2222-2222-2222-222222222222', 'C1-DNAC-E', 'DNA Center Essentials', 'subscription', 500, 220, 'compliant', 'MGM-SA', 'GES-WEST', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa')
ON CONFLICT DO NOTHING;

INSERT INTO mgm.incidents (incident_id, property_id, device_id, title, description, priority, status, reported_by, assigned_to, tac_case_number, tac_severity)
VALUES
  ('12345678-1234-1234-1234-123456789012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', 'Core switch packet loss', 'High packet loss detected on core switch uplink.', 'P2', 'investigating', '33333333-3333-3333-3333-333333333333', '33333333-3333-3333-3333-333333333333', 'SR-700000001', '2')
ON CONFLICT DO NOTHING;

INSERT INTO cisco.tac_cases (tac_case_id, incident_id, property_id, device_id, owner_user_id, case_number, severity, status, contract_number, last_update_at)
VALUES
  ('99999999-9999-9999-9999-999999999999', '12345678-1234-1234-1234-123456789012', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'cccccccc-cccc-cccc-cccc-cccccccccccc', '22222222-2222-2222-2222-222222222222', 'SR-700000001', '2', 'in-progress', 'GES-W-2024-MGM', NOW())
ON CONFLICT (case_number) DO NOTHING;

INSERT INTO mgm.sla_metrics (property_id, metric_type, availability_percent, uptime_minutes, downtime_minutes, tac_cases_opened, tac_cases_closed, tac_avg_response_minutes, tac_avg_resolution_hours)
VALUES
  ('aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa', 'daily', 99.20, 1428, 12, 3, 2, 18, 4)
ON CONFLICT DO NOTHING;
