import { PrismaClient, Environment, VmStatus } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';
import * as crypto from 'crypto';

// Load .env
if (process.env.NODE_ENV !== 'production') {
  try {
    require('dotenv').config();
  } catch {
    // ignore
  }
}

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Dghs@123";
const ENCRYPTION_KEY = process.env.EMAIL_ENCRYPTION_KEY || "default-32-char-encryption-key!!";

/**
 * Normalizes names to help with matching (e.g., handles "Md.", "Dr.", etc.)
 */
function normalizeName(name: string): string {
  if (!name) return "";
  return name.toLowerCase()
    .replace(/^(md|dr|prof|mr|mrs|ms)\.?\s+/gi, '') // Remove common prefixes
    .replace(/[^\w\s]/gi, '') // Remove punctuation
    .trim();
}

/**
 * Strips null indicators and returns trimmed string or empty
 */
function clean(val?: string | null): string {
  if (!val) return "";
  const trimmed = val.trim();
  if (
    trimmed === "(NULL)" ||
    trimmed === "NULL" ||
    trimmed === "\\N" ||
    trimmed.toLowerCase() === "n\\a" ||
    trimmed.toLowerCase() === "not applicable"
  ) {
    return "";
  }
  return trimmed;
}

/**
 * Encrypts password for VmCredential (compatible with lib/admin/emailService decrypt)
 */
function encryptCredential(text: string): string {
  const iv = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, "utf-8");
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(text, "utf8", "hex");
  encrypted += cipher.final("hex");
  return iv.toString("hex") + ":" + encrypted;
}

/**
 * Robust CSV parser that handles quotes, escaped quotes, and commas
 */
function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let row: string[] = [];
  let inQuotes = false;
  let current = "";

  for (let i = 0; i < text.length; i++) {
    const char = text[i];
    const next = text[i + 1];

    if (char === '"' && inQuotes && next === '"') {
      current += '"';
      i++;
    } else if (char === '"') {
      inQuotes = !inQuotes;
    } else if (char === ',' && !inQuotes) {
      row.push(current);
      current = "";
    } else if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      row.push(current);
      current = "";
      if (row.length > 1 || (row.length === 1 && row[0] !== "")) {
        lines.push(row);
      }
      row = [];
    } else {
      current += char;
    }
  }
  if (current || row.length > 0) {
    row.push(current);
    lines.push(row);
  }
  return lines;
}

function parseStorage(storageStr?: string, provSpaceStr?: string, detailsStr?: string): number {
  let storage = 0;
  if (storageStr) {
    const parts = storageStr.split("+");
    let sum = 0;
    for (const p of parts) {
      const n = parseInt(p.trim(), 10);
      if (!isNaN(n)) sum += n;
    }
    if (sum > 0) storage = sum;
  }
  if (storage === 0 && detailsStr) {
    const tbMatch = detailsStr.match(/Storage\s*:\s*(\d+(?:\.\d+)?)\s*TB/i);
    if (tbMatch) {
      storage = Math.round(parseFloat(tbMatch[1]) * 1024);
    } else {
      const gbMatch = detailsStr.match(/Storage\s*:\s*([\d\+\s]+)\s*GB/i);
      if (gbMatch) {
        const parts = gbMatch[1].split("+");
        let sum = 0;
        for (const p of parts) {
          const n = parseInt(p.trim(), 10);
          if (!isNaN(n)) sum += n;
        }
        if (sum > 0) storage = sum;
      }
    }
  }
  if (storage === 0 && provSpaceStr) {
    const n = Math.round(parseFloat(provSpaceStr));
    if (!isNaN(n) && n > 0) storage = n;
  }
  return storage > 0 ? storage : 20;
}

function parseCpu(cpuStr?: string, procReqStr?: string, detailsStr?: string): number {
  let cpu = parseInt(cpuStr || "", 10);
  if (isNaN(cpu) || cpu <= 0) cpu = parseInt(procReqStr || "", 10);
  if (isNaN(cpu) || cpu <= 0) {
    const m = (detailsStr || "").match(/CPU\s*:\s*(\d+)/i);
    if (m) cpu = parseInt(m[1], 10);
  }
  return cpu && cpu > 0 ? cpu : 1;
}

function parseRam(ramStr?: string, memRamStr?: string, detailsStr?: string): number {
  let ram = parseInt(ramStr || "", 10);
  if (isNaN(ram) || ram <= 0) ram = parseInt(memRamStr || "", 10);
  if (isNaN(ram) || ram <= 0) {
    const m = (detailsStr || "").match(/Memory\s*:\s*(\d+)\s*G/i);
    if (m) ram = parseInt(m[1], 10);
  }
  return ram && ram > 0 ? ram : 1;
}

function parseOs(osNameStr?: string, osVerStr?: string, detailsStr?: string): { osName: string; osVersion: string | null } {
  let osName = clean(osNameStr);
  let osVersion = clean(osVerStr);

  if (!osName && detailsStr) {
    const m = detailsStr.match(/OS\s*:\s*([A-Za-z]+)\s*([\d\.]+)?/i);
    if (m) {
      osName = m[1];
      if (m[2] && !osVersion) osVersion = m[2];
    }
  }
  if (!osName) osName = "Ubuntu";
  return { osName, osVersion: osVersion || null };
}

function parseCredentials(detailsStr?: string): { username: string; password: string } | null {
  if (!detailsStr) return null;
  let username: string | null = null;
  let password: string | null = null;

  const passMatch = detailsStr.match(/Password\s*:\s*(\S+)/i);
  if (passMatch) {
    password = passMatch[1].trim();
  }

  const uMatch1 = detailsStr.match(/Username\s*[;:]\s*([a-zA-Z0-9_\-\.]+)(?:\s*\/\s*([a-zA-Z0-9_\-\.!@#\$%\^&\*]+))?/i);
  const uMatch2 = detailsStr.match(/User\s*Name\s*[;:]\s*([a-zA-Z0-9_\-\.]+)/i);

  if (uMatch1) {
    username = uMatch1[1].trim();
    if (!password && uMatch1[2]) {
      password = uMatch1[2].trim();
    }
  } else if (uMatch2) {
    username = uMatch2[1].trim();
  }

  if (username) {
    return { username, password: password || DEFAULT_PASSWORD };
  }
  return null;
}

/**
 * Ensures all standard roles and default approval workflows exist in the DB.
 */
async function ensureRolesAndWorkflows(): Promise<Record<string, string>> {
  console.log("🛠️  Ensuring standard Roles and Approval Workflows...");
  const roleNames = ["DEVELOPER", "REQUESTER", "APPROVER_L1", "APPROVER_L2", "APPROVER_L3", "APPROVER_L4", "DC_OPS", "ADMIN", "VIEW"];
  const rolesMap: Record<string, string> = {};

  for (const name of roleNames) {
    const role = await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name }
    });
    rolesMap[name] = role.id;
  }

  const workflows = [
    { requestType: "NEW_VM", level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
    { requestType: "NEW_VM", level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
    { requestType: "NEW_VM", level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: false },
    { requestType: "NEW_VM", level: 4, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: true },
    { requestType: "CUSTOMIZED", level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
    { requestType: "CUSTOMIZED", level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
    { requestType: "CUSTOMIZED", level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: false },
    { requestType: "CUSTOMIZED", level: 4, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: true },
    { requestType: "DECOMMISSION", level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: true },
    { requestType: "DECOMMISSION", level: 2, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: false },
    { requestType: "RENEWAL", level: 1, role: "APPROVER_L1", roleLabel: "Assistant Maintenance Engineer", isFinal: false },
    { requestType: "RENEWAL", level: 2, role: "APPROVER_L2", roleLabel: "Maintenance Engineer", isFinal: false },
    { requestType: "RENEWAL", level: 3, role: "APPROVER_L3", roleLabel: "System Analyst", isFinal: false },
    { requestType: "RENEWAL", level: 4, role: "DC_OPS", roleLabel: "DC OPS Team", isFinal: true },
  ];

  for (const w of workflows) {
    await prisma.approvalWorkflow.upsert({
      where: { requestType_level: { requestType: w.requestType, level: w.level } },
      update: w,
      create: w
    });
  }

  return rolesMap;
}

async function seedUsers() {
  console.log("🌱 Seeding Roles and Users from UserList.json...");
  const rolesMap = await ensureRolesAndWorkflows();

  const userListPath = path.join(process.cwd(), 'data', 'UserList.json');
  if (!fs.existsSync(userListPath)) {
    console.log("⚠️  UserList.json not found, skipping base user seeding.");
    return;
  }

  const userData = JSON.parse(fs.readFileSync(userListPath, 'utf8'));
  const passwordHashes: Record<string, string> = {};

  for (const user of userData) {
    let email = user.email;
    if (!email) {
      const normalized = normalizeName(user.name).replace(/\s+/g, '.');
      email = `${normalized}@dghs.gov.bd`;
    }

    const rawPassword = user.password || DEFAULT_PASSWORD;
    if (!passwordHashes[rawPassword]) {
      passwordHashes[rawPassword] = await bcrypt.hash(rawPassword, 12);
    }
    const hashedPassword = passwordHashes[rawPassword];

    const userIdToSet = user.id || (email.toLowerCase() === "ame@mis.dghs.gov.bd" ? "3834df81-62d8-4dcc-9dea-0ace73b4e9e2" : undefined);
    const dbUser = await prisma.user.upsert({
      where: { email },
      update: {
        name: user.name,
        contact: user.contact || null,
        designation: user.designation || null,
        organization: user.organization || null,
        isActive: true,
      },
      create: {
        ...(userIdToSet ? { id: userIdToSet } : {}),
        email,
        name: user.name,
        contact: user.contact || null,
        designation: user.designation || null,
        organization: user.organization || null,
        password: hashedPassword,
        isActive: true,
      }
    });

    const userRoles = user.roles || [{ role: { name: "REQUESTER" } }];
    for (const roleEntry of userRoles) {
      let rName: string | undefined;
      if (typeof roleEntry === 'string') {
        rName = roleEntry;
      } else if (roleEntry && typeof roleEntry === 'object' && roleEntry.role && typeof roleEntry.role === 'object') {
        rName = roleEntry.role.name;
      }

      if (!rName) continue;

      const roleId = rolesMap[rName.toUpperCase()];
      if (roleId) {
        await prisma.userRole.upsert({
          where: { userId_roleId: { userId: dbUser.id, roleId } },
          update: {},
          create: { userId: dbUser.id, roleId }
        });
      }
    }
  }

  console.log("✅ Roles, Users, and Workflows seeded.");
}

/**
 * Imports VM inventory, hardware specs, and missing users (e.g. unknwon@mis.dghs.gov.bd) from CSV
 */
async function seedFromCSV(customCsvPath?: string) {
  const csvFilePath = customCsvPath || path.join(process.cwd(), 'data', 'vm_import.csv');
  console.log(`\n======================================================`);
  console.log(`📥 Starting CSV VM & Spec Import from: ${csvFilePath}`);
  console.log(`======================================================\n`);

  if (!fs.existsSync(csvFilePath)) {
    throw new Error(`CSV file not found at: ${csvFilePath}`);
  }

  // 1. Ensure system roles exist
  const rolesMap = await ensureRolesAndWorkflows();
  const requesterRoleId = rolesMap["REQUESTER"];

  // 2. Read and parse CSV
  const content = fs.readFileSync(csvFilePath, 'utf8');
  const rows = parseCSV(content);

  if (rows.length <= 1) {
    console.log("⚠️  CSV file is empty or contains only headers.");
    return;
  }

  console.log(`📊 Found ${rows.length - 1} data rows in CSV.\n`);

  // 3. Scan all unique users from CSV and collect metadata
  const userMetadataMap = new Map<string, {
    names: Set<string>;
    departments: Set<string>;
    designations: Set<string>;
    contacts: Set<string>;
  }>();

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawEmail = (r[10] || "").trim().toLowerCase();
    if (!rawEmail || rawEmail === "(null)" || rawEmail === "null") continue;

    if (!userMetadataMap.has(rawEmail)) {
      userMetadataMap.set(rawEmail, {
        names: new Set(),
        departments: new Set(),
        designations: new Set(),
        contacts: new Set(),
      });
    }

    const meta = userMetadataMap.get(rawEmail)!;
    const name = clean(r[7]);
    const dept = clean(r[8]);
    const desig = clean(r[9]);
    const con = clean(r[11]);

    if (name) meta.names.add(name);
    if (dept) meta.departments.add(dept);
    if (desig) meta.designations.add(desig);
    if (con) meta.contacts.add(con);
  }

  console.log(`👥 Found ${userMetadataMap.size} unique requester emails in CSV.`);

  // 4. Fetch existing users to create missing ones
  const allDbUsers = await prisma.user.findMany({
    select: { id: true, email: true, name: true }
  });
  const userEmailMap: Record<string, string> = {};
  allDbUsers.forEach(u => {
    userEmailMap[u.email.toLowerCase()] = u.id;
  });

  const defaultPasswordHash = await bcrypt.hash(DEFAULT_PASSWORD, 12);
  let createdUsersCount = 0;

  for (const [email, meta] of userMetadataMap.entries()) {
    if (!userEmailMap[email]) {
      // Pick best name
      let displayName = Array.from(meta.names)[0] || "";
      if (!displayName) {
        if (email.includes("unknwon") || email.includes("unknown")) {
          displayName = "Unknown Requester";
        } else {
          const handle = email.split("@")[0].replace(/[._-]/g, " ");
          displayName = handle
            .split(" ")
            .map(w => w.charAt(0).toUpperCase() + w.slice(1))
            .join(" ");
        }
      }

      const department = Array.from(meta.departments)[0] || "MIS, DGHS";
      const designation = Array.from(meta.designations)[0] || "Requester";
      const contact = Array.from(meta.contacts)[0] || null;

      const newUser = await prisma.user.create({
        data: {
          email,
          name: displayName,
          organization: department,
          designation,
          contact,
          password: defaultPasswordHash,
          isActive: true,
        }
      });

      if (requesterRoleId) {
        await prisma.userRole.create({
          data: { userId: newUser.id, roleId: requesterRoleId }
        });
      }

      userEmailMap[email] = newUser.id;
      createdUsersCount++;
      console.log(`  ➕ Created missing user: ${displayName} <${email}>`);
    }
  }

  if (createdUsersCount > 0) {
    console.log(`\n✅ Created ${createdUsersCount} missing users with role REQUESTER.`);
  } else {
    console.log(`\n✅ All ${userMetadataMap.size} requester users already exist in DB.`);
  }

  // 5. Cache existing VMs to handle updates and unique constraints
  const existingVms = await prisma.vmInstance.findMany({
    select: {
      id: true,
      hostname: true,
      ipAddress: true,
      currentSpecId: true,
      systemName: true,
      subdomain: true,
      publicIpAddress: true,
      ownerId: true,
      environment: true,
    }
  });

  const existingVmByHost = new Map<string, typeof existingVms[0]>();
  const usedIps = new Set<string>();
  const usedHostnames = new Set<string>();

  existingVms.forEach(v => {
    if (v.hostname) {
      existingVmByHost.set(v.hostname.toLowerCase(), v);
    }
    if (v.ipAddress) {
      usedIps.add(v.ipAddress.toLowerCase());
    }
  });

  // 6. Process VM rows from CSV
  let createdVmCount = 0;
  let updatedVmCount = 0;
  let createdSpecCount = 0;
  let credentialsSavedCount = 0;
  let skippedDuplicatesCount = 0;

  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const rawHost = clean(r[0]);
    if (!rawHost) continue;

    const hostname = rawHost.trim();
    const hostnameLower = hostname.toLowerCase();

    // Skip in-file duplicates
    if (usedHostnames.has(hostnameLower)) {
      skippedDuplicatesCount++;
      continue;
    }
    usedHostnames.add(hostnameLower);

    // Map owner
    const requesterEmail = (r[10] || "").trim().toLowerCase();
    const ownerId = userEmailMap[requesterEmail] || null;

    // Environment mapping
    const serverType = clean(r[12]).toLowerCase();
    let env: Environment = Environment.PRODUCTION;
    if (serverType === "development") env = Environment.DEVELOPMENT;
    else if (serverType === "testing" || serverType === "poc") env = Environment.TESTING;
    else if (serverType === "staging") env = Environment.STAGING;
    else if (hostnameLower.includes("dev")) env = Environment.DEVELOPMENT;
    else if (hostnameLower.includes("test")) env = Environment.TESTING;
    else if (hostnameLower.includes("stag")) env = Environment.STAGING;

    // IP address resolution
    const primIp = clean(r[5]);
    const privIp = clean(r[22]);
    const pubIp = clean(r[6]) || clean(r[21]);
    const rawIpField = r[4] || "";

    let candIp: string | null = null;
    if (primIp) candIp = primIp;
    else if (privIp) candIp = privIp;
    else if (rawIpField) {
      const match = rawIpField.match(/\b(?:\d{1,3}\.){3}\d{1,3}\b/);
      if (match) candIp = match[0];
    } else if (pubIp) {
      candIp = pubIp;
    }

    // IP uniqueness guard
    let ipAddress: string | null = null;
    if (candIp) {
      const candIpLower = candIp.toLowerCase();
      const existingWithThisHost = existingVmByHost.get(hostnameLower);
      const isAlreadyOwnedByThisVm = existingWithThisHost && existingWithThisHost.ipAddress?.toLowerCase() === candIpLower;

      if (!usedIps.has(candIpLower) || isAlreadyOwnedByThisVm) {
        ipAddress = candIp;
        usedIps.add(candIpLower);
      }
    }

    const publicIpAddress = pubIp || (candIp && candIp.startsWith("103.") ? candIp : null);

    // Subdomain & System Name
    const subdomain = clean(r[20]) || null;
    const systemName = clean(r[14]) || hostname;

    // Hardware Specs
    const vcpu = parseCpu(r[15], r[3], r[13]);
    const ramGb = parseRam(r[16], r[2], r[13]);
    const storageGb = parseStorage(r[17], r[1], r[13]);
    const { osName, osVersion } = parseOs(r[18], r[19], r[13]);

    const existingVm = existingVmByHost.get(hostnameLower);

    let vmInstanceId: string;

    if (!existingVm) {
      // Create new VM Instance
      const newVm = await prisma.vmInstance.create({
        data: {
          sequenceNumber: 1,
          hostname,
          ipAddress,
          publicIpAddress,
          status: VmStatus.ACTIVE,
          ownerId,
          environment: env,
          subdomain,
          systemName,
          hasRemoteAccess: !!publicIpAddress,
          provisionedAt: new Date(),
        }
      });

      vmInstanceId = newVm.id;

      // Create Spec
      const spec = await prisma.vmSpec.create({
        data: {
          vmInstanceId: newVm.id,
          vcpu,
          ramGb,
          storageGb,
          osName,
          osVersion,
          effectiveFrom: new Date(),
        }
      });

      await prisma.vmInstance.update({
        where: { id: newVm.id },
        data: { currentSpecId: spec.id }
      });

      createdVmCount++;
      createdSpecCount++;
    } else {
      vmInstanceId = existingVm.id;

      // Update existing VM details
      await prisma.vmInstance.update({
        where: { id: existingVm.id },
        data: {
          ipAddress: ipAddress || existingVm.ipAddress,
          publicIpAddress: publicIpAddress || existingVm.publicIpAddress,
          ownerId: ownerId || existingVm.ownerId,
          subdomain: subdomain || existingVm.subdomain,
          systemName: systemName || existingVm.systemName,
          environment: env || existingVm.environment,
        }
      });

      // Ensure spec exists
      if (existingVm.currentSpecId) {
        await prisma.vmSpec.update({
          where: { id: existingVm.currentSpecId },
          data: {
            vcpu,
            ramGb,
            storageGb,
            osName,
            osVersion,
          }
        });
      } else {
        const spec = await prisma.vmSpec.create({
          data: {
            vmInstanceId: existingVm.id,
            vcpu,
            ramGb,
            storageGb,
            osName,
            osVersion,
            effectiveFrom: new Date(),
          }
        });

        await prisma.vmInstance.update({
          where: { id: existingVm.id },
          data: { currentSpecId: spec.id }
        });
        createdSpecCount++;
      }

      updatedVmCount++;
    }

    // Credentials extraction from server details
    const creds = parseCredentials(r[13]);
    if (creds && creds.username) {
      try {
        const encryptedPass = encryptCredential(creds.password);
        await prisma.vmCredential.upsert({
          where: { vmInstanceId },
          update: {
            username: creds.username,
            password: encryptedPass,
          },
          create: {
            vmInstanceId,
            username: creds.username,
            password: encryptedPass,
          }
        });
        credentialsSavedCount++;
      } catch (err) {
        console.warn(`Could not save credentials for VM ${hostname}:`, err);
      }
    }
  }

  console.log(`\n======================================================`);
  console.log(`🎉 CSV Import Completed Successfully!`);
  console.log(`   - Missing Users Created: ${createdUsersCount}`);
  console.log(`   - VM Instances Created:  ${createdVmCount}`);
  console.log(`   - VM Instances Updated:  ${updatedVmCount}`);
  console.log(`   - VM Specs Generated:    ${createdSpecCount}`);
  console.log(`   - Credentials Seeded:    ${credentialsSavedCount}`);
  if (skippedDuplicatesCount > 0) {
    console.log(`   - Duplicate CSV Rows:    ${skippedDuplicatesCount} (deduplicated)`);
  }
  console.log(`======================================================\n`);
}

async function main() {
  const arg = process.argv[2];
  const customPath = process.argv[3];

  if (arg === '--users') {
    await seedUsers();
  } else if (arg === '--vms' || arg === '--csv') {
    await seedFromCSV(customPath);
  } else if (arg === '--clear' || arg === '--clear-all') {
    console.error("❌ Database wipe commands are disabled to protect production data.");
    process.exit(1);
  } else {
    // Default: Seed roles, base users, and complete inventory from CSV
    console.log("🚀 Running complete database seed (Users + CSV VM Inventory & Specs)...");
    await seedUsers();
    await seedFromCSV(customPath);
  }
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed with error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
