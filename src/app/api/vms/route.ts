// src/app/api/vms/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const ownerId = searchParams.get("ownerId");
  if (ownerId !== session.user.id) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }

  const vms = await prisma.vmInstance.findMany({
    where: { ownerId },
    orderBy: { createdAt: "desc" },
    include: {
      request: {
        select: {
          systemName: true,
          environment: true,
        },
      },
    },
  });

  return Response.json(vms);
}
