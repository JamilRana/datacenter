// src/app/approvals/lib.ts
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { 
  RequestStatus, 
  RequestType,
  CustomizationStatus,
  ApprovalDecision,
  Prisma
} from "@prisma/client";
import { DashboardRequest } from "@/types/approvals"; // Now uses string types

export type MetricColor = "slate" | "amber" | "emerald" | "red" | "blue";

export async function fetchDashboardData(
  userId: string, 
  userRoles: string[], 
  isAdmin: boolean,
  page: number = 1,
  pageSize: number = 20
) {
  const skip = (page - 1) * pageSize;

  // ✅ SEPARATE STATUS ARRAYS WITH CORRECT ENUM TYPES
  // Include DECOMMISSION statuses for L1 approvers
  const pendingRequestStatuses = Array.from(new Set([
    ...(userRoles.includes(ROLES.L1_APPROVER) ? [RequestStatus.PENDING_L1] : []),
    ...(userRoles.includes(ROLES.L2_APPROVER) ? [RequestStatus.PENDING_L2] : []),
    ...(userRoles.includes(ROLES.L3_APPROVER) ? [RequestStatus.PENDING_L3] : []),
    ...(userRoles.includes(ROLES.L4_APPROVER) ? [RequestStatus.PENDING_L4] : []),
    ...(userRoles.includes(ROLES.DCOPS) ? [RequestStatus.APPROVED, RequestStatus.PROVISIONED] : []),
    ...(isAdmin ? [RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3, RequestStatus.PENDING_L4, RequestStatus.APPROVED, RequestStatus.PROVISIONED] : []),
  ]));

  const pendingCustomizationStatuses = Array.from(new Set([
    ...(userRoles.includes(ROLES.L1_APPROVER) ? [CustomizationStatus.PENDING_L1] : []),
    ...(userRoles.includes(ROLES.L2_APPROVER) ? [CustomizationStatus.PENDING_L2] : []),
    ...(userRoles.includes(ROLES.L3_APPROVER) ? [CustomizationStatus.PENDING_L3] : []),
    ...(userRoles.includes(ROLES.DCOPS) ? [CustomizationStatus.APPROVED, CustomizationStatus.APPLIED] : []),
    ...(isAdmin ? [CustomizationStatus.PENDING_L1, CustomizationStatus.PENDING_L2, CustomizationStatus.PENDING_L3, CustomizationStatus.APPROVED, CustomizationStatus.APPLIED] : []),
  ]));

  // ✅ DEFINE FILTERING LOGIC
  // Admins see everything in target statuses
  // DCOps see everything in APPROVED status
  // Approvers see ONLY what is assigned to them
  
  let requestWhere: Prisma.RequestWhereInput;
  if (isAdmin) {
    requestWhere = { status: { in: pendingRequestStatuses as RequestStatus[] } };
  } else {
    const orConditions: Prisma.RequestWhereInput[] = [
      { 
        status: { in: pendingRequestStatuses.filter(s => s !== RequestStatus.APPROVED && s !== RequestStatus.PROVISIONED) as RequestStatus[] },
        approvals: { some: { approverId: userId, decision: ApprovalDecision.PENDING } }
      }
    ];
    if (userRoles.includes(ROLES.DCOPS)) {
      orConditions.push({ status: { in: [RequestStatus.APPROVED, RequestStatus.PROVISIONED] } });
    }
    requestWhere = { OR: orConditions };
  }

  let customizationWhere: Prisma.CustomizationRequestWhereInput;
  if (isAdmin) {
    customizationWhere = { status: { in: pendingCustomizationStatuses as CustomizationStatus[] } };
  } else {
    const orConditions: Prisma.CustomizationRequestWhereInput[] = [
      { 
        status: { in: pendingCustomizationStatuses.filter(s => s !== CustomizationStatus.APPROVED && s !== CustomizationStatus.APPLIED) as CustomizationStatus[] },
        approvals: { some: { approverId: userId, decision: ApprovalDecision.PENDING } }
      }
    ];
    if (userRoles.includes(ROLES.DCOPS)) {
      orConditions.push({ status: { in: [CustomizationStatus.APPROVED, CustomizationStatus.APPLIED] } });
    }
    customizationWhere = { OR: orConditions };
  }

  // ✅ CORRECT ENUM USAGE FOR EACH MODEL
  const [
    reqTotal, reqPending, reqApproved, reqRejected, reqExecuted,
    custTotal, custPending, custApproved, custRejected, custExecuted
  ] = await Promise.all([
    // Request metrics
    prisma.request.count({ where: isAdmin ? {} : { status: { not: RequestStatus.DRAFT } } }),
    prisma.request.count({ where: requestWhere }),
    prisma.request.count({ where: { status: RequestStatus.APPROVED } }),
    prisma.request.count({ where: { status: RequestStatus.REJECTED } }),
    prisma.request.count({ where: { status: { in: [RequestStatus.PROVISIONED, RequestStatus.CLOSED] } } }),
    
    // Customization metrics
    prisma.customizationRequest.count({ where: { status: { not: CustomizationStatus.DRAFT } } }),
    prisma.customizationRequest.count({ where: customizationWhere }),
    prisma.customizationRequest.count({ where: { status: CustomizationStatus.APPROVED } }),
    prisma.customizationRequest.count({ where: { status: CustomizationStatus.REJECTED } }),
    prisma.customizationRequest.count({ where: { status: CustomizationStatus.APPLIED } }),
  ]);

  // ✅ FETCH WITH RELATIONS
  const [requests, customizations] = await Promise.all([
    prisma.request.findMany({
      where: requestWhere,
      include: { 
        requester: { select: { id: true, name: true, email: true, designation: true } },
        targetVm: { select: { hostname: true, id: true } },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true, designation: true } }
          }
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize
    }),
    prisma.customizationRequest.findMany({
      where: customizationWhere,
      include: { 
        requester: { select: {id: true, name: true, email: true, designation: true } },
        targetVm: { 
          include: { 
            owner: { select: { name: true, email: true } },
            request: { select: { environment: true, systemName: true } },
          }
        },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true, designation: true } }
          }
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: pageSize
    })
  ]);

  // ✅ TRANSFORM WITH STRING VALUES (no enum conflicts)
  const dashboardRequests: DashboardRequest[] = [
    // Standard requests (NEW_VM, RENEWAL, DECOMMISSION)
    ...requests.map(req => ({
      id: req.id,
      createdAt: req.createdAt,
      status: req.status, // ✅ Prisma enum auto-converts to string
      requestType: req.requestType, // ✅ Same here
      systemName: req.systemName,
      projectName: req.projectName,
      requester: req.requester ? {
        id: req.requester.id,
        name: req.requester.name,
        email: req.requester.email,
        designation: req.requester.designation || null
      } : null,
      targetVm: req.requestType === RequestType.DECOMMISSION && req.targetVm 
        ? { hostname: req.targetVm.hostname } 
        : null,
      approvals: req.approvals
    })),
    
    // Customization requests
    ...customizations.map(cust => ({
      id: cust.id,
      createdAt: cust.createdAt,
      status: cust.status, // ✅ Prisma enum → string
      requestType: "CUSTOMIZED", // ✅ Explicit string value
      systemName: cust.targetVm?.hostname 
        ? `${cust.targetVm.hostname} Customization` 
        : "VM Customization Request",
      projectName: "Infrastructure Update",
      requester: cust.requester ? {
        id: cust.requester.id,
        name: cust.requester.name,
        email: cust.requester.email,
        designation: cust.requester.designation || null
      } : null,
      targetVm: cust.targetVm 
        ? { hostname: cust.targetVm.hostname } 
        : null,
      approvals: cust.approvals
    }))
  ]
  .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
  .slice(0, 100); // Limit final display

  return {
    metrics: {
      totalVisible: reqTotal + custTotal,
      pendingCount: reqPending + custPending,
      approvedCount: reqApproved + custApproved,
      rejectedCount: reqRejected + custRejected,
      executedCount: reqExecuted + custExecuted,
    },
    requests: dashboardRequests,
    userRoles,
    isAdmin
  };
}