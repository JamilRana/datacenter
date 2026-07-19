import { createRequest } from "@/app/actions/request-actions";
import { createCustomizationRequest } from "@/app/actions/customization-actions";
import { createDecommissionRequest } from "@/app/actions/decommission-actions";
import { createCloneRequest } from "@/app/actions/clone-actions";
import { createK8sNamespaceRequest } from "@/app/actions/k8s-actions";
import { createAccessRequest } from "@/app/actions/access-actions";
import { NextResponse } from "next/server";
import { RequestStatus } from "@prisma/client";

export async function POST(req: Request) {
  try {
    const formData = await req.formData();
    const requestType = formData.get("requestType")?.toString();

    if (requestType === "CUSTOMIZED") {
      const result = await createCustomizationRequest(formData);
      return NextResponse.json(result, { status: 201 });
    }

    if (requestType === "DECOMMISSION") {
      const decommissionData = new FormData();
      decommissionData.append("targetVmId", formData.get("targetVmId")?.toString() || "");
      decommissionData.append("reason", formData.get("reason")?.toString() || "");
      decommissionData.append("status", RequestStatus.DRAFT);
      
      const result = await createDecommissionRequest(decommissionData);
      return NextResponse.json(result, { status: 201 });
    }

    if (requestType === "CLONE_VM") {
      const result = await createCloneRequest(formData);
      return NextResponse.json(result, { status: 201 });
    }

    if (requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") {
      const result = await createAccessRequest(formData);
      return NextResponse.json(result, { status: 201 });
    }

    if (requestType === "K8S_NAMESPACE") {
      const result = await createK8sNamespaceRequest(formData);
      return NextResponse.json(result, { status: 201 });
    }

    // Default handler for NEW_VM, RENEWAL
    const result = await createRequest(formData);
    return NextResponse.json(result, { status: 201 });
  } catch (error) {
    console.error("API Route Error [POST /api/requests]:", error);
    return NextResponse.json(
      { error: "Internal Server Error" },
      { status: error === "Unauthorized" ? 401 : 500 }
    );
  }
}
