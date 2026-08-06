// src/app/api/requests/[id]/route.ts
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";


export async function PATCH(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id: requestId } = await context.params;
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const contentType = request.headers.get("content-type");
    if (!contentType || !contentType.includes("multipart/form-data")) {
      return NextResponse.json(
        { error: "Content-Type must be multipart/form-data" },
        { status: 400 }
      );
    }

    const formData = await request.formData();

    // ✅ Verify ownership (requester OR developer) and status
    const existingRequest = await prisma.request.findUnique({
      where: { id: requestId },
      select: { requesterId: true, developerId: true, status: true, requestType: true },
    });

    let customization = null;
    if (!existingRequest) {
      customization = await prisma.customizationRequest.findUnique({
        where: { id: requestId, requesterId: session.user.id }
      });
    }

    if (!existingRequest && !customization) {
      return NextResponse.json({ error: "Request not found" }, { status: 404 });
    }

    // Check if user can edit (requester, developer who created, or admin)
    if (existingRequest) {
      const isRequester = existingRequest.requesterId === session.user.id;
      const isDeveloper = existingRequest.developerId === session.user.id;
      const isAdmin = session.user.roles?.includes("ADMIN");
      
      if (!isRequester && !isDeveloper && !isAdmin) {
        return NextResponse.json({ error: "Unauthorized to edit this request" }, { status: 403 });
      }
    }

    const item = existingRequest || customization;
    if (item?.status !== "DRAFT") {
       return NextResponse.json({ error: "Only drafts can be edited" }, { status: 403 });
    }

    const { editRequest } = await import("@/app/actions/request-actions");
    const { updateCustomizationRequest } = await import("@/app/actions/customization-actions");
    const { editDecommissionRequest } = await import("@/app/actions/decommission-actions");
    formData.append("requestId", requestId);
    
    let updated;
    if (existingRequest && existingRequest.requestType === "DECOMMISSION") {
      const response = await editDecommissionRequest(formData) as { id: string } | { success: boolean; data?: { id: string } };
      updated = 'success' in response ? response.data : response;
    } else if (existingRequest) {
      const response = await editRequest(formData) as { id: string } | { success: boolean; data?: { id: string } };
      updated = 'success' in response ? response.data : response;
    } else {
      const response = await updateCustomizationRequest(requestId, formData) as { id: string } | { success: boolean; data?: { id: string } };
      updated = 'success' in response ? response.data : response;
    }
    
    if (!updated?.id) {
      return NextResponse.json({ error: "Failed to update request" }, { status: 500 });
    }
    
    return NextResponse.json(
      { message: "Request updated successfully", requestId: updated.id },
      { status: 200 }
    );
  } catch (error) {
    console.error("PATCH Request Error:", error);
    return NextResponse.json(
      { error: "Failed to update request" },
      { status: 500 }
    );
  }
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await context.params;
      const requestData = await prisma.request.findUnique({
        where: { id },
        select: { requesterId: true, developerId: true, status: true, requestType: true },
      });
      if (requestData) {
        return NextResponse.json({ ...requestData, type: "REQUEST" });
      }
      const customization = await prisma.customizationRequest.findUnique({
        where: { id },
        select: { requesterId: true, status: true },
      });
      if (customization) {
        return NextResponse.json({ ...customization, type: "CUSTOMIZATION", requestType: "CUSTOMIZED" });
      }
      return NextResponse.json({ error: "Not found" }, { status: 404 });
  }catch(error){
    console.log(error);
    return NextResponse.json({ error: "Failed to load request" }, { status: 500 });
  }
}