// test-db.ts
import dotenv from "dotenv";
dotenv.config(); // 👈 This reads .env

import { prisma } from "./src/lib/prisma";

async function test() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    console.log("✅ DB connected!");
  } catch (e: any) {
    console.error("❌ DB connection failed:", e.message);
    // Optional: log the URL (for debugging ONLY — remove in production!)
    console.log(
      "Using URL:",
      process.env.DATABASE_URL?.substring(0, 30) + "..."
    );
  } finally {
    await prisma.$disconnect();
  }
}

test();
