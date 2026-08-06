import { PrismaClient, RequestType, RequestStatus, ServerType, Environment, Protocol, LicenseProvider, ApprovalDecision, ApprovalEntityType } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import * as path from 'path';
import * as fs from 'fs';
import * as bcrypt from 'bcryptjs';

// Load .env
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

const DEFAULT_PASSWORD = process.env.SEED_DEFAULT_PASSWORD || "Dghs@123";

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

async function seedUsers() {
  console.log("🌱 Seeding Roles and Users from UserList.json...");

  // 1. Roles
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

  // 2. Users from UserList.json
  const userData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'UserList.json'), 'utf8'));
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

  // 3. Workflows
  const workflows = [
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

  for (const w of workflows) {
    await prisma.approvalWorkflow.upsert({
      where: { requestType_level: { requestType: w.requestType, level: w.level } },
      update: w,
      create: w
    });
  }

  console.log("✅ Roles, Users, and Workflows seeded.");
}

async function seedVMs() {
  console.log("🌱 Seeding VM Inventory (Strict Matching)...");

  // Fetch all existing users for mapping
  const allUsers = await prisma.user.findMany();
  const userEmailMap: Record<string, string> = {};
  const userNameMap: Record<string, string> = {};
  
  allUsers.forEach(u => {
    userEmailMap[u.email.toLowerCase()] = u.id;
    userNameMap[normalizeName(u.name)] = u.id;
  });

  const vmData = JSON.parse(fs.readFileSync(path.join(process.cwd(), 'data', 'VmList.json'), 'utf8'));
  const usedHostnames = new Set<string>();
  const usedIps = new Set<string>();

  let seededCount = 0;
  let unassignedCount = 0;

  for (const vm of vmData) {
    // Only seed if it looks like a provisioned VM
    const s = (vm.status || "").toLowerCase();
    const isProvisioned = s.includes("deployed") || s.includes("approved") || vm.ip_address;
    
    if (!isProvisioned) continue;

    let hostname = vm.server_name || `vm-${vm.id}`;
    hostname = hostname.replace(/\s+/g, '-').toLowerCase();
    
    // Skip duplicates in CSV/JSON
    if (usedHostnames.has(hostname)) continue;
    
    let ipAddress = vm.ip_address || null;
    if (ipAddress && usedIps.has(ipAddress)) {
      ipAddress = null;
    }

    usedHostnames.add(hostname);
    if (ipAddress) usedIps.add(ipAddress);

    // Try mapping to existing user
    let userId: string | null = null;
    
    // 1. Try Email
    if (vm.user_info?.email) {
        userId = userEmailMap[vm.user_info.email.toLowerCase()] || null;
    }
    
    // 2. Try Normalized Name if still null
    if (!userId && vm.requester) {
        userId = userNameMap[normalizeName(vm.requester)] || null;
    }

    if (!userId) unassignedCount++;

    // Determine environment
    let env: Environment = Environment.PRODUCTION;
    if (hostname.includes("dev") || hostname.includes("test")) env = Environment.DEVELOPMENT;
    else if (hostname.includes("stag")) env = Environment.STAGING;

    // Hardware Parsing
    const vcpu = parseInt(vm.cpu) || 1;
    const ramGb = parseInt(vm.ram) || 1;
    let storageGb = 0;
    (vm.storage || "").split('+').forEach((p: string) => storageGb += parseInt(p) || 0);
    if (storageGb === 0) storageGb = 20;

    // Check if hostname already exists to prevent data deletion / duplicate errors
    const existingVm = await prisma.vmInstance.findUnique({
      where: { hostname }
    });

    if (!existingVm) {
      const vmInstance = await prisma.vmInstance.create({
        data: {
          sequenceNumber: 1,
          hostname,
          ipAddress,
          status: "ACTIVE",
          ownerId: userId, // NULL if no match found
          environment: env,
          subdomain: vm.subdomain || null,
          provisionedAt: vm.deployment_date ? new Date(vm.deployment_date) : new Date(),
        }
      });

      const spec = await prisma.vmSpec.create({
        data: {
          vmInstanceId: vmInstance.id,
          vcpu,
          ramGb,
          storageGb,
          osName: vm.os || "Ubuntu",
          effectiveFrom: vm.deployment_date ? new Date(vm.deployment_date) : new Date(),
        }
      });

      await prisma.vmInstance.update({
        where: { id: vmInstance.id },
        data: { currentSpecId: spec.id }
      });

      seededCount++;
    } else {
      // Update details safely if it already exists, retaining spec and requests
      await prisma.vmInstance.update({
        where: { id: existingVm.id },
        data: {
          ipAddress: ipAddress || existingVm.ipAddress,
          ownerId: userId || existingVm.ownerId,
          subdomain: vm.subdomain || existingVm.subdomain,
        }
      });
    }
  }

  console.log(`✅ Seeded/Updated ${seededCount} VM Instances (without deleting existing records).`);
  if (unassignedCount > 0) {
    console.log(`⚠️  ${unassignedCount} VMs could not be matched to a user in UserList.json and are unassigned.`);
  }
}

async function main() {
  const arg = process.argv[2];

  if (arg === '--users') {
    await seedUsers();
  } else if (arg === '--vms') {
    await seedVMs();
  } else if (arg === '--clear' || arg === '--clear-all') {
    console.error("❌ Database wipe commands are disabled to protect production data.");
    process.exit(1);
  } else {
    // If no arg, provide usage
    console.log("Usage: npx tsx prisma/seed.ts [--users | --vms]");
    console.log("Hint: Always run --users before --vms to ensure proper owner matching.");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
