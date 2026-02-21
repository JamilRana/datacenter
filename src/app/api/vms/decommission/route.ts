// src/app/api/vm/decommission/route.ts
import { NextRequest } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { createDecommissionRequest } from "@/app/actions/decommission-actions";

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { vmId, reason } = await req.json();
  if (!vmId || !reason) {
    return Response.json({ error: "Missing vmId or reason" }, { status: 400 });
  }

  try {
    const decommissionFormData = new FormData();
    decommissionFormData.append("targetVmId", vmId);
    decommissionFormData.append("reason", reason);
    decommissionFormData.append("status", "PENDING_L1");
    
    await createDecommissionRequest(decommissionFormData);
    return Response.json({ success: true });
  } catch (err) {
    return Response.json({ error: err }, { status: 400 });
  }
}