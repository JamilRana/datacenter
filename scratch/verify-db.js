require('dotenv').config();
const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  const usersCount = await prisma.user.count();
  console.log("Total users in DB:", usersCount);

  // Print a user with multiple roles to verify roles association
  const multiRoleUser = await prisma.user.findFirst({
    where: {
      email: "system.analyst@mis.dghs.gov.bd"
    },
    include: {
      roles: {
        include: {
          role: true
        }
      }
    }
  });

  if (multiRoleUser) {
    console.log("User:", multiRoleUser.name);
    console.log("Email:", multiRoleUser.email);
    console.log("Roles assigned:", multiRoleUser.roles.map(r => r.role.name));
  } else {
    console.log("Could not find sample user.");
  }
}

main()
  .catch(console.error)
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
