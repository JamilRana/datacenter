-- Seed SQL for datacenter database
-- Run this directly with: docker exec -i pg-db psql -U postgres -d datacenter < prisma/seed.sql

-- Insert roles (using gen_random_uuid() for compatibility with PostgreSQL)
INSERT INTO "Role" (id, name) VALUES 
  (gen_random_uuid(), 'DEVELOPER'),
  (gen_random_uuid(), 'REQUESTER'),
  (gen_random_uuid(), 'APPROVER_L1'),
  (gen_random_uuid(), 'APPROVER_L2'),
  (gen_random_uuid(), 'APPROVER_L3'),
  (gen_random_uuid(), 'APPROVER_L4'),
  (gen_random_uuid(), 'DC_OPS'),
  (gen_random_uuid(), 'ADMIN'),
  (gen_random_uuid(), 'VIEW')
ON CONFLICT (name) DO NOTHING;

-- Get role IDs for user creation
DO $$
DECLARE
  admin_rid text;
  requester_rid text;
  dcops_rid text;
  approver_l1_rid text;
  approver_l2_rid text;
  approver_l3_rid text;
  developer_rid text;
BEGIN
  SELECT id INTO admin_rid FROM "Role" WHERE name = 'ADMIN';
  SELECT id INTO requester_rid FROM "Role" WHERE name = 'REQUESTER';
  SELECT id INTO dcops_rid FROM "Role" WHERE name = 'DC_OPS';
  SELECT id INTO approver_l1_rid FROM "Role" WHERE name = 'APPROVER_L1';
  SELECT id INTO approver_l2_rid FROM "Role" WHERE name = 'APPROVER_L2';
  SELECT id INTO approver_l3_rid FROM "Role" WHERE name = 'APPROVER_L3';
  SELECT id INTO developer_rid FROM "Role" WHERE name = 'DEVELOPER';

  -- Password hash for "Dghs@123" generated with bcryptjs (12 rounds)
  -- Hash generated: $2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6
  INSERT INTO "User" (id, email, name, password, designation, organization, contact, "isActive", "createdAt", "updatedAt")
  VALUES 
    (gen_random_uuid(), 'admin@dghs.gov.bd', 'System Admin', '$2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6', 'Administrator', 'DGHS', '01234567890', true, NOW(), NOW()),
    (gen_random_uuid(), 'requester@dghs.gov.bd', 'Requester User', '$2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6', 'Staff', 'DGHS', '01234567891', true, NOW(), NOW()),
    (gen_random_uuid(), 'dcops@dghs.gov.bd', 'DC OPS User', '$2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6', 'System Admin', 'DGHS', '01234567892', true, NOW(), NOW()),
    (gen_random_uuid(), 'approverl1@dghs.gov.bd', 'Approver L1', '$2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6', 'Section Officer', 'DGHS', '01234567893', true, NOW(), NOW()),
    (gen_random_uuid(), 'approverl2@dghs.gov.bd', 'Approver L2', '$2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6', 'Deputy Director', 'DGHS', '01234567894', true, NOW(), NOW()),
    (gen_random_uuid(), 'approverl3@dghs.gov.bd', 'Approver L3', '$2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6', 'Director', 'DGHS', '01234567895', true, NOW(), NOW()),
    (gen_random_uuid(), 'developer@dghs.gov.bd', 'Developer User', '$2b$12$1/t6ftKjMDDJ5uqSB9Cwbuq0cwbdw/UHdyl0FEq4BqeTvkLFSlHX6', 'Developer', 'DGHS', '01234567896', true, NOW(), NOW())
  ON CONFLICT (email) DO UPDATE SET password = EXCLUDED.password;

  -- Assign roles to users (using UserRole table)
  INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
  SELECT u.id, admin_rid, NOW() FROM "User" u WHERE u.email = 'admin@dghs.gov.bd'
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
  SELECT u.id, requester_rid, NOW() FROM "User" u WHERE u.email = 'requester@dghs.gov.bd'
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
  SELECT u.id, dcops_rid, NOW() FROM "User" u WHERE u.email = 'dcops@dghs.gov.bd'
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
  SELECT u.id, approver_l1_rid, NOW() FROM "User" u WHERE u.email = 'approverl1@dghs.gov.bd'
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
  SELECT u.id, approver_l2_rid, NOW() FROM "User" u WHERE u.email = 'approverl2@dghs.gov.bd'
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
  SELECT u.id, approver_l3_rid, NOW() FROM "User" u WHERE u.email = 'approverl3@dghs.gov.bd'
  ON CONFLICT ("userId", "roleId") DO NOTHING;

  INSERT INTO "UserRole" ("userId", "roleId", "createdAt")
  SELECT u.id, developer_rid, NOW() FROM "User" u WHERE u.email = 'developer@dghs.gov.bd'
  ON CONFLICT ("userId", "roleId") DO NOTHING;
END $$;

-- Insert approval workflows with explicit timestamps
INSERT INTO "ApprovalWorkflow" (id, "requestType", level, role, "roleLabel", "isFinal", "createdAt", "updatedAt") VALUES
  ('NEW_VM-1', 'NEW_VM', 1, 'APPROVER_L1', 'Section Officer', false, NOW(), NOW()),
  ('NEW_VM-2', 'NEW_VM', 2, 'APPROVER_L2', 'Deputy Director', false, NOW(), NOW()),
  ('NEW_VM-3', 'NEW_VM', 3, 'APPROVER_L3', 'Director', true, NOW(), NOW()),
  ('NEW_VM-4', 'NEW_VM', 4, 'DC_OPS', 'DC OPS Team', false, NOW(), NOW()),
  ('CUSTOMIZED-1', 'CUSTOMIZED', 1, 'APPROVER_L1', 'Section Officer', false, NOW(), NOW()),
  ('CUSTOMIZED-2', 'CUSTOMIZED', 2, 'APPROVER_L2', 'Deputy Director', false, NOW(), NOW()),
  ('CUSTOMIZED-3', 'CUSTOMIZED', 3, 'APPROVER_L3', 'Director', true, NOW(), NOW()),
  ('CUSTOMIZED-4', 'CUSTOMIZED', 4, 'DC_OPS', 'DC OPS Team', false, NOW(), NOW()),
  ('DECOMMISSION-1', 'DECOMMISSION', 1, 'APPROVER_L1', 'Section Officer', true, NOW(), NOW()),
  ('DECOMMISSION-2', 'DECOMMISSION', 2, 'DC_OPS', 'DC OPS Team', false, NOW(), NOW()),
  ('RENEWAL-1', 'RENEWAL', 1, 'APPROVER_L1', 'Section Officer', false, NOW(), NOW()),
  ('RENEWAL-2', 'RENEWAL', 2, 'APPROVER_L2', 'Deputy Director', false, NOW(), NOW()),
  ('RENEWAL-3', 'RENEWAL', 3, 'APPROVER_L3', 'Director', true, NOW(), NOW()),
  ('RENEWAL-4', 'RENEWAL', 4, 'DC_OPS', 'DC OPS Team', false, NOW(), NOW())
ON CONFLICT (id) DO NOTHING;

\echo 'Seed completed successfully!'
