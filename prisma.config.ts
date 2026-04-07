import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",

    // ✅ FIX: use ts-node (already added in Dockerfile)
    seed: "npx ts-node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL!,
  },
});