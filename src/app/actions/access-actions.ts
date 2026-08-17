// src/app/actions/access-actions.ts
"use server";

import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { 
  RequestStatus, 
  RequestType, 
  Environment,
  VmStatus,
  AccessType,
  Prisma
} from "@prisma/client";
import { generateApprovals } from "./approval-actions";
import { revalidatePath } from "next/cache";
import { ROLES, hasRole } from "@/lib/roles";

export async function getAccessableVms() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    
    // Non-admins see their own active VMs, admins see all active VMs
    const whereClause: Prisma.VmInstanceWhereInput = isAdmin
      ? { status: VmStatus.ACTIVE }
      : { ownerId: session.user.id, status: VmStatus.ACTIVE };

    const vms = await prisma.vmInstance.findMany({
      where: whereClause,
      include: {
        currentSpec: true,
        request: {
          select: {
            systemName: true
          }
        }
      },
      orderBy: { hostname: "asc" },
    });

    return vms;
  } catch (error) {
    console.error("Error fetching accessible VMs:", error);
    throw error;
  }
}

export async function createAccessRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);
    const isDeveloper = hasRole(session.user.roles, ROLES.DEVELOPER);
    const assignedRequesterId = formData.get("requesterId")?.toString();

    // Read multiple resources from JSON payload
    const selectedResourcesStr = formData.get("selectedResources")?.toString();
    let vmIds: string[] = [];
    let namespaceIds: string[] = [];
    
    if (selectedResourcesStr) {
      const parsed = JSON.parse(selectedResourcesStr);
      vmIds = parsed.vmIds || [];
      namespaceIds = parsed.namespaceIds || [];
    } else {
      // Fallback for legacy requests
      const accessTargetVmId = formData.get("accessTargetVmId")?.toString();
      if (accessTargetVmId) {
        vmIds = [accessTargetVmId];
      }
    }

    if (vmIds.length === 0 && namespaceIds.length === 0) {
      throw new Error("At least one target VM or Kubernetes Namespace is required");
    }

    // Resolve system name and specs using the first VM/Namespace selected
    let firstVm: any = null;
    let firstNamespace: any = null;
    if (vmIds.length > 0) {
      firstVm = await prisma.vmInstance.findUnique({
        where: { id: vmIds[0] },
        include: { currentSpec: true, request: true }
      });
      if (!firstVm) throw new Error("Target VM not found");
    }
    if (namespaceIds.length > 0) {
      firstNamespace = await prisma.k8sNamespace.findUnique({
        where: { id: namespaceIds[0] }
      });
      if (!firstNamespace) throw new Error("Target Namespace not found");
    }

    // Check VM ownership
    const effectiveRequesterId = isDeveloper && assignedRequesterId ? assignedRequesterId : userId;
    if (firstVm && !isAdmin && firstVm.ownerId !== effectiveRequesterId) {
      throw new Error("You can only request access for your own VMs");
    }

    if (firstVm && firstVm.status !== VmStatus.ACTIVE) {
      throw new Error("Target VM must be ACTIVE to request access");
    }

    const rawAccessType = formData.get("accessType")?.toString();
    if (rawAccessType !== "VPN" && rawAccessType !== "HORIZON") {
      throw new Error("Invalid access type requested");
    }
    const accessType = rawAccessType as AccessType;

    const accessJustification = formData.get("accessJustification")?.toString() || formData.get("purpose")?.toString() || "";

    const requestType = accessType === AccessType.VPN 
      ? RequestType.VPN_ACCESS 
      : RequestType.HORIZON_ACCESS;

    // Build system display name
    let systemName = "";
    if (vmIds.length > 0 && firstVm) {
      systemName = `VM ${firstVm.hostname || firstVm.request?.systemName || "Unnamed"}`;
      if (vmIds.length > 1) systemName += ` (+${vmIds.length - 1} more)`;
    }
    if (namespaceIds.length > 0 && firstNamespace) {
      if (systemName) systemName += " & ";
      systemName += `Namespace ${firstNamespace.name}`;
      if (namespaceIds.length > 1) systemName += ` (+${namespaceIds.length - 1} more)`;
    }

    const newCreatedRequest = await prisma.$transaction(async (tx: any) => {
      const created = await tx.request.create({
        data: {
          requestType,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: 1,
          systemName: `${accessType === AccessType.VPN ? "VPN" : "Horizon"} Access to ${systemName}`,
          projectName: firstVm?.request?.projectName || "Access Request",
          purpose: accessJustification,
          environment: firstVm?.environment || Environment.PRODUCTION,
          
          requesterId: effectiveRequesterId,
          developerId: isDeveloper ? userId : null,

          // Access specific fields
          accessTargetVmId: vmIds.length > 0 ? vmIds[0] : null,
          accessType,
          accessJustification,

          // Copied specs for details panel compatibility
          vcpu: firstVm?.currentSpec?.vcpu || 1,
          ramGb: firstVm?.currentSpec?.ramGb || 2,
          storageGb: firstVm?.currentSpec?.storageGb || 50,
          osName: firstVm?.currentSpec?.osName || "Unknown",
          osVersion: firstVm?.currentSpec?.osVersion || "Unknown",
          serverType: firstVm?.request?.serverType || "OTHER",

          // Join table selections
          requestResources: {
            create: [
              ...vmIds.map(id => ({ vmId: id })),
              ...namespaceIds.map(id => ({ namespaceId: id }))
            ]
          }
        },
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "CREATE_ACCESS_REQUEST",
          entityType: "REQUEST",
          entityId: created.id,
          details: JSON.stringify({
            systemName: created.systemName,
            status: created.status,
            vmIds,
            namespaceIds,
            accessType
          }),
        },
      });

      return created;
    }, { timeout: 15000 });

    if (newCreatedRequest.status !== RequestStatus.DRAFT) {
      await generateApprovals(
        prisma,
        newCreatedRequest.id,
        "REQUEST",
        requestType
      );
    }

    revalidatePath("/requests");
    return newCreatedRequest;
  } catch (error) {
    console.error("Error creating access request:", error);
    throw error;
  }
}

export async function getExistingHorizonUsers() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");
    return await prisma.horizonUser.findMany({
      orderBy: { username: "asc" }
    });
  } catch (error) {
    console.error("Error fetching Horizon users:", error);
    return [];
  }
}

export async function getExistingVpnUsers() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");
    return await prisma.vpnUser.findMany({
      orderBy: { username: "asc" }
    });
  } catch (error) {
    console.error("Error fetching VPN users:", error);
    return [];
  }
}

export async function provisionAccessRequest(
  requestId: string,
  data: {
    username: string;
    fullName: string;
    email?: string;
    vpnProfile?: string;
    assignedIp?: string;
    notes?: string;
    expiresAt?: Date | null;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDCOps = hasRole(session.user.roles, ROLES.DCOPS) || hasRole(session.user.roles, ROLES.ADMIN);
    if (!isDCOps) throw new Error("Only DC Ops or Administrators can provision access");

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { requestResources: true }
    });
    if (!request) throw new Error("Request not found");

    const isVpn = request.requestType === RequestType.VPN_ACCESS;

    // 1. Create or update User
    let resolvedUser: any = null;
    if (isVpn) {
      resolvedUser = await prisma.vpnUser.upsert({
        where: { username: data.username },
        update: {
          fullName: data.fullName,
          vpnProfile: data.vpnProfile || "Full Tunnel",
          vpnIp: data.assignedIp || "",
          status: "ACTIVE"
        },
        create: {
          username: data.username,
          fullName: data.fullName,
          vpnProfile: data.vpnProfile || "Full Tunnel",
          vpnIp: data.assignedIp || "",
          status: "ACTIVE"
        }
      });
    } else {
      resolvedUser = await prisma.horizonUser.upsert({
        where: { username: data.username },
        update: {
          fullName: data.fullName,
          email: data.email || null,
          status: "ACTIVE"
        },
        create: {
          username: data.username,
          fullName: data.fullName,
          email: data.email || null,
          status: "ACTIVE"
        }
      });
    }

    // 2. Write assignments for each resource
    const assignmentsToCreate: any[] = [];
    for (const res of request.requestResources) {
      if (isVpn) {
        const existing = await prisma.vpnAssignment.findFirst({
          where: {
            vpnUserId: resolvedUser.id,
            vmId: res.vmId,
            namespaceId: res.namespaceId
          }
        });
        if (!existing) {
          assignmentsToCreate.push({
            vpnUserId: resolvedUser.id,
            vmId: res.vmId,
            namespaceId: res.namespaceId,
            assignedById: userId,
            expiresAt: data.expiresAt ? new Date(data.expiresAt) : null,
            notes: data.notes || null
          });
        }
      } else {
        const existing = await prisma.horizonAssignment.findFirst({
          where: {
            horizonUserId: resolvedUser.id,
            vmId: res.vmId,
            namespaceId: res.namespaceId
          }
        });
        if (!existing) {
          assignmentsToCreate.push({
            horizonUserId: resolvedUser.id,
            vmId: res.vmId,
            namespaceId: res.namespaceId,
            assignedIp: data.assignedIp || null,
            assignedById: userId,
            notes: data.notes || null,
            status: "ACTIVE"
          });
        }
      }
    }

    await prisma.$transaction(async (tx: any) => {
      if (isVpn) {
        for (const item of assignmentsToCreate) {
          await tx.vpnAssignment.create({ data: item });
        }
      } else {
        for (const item of assignmentsToCreate) {
          await tx.horizonAssignment.create({ data: item });
        }
      }

      await tx.request.update({
        where: { id: requestId },
        data: {
          status: RequestStatus.PROVISIONED,
          provisionedAt: new Date()
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: isVpn ? "PROVISION_VPN_ACCESS" : "PROVISION_HORIZON_ACCESS",
          entityType: "REQUEST",
          entityId: requestId,
          details: JSON.stringify({
            userId: resolvedUser.id,
            username: data.username,
            resources: request.requestResources.map((r: any) => ({ vmId: r.vmId, namespaceId: r.namespaceId })),
            assignedIp: data.assignedIp
          })
        }
      });
    });

    const { NotificationService } = await import("@/lib/services/notification.service");
    await NotificationService.notifyDeployment(requestId, "PROVISIONED");

    return { success: true, message: "Access successfully provisioned!" };
  } catch (error: any) {
    console.error("Error provisioning access:", error);
    return { success: false, message: error.message || "Failed to provision access" };
  }
}

export interface ProvisionVpnForRequestInput {
  username: string;
  fullName: string;
  vpnProfile: string;
  assignedIp: string;
  selectedVmIds?: string[];
  selectedNamespaceIds?: string[];
  notes?: string;
  expiresAt?: Date | null;
}

export async function provisionVpnForRequest(
  requestId: string,
  data: ProvisionVpnForRequestInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDCOps = hasRole(session.user.roles, ROLES.DCOPS) || hasRole(session.user.roles, ROLES.ADMIN);
    if (!isDCOps) throw new Error("Only DC Ops or Administrators can provision VPN access");

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        vmInstances: true,
        vmSpecifications: true
      }
    });
    if (!request) throw new Error("Request not found");

    // 1. Create or update VPN User
    const vpnUser = await prisma.vpnUser.upsert({
      where: { username: data.username },
      update: {
        fullName: data.fullName,
        vpnProfile: data.vpnProfile || "Full Tunnel",
        vpnIp: data.assignedIp || "",
        status: "ACTIVE"
      },
      create: {
        username: data.username,
        fullName: data.fullName,
        vpnProfile: data.vpnProfile || "Full Tunnel",
        vpnIp: data.assignedIp || "",
        status: "ACTIVE"
      }
    });

    // 2. Identify VMs and Namespaces to attach
    let vmIdsToAssign = data.selectedVmIds || [];
    if (vmIdsToAssign.length === 0 && request.vmInstances.length > 0) {
      vmIdsToAssign = request.vmInstances.map((v: any) => v.id);
    }

    const namespaceIdsToAssign = data.selectedNamespaceIds || [];

    await prisma.$transaction(async (tx: any) => {
      // Create assignments for VMs
      for (const vmId of vmIdsToAssign) {
        const existing = await tx.vpnAssignment.findFirst({
          where: { vpnUserId: vpnUser.id, vmId }
        });
        if (!existing) {
          await tx.vpnAssignment.create({
            data: {
              vpnUserId: vpnUser.id,
              vmId,
              assignedById: userId,
              notes: data.notes || null,
              expiresAt: data.expiresAt ? new Date(data.expiresAt) : null
            }
          });
        }
      }

      // Create assignments for Namespaces
      for (const namespaceId of namespaceIdsToAssign) {
        const existing = await tx.vpnAssignment.findFirst({
          where: { vpnUserId: vpnUser.id, namespaceId }
        });
        if (!existing) {
          await tx.vpnAssignment.create({
            data: {
              vpnUserId: vpnUser.id,
              namespaceId,
              assignedById: userId,
              notes: data.notes || null,
              expiresAt: data.expiresAt ? new Date(data.expiresAt) : null
            }
          });
        }
      }

      // 3. Recalculate status of request
      const totalVMsRequested = request.quantity || (request.vmSpecifications?.length || 1);
      const isAllVmsProvisioned = request.vmInstances.length >= totalVMsRequested;

      const isK8sRequired = request.requestType === RequestType.K8S_NAMESPACE || request.kubernetesOption;
      const k8sClusterCount = await tx.k8sCluster.count({
        where: { requestId: requestId }
      });
      const isAllK8sFulfilled = !isK8sRequired || k8sClusterCount > 0;

      if (isAllVmsProvisioned && isAllK8sFulfilled) {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.PROVISIONED,
            provisionedAt: new Date()
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "PROVISION_VPN_ACCESS",
          entityType: "REQUEST",
          entityId: requestId,
          details: JSON.stringify({
            vpnUserId: vpnUser.id,
            username: data.username,
            assignedVmsCount: vmIdsToAssign.length,
            assignedNamespacesCount: namespaceIdsToAssign.length,
            vpnIp: data.assignedIp
          })
        }
      });
    });

    const { NotificationService } = await import("@/lib/services/notification.service");
    await NotificationService.notifyDeployment(requestId, "PROVISIONED");

    revalidatePath(`/approvals/${requestId}`);
    return { success: true, message: `VPN access successfully provisioned for user ${data.username}` };
  } catch (error: any) {
    console.error("Error provisioning VPN for request:", error);
    return { success: false, message: error.message || "Failed to provision VPN access" };
  }
}

export interface ProvisionHorizonForRequestInput {
  username: string;
  fullName: string;
  email?: string;
  assignedIp?: string;
  selectedVmIds?: string[];
  selectedNamespaceIds?: string[];
  notes?: string;
}

export async function provisionHorizonForRequest(
  requestId: string,
  data: ProvisionHorizonForRequestInput
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDCOps = hasRole(session.user.roles, ROLES.DCOPS) || hasRole(session.user.roles, ROLES.ADMIN);
    if (!isDCOps) throw new Error("Only DC Ops or Administrators can provision Horizon access");

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: {
        vmInstances: true,
        vmSpecifications: true
      }
    });
    if (!request) throw new Error("Request not found");

    // 1. Create or update Horizon User
    const horizonUser = await prisma.horizonUser.upsert({
      where: { username: data.username },
      update: {
        fullName: data.fullName,
        email: data.email || null,
        status: "ACTIVE"
      },
      create: {
        username: data.username,
        fullName: data.fullName,
        email: data.email || null,
        status: "ACTIVE"
      }
    });

    // 2. Identify VMs and Namespaces to attach
    let vmIdsToAssign = data.selectedVmIds || [];
    if (vmIdsToAssign.length === 0 && request.vmInstances.length > 0) {
      vmIdsToAssign = request.vmInstances.map((v: any) => v.id);
    }

    const namespaceIdsToAssign = data.selectedNamespaceIds || [];

    await prisma.$transaction(async (tx: any) => {
      // Create assignments for VMs
      for (const vmId of vmIdsToAssign) {
        const existing = await tx.horizonAssignment.findFirst({
          where: { horizonUserId: horizonUser.id, vmId }
        });
        if (!existing) {
          await tx.horizonAssignment.create({
            data: {
              horizonUserId: horizonUser.id,
              vmId,
              assignedIp: data.assignedIp || null,
              assignedById: userId,
              notes: data.notes || null,
              status: "ACTIVE"
            }
          });
        }
      }

      // Create assignments for Namespaces
      for (const namespaceId of namespaceIdsToAssign) {
        const existing = await tx.horizonAssignment.findFirst({
          where: { horizonUserId: horizonUser.id, namespaceId }
        });
        if (!existing) {
          await tx.horizonAssignment.create({
            data: {
              horizonUserId: horizonUser.id,
              namespaceId,
              assignedIp: data.assignedIp || null,
              assignedById: userId,
              notes: data.notes || null,
              status: "ACTIVE"
            }
          });
        }
      }

      // 3. Recalculate status of request
      const totalVMsRequested = request.quantity || (request.vmSpecifications?.length || 1);
      const isAllVmsProvisioned = request.vmInstances.length >= totalVMsRequested;

      if (isAllVmsProvisioned) {
        await tx.request.update({
          where: { id: requestId },
          data: {
            status: RequestStatus.PROVISIONED,
            provisionedAt: new Date()
          }
        });
      }

      await tx.auditLog.create({
        data: {
          actorId: userId,
          action: "PROVISION_HORIZON_ACCESS",
          entityType: "REQUEST",
          entityId: requestId,
          details: JSON.stringify({
            horizonUserId: horizonUser.id,
            username: data.username,
            assignedVmsCount: vmIdsToAssign.length,
            assignedNamespacesCount: namespaceIdsToAssign.length,
            assignedIp: data.assignedIp
          })
        }
      });
    });

    const { NotificationService } = await import("@/lib/services/notification.service");
    await NotificationService.notifyDeployment(requestId, "PROVISIONED");

    revalidatePath(`/approvals/${requestId}`);
    return { success: true, message: `Horizon access successfully provisioned for user ${data.username}` };
  } catch (error: any) {
    console.error("Error provisioning Horizon for request:", error);
    return { success: false, message: error.message || "Failed to provision Horizon access" };
  }
}
