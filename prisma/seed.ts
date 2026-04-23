import { PrismaClient, RequestType, RequestStatus, ServerType, Environment, Protocol, Raid, LicenseProvider, ApprovalDecision, ApprovalEntityType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as xlsx from 'xlsx';
import * as path from 'path';
import * as fs from 'fs';

// Try to load .env if on host
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch (e) {}
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD_HASH = "$2b$12$8VAittz9caJlxlWrdb0JguKxj1v5yBL7DKwPj3X0ymGxPBxGg12kO";

// Helper to parse TSV/CSV using xlsx
function parseCsv(filePath: string) {
  if (!fs.existsSync(filePath)) {
    console.warn(`File not found: ${filePath}`);
    return [];
  }
  const content = fs.readFileSync(filePath);
  const workbook = xlsx.read(content, { type: 'buffer' });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  return xlsx.utils.sheet_to_json(sheet, { defval: "" });
}

async function main() {
  console.log("Starting seed with Prisma 7 Adapter...");
  
  // 1. Roles
  const roleNames = [
    "DEVELOPER",
    "REQUESTER",
    "APPROVER_L1",
    "APPROVER_L2",
    "APPROVER_L3",
    "APPROVER_L4",
    "DC_OPS",
    "ADMIN",
    "VIEW",
  ];

  const roles: Record<string, string> = {};
  for (const roleName of roleNames) {
    const role = await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
    roles[roleName] = role.id;
  }
  console.log("Roles created/verified");

  // 2. Load Users from CSV
  const userData = parseCsv(path.join(process.cwd(), 'data', 'user.csv'));
  const userMap: Record<string, string> = {}; // csv_id -> prisma_id

  console.log(`Processing ${userData.length} users from CSV...`);

for (const row of userData as any[]) {
    const csvId = String(row.id || "");
    const email = row.email || `user_${csvId}@placeholder.com`;
    
    // Fallback logic to ensure name is NEVER undefined or empty
    const generatedName = (
      `${row.first_name || ""} ${row.last_name || ""}`.trim() || 
      row.user_id || 
      `User ${csvId}`
    );
    // Determine roles based on user_type_server or other hints
    const userRoles = [];
    if (row.user_id === "approver1") userRoles.push(roles.APPROVER_L1);
    if (row.user_id === "approver2") userRoles.push(roles.APPROVER_L2);
    if (row.user_id === "approver3") userRoles.push(roles.APPROVER_L3);
    if (row.user_id === "deployer") userRoles.push(roles.DC_OPS);
    if (String(row.user_type_server).includes("2")) userRoles.push(roles.REQUESTER);
    
    if (userRoles.length === 0) userRoles.push(roles.REQUESTER);
    if (["92", "93", "94", "95"].includes(csvId)) userRoles.push(roles.ADMIN);

const user = await prisma.user.upsert({
      where: { email },
      update: {
        name: generatedName, // Use the fallback here
        designation: row.designation || null,
        contact: row.phone || null,
      },
      create: {
        email,
        name: generatedName, // And use it here
        password: row.password ? row.password : DEFAULT_PASSWORD_HASH,
        designation: row.designation || null,
        organization: "DGHS",
        contact: row.phone || null,
        isActive: true,
        roles: {
          create: Array.from(new Set(userRoles)).map(roleId => ({ roleId }))
        }
      }
    });
    userMap[csvId] = user.id;
  }

  // Add default system admin
  await prisma.user.upsert({
    where: { email: "admin@dghs.gov.bd" },
    update: {},
    create: {
      email: "admin@dghs.gov.bd",
      name: "System Admin",
      password: DEFAULT_PASSWORD_HASH,
      designation: "Administrator",
      organization: "DGHS",
      contact: "",
      isActive: true,
      roles: {
        create: [{ roleId: roles.ADMIN }],
      },
    },
  });

  console.log("Users processed");

  // 3. Workflows
  const workflowConfigs = [
    { requestType: "NEW_VM", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
    { requestType: "NEW_VM", level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
    { requestType: "NEW_VM", level: 3, role: "APPROVER_L3", roleLabel: "Director", isFinal: true },
    { requestType: "NEW_VM", level: 4, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: false },
    { requestType: "CUSTOMIZED", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
    { requestType: "CUSTOMIZED", level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
    { requestType: "CUSTOMIZED", level: 3, role: "APPROVER_L3", roleLabel: "Director", isFinal: true },
    { requestType: "CUSTOMIZED", level: 4, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: false },
    { requestType: "DECOMMISSION", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: true },
    { requestType: "DECOMMISSION", level: 2, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: false },
    { requestType: "RENEWAL", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
    { requestType: "RENEWAL", level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
    { requestType: "RENEWAL", level: 3, role: "APPROVER_L3", roleLabel: "Director", isFinal: true },
    { requestType: "RENEWAL", level: 4, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: false },
  ];

  for (const config of workflowConfigs) {
    await prisma.approvalWorkflow.upsert({
      where: { id: `${config.requestType}-${config.level}` },
      update: config,
      create: { id: `${config.requestType}-${config.level}`, ...config },
    });
  }
  console.log("Workflows created");

  // 4. Load Requests from CSV
  const requestData = parseCsv(path.join(process.cwd(), 'data', 'server_req.csv'));
  const requestMap: Record<string, string> = {};

  console.log(`Processing ${requestData.length} requests from CSV...`);

  for (const row of requestData as any[]) {
    const csvId = String(row.id || "");
    const userId = String(row.user_id);
    const requesterId = userMap[userId] || userMap["96"];
    
    if (!requesterId) continue;

    const statusMap: Record<string, RequestStatus> = {
      "Approved & Deployed": RequestStatus.PROVISIONED,
      "Approved": RequestStatus.APPROVED,
      "Forwarded": RequestStatus.PENDING_L2,
      "Rejected": RequestStatus.REJECTED,
    };

    const serverTypeMap: Record<string, ServerType> = {
      "Application": ServerType.APPLICATION,
      "Database": ServerType.DATABASE,
      "Mail": ServerType.MAIL,
      "FTP": ServerType.FTP,
    };

    const envMap: Record<string, Environment> = {
      "Production": Environment.PRODUCTION,
      "Development": Environment.DEVELOPMENT,
      "Testing": Environment.TESTING,
      "POC": Environment.TESTING,
    };

    const raidMap: Record<string, Raid> = {
      "RAID 0": Raid.RAID0,
      "RAID 1": Raid.RAID1,
      "RAID 5": Raid.RAID5,
      "RAID 10": Raid.RAID10,
    };

    const request = await prisma.request.upsert({
      where: { requestId: `REQ-${csvId.padStart(5, '0')}` },
      update: {},
      create: {
        requestType: RequestType.NEW_VM,
        status: statusMap[row.request_status] || RequestStatus.PENDING_L1,
        systemName: row.facility_name || "N/A",
        purpose: row.purpose_of_server || "N/A",
        environment: envMap[row.hosted_service] || Environment.PRODUCTION,
        requesterId,
        serverType: serverTypeMap[row.server_type] || ServerType.OTHER,
        vcpu: parseInt(String(row.processor_required)) || 1,
        ramGb: parseInt(String(row.memory_ram)) || 1,
        storageGb: parseInt(String(row.space_for_os)) || 10,
        osName: row.os_name || "Ubuntu",
        osVersion: row.os_version || "22.04",
        raid: raidMap[row.raid_configuration] || Raid.NONE,
        requestId: `REQ-${csvId.padStart(5, '0')}`,
        submittedAt: row.request_date ? new Date(row.request_date) : new Date(),
        provisionedAt: row.deployment_date ? new Date(row.deployment_date) : null,
      }
    });
    requestMap[csvId] = request.id;
  }
  console.log("Requests processed");

  // 5. Load History
  const historyData = parseCsv(path.join(process.cwd(), 'data', 'server_req_history.csv'));
  console.log(`Processing ${historyData.length} history entries...`);

  for (const row of historyData as any[]) {
    const requestId = requestMap[String(row.server_id)];
    const approverId = userMap[String(row.user_id)];

    if (!requestId || !approverId) continue;

    const decisionMap: Record<string, ApprovalDecision> = {
      "Forwarded": ApprovalDecision.FORWARDED,
      "Forwarded Final Approval": ApprovalDecision.FORWARDED,
      "Final Approved": ApprovalDecision.APPROVED,
      "Approved & Deployed": ApprovalDecision.APPROVED,
      "Rejected": ApprovalDecision.REJECTED,
      "Approved": ApprovalDecision.APPROVED,
    };

    await prisma.approval.create({
      data: {
        requestId,
        approverId,
        level: row.username === "Younus Jamil Rana" ? 1 : (row.username === "Kazi Fabliha Tasnim" ? 2 : 3),
        decision: decisionMap[row.server_status] || ApprovalDecision.FORWARDED,
        comments: row.history_comments || "",
        decidedAt: row.cdt ? new Date(row.cdt) : new Date(),
        entityType: ApprovalEntityType.REQUEST,
      }
    });
  }
  console.log("History entries processed");

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
