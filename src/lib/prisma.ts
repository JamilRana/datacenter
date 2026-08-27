// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import dns from "dns";
import net from "net";

// Force IPv4 resolution and disable Node's Happy Eyeballs autoSelectFamily
// to prevent ETIMEDOUT when connecting to cloud databases (e.g. Neon) on systems with unreachable IPv6 routes.
if (typeof dns.setDefaultResultOrder === "function") {
  dns.setDefaultResultOrder("ipv4first");
}
if (typeof (net as any).setDefaultAutoSelectFamily === "function") {
  (net as any).setDefaultAutoSelectFamily(false);
}

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

let prisma: PrismaClient;

if (process.env.TESTING_NOTIFICATIONS === "true") {
  prisma = {
    systemSetting: {
      findMany: async (_args: any) => {
        return (global as any).mockSmtpSettings || [];
      }
    },
    approval: {
      findMany: async (_args: any) => {
        return (global as any).mockApprovalList || [];
      }
    },
    notification: {
      create: async (args: any) => {
        return { id: "mock-notif-id", ...args.data };
      },
      findFirst: async (args: any) => {
        return (global as any).mockNotificationFindFirst ? (global as any).mockNotificationFindFirst(args) : null;
      }
    },
    vmInstance: {
      findMany: async (_args: any) => {
        return (global as any).mockVmList || [];
      },
      count: async () => 0
    },
    softwareLicense: {
      findMany: async (_args: any) => {
        return (global as any).mockLicenseList || [];
      }
    },
    user: {
      findMany: async (_args: any) => {
        return (global as any).mockUserList || [];
      },
      count: async () => 0
    },
    request: {
      findUnique: async (args: any) => {
        return (global as any).mockRequestFindUnique ? (global as any).mockRequestFindUnique(args) : null;
      }
    }
  } as any;
} else {
  if (!process.env.DATABASE_URL) {
    try {
      require("dotenv").config();
    } catch {}
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) {
    throw new Error("DATABASE_URL is not set");
  }
  const connectionString = rawUrl.trim().replace(/^['"]|['"]$/g, '');

  if (!globalForPrisma.pool) {
    globalForPrisma.pool = new Pool({
      connectionString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 15000,
    });
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(globalForPrisma.pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
