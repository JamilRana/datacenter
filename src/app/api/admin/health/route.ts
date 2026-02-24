// src/app/api/admin/health/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { getSystemHealth } from "@/app/actions/settings-actions";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.roles?.includes("ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const health = await getSystemHealth();
    return NextResponse.json(health);
  } catch (error) {
    console.error("Error fetching health:", error);
    return NextResponse.json({ error: "Failed to fetch health" }, { status: 500 });
  }
}
