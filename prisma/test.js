const { PrismaClient } = require('@prisma/client');
console.log("Starting test...");
try {
  const prisma = new PrismaClient();
  console.log("Prisma initialized successfully");
  prisma.$disconnect();
} catch (e) {
  console.error("Failed to initialize Prisma:", e);
}
