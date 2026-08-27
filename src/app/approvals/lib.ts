// src/app/approvals/lib.ts
import prisma from "@/lib/prisma";
import { ROLES } from "@/lib/roles";
import { 
  RequestStatus, 
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
  pageSize: number = 20,
  decisionFilter?: "PENDING" | "APPROVED" | "REJECTED" | "EXECUTED"
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
  // Approvers see ONLY what is assigned to them (matching their level)
  
  const levelMapping: Record<string, number> = {
    "APPROVER_L1": 1,
    "APPROVER_L2": 2,
    "APPROVER_L3": 3,
    [ROLES.L4_APPROVER]: 4,
  };
  
  const userApprovalLevels = userRoles
    .map((role: any) => levelMapping[role])
    .filter((lvl): lvl is number => lvl !== undefined);

  // Admins see everything - regardless of also having approver role
  const isAdminUser = userRoles.includes(ROLES.ADMIN);
  const isDCOps = userRoles.includes(ROLES.DCOPS);

  console.log("User roles:", userRoles);
  console.log("User approval levels:", userApprovalLevels);
  console.log("Is admin:", isAdminUser);
  console.log("Is DCOPS:", isDCOps);

  let requestWhere: Prisma.RequestWhereInput;
  if (isAdminUser) {
    // Admins see everything (all non-draft requests)
    requestWhere = { status: { not: RequestStatus.DRAFT } };
  } else if (isDCOps) {
    // DCOPS see approved (pending provisioning) and provisioned requests
    const orConditions: Prisma.RequestWhereInput[] = [
      { status: RequestStatus.APPROVED },
      { status: RequestStatus.PROVISIONED },
      { status: RequestStatus.PARTIALLY_PROVISIONED },
      { status: RequestStatus.CLOSED },
    ];
    requestWhere = { OR: orConditions };
  } else if (userApprovalLevels.length > 0) {
    // For approvers, show pending requests at their level
    const orConditions: Prisma.RequestWhereInput[] = [];
    
    for (const level of userApprovalLevels) {
      const pendingStatus = `PENDING_L${level}` as RequestStatus;
      orConditions.push({
        status: pendingStatus,
        approvals: { 
          some: { 
            decision: ApprovalDecision.PENDING,
            level: level
          } 
        }
      });
    }
    
    // DCOps can also see approved/provisioned requests
    if (userRoles.includes(ROLES.DCOPS)) {
      orConditions.push({ status: { in: [RequestStatus.APPROVED, RequestStatus.PROVISIONED, RequestStatus.PARTIALLY_PROVISIONED] } });
    }
    
    requestWhere = { OR: orConditions };
  } else if (isDCOps) {
    // DCOPS see approved/provisioned/closed requests
    const orConditions: Prisma.RequestWhereInput[] = [
      { status: RequestStatus.APPROVED },
      { status: RequestStatus.PROVISIONED },
      { status: RequestStatus.PARTIALLY_PROVISIONED },
      { status: RequestStatus.CLOSED },
    ];
    requestWhere = { OR: orConditions };
  } else {
    // No approval roles - fallback
    requestWhere = { status: { in: [] } };
  }

  let customizationWhere: Prisma.CustomizationRequestWhereInput;
  if (isAdminUser) {
    // Admins see everything (all non-draft customizations)
    customizationWhere = { 
      status: { not: CustomizationStatus.DRAFT },
      ...(decisionFilter && { approvals: { some: { decision: decisionFilter as ApprovalDecision } } })
    };
  } else if (isDCOps) {
    // DCOPS see approved/applied customizations
    const orConditions: Prisma.CustomizationRequestWhereInput[] = [
      { status: CustomizationStatus.APPROVED },
      { status: CustomizationStatus.APPLIED },
    ];
    customizationWhere = { OR: orConditions };
  } else if (userApprovalLevels.length > 0) {
    // For approvers, show pending customizations at their level
    const orConditions: Prisma.CustomizationRequestWhereInput[] = [];
    
    for (const level of userApprovalLevels) {
      const pendingStatus = `PENDING_L${level}` as CustomizationStatus;
      orConditions.push({
        status: pendingStatus,
        approvals: { 
          some: { 
            decision: ApprovalDecision.PENDING,
            level: level
          } 
        }
      });
    }
    
    // DCOps can also see approved/applied customizations
    if (userRoles.includes(ROLES.DCOPS)) {
      orConditions.push({ status: { in: [CustomizationStatus.APPROVED, CustomizationStatus.APPLIED] } });
    }
    
    customizationWhere = { OR: orConditions };
  } else {
    // No approval roles - fallback
    customizationWhere = { status: { in: [] } };
  }

  // ✅ Apply status filter (not decision filter) to match MetricCard links
  // The filter param ?filter=PENDING should filter by request status
  let statusFilter: RequestStatus[] | undefined;
  let customizationStatusFilter: CustomizationStatus[] | undefined;
  
  if (decisionFilter === "PENDING") {
    statusFilter = pendingRequestStatuses as RequestStatus[];
    customizationStatusFilter = pendingCustomizationStatuses as CustomizationStatus[];
  } else if (decisionFilter === "APPROVED") {
    statusFilter = [RequestStatus.APPROVED, RequestStatus.PROVISIONED, RequestStatus.PARTIALLY_PROVISIONED];
    customizationStatusFilter = [CustomizationStatus.APPROVED, CustomizationStatus.APPLIED];
  } else if (decisionFilter === "REJECTED") {
    statusFilter = [RequestStatus.REJECTED];
    customizationStatusFilter = [CustomizationStatus.REJECTED];
  } else if (decisionFilter === "EXECUTED") {
    statusFilter = [RequestStatus.PROVISIONED, RequestStatus.PARTIALLY_PROVISIONED, RequestStatus.CLOSED];
    customizationStatusFilter = [CustomizationStatus.APPLIED];
  }

  // Build the WHERE clause for the list (respects filter)
  let listRequestWhere = { ...requestWhere };
  let listCustomizationWhere = { ...customizationWhere };
  
  if (statusFilter) {
    if (isAdminUser) {
      listRequestWhere = { status: { in: statusFilter } };
    } else if (isDCOps) {
      // DCOPS see approved/provisioned/closed regardless of filter
      listRequestWhere = { status: { in: statusFilter } };
    } else {
      const orConditions: Prisma.RequestWhereInput[] = [];
      
      // For non-admin, filter based on user's approval levels + DCOPS execution rights
      if (statusFilter) {
        const pendingStatuses = statusFilter.filter(s => 
          s !== RequestStatus.APPROVED && 
          s !== RequestStatus.PROVISIONED && 
          s !== RequestStatus.PARTIALLY_PROVISIONED
        );
        const executedStatusesFilter = statusFilter.filter(s => 
          s === RequestStatus.APPROVED || 
          s === RequestStatus.PROVISIONED || 
          s === RequestStatus.PARTIALLY_PROVISIONED
        );
        
        if (pendingStatuses.length > 0) {
          // Filter by user's approval levels
          const levelConditions: Prisma.RequestWhereInput[] = [];
          for (const level of userApprovalLevels) {
            levelConditions.push({
              status: `PENDING_L${level}` as RequestStatus,
              approvals: { 
                some: { 
                  approverId: userId, 
                  decision: ApprovalDecision.PENDING,
                  level: level
                } 
              }
            });
          }
          orConditions.push({ OR: levelConditions });
        }
        if (executedStatusesFilter.length > 0) {
          orConditions.push({ status: { in: executedStatusesFilter } });
        }
      }
      listRequestWhere = orConditions.length > 0 ? { OR: orConditions } : requestWhere;
      console.log("List Request Where:", JSON.stringify(listRequestWhere));
    }
  }

  if (customizationStatusFilter) {
    if (isAdminUser) {
      listCustomizationWhere = { status: { in: customizationStatusFilter } };
    } else {
      const orConditions: Prisma.CustomizationRequestWhereInput[] = [];
      
      const pendingStatuses = customizationStatusFilter.filter(s => 
        s !== CustomizationStatus.APPROVED && s !== CustomizationStatus.APPLIED
      );
      const executedStatusesFilter = customizationStatusFilter.filter(s => 
        s === CustomizationStatus.APPROVED || s === CustomizationStatus.APPLIED
      );
      
        if (pendingStatuses.length > 0) {
          // Filter by user's approval levels
          const levelConditions: Prisma.CustomizationRequestWhereInput[] = [];
          for (const level of userApprovalLevels) {
            levelConditions.push({
              status: `PENDING_L${level}` as CustomizationStatus,
              approvals: { 
                some: { 
                  approverId: userId, 
                  decision: ApprovalDecision.PENDING,
                  level: level
                } 
              }
            });
          }
          orConditions.push({ OR: levelConditions });
        }
      if (executedStatusesFilter.length > 0) {
        orConditions.push({ status: { in: executedStatusesFilter } });
      }
      
      listCustomizationWhere = orConditions.length > 0 ? { OR: orConditions } : customizationWhere;
    }
  }

  // ✅ EXECUTED statuses include PARTIALLY_PROVISIONED
  const executedStatusesList: RequestStatus[] = [RequestStatus.PROVISIONED, RequestStatus.PARTIALLY_PROVISIONED, RequestStatus.CLOSED];
  
  // Get filtered counts when filter is active
  let filteredTotal = 0;
  if (decisionFilter) {
    const [filteredReq, filteredCust] = await Promise.all([
      prisma.request.count({ where: listRequestWhere }),
      prisma.customizationRequest.count({ where: listCustomizationWhere }),
    ]);
    filteredTotal = filteredReq + filteredCust;
  }
  
  const [
    reqTotal, reqPending, reqApproved, reqRejected, reqExecuted,
    custTotal, custPending, custApproved, custRejected, custExecuted
  ] = await Promise.all([
    // Request metrics - ALL non-draft requests (for "Assigned" card)
    prisma.request.count({ where: isAdminUser ? {} : { status: { not: RequestStatus.DRAFT } } }),
    
    // Pending - use requestWhere which respects level filtering
    prisma.request.count({ where: requestWhere }),
    
    // Approved - only count if user can see approved (DCOPS or Admin)
    userRoles.includes(ROLES.DCOPS) || isAdminUser 
      ? prisma.request.count({ where: { status: RequestStatus.APPROVED } })
      : Promise.resolve(0),
    
    // Rejected - use level filtering for approvers
    prisma.request.count({ 
      where: isAdminUser 
        ? { status: RequestStatus.REJECTED }
        : { status: RequestStatus.REJECTED, approvals: { some: { approverId: userId } } }
    }),
    
    // Executed - only DCOPS and Admins see executed
    userRoles.includes(ROLES.DCOPS) || isAdminUser
      ? prisma.request.count({ where: { status: { in: executedStatusesList } } })
      : Promise.resolve(0),
    
    // Customization metrics - ALL non-draft (for "Assigned" card)
    prisma.customizationRequest.count({ where: { status: { not: CustomizationStatus.DRAFT } } }),
    
    // Pending - using customizationWhere
    prisma.customizationRequest.count({ where: customizationWhere }),
    
    // Approved - only count if user can see approved
    userRoles.includes(ROLES.DCOPS) || isAdminUser 
      ? prisma.customizationRequest.count({ where: { status: CustomizationStatus.APPROVED } })
      : Promise.resolve(0),
    
    // Rejected - use level filtering
    prisma.customizationRequest.count({ 
      where: isAdminUser 
        ? { status: CustomizationStatus.REJECTED }
        : { status: CustomizationStatus.REJECTED, approvals: { some: { approverId: userId } } }
    }),
    
    // Applied - only DCOPS and Admins see applied
    userRoles.includes(ROLES.DCOPS) || isAdminUser
      ? prisma.customizationRequest.count({ where: { status: CustomizationStatus.APPLIED } })
      : Promise.resolve(0),
  ]);

  // ✅ FETCH WITH RELATIONS - Uses filtered WHERE clauses
  console.log("Fetching requests with listRequestWhere:", JSON.stringify(listRequestWhere));
  const [requests, customizations] = await Promise.all([
    prisma.request.findMany({
      where: listRequestWhere,
      include: { 
        requester: { select: { id: true, name: true, email: true, designation: true } },
        targetVm: { 
          select: { 
            hostname: true, 
            id: true,
            environment: true,
            currentSpec: {
              select: {
                vcpu: true,
                ramGb: true,
                storageGb: true,
                osName: true,
                osVersion: true
              }
            }
          } 
        },
        approvals: {
          include: {
            approver: { select: { id: true, name: true, email: true, designation: true } }
          }
        },
        vmInstances: { select: { id: true } },
        vmSpecifications: {
          include: {
            additionalStorage: true
          }
        },
        k8sRequestNodeGroups: true,
        requestResources: true,
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

  // Helper function to calculate resource totals for each request
  function computeRequestSummary(req: any) {
    let vmCount = 0;
    let namespaceCount = 0;
    let cpu = 0;
    let ram = 0;
    let storage = 0;

    const requestType = req.requestType;

    if (requestType === "NEW_VM") {
      vmCount = req.vmSpecifications?.length || req.quantity || 1;
      if (req.vmSpecifications && req.vmSpecifications.length > 0) {
        req.vmSpecifications.forEach((spec: any) => {
          cpu += spec.vcpu || 0;
          ram += spec.ramGb || 0;
          storage += spec.storageGb || 0;
          if (spec.additionalStorage) {
            spec.additionalStorage.forEach((disk: any) => {
              storage += disk.sizeGb || 0;
            });
          }
        });
      } else {
        cpu = (req.vcpu || 1) * vmCount;
        ram = (req.ramGb || 2) * vmCount;
        storage = (req.storageGb || 50) * vmCount;
      }
    } else if (requestType === "CLONE_VM") {
      vmCount = 1;
      cpu = req.vcpu || req.targetVm?.currentSpec?.vcpu || 1;
      ram = req.ramGb || req.targetVm?.currentSpec?.ramGb || 2;
      storage = req.storageGb || req.targetVm?.currentSpec?.storageGb || 50;
    } else if (requestType === "K8S_NAMESPACE") {
      namespaceCount = 1;
      if (req.k8sRequestNodeGroups && req.k8sRequestNodeGroups.length > 0) {
        req.k8sRequestNodeGroups.forEach((group: any) => {
          const count = group.nodeCount || 1;
          cpu += (group.vcpu || 0) * count;
          ram += (group.ramGb || 0) * count;
          storage += (group.storageGb || 0) * count;
        });
      }
    } else if (requestType === "SYSTEM_UPGRADE") {
      vmCount = 1;
      const currentCpu = req.targetVm?.currentSpec?.vcpu || 0;
      const currentRam = req.targetVm?.currentSpec?.ramGb || 0;
      const currentStorage = req.targetVm?.currentSpec?.storageGb || 0;
      
      cpu = req.upgradeCpu ? req.upgradeCpu : currentCpu;
      ram = req.upgradeRamGb ? req.upgradeRamGb : currentRam;
      storage = req.upgradeStorageGb ? (currentStorage + req.upgradeStorageGb) : currentStorage;
      
      const resources = req.requestResources || [];
      resources.forEach((r: any) => {
        if (r.vm) {
          vmCount++;
        } else if (r.namespace) {
          namespaceCount++;
        }
      });
      if (vmCount === 0 && req.targetVm) {
        vmCount = 1;
      }
    } else if (requestType === "VPN_ACCESS" || requestType === "HORIZON_ACCESS") {
      const resources = req.requestResources || [];
      resources.forEach((r: any) => {
        if (r.vmId) vmCount++;
        if (r.namespaceId) namespaceCount++;
      });
    }

    return { vmCount, namespaceCount, cpu, ram, storage };
  }

  // ✅ TRANSFORM WITH STRING VALUES (no enum conflicts)
  const dashboardRequests: DashboardRequest[] = [
    // Standard requests (NEW_VM, RENEWAL, DECOMMISSION)
    ...requests.map((req: any) => ({
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
      targetVm: req.targetVm 
        ? { hostname: req.targetVm.hostname } 
        : null,
      approvals: req.approvals,
      quantity: req.quantity,
      vmInstances: { length: req.vmInstances.length },
      subdomain: req.subdomain,
      summary: computeRequestSummary(req),
    })),
    
    // Customization requests
    ...customizations.map((cust: any) => ({
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
      approvals: cust.approvals,
      summary: {
        vmCount: 1,
        namespaceCount: 0,
        cpu: cust.vcpu || 0,
        ram: cust.ramGb || 0,
        storage: cust.storageGb || 0,
      },
    }))
  ]
  .sort((a: any, b: any) => b.createdAt.getTime() - a.createdAt.getTime())
  .slice(0, 100); // Limit final display

  return {
    metrics: {
      totalVisible: decisionFilter ? filteredTotal : reqTotal + custTotal,
      pendingCount: decisionFilter 
        ? (decisionFilter === "PENDING" ? filteredTotal : 0)
        : reqPending + custPending,
      approvedCount: decisionFilter 
        ? (decisionFilter === "APPROVED" ? filteredTotal : 0)
        : reqApproved + custApproved,
      rejectedCount: decisionFilter 
        ? (decisionFilter === "REJECTED" ? filteredTotal : 0)
        : reqRejected + custRejected,
      executedCount: decisionFilter 
        ? (decisionFilter === "EXECUTED" ? filteredTotal : 0)
        : reqExecuted + custExecuted,
    },
    requests: dashboardRequests,
    userRoles,
    isAdmin
  };
}