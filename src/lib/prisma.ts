// src/lib/prisma.ts
import { PrismaClient } from "@prisma/client";
import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

let prisma: any;

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
      }
    },
    softwareLicense: {
      findMany: async (_args: any) => {
        return (global as any).mockLicenseList || [];
      }
    },
    user: {
      findMany: async (_args: any) => {
        return (global as any).mockUserList || [];
      }
    },
    request: {
      findUnique: async (args: any) => {
        return (global as any).mockRequestFindUnique ? (global as any).mockRequestFindUnique(args) : null;
      }
    }
  };
} else {
  const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient; pool?: Pool };

  const connectionString = process.env.DATABASE_URL || "";

  let pool: Pool;
  if (process.env.NODE_ENV !== "production") {
    if (!globalForPrisma.pool) {
      globalForPrisma.pool = new Pool({ 
        connectionString,
        max: 5,
        idleTimeoutMillis: 10000,
        connectionTimeoutMillis: 10000,
      });
      globalForPrisma.pool.connect().then(() => {
        console.log('Successfully connected to the database');
      }).catch((err) => {
        console.error('Database connection error:', err);
      });
    }
    pool = globalForPrisma.pool;
  } else {
    pool = new Pool({ 
      connectionString,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    });
    pool.connect().then(() => {
      console.log('Successfully connected to the database');
    }).catch((err) => {
      console.error('Database connection error:', err);
    });
  }

  if (!globalForPrisma.prisma) {
    const adapter = new PrismaPg(pool);
    globalForPrisma.prisma = new PrismaClient({ adapter });
  }
  prisma = globalForPrisma.prisma;
}

export default prisma;
