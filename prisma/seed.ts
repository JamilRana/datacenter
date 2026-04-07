import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

import * as bcrypt from "bcryptjs";

async function main() {
  // 1. Create/Upsert Roles
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

  console.log("🌱 Seeding roles...");
  for (const name of roleNames) {
    await prisma.role.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  // 2. Helper function to create user with multiple roles
  const createUserWithRoles = async (
    email: string,
    name: string,
    designation: string,
    roleNames: string[],
    password: string = process.env.SEED_DEFAULT_PASSWORD || "Dghs@123"
  ) => {
    const salt = await bcrypt.genSalt(12);
    const hashedPassword = await bcrypt.hash(password, salt);

    // Create or find user
    const user = await prisma.user.upsert({
      where: { email },
      update: { isActive: true },
      create: {
        email,
        name,
        password: hashedPassword,
        designation,
        isActive: true,
      },
    });

    // Assign multiple roles
    for (const roleName of roleNames) {
      const role = await prisma.role.findUnique({ where: { name: roleName } });
      if (role) {
        await prisma.userRole.upsert({
          where: {
            userId_roleId: {
              userId: user.id,
              roleId: role.id,
            },
          },
          update: {},
          create: {
            userId: user.id,
            roleId: role.id,
          },
        });
      }
    }

    console.log(
      `✅ User: ${name} (${email}) -> Roles: [${roleNames.join(", ")}]`
    );
    return user;
  };

  // 3. Seed Users based on your requirements

  // L1 Approver + Admin
  await createUserWithRoles(
    "ame@mis.dghs.gov.bd",
    "Younus Jamil Rana",
    "Assistant Maintenance Engineer",
    ["APPROVER_L1", "ADMIN","REQUESTER"]
  );

  // L2 Approver + Admin
  await createUserWithRoles(
    "me@mis.dghs.gov.bd",
    "Kazi Fabliha Tasnim",
    "Maintenance Engineer",
    ["APPROVER_L2", "ADMIN","REQUESTER"]
  );

  // L3 Approver + Admin
  await createUserWithRoles(
    "sukhen@mis.dghs.gov.bd",
    "Sukhendu Shekhor Roy",
    "Maintenance Engineer",
    ["APPROVER_L3", "ADMIN","REQUESTER"]
  );

  // DC Ops + View Access
  await createUserWithRoles(
    "dcops@mis.dghs.gov.bd",
    "Datacenter Operations Team",
    "DC Operations",
    ["DC_OPS", "VIEW"]
  );

    await createUserWithRoles(
    "director@mis.dghs.gov.bd",
    "Director",
    "Director",
    ["APPROVER_L4", "ADMIN"]
  );

    await createUserWithRoles(
    "dev@mis.dghs.gov.bd",
    "Developer",
    "Developer",
    ["DEVELOPER", "ADMIN"]
  );

  // Devops / Requester
  await createUserWithRoles(
    "requester@mis.dghs.gov.bd",
    "Sadman",
    "Devops Engineer",
    ["REQUESTER"]
  );

  // 3. Seed ApprovalWorkflow table
  console.log("🌱 Seeding approval workflows...");

  const workflows = [
    // NEW_VM workflow
    { requestType: "NEW_VM", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
    { requestType: "NEW_VM", level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
    { requestType: "NEW_VM", level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
    { requestType: "NEW_VM", level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },

    // CUSTOMIZED workflow
    { requestType: "CUSTOMIZED", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
    { requestType: "CUSTOMIZED", level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
    { requestType: "CUSTOMIZED", level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
    { requestType: "CUSTOMIZED", level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },

    // DECOMMISSION workflow
    { requestType: "DECOMMISSION", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: true },
    { requestType: "DECOMMISSION", level: 2, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },

    // RENEWAL workflow
    { requestType: "RENEWAL", level: 1, role: "APPROVER_L1", roleLabel: "Section Officer", isFinal: false },
    { requestType: "RENEWAL", level: 2, role: "APPROVER_L2", roleLabel: "Deputy Director", isFinal: false },
    { requestType: "RENEWAL", level: 3, role: "APPROVER_L3", roleLabel: "Director MIS", isFinal: true },
    { requestType: "RENEWAL", level: 4, role: "DC_OPS", roleLabel: "DCOPS", isFinal: true },
  ];

  for (const wf of workflows) {
    await prisma.approvalWorkflow.upsert({
      where: {
        requestType_level: { requestType: wf.requestType, level: wf.level },
      },
      update: {},
      create: wf,
    });
  }
  console.log("✅ Approval workflows seeded");

  console.log("\n🎉 Seeding completed successfully!");
}

main()
  .catch((e) => {
    console.error("❌ Seeding failed:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
