// src/app/actions/approval-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  ApprovalDecision, 
  RequestStatus,
  
  Prisma
} from "@prisma/client";
import { ROLES, canUserApprove } from "@/lib/roles";
import { notifyRequester } from "@/lib/notifications"; // ✅ Add this import
import { redirect } from "next/navigation";
import { fetchDashboardData } from "../approvals/lib";
import { ApprovalRequestDetail } from "@/types/approvals";

// export async function fetchApprovalData(requestId: string) {
//   const session = await getServerSession(authOptions);
//   if (!session?.user) redirect("/auth");
//   try{
//     const request = await prisma.request.findUnique({
//         where: { id: requestId },
//         include: {
//           requester: {select: {name: true, email: true, designation: true}},
//           approvals: {
//             include: { approver: true },
//             orderBy: { createdAt: "asc" }
//           },
//           vmInstances: true,
//           targetVm: true,
//         }
//       });

//     if (!request) throw new Error("Request not found");

//     return request;
//   }
//   catch(error){
//     console.log(error);
//     throw error;
//   }
// }

export async function fetchApprovalData(
  requestId: string
): Promise<ApprovalRequestDetail | null> {
  const session = await getServerSession(authOptions);
  if (!session?.user) return null;

  try {
    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        requester: { select: { name: true, email: true, designation: true } },
        approvals: {
          select: {
            // ✅ MUST include these exact fields Timeline expects
            id: true,
            entityType: true,
            entityId: true,
            level: true,        // Critical for Timeline matching
            approverId: true,
            decision: true,     // NOT "status" - this is the approval decision
            comments: true,
            decidedAt: true,
            createdAt: true,
            // Include relation with minimal fields
            approver: {
              select: { 
                id: true, 
                name: true, 
                email: true 
              } 
            }
          },
          orderBy: { createdAt: "asc" }
        },
        vmInstances: true,
        targetVm: true,
      }
    });

    if (!request) return null;
    
    // ✅ Explicitly cast to match ApprovalRequestDetail shape
    // (Prisma payload matches our interface structure)
    return request as unknown as ApprovalRequestDetail;
  } catch (error) {
    console.error("Approval fetch error:", error);
    return null;
  }
}

export async function getDashboardData() {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const userRoles = session.user.roles;
  const isAdmin = userRoles.includes(ROLES.ADMIN);

  return fetchDashboardData(userRoles, isAdmin);
}

export async function handleApprovalDecision(
  requestId: string,
  decision: "APPROVED" | "REJECTED" | "RETURNED",
  comments: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles;

  return await prisma.$transaction(async (tx) => {
    // 1. Try to fetch as Request first
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: { 
        approvals: true, 
        requester: true,
        vmInstances: true
      },
    });

    let customization = null;
    let entityType: "REQUEST" | "CUSTOMIZATION" = "REQUEST";

    // 2. If not found as Request, try as CustomizationRequest
    if (!request) {
      customization = await tx.customizationRequest.findUnique({
        where: { id: requestId },
        include: { 
          requester: true, 
          targetVm: true 
        },
      });
      if (customization) {
        entityType = "CUSTOMIZATION";
      } else {
        throw new Error("Request or Customization not found");
      }
    }

    // 3. Determine current status and level
    const currentStatus = request?.status || customization?.status;
    if (!currentStatus) throw new Error("Invalid request status");

    let currentLevel: "L1" | "L2" | "L3" | null = null;
    if (currentStatus === "PENDING_L1") currentLevel = "L1";
    else if (currentStatus === "PENDING_L2") currentLevel = "L2";
    else if (currentStatus === "PENDING_L3") currentLevel = "L3";

    if (!currentLevel) throw new Error("Request is not in an approval stage");

    // 4. RBAC Check
    if (!canUserApprove(userRoles, currentLevel)) {
      throw new Error(`User cannot approve at level ${currentLevel}`);
    }

    if (decision === "REJECTED" && !comments) {
      throw new Error("Rejection requires a mandatory comment");
    }

    // 5. Create Approval record
    await tx.approval.create({
       data:{
        entityId: requestId,
        entityType: entityType,
        approverId: session.user.id,
        level: currentLevel,
        decision: decision as ApprovalDecision,
        comments,
        decidedAt: new Date(),
      },
    });

    // 6. Determine next status
    let nextStatus: RequestStatus = currentStatus;

    if (decision === "REJECTED") {
      nextStatus = "REJECTED";
    } else if (decision === "RETURNED") {
      nextStatus = "DRAFT";
    } else if (decision === "APPROVED") {
      const requestType = request?.requestType || "CUSTOMIZED";
      
      if (requestType === "DECOMMISSION") {
        nextStatus = "APPROVED";
      } else {
        if (currentLevel === "L1") nextStatus = "PENDING_L2";
        else if (currentLevel === "L2") nextStatus = "PENDING_L3";
        else if (currentLevel === "L3") nextStatus = "APPROVED";
      }
    }

    // 7. Update entity
    if (entityType === "REQUEST") {
      await tx.request.update({
        where: { id: requestId },
         data:{ status: nextStatus },
      });
    } else {
      await tx.customizationRequest.update({
        where: { id: requestId },
         data:{ status: nextStatus },
      });
    }

    // 8. Audit Log
    await tx.auditLog.create({
       data:{
        actorId: session.user.id,
        action: `DECISION_${decision}_${currentLevel}`,
        entityType: entityType,
        entityId: requestId,
        details: JSON.stringify({ 
          comments, 
          previousStatus: currentStatus, 
          nextStatus,
          requestType: request?.requestType || "CUSTOMIZED"
        }),
      },
    });

    revalidatePath("/approvals");
    revalidatePath(`/requests/${requestId}`);
    revalidatePath(`/approvals/${requestId}`);

    return { 
      id: requestId, 
      status: nextStatus, 
      type: entityType,
      requestType: request?.requestType || "CUSTOMIZED"
    };
  });
}

/**
 * Handles DCOPS Execution (Final Step)
 */
export async function executeRequest(
  requestId: string,
  notes?: string
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  if (!session.user.roles.includes(ROLES.DCOPS) && !session.user.roles.includes(ROLES.ADMIN)) {
    throw new Error("Only DCOPS can execute requests");
  }

  return await prisma.$transaction(async (tx) => {
    // 1. Fetch entities with proper relations
    const request = await tx.request.findUnique({
      where: { id: requestId },
      include: { 
        requester: true,
        vmInstances: true,
        targetVm: true,
        // ✅ Include all required relations
        additionalDisks: true,
        firewallPorts: true,
        networkAccess: true
      },
    });

    let customization = null;
    let entityType: "REQUEST" | "CUSTOMIZATION" = "REQUEST";

    if (!request) {
      customization = await tx.customizationRequest.findUnique({
        where: { id: requestId },
        include: { 
          requester: true, 
          targetVm: true,
          // ✅ Include customization relations
          additionalDisks: true,
          firewallPorts: true,
          networkAccess: true
        },
      });
      if (customization) {
        entityType = "CUSTOMIZATION";
      } else {
        throw new Error("Request entity not found");
      }
    }

    const currentStatus = request?.status || customization?.status;
    if (currentStatus !== "APPROVED") {
      throw new Error(`Request must be APPROVED before execution. Current status: ${currentStatus}`);
    }

    const requestType = request?.requestType || "CUSTOMIZED";
    const requesterId = request?.requesterId || customization?.requesterId;
    const targetVmId = request?.targetVmId || customization?.targetVmId;
    const systemName = request?.systemName || customization?.targetVm?.hostname || "VM";

    if (!requesterId) {
      throw new Error("Requester ID not found");
    }

    if (!targetVmId) {
      throw new Error("Target VM ID not found");
    }

    // 2. Execute based on type
    if (entityType === "REQUEST") {
      if (requestType === "NEW_VM") {
        await tx.request.update({
          where: { id: requestId },
          data: { status: "PROVISIONED", provisionedAt: new Date() },
        });
        await notifyRequester(requesterId, systemName, "PROVISIONED");
        
      } else if (requestType === "CUSTOMIZED") {
        const latestSpec = await tx.vmSpec.findFirst({
          where: { vmInstanceId: targetVmId },
          orderBy: { createdAt: "desc" }
        });

        const specData: Prisma.VmSpecCreateInput = {
          // ✅ Correct relation syntax
          vmInstance: { connect: { id: targetVmId } },
          vcpu: request!.vcpu || latestSpec?.vcpu || 0,
          ramGb: request!.ramGb || latestSpec?.ramGb || 0,
          storageGb: request!.storageGb || latestSpec?.storageGb || 0,
          osName: request!.osName || latestSpec?.osName || null,
          osVersion: request!.osVersion || latestSpec?.osVersion || null,
          sourceRequest: { connect: { id: requestId } },
          effectiveFrom: new Date(),
          
          // ✅ Nested relations
          additionalDisks: {
            create: (request!.additionalDisks || []).map((disk, i) => ({
              sizeGb: disk.sizeGb,
              purpose: disk.purpose,
              sequence: i
            }))
          },
          firewallPorts: {
            create: (request!.firewallPorts || []).map(port => ({
              port: port.port,
              protocol: port.protocol,
              purpose: port.purpose,
              source: port.source
            }))
          },
          networkAccess: {
            create: (request!.networkAccess || []).map(access => ({
              accessType: access.accessType
            }))
          }
        };

        const newSpec = await tx.vmSpec.create({ data: specData });

        await tx.vmInstance.update({
          where: { id: targetVmId },
          data: { currentSpecId: newSpec.id }
        });

        await tx.request.update({
          where: { id: requestId },
          data: { status: "PROVISIONED" },
        });
        await notifyRequester(requesterId, systemName, "PROVISIONED");
        
      } else if (requestType === "DECOMMISSION") {
        await tx.vmInstance.update({
          where: { id: targetVmId },
          data: { status: "RETIRED", decommissionedAt: new Date() }
        });
        await tx.request.update({
          where: { id: requestId },
          data: { status: "CLOSED" },
        });
        await notifyRequester(requesterId, systemName, "CLOSED");
      }
      
    } else {
      // Handle CUSTOMIZATION_REQUEST execution
      const latestSpec = await tx.vmSpec.findFirst({
        where: { vmInstanceId: targetVmId },
        orderBy: { createdAt: "desc" }
      });

      const specData: Prisma.VmSpecCreateInput = {
        vmInstance: { connect: { id: targetVmId } },
        vcpu: customization!.vcpu || latestSpec?.vcpu || 0,
        ramGb: customization!.ramGb || latestSpec?.ramGb || 0,
        storageGb: customization!.storageGb || latestSpec?.storageGb || 0,
        osName: latestSpec?.osName || null,
        osVersion: latestSpec?.osVersion || null,
        sourceRequest: { connect: { id: requestId } },
        effectiveFrom: new Date(),
        
        additionalDisks: {
          create: (customization!.additionalDisks || []).map((disk, i) => ({
            sizeGb: disk.sizeGb,
            purpose: disk.purpose,
            sequence: i
          }))
        },
        firewallPorts: {
          create: (customization!.firewallPorts || []).map(port => ({
            port: port.port,
            protocol: port.protocol,
            purpose: port.purpose,
            source: port.source
          }))
        },
        networkAccess: {
          create: (customization!.networkAccess || []).map(access => ({
            accessType: access.accessType
          }))
        }
      };

      const newSpec = await tx.vmSpec.create({ data: specData });

      await tx.vmInstance.update({
        where: { id: targetVmId },
        data: { currentSpecId: newSpec.id }
      });
      
      await tx.customizationRequest.update({
        where: { id: requestId },
        data: { status: "PROVISIONED" },
      });
      await notifyRequester(requesterId, systemName, "PROVISIONED");
    }

    // 3. Audit Log
    await tx.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "EXECUTION_COMPLETED",
        entityType: entityType,
        entityId: requestId,
        details: JSON.stringify({ notes }),
      },
    });

    revalidatePath("/approvals");
    revalidatePath(`/requests/${requestId}`);
    return { success: true };
  });
}