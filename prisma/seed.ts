import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const DEFAULT_PASSWORD_HASH = "$2b$12$Bzh9f3m9u0ZqXWGYR.qEruN2N4G6UjP.pTqHrkEclJ3A/1v2u9W2u";

async function main() {
  console.log("Starting seed...");

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

  for (const roleName of roleNames) {
    await prisma.role.upsert({
      where: { name: roleName },
      update: {},
      create: { name: roleName },
    });
  }
  console.log("Roles created");

  const adminRole = await prisma.role.findUnique({ where: { name: "ADMIN" } });
  const requesterRole = await prisma.role.findUnique({ where: { name: "REQUESTER" } });
  const dcopsRole = await prisma.role.findUnique({ where: { name: "DC_OPS" } });
  const approverL1Role = await prisma.role.findUnique({ where: { name: "APPROVER_L1" } });
  const approverL2Role = await prisma.role.findUnique({ where: { name: "APPROVER_L2" } });
  const approverL3Role = await prisma.role.findUnique({ where: { name: "APPROVER_L3" } });
  const developerRole = await prisma.role.findUnique({ where: { name: "DEVELOPER" } });

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
        create: [{ roleId: adminRole!.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "akber.hossain@mis.dghs.gov.bd" },
    update: {},
    create: {
      email: "akber.hossain@mis.dghs.gov.bd",
      name: "Akber Hossain",
      password: DEFAULT_PASSWORD_HASH,
      designation: "Programmer",
      organization: "MIS, DGHS",
      contact: "01234567891",
      isActive: true,
      roles: {
        create: [{ roleId: requesterRole!.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "zulfiker@nns-solution.net" },
    update: {},
    create: {
      email: "zulfiker@nns-solution.net",
      name: "Zulfiker Ali",
      password: DEFAULT_PASSWORD_HASH,
      designation: "System Admin",
      organization: "NNS Solution",
      contact: "",
      isActive: true,
      roles: {
        create: [{ roleId: dcopsRole!.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "ame@mis.dghs.gov.bd" },
    update: {},
    create: {
      email: "ame@mis.dghs.gov.bd",
      name: "Approver L1",
      password: DEFAULT_PASSWORD_HASH,
      designation: "AME",
      organization: "DGHS",
      contact: "01746605604",
      isActive: true,
      roles: {
        create: [{ roleId: approverL1Role!.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "me@mis.dghs.gov.bd" },
    update: {},
    create: {
      email: "me@mis.dghs.gov.bd",
      name: "Approver L2",
      password: DEFAULT_PASSWORD_HASH,
      designation: "Maintenance Engineer",
      organization: "DGHS",
      contact: "",
      isActive: true,
      roles: {
        create: [{ roleId: approverL2Role!.id }],
      },
    },
  });

  await prisma.user.upsert({
    where: { email: "sukhenbd@hotmail.com" },
    update: {},
    create: {
      email: "sukhenbd@hotmail.com",
      name: "Sukhendu Shekhor Roy",
      password: DEFAULT_PASSWORD_HASH,
      designation: "SSA",
      organization: "DGHS",
      contact: "01234567895",
      isActive: true,
      roles: {
        create: [{ roleId: approverL3Role!.id }],
      },
    },
  });

  console.log("Users created");

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
      where: {
        id: `${config.requestType}-${config.level}`,
      },
      update: config,
      create: {
        id: `${config.requestType}-${config.level}`,
        ...config,
      },
    });
  }
  console.log("Workflows created");

  console.log("Seed completed successfully!");
}

main()
  .catch((e) => {
    console.error("Seed error:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
