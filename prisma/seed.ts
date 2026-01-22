// prisma/seed.ts

import prisma from "../src/lib/prisma";
import dotenv from "dotenv";
dotenv.config();

import * as bcrypt from "bcryptjs";

async function main() {
  // 1. Create/Upsert Roles
  const roleNames = [
    "REQUESTER",
    "APPROVER_L1",
    "APPROVER_L2",
    "APPROVER_L3",
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
    ["APPROVER_L1", "ADMIN"]
  );

  // L2 Approver + Admin
  await createUserWithRoles(
    "me@mis.dghs.gov.bd",
    "Kazi Fabliha Tasnim",
    "Maintenance Engineer",
    ["APPROVER_L2", "ADMIN"]
  );

  // L3 Approver + Admin
  await createUserWithRoles(
    "sukhen@mis.dghs.gov.bd",
    "Sukhendu Shekhor Roy",
    "Maintenance Engineer",
    ["APPROVER_L3", "ADMIN"]
  );

  // DC Ops + View Access
  await createUserWithRoles(
    "dcops@mis.dghs.gov.bd",
    "Datacenter Operations Team",
    "DC Operations",
    ["DC_OPS", "VIEW"]
  );

  // Devops / Requester
  await createUserWithRoles(
    "requester@mis.dghs.gov.bd",
    "Sadman",
    "Devops Engineer",
    ["REQUESTER"]
  );

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
