// src/app/approvals/lib.ts
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { 
  RequestStatus, 
  RequestType,
  CustomizationStatus 
} from "@prisma/client";
import { DashboardRequest } from "@/types/approvals"; // Now uses string types

export type MetricColor = "slate" | "amber" | "emerald" | "red" | "blue";

export async function fetchDashboardData(userRoles: string[], isAdmin: boolean) {
  // ✅ SEPARATE STATUS ARRAYS WITH CORRECT ENUM TYPES
  const pendingRequestStatuses = Array.from(new Set([
    ...(userRoles.includes(ROLES.L1_APPROVER) ? [RequestStatus.PENDING_L1] : []),
    ...(userRoles.includes(ROLES.L2_APPROVER) ? [RequestStatus.PENDING_L2] : []),
    ...(userRoles.includes(ROLES.L3_APPROVER) ? [RequestStatus.PENDING_L3] : []),
    ...(userRoles.includes(ROLES.DCOPS) ? [RequestStatus.APPROVED] : []),
    ...(isAdmin ? [RequestStatus.PENDING_L1, RequestStatus.PENDING_L2, RequestStatus.PENDING_L3, RequestStatus.APPROVED] : []),
  ]));

  const pendingCustomizationStatuses = Array.from(new Set([
    ...(userRoles.includes(ROLES.L1_APPROVER) ? [CustomizationStatus.PENDING_L1] : []),
    ...(userRoles.includes(ROLES.L2_APPROVER) ? [CustomizationStatus.PENDING_L2] : []),
    ...(userRoles.includes(ROLES.L3_APPROVER) ? [CustomizationStatus.PENDING_L3] : []),
    ...(userRoles.includes(ROLES.DCOPS) ? [CustomizationStatus.APPROVED] : []),
    ...(isAdmin ? [CustomizationStatus.PENDING_L1, CustomizationStatus.PENDING_L2, CustomizationStatus.PENDING_L3, CustomizationStatus.APPROVED] : []),
  ]));

  // ✅ CORRECT ENUM USAGE FOR EACH MODEL
  const [
    reqTotal, reqPending, reqApproved, reqRejected, reqExecuted,
    custTotal, custPending, custApproved, custRejected, custExecuted
  ] = await Promise.all([
    // Request metrics
    prisma.request.count({ where: isAdmin ? {} : { status: { not: RequestStatus.DRAFT } } }),
    prisma.request.count({ where: { status: { in: pendingRequestStatuses } } }),
    prisma.request.count({ where: { status: RequestStatus.APPROVED } }),
    prisma.request.count({ where: { status: RequestStatus.REJECTED } }),
    prisma.request.count({ where: { status: { in: [RequestStatus.PROVISIONED, RequestStatus.CLOSED] } } }),
    
    // Customization metrics
    prisma.customizationRequest.count({ where: { status: { not: CustomizationStatus.DRAFT } } }),
    prisma.customizationRequest.count({ where: { status: { in: pendingCustomizationStatuses } } }),
    prisma.customizationRequest.count({ where: { status: CustomizationStatus.APPROVED } }),
    prisma.customizationRequest.count({ where: { status: CustomizationStatus.REJECTED } }),
    prisma.customizationRequest.count({ where: { status: CustomizationStatus.APPLIED } }), // ✅ CORRECT
  ]);

  // ✅ FETCH WITH RELATIONS
  const [requests, customizations] = await Promise.all([
    prisma.request.findMany({
      where: isAdmin ? {} : { status: { not: RequestStatus.DRAFT } },
      include: { 
        requester: { select: { name: true, email: true, designation: true } },
        targetVm: { select: { hostname: true, id: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 50
    }),
    prisma.customizationRequest.findMany({
      where: { status: { not: CustomizationStatus.DRAFT } },
      include: { 
        requester: { select: { name: true, email: true, designation: true } },
        targetVm: { 
      include: { 
        owner: { select: { name: true, email: true } },
        request: { select: { environment: true, systemName: true } } // ✅ ADD THIS
      }
    }
      },
      orderBy: { createdAt: "desc" },
      take: 50
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
        name: req.requester.name,
        email: req.requester.email,
        designation: req.requester.designation || null
      } : null,
      targetVm: req.requestType === RequestType.DECOMMISSION && req.targetVm 
        ? { hostname: req.targetVm.hostname } 
        : null
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
        name: cust.requester.name,
        email: cust.requester.email,
        designation: cust.requester.designation || null
      } : null,
      targetVm: cust.targetVm 
        ? { hostname: cust.targetVm.hostname } 
        : null
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