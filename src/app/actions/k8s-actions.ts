// src/app/actions/k8s-actions.ts
"use server";

import { revalidatePath } from "next/cache";
import prisma from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import {
  AttachmentType,
  Environment,
  RequestStatus,
  RequestType,
  ServerType,
  K8sNodeRole,
  SSLProvider,
  Protocol,
  NetworkAccess
} from "@prisma/client";
import { generateApprovals } from "./approval-actions";
import { AdditionalDisk, FirewallPort } from "@/types/requests";
import { ROLES, hasRole } from "@/lib/roles";

interface Attachment {
  fileName: string;
  filePath: string;
  attachmentType: AttachmentType;
  uploadedBy: string;
}

export async function createK8sNamespaceRequest(formData: FormData) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const userId = session.user.id;
    const isDeveloper = hasRole(session.user.roles, ROLES.DEVELOPER);
    const isRequester = hasRole(session.user.roles, ROLES.REQUESTER);
    const isAdmin = hasRole(session.user.roles, ROLES.ADMIN);

    if (!isDeveloper && !isRequester && !isAdmin) {
      throw new Error("Only developers, requesters, or admins can create K8s namespace requests");
    }

    let assignedRequesterId: string | null = null;
    if (isDeveloper) {
      assignedRequesterId = formData.get("requesterId")?.toString() || null;
      if (!assignedRequesterId) {
        throw new Error("Developers must assign a requester before saving draft");
      }

      const assignedUser = await prisma.user.findUnique({
        where: { id: assignedRequesterId },
        include: { roles: { include: { role: true } } }
      });

      if (!assignedUser || !assignedUser.roles.some((r: any) => r.role.name === ROLES.REQUESTER)) {
        throw new Error("Assigned user must have REQUESTER role");
      }

      formData.set("status", RequestStatus.DRAFT);
    }

    const rawAdditionalDisks = formData.get("additionalDisks")?.toString();
    const rawFirewallPorts = formData.get("firewallPorts")?.toString();
    const rawNetworkAccess = formData.get("networkAccess")?.toString();
    const rawK8sNodeGroups = formData.get("k8sNodeGroups")?.toString();
    const additionalDisks = rawAdditionalDisks ? JSON.parse(rawAdditionalDisks) : [];
    const firewallPorts = rawFirewallPorts ? JSON.parse(rawFirewallPorts) : [];
    const networkAccess = rawNetworkAccess ? JSON.parse(rawNetworkAccess) : [];
    const k8sNodeGroupsInput = rawK8sNodeGroups ? JSON.parse(rawK8sNodeGroups) : [];
    const securityFile = formData.get("securityReport") as File;
    const justificationFile = formData.get("justificationDoc") as File;
    const requestId = crypto.randomUUID();
    const attachments: Attachment[] = [];

    const env = formData.get("environment")?.toString();
    if (!env || !["DEVELOPMENT", "STAGING", "PRODUCTION", "TESTING"].includes(env)) {
      throw new Error("Invalid environment");
    }

    // Handle security report upload
    if (securityFile && securityFile.size > 0) {
      const buffer = Buffer.from(await securityFile.arrayBuffer());
      const uploadResult = await uploadBuffer(buffer, securityFile.name, `requests/${requestId}`);

      if (!uploadResult.success) {
        throw new Error(`Failed to upload security report: ${uploadResult.error}`);
      }

      attachments.push({
        fileName: securityFile.name,
        filePath: uploadResult.key || "",
        attachmentType: AttachmentType.SECURITY_REPORT,
        uploadedBy: userId,
      });
    }

    // Handle justification document upload
    if (justificationFile && justificationFile.size > 0) {
      const buffer = Buffer.from(await justificationFile.arrayBuffer());
      const uploadResult = await uploadBuffer(buffer, justificationFile.name, `requests/${requestId}`);

      if (!uploadResult.success) {
        throw new Error(`Failed to upload justification: ${uploadResult.error}`);
      }

      attachments.push({
        fileName: justificationFile.name,
        filePath: uploadResult.key || "",
        attachmentType: AttachmentType.JUSTIFICATION,
        uploadedBy: userId,
      });
    }

    const totalNodeVcpu = k8sNodeGroupsInput.reduce((acc: number, g: any) => acc + ((Number(g.vcpu) || 0) * (Number(g.nodeCount) || 1)), 0);
    const totalNodeRam = k8sNodeGroupsInput.reduce((acc: number, g: any) => acc + ((Number(g.ramGb) || 0) * (Number(g.nodeCount) || 1)), 0);
    const totalNodeStorage = k8sNodeGroupsInput.reduce((acc: number, g: any) => acc + ((Number(g.storageGb) || 0) * (Number(g.nodeCount) || 1)), 0);
    const totalNodeCount = k8sNodeGroupsInput.reduce((acc: number, g: any) => acc + (Number(g.nodeCount) || 1), 0);

    // ✅ CREATE REQUEST WITH CORRECT FIELDS
    const newCreatedRequest = await prisma.request.create({
      data: {
        requestType: RequestType.K8S_NAMESPACE,
        status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
        quantity: totalNodeCount || 1,
        systemName: formData.get("systemName")?.toString() || "",
        projectName: formData.get("projectName")?.toString() || null,
        purpose: formData.get("purpose")?.toString() || "",
        environment: env as Environment,

        requesterId: isDeveloper && assignedRequesterId
          ? assignedRequesterId
          : userId,

        ...(isDeveloper && {
          developerId: userId,
          developerName: session.user.name || "",
          developerDesignation: session.user.designation || "",
          developerOrganization: session.user.organization || "",
          developerContact: session.user.contact || "",
          developerEmail: session.user.email || "",
        }),

        // K8s Namespace fields - calculated node specs
        vcpu: totalNodeVcpu,
        ramGb: totalNodeRam,
        storageGb: totalNodeStorage,
        serverType: ServerType.OTHER,
        osName: null,
        osVersion: null,
        subdomain: formData.get("subdomain")?.toString() || null,
        sslProvider: SSLProvider.MIS,
        vpnRequired: networkAccess.includes("VPN"),
        vpnDetails: formData.get("vpnDetails")?.toString() || null,

        // K8s specific
        kubernetesOption: true,
        kubernetesNamespace: null,
        underExistingNamespace: false,
        existingNamespaceId: null,
        k8sRequestNodeGroups: {
          create: k8sNodeGroupsInput.map((g: any) => ({
            role: g.role as K8sNodeRole,
            nodeCount: g.nodeCount,
            vcpu: g.vcpu,
            ramGb: g.ramGb,
            storageGb: g.storageGb
          }))
        },

        // Tech Stack
        frontendTech: formData.get("frontendTech")?.toString() || null,
        backendTech: formData.get("backendTech")?.toString() || null,
        dataBase: formData.get("dataBase")?.toString() || null,
        serverArchitecture: formData.get("serverArchitecture")?.toString() || null,
        additionalTechNotes: formData.get("additionalTechNotes")?.toString() || null,

        // Alternate Person
        alternativePersonName: formData.get("alternativePersonName")?.toString() || null,
        alternativePersonDesignation: formData.get("alternativePersonDesignation")?.toString() || null,
        alternativePersonOrganization: formData.get("alternativePersonOrganization")?.toString() || null,
        alternativePersonContact: formData.get("alternativePersonContact")?.toString() || null,
        alternativePersonEmail: formData.get("alternativePersonEmail")?.toString() || null,

        // Compliance
        vaReportSubmitted: formData.get("vaReportSubmitted") === "true",
        justificationSubmitted: formData.get("justificationSubmitted") === "true",

        // Relations
        additionalDisks: {
          create: additionalDisks
            .filter((d: AdditionalDisk) => d.sizeGb && d.sizeGb > 0)
            .map((d: AdditionalDisk, index: number) => ({
              sizeGb: d.sizeGb,
              purpose: d.purpose || null,
              sequence: index + 1,
            })),
        },
        firewallPorts: {
          create: firewallPorts
            .filter((p: FirewallPort) => p.port && p.port > 0)
            .map((p: FirewallPort) => ({
              port: p.port,
              protocol: p.protocol as Protocol,
              purpose: p.purpose || "N/A",
              source: p.source || null,
            })),
        },
        networkAccess: {
          create: networkAccess
            .filter((type: string) => type)
            .map((type: string) => ({
              accessType: type as NetworkAccess,
            })),
        },
      },
    });

    // ✅ GENERATE APPROVALS ONLY FOR SUBMITTED REQUESTS (not drafts)
    if (newCreatedRequest.status === RequestStatus.PENDING_L1) {
      await generateApprovals(
        prisma,
        newCreatedRequest.id,
        "REQUEST",
        RequestType.K8S_NAMESPACE
      );
    }

    // Audit log
    await prisma.auditLog.create({
      data: {
        actorId: userId,
        action: "CREATE_K8S_NAMESPACE_REQUEST",
        entityType: "REQUEST",
        entityId: newCreatedRequest.id,
        details: JSON.stringify({
          systemName: newCreatedRequest.systemName,
          status: newCreatedRequest.status,
          kubernetesNamespace: newCreatedRequest.kubernetesNamespace,
          isDeveloperCreated: isDeveloper,
        }),
      },
    });

    return newCreatedRequest;
  } catch (error) {
    console.error("Error creating K8s namespace request:", error);
    throw error;
  }
}

// Re-export uploadBuffer from request-actions
import { uploadBuffer } from "@/lib/services/minio.service";

export async function getNamespaceOptions() {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const namespaces = await prisma.k8sNamespace.findMany({
      select: {
        id: true,
        name: true,
        supervisorIp: true,
      },
      orderBy: { name: "asc" },
    });
    return namespaces;
  } catch (error) {
    console.error("Error fetching namespace options:", error);
    throw error;
  }
}

export async function createK8sCluster(data: {
  requestId: string;
  namespaceId: string;
  clusterName: string;
  totalSpaceGb?: number;
  nodeGroups: {
    role: K8sNodeRole;
    nodeCount: number;
    vcpu: number;
    ramGb: number;
    isClonable?: boolean;
  }[];
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const request = await prisma.request.findUnique({
      where: { id: data.requestId },
    });
    if (!request) throw new Error("Request not found");

    const cluster = await prisma.k8sCluster.create({
      data: {
        requestId: data.requestId,
        namespaceId: data.namespaceId,
        clusterName: data.clusterName,
        totalSpaceGb: data.totalSpaceGb || null,
        status: "ACTIVE",
        nodeGroups: {
          create: data.nodeGroups.map((ng) => ({
            role: ng.role,
            nodeCount: ng.nodeCount,
            vcpu: ng.vcpu,
            ramGb: ng.ramGb,
            isClonable: ng.isClonable !== undefined ? ng.isClonable : true,
          })),
        },
      },
      include: {
        nodeGroups: true,
      },
    });

    return cluster;
  } catch (error) {
    console.error("Error creating K8s cluster:", error);
    throw error;
  }
}

export async function cloneNodeGroup(nodeGroupId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const sourceNodeGroup = await prisma.k8sNodeGroup.findUnique({
      where: { id: nodeGroupId },
      include: { cluster: true },
    });
    if (!sourceNodeGroup) throw new Error("Node group not found");

    if (sourceNodeGroup.cluster.requestId) {
      const request = await prisma.request.findUnique({
        where: { id: sourceNodeGroup.cluster.requestId },
      });
      if (request && request.status !== RequestStatus.DRAFT) {
        throw new Error("Cannot clone node group of a non-draft request");
      }
    }

    const cloned = await prisma.k8sNodeGroup.create({
      data: {
        clusterId: sourceNodeGroup.clusterId,
        role: sourceNodeGroup.role,
        nodeCount: sourceNodeGroup.nodeCount,
        vcpu: sourceNodeGroup.vcpu,
        ramGb: sourceNodeGroup.ramGb,
        isClonable: sourceNodeGroup.isClonable,
      },
    });

    return cloned;
  } catch (error) {
    console.error("Error cloning node group:", error);
    throw error;
  }
}

export async function updateNodeGroup(
  id: string,
  data: {
    role?: K8sNodeRole;
    nodeCount?: number;
    vcpu?: number;
    ramGb?: number;
    isClonable?: boolean;
  }
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) throw new Error("Unauthorized");

    const nodeGroup = await prisma.k8sNodeGroup.findUnique({
      where: { id },
      include: { cluster: true },
    });
    if (!nodeGroup) throw new Error("Node group not found");

    if (nodeGroup.cluster.requestId) {
      const request = await prisma.request.findUnique({
        where: { id: nodeGroup.cluster.requestId },
      });
      if (!request || request.status !== RequestStatus.DRAFT) {
        throw new Error("Node group can only be updated if the parent request is in DRAFT status");
      }
    }

    const updated = await prisma.k8sNodeGroup.update({
      where: { id },
      data,
    });

    return updated;
  } catch (error) {
    console.error("Error updating node group:", error);
    throw error;
  }
}

export async function provisionK8sNamespace(
  requestId: string,
  namespaceName: string,
  supervisorIp: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) {
      return { success: false, message: "Unauthorized" };
    }

    const userRoles = session.user.roles;
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isDCOps && !isAdmin) {
      return { success: false, message: "Only DCOPS or ADMIN can provision namespaces" };
    }

    const request = await prisma.request.findUnique({
      where: { id: requestId },
      include: { k8sRequestNodeGroups: true }
    });

    if (!request) {
      return { success: false, message: "Request not found" };
    }

    if (request.status !== "APPROVED") {
      return { success: false, message: `Request status must be APPROVED (current: ${request.status})` };
    }

    let targetNamespaceId: string | null = null;

    if (request.underExistingNamespace) {
      const existingNs = request.existingNamespaceId
        ? await prisma.k8sNamespace.findUnique({ where: { id: request.existingNamespaceId } })
        : await prisma.k8sNamespace.findUnique({ where: { name: namespaceName } });

      if (existingNs) {
        targetNamespaceId = existingNs.id;
      }
    }

    if (!targetNamespaceId) {
      // Check if namespace name already exists when creating brand new namespace
      const existingNamespace = await prisma.k8sNamespace.findUnique({
        where: { name: namespaceName }
      });
      if (existingNamespace) {
        return { success: false, message: `Namespace "${namespaceName}" already exists. Please choose a unique name.` };
      }
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. Create or fetch Namespace
      let namespace: any;
      if (targetNamespaceId) {
        namespace = await tx.k8sNamespace.findUnique({
          where: { id: targetNamespaceId }
        });
        if (supervisorIp && supervisorIp !== namespace.supervisorIp) {
          namespace = await tx.k8sNamespace.update({
            where: { id: targetNamespaceId },
            data: { supervisorIp }
          });
        }
      } else {
        namespace = await tx.k8sNamespace.create({
          data: {
            name: namespaceName,
            supervisorIp: supervisorIp
          }
        });
      }

      // Calculate total storage across all requested node groups
      const totalNodeStorage = (request.k8sRequestNodeGroups || []).reduce(
        (acc: number, g: any) => acc + ((Number(g.storageGb) || 0) * (Number(g.nodeCount) || 1)),
        0
      );

      // 2. Find or Create Cluster
      let cluster = await tx.k8sCluster.findFirst({
        where: { namespaceId: namespace.id }
      });
      if (!cluster) {
        cluster = await tx.k8sCluster.create({
          data: {
            namespaceId: namespace.id,
            requestId: request.id,
            clusterName: `${namespace.name}-cluster`,
            totalSpaceGb: totalNodeStorage || request.storageGb || 0,
            status: "ACTIVE"
          }
        });
      } else {
        await tx.k8sCluster.update({
          where: { id: cluster.id },
          data: {
            totalSpaceGb: (cluster.totalSpaceGb || 0) + (totalNodeStorage || request.storageGb || 0),
            ...(!cluster.requestId ? { requestId: request.id } : {})
          }
        });
      }

      // 3. Create or Update Node Groups & Nodes
      for (const group of request.k8sRequestNodeGroups) {
        if (group.targetNodeGroupId) {
          const existingGroup = await tx.k8sNodeGroup.findUnique({
            where: { id: group.targetNodeGroupId },
            include: { nodes: true }
          });

          if (existingGroup) {
            // Update node group specs (vCPU, RAM, Role, NodeCount, Storage)
            await tx.k8sNodeGroup.update({
              where: { id: existingGroup.id },
              data: {
                role: group.role,
                nodeCount: group.nodeCount,
                vcpu: group.vcpu,
                ramGb: group.ramGb,
                storageGb: group.storageGb || 0,
              }
            });

            const currentNodes = existingGroup.nodes || [];
            const currentNodeCount = currentNodes.length;
            const targetCount = group.nodeCount;

            if (targetCount > currentNodeCount) {
              // Scale UP: Add new nodes
              for (let i = currentNodeCount + 1; i <= targetCount; i++) {
                await tx.k8sNode.create({
                  data: {
                    nodeGroupId: existingGroup.id,
                    name: `${namespace.name}-${group.role.toLowerCase()}-${i}`,
                    ipAddress: `10.0.1.${50 + i}`,
                    subdomainStatus: "PENDING"
                  }
                });
              }
            } else if (targetCount < currentNodeCount) {
              // Scale DOWN: Remove excess nodes from the end
              const nodesToRemove = currentNodes.slice(targetCount);
              for (const node of nodesToRemove) {
                await tx.k8sNode.delete({
                  where: { id: node.id }
                });
              }
            }
            // If targetCount === currentNodeCount, node instances remain intact while specs are updated
            continue;
          }
        }

        // Fallback / New Node Group creation
        const nodeGroup = await tx.k8sNodeGroup.create({
          data: {
            clusterId: cluster.id,
            role: group.role,
            nodeCount: group.nodeCount,
            vcpu: group.vcpu,
            ramGb: group.ramGb,
            storageGb: group.storageGb || 0,
            isClonable: true
          }
        });

        // Create individual K8s Nodes
        for (let i = 1; i <= group.nodeCount; i++) {
          await tx.k8sNode.create({
            data: {
              nodeGroupId: nodeGroup.id,
              name: `${namespace.name}-${group.role.toLowerCase()}-${i}`,
              ipAddress: `10.0.1.${50 + i}`, // placeholder IP
              subdomainStatus: "PENDING"
            }
          });
        }
      }

      // 4. Update Request
      await tx.request.update({
        where: { id: request.id },
        data: {
          status: RequestStatus.PROVISIONED,
          provisionedAt: new Date(),
          existingNamespaceId: namespace.id
        }
      });

      // 5. Audit Log
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "PROVISION_K8S_NAMESPACE",
          entityType: "REQUEST",
          entityId: request.id,
          details: JSON.stringify({ namespaceName, supervisorIp, clusterId: cluster.id }),
        }
      });
    });

    const { NotificationService } = await import("@/lib/services/notification.service");
    await NotificationService.notifyDeployment(requestId, "PROVISIONED");

    revalidatePath("/requests");
    revalidatePath("/inventory/assets");
    return { success: true, message: `Kubernetes namespace ${namespaceName} provisioned successfully` };
  } catch (error) {
    console.error("Error provisioning namespace:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error occurred" };
  }
}

export async function getUserK8sNamespaces() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userId = session.user.id;

    const namespaces = await prisma.k8sNamespace.findMany({
      where: {
        OR: [
          {
            clusters: {
              some: {
                request: {
                  requesterId: userId
                }
              }
            }
          },
          {
            requests: {
              some: {
                requesterId: userId,
                status: "PROVISIONED"
              }
            }
          }
        ]
      },
      include: {
        subdomains: {
          include: {
            requestedBy: { select: { id: true, name: true, email: true } },
            approvedBy: { select: { id: true, name: true, email: true } }
          },
          orderBy: { createdAt: "desc" }
        },
        clusters: {
          include: {
            nodeGroups: {
              include: {
                nodes: true
              }
            }
          }
        }
      },
      orderBy: { name: "asc" }
    });

    return { success: true, namespaces };
  } catch (error) {
    console.error("Error fetching namespaces:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function requestK8sSubdomain(data: {
  namespaceId: string;
  subdomain: string;
  externalIp?: string;
  serviceName?: string;
  targetPort?: number;
  purpose?: string;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const namespace = await prisma.k8sNamespace.findUnique({
      where: { id: data.namespaceId },
      include: {
        clusters: {
          include: {
            request: true
          }
        },
        requests: {
          where: {
            requesterId: session.user.id,
            status: "PROVISIONED"
          }
        }
      }
    });

    if (!namespace) throw new Error("Namespace not found");

    const userRoles = session.user.roles || [];
    const isOwner =
      namespace.clusters.some((c: any) => c.request?.requesterId === session.user.id) ||
      (namespace.requests && namespace.requests.length > 0);
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isOwner && !isDCOps && !isAdmin) {
      throw new Error("You do not have permission to request subdomains for this namespace");
    }

    let cleanSubdomain = data.subdomain.trim().toLowerCase();
    if (!cleanSubdomain) {
      throw new Error("Subdomain is required");
    }
    // Remove https:// or http:// if user pasted a URL
    cleanSubdomain = cleanSubdomain.replace(/^https?:\/\//, "").replace(/\/$/, "");

    const newSubdomain = await prisma.k8sSubdomain.create({
      data: {
        namespaceId: data.namespaceId,
        subdomain: cleanSubdomain,
        externalIp: data.externalIp?.trim() || null,
        serviceName: data.serviceName?.trim() || null,
        targetPort: data.targetPort ? Number(data.targetPort) : 443,
        purpose: data.purpose?.trim() || null,
        status: "PENDING",
        requestedById: session.user.id
      },
      include: {
        namespace: true
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "REQUEST_K8S_SUBDOMAIN",
        entityType: "REQUEST",
        entityId: data.namespaceId,
        details: JSON.stringify({
          subdomainId: newSubdomain.id,
          subdomain: cleanSubdomain,
          namespace: namespace.name,
          externalIp: data.externalIp,
          serviceName: data.serviceName
        }),
      }
    });

    // Notify Approver L1s
    try {
      const approvers = await prisma.user.findMany({
        where: {
          roles: {
            some: {
              role: {
                name: { in: ["APPROVER_L1", "ADMIN"] }
              }
            }
          }
        },
        select: { id: true }
      });

      for (const approver of approvers) {
        await prisma.notification.create({
          data: {
            userId: approver.id,
            type: "SUBDOMAIN_REQUEST",
            message: `New Ingress Subdomain request "${cleanSubdomain}" submitted for namespace "${namespace.name}" by ${session.user.name || "Requester"}.`,
            link: "/approvals"
          }
        });
      }
    } catch (notifErr) {
      console.warn("Failed to dispatch notifications for subdomain request:", notifErr);
    }

    revalidatePath("/my-vms");
    revalidatePath("/inventory/namespaces");
    revalidatePath("/approvals");

    return {
      success: true,
      message: `Subdomain route "${cleanSubdomain}" submitted for Approver 1 approval.`,
      subdomain: newSubdomain
    };
  } catch (error) {
    console.error("Error requesting K8s subdomain:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function deleteK8sSubdomain(subdomainId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const subdomain = await prisma.k8sSubdomain.findUnique({
      where: { id: subdomainId },
      include: {
        namespace: {
          include: {
            clusters: {
              include: {
                request: true
              }
            },
            requests: {
              where: {
                requesterId: session.user.id,
                status: "PROVISIONED"
              }
            }
          }
        }
      }
    });

    if (!subdomain) throw new Error("Subdomain not found");

    const userRoles = session.user.roles || [];
    const isRequester = subdomain.requestedById === session.user.id;
    const isOwner =
      subdomain.namespace.clusters.some((c: any) => c.request?.requesterId === session.user.id) ||
      (subdomain.namespace.requests && subdomain.namespace.requests.length > 0);
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isRequester && !isOwner && !isDCOps && !isAdmin) {
      throw new Error("You do not have permission to delete this subdomain");
    }

    await prisma.k8sSubdomain.delete({
      where: { id: subdomainId }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_K8S_SUBDOMAIN",
        entityType: "REQUEST",
        entityId: subdomain.namespaceId,
        details: JSON.stringify({ subdomainId, subdomain: subdomain.subdomain }),
      }
    });

    revalidatePath("/my-vms");
    revalidatePath("/inventory/namespaces");
    revalidatePath("/approvals");

    return { success: true, message: "Subdomain route removed successfully" };
  } catch (error) {
    console.error("Error deleting K8s subdomain:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function addK8sNode(nodeGroupId: string) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const nodeGroup: any = await prisma.k8sNodeGroup.findUnique({
      where: { id: nodeGroupId },
      include: {
        cluster: {
          include: {
            namespace: {
              include: {
                requests: {
                  where: {
                    requesterId: session.user.id,
                    status: "PROVISIONED"
                  }
                }
              }
            },
            request: true
          }
        },
        nodes: true
      }
    });

    if (!nodeGroup) throw new Error("Node group not found");

    // Check permission
    const userRoles = session.user.roles || [];
    const isOwner =
      nodeGroup.cluster.request?.requesterId === session.user.id ||
      (nodeGroup.cluster.namespace?.requests && nodeGroup.cluster.namespace.requests.length > 0);
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isOwner && !isDCOps && !isAdmin) {
      throw new Error("You do not have permission to add nodes to this namespace");
    }

    const namespaceName = nodeGroup.cluster.namespace.name;
    const nextNodeIndex = nodeGroup.nodes.length + 1;

    const result = await prisma.$transaction(async (tx: any) => {
      // Increment count
      await tx.k8sNodeGroup.update({
        where: { id: nodeGroupId },
        data: {
          nodeCount: { increment: 1 }
        }
      });

      // Create new node
      const newNode = await tx.k8sNode.create({
        data: {
          nodeGroupId: nodeGroupId,
          name: `${namespaceName}-${nodeGroup.role.toLowerCase()}-${nextNodeIndex}`,
          ipAddress: `10.0.1.${50 + nextNodeIndex}`,
          subdomainStatus: "PENDING"
        }
      });

      // Audit Log
      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "ADD_K8S_NODE",
          entityType: "K8S_CLUSTER",
          entityId: nodeGroup.cluster.requestId || nodeGroup.cluster.id,
          details: JSON.stringify({ nodeGroupId, nodeId: newNode.id, nodeName: newNode.name }),
        }
      });

      return newNode;
    });

    revalidatePath("/inventory/namespaces");
    revalidatePath("/my-vms");
    return { success: true, message: `Node ${result.name} added successfully`, node: result };
  } catch (error) {
    console.error("Error adding K8s node:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function submitK8sResourceCustomization(data: {
  namespaceId: string;
  role: "MASTER" | "WORKER";
  nodeCount: number;
  vcpu: number;
  ramGb: number;
  storageGb: number;
  purpose: string;
  targetNodeGroupId?: string | null;
  targetNodeId?: string | null;
  targetNodeName?: string | null;
}) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const namespace = await prisma.k8sNamespace.findUnique({
      where: { id: data.namespaceId },
      include: {
        clusters: {
          include: {
            request: true,
            nodeGroups: true
          }
        },
        requests: {
          where: {
            requesterId: session.user.id,
            status: "PROVISIONED"
          }
        }
      }
    });

    if (!namespace) throw new Error("Namespace not found");

    const userRoles = session.user.roles || [];
    const isOwner =
      namespace.clusters.some((c: any) => c.request?.requesterId === session.user.id) ||
      (namespace.requests && namespace.requests.length > 0);
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isOwner && !isDCOps && !isAdmin) {
      throw new Error("You do not have permission to request resource customization for this namespace");
    }

    const nodeCount = Math.max(1, Number(data.nodeCount) || 1);
    const vcpu = Math.max(1, Number(data.vcpu) || 1);
    const ramGb = Math.max(1, Number(data.ramGb) || 1);
    const storageGb = Math.max(10, Number(data.storageGb) || 10);
    const purpose = data.purpose?.trim();

    if (!purpose) {
      throw new Error("Justification / Purpose is required");
    }

    const newRequest = await prisma.$transaction(async (tx: any) => {
      const created = await tx.request.create({
        data: {
          requestType: RequestType.K8S_NAMESPACE,
          status: RequestStatus.PENDING_L1,
          systemName: data.targetNodeName
            ? `Resource Customization: ${namespace.name} (Node: ${data.targetNodeName})`
            : data.targetNodeGroupId
              ? `Resource Scaling: ${namespace.name} (${data.role} Node Group)`
              : `Resource Customization: ${namespace.name}`,
          purpose: purpose,
          additionalTechNotes: data.targetNodeName
            ? `Target Node: ${data.targetNodeName}${data.targetNodeId ? ` (ID: ${data.targetNodeId})` : ""}`
            : null,
          environment: Environment.PRODUCTION,
          quantity: nodeCount,
          requesterId: session.user.id,
          underExistingNamespace: true,
          existingNamespaceId: namespace.id,
          kubernetesNamespace: namespace.name,
          kubernetesOption: true,
          vcpu: vcpu * nodeCount,
          ramGb: ramGb * nodeCount,
          storageGb: storageGb * nodeCount,
          serverType: ServerType.OTHER,
          k8sRequestNodeGroups: {
            create: [
              {
                targetNodeGroupId: data.targetNodeGroupId || null,
                role: data.role as K8sNodeRole,
                nodeCount: nodeCount,
                vcpu: vcpu,
                ramGb: ramGb,
                storageGb: storageGb
              }
            ]
          }
        }
      });

      await tx.auditLog.create({
        data: {
          actorId: session.user.id,
          action: "CREATE_K8S_RESOURCE_CUSTOMIZATION_REQUEST",
          entityType: "REQUEST",
          entityId: created.id,
          details: JSON.stringify({
            namespaceId: namespace.id,
            namespaceName: namespace.name,
            targetNodeGroupId: data.targetNodeGroupId || null,
            targetNodeId: data.targetNodeId || null,
            targetNodeName: data.targetNodeName || null,
            role: data.role,
            nodeCount,
            vcpu,
            ramGb,
            storageGb,
            purpose
          })
        }
      });

      return created;
    });

    await generateApprovals(
      prisma,
      newRequest.id,
      "REQUEST",
      RequestType.K8S_NAMESPACE
    );

    revalidatePath("/my-vms");
    revalidatePath("/requests");
    return {
      success: true,
      message: `Resource customization request for namespace "${namespace.name}" submitted successfully.`,
      requestId: newRequest.id
    };
  } catch (error) {
    console.error("Error submitting K8s resource customization:", error);
    return { success: false, message: error instanceof Error ? error.message : "Failed to submit resource customization request" };
  }
}

export async function updateK8sNodeIpAndSubdomain(
  nodeId: string,
  externalIp: string,
  subdomain: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const node: any = await prisma.k8sNode.findUnique({
      where: { id: nodeId },
      include: {
        nodeGroup: {
          include: {
            cluster: {
              include: {
                namespace: {
                  include: {
                    requests: {
                      where: {
                        requesterId: session.user.id,
                        status: "PROVISIONED"
                      }
                    }
                  }
                },
                request: true
              }
            }
          }
        }
      }
    });

    if (!node) throw new Error("Node not found");

    // Check permission
    const userRoles = session.user.roles || [];
    const isOwner =
      node.nodeGroup.cluster.request?.requesterId === session.user.id ||
      (node.nodeGroup.cluster.namespace?.requests && node.nodeGroup.cluster.namespace.requests.length > 0);
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isOwner && !isDCOps && !isAdmin) {
      throw new Error("You do not have permission to modify this node");
    }

    const updatedNode = await prisma.k8sNode.update({
      where: { id: nodeId },
      data: {
        externalIp: externalIp || null,
        subdomain: subdomain || null,
        subdomainStatus: subdomain ? "PENDING" : "NONE"
      }
    });

    // Audit Log
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "UPDATE_K8S_NODE_IP_SUBDOMAIN",
        entityType: "REQUEST",
        entityId: node.nodeGroup.cluster.requestId || "",
        details: JSON.stringify({ nodeId, externalIp, subdomain, subdomainStatus: "PENDING" }),
      }
    });

    revalidatePath("/my-vms");
    return { success: true, message: "Node updated successfully. Subdomain activation is pending approval.", node: updatedNode };
  } catch (error) {
    console.error("Error updating K8s node:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function getPendingSubdomains() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userRoles = session.user.roles || [];
    const isL1 = userRoles.includes("APPROVER_L1");
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isL1 && !isDCOps && !isAdmin) {
      return { success: true, pendingSubdomains: [], pendingNodes: [] };
    }

    // 1. Fetch from K8sSubdomain model (new flexible model)
    const pendingSubdomains = await prisma.k8sSubdomain.findMany({
      where: {
        status: "PENDING"
      },
      include: {
        namespace: {
          include: {
            clusters: {
              include: {
                request: {
                  include: {
                    requester: true
                  }
                }
              }
            }
          }
        },
        requestedBy: true
      },
      orderBy: { createdAt: "desc" }
    });

    // 2. Legacy fallback from K8sNode model
    const pendingNodes = await prisma.k8sNode.findMany({
      where: {
        subdomainStatus: "PENDING",
        subdomain: { not: null }
      },
      include: {
        nodeGroup: {
          include: {
            cluster: {
              include: {
                namespace: true,
                request: {
                  include: {
                    requester: true
                  }
                }
              }
            }
          }
        }
      }
    });

    return { success: true, pendingSubdomains, pendingNodes };
  } catch (error) {
    console.error("Error fetching pending subdomains:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function approveSubdomain(
  subdomainId: string,
  decision: "ACTIVE" | "REJECTED",
  rejectionReason?: string
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userRoles = session.user.roles || [];
    const isL1 = userRoles.includes("APPROVER_L1");
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isL1 && !isDCOps && !isAdmin) {
      throw new Error("You do not have permission to approve subdomains. Only Approver 1, DC-Ops, or Admins can approve.");
    }

    // Try finding in K8sSubdomain first
    const subdomain = await prisma.k8sSubdomain.findUnique({
      where: { id: subdomainId },
      include: {
        namespace: true
      }
    });

    if (subdomain) {
      await prisma.k8sSubdomain.update({
        where: { id: subdomainId },
        data: {
          status: decision,
          approvedById: session.user.id,
          rejectionReason: decision === "REJECTED" ? (rejectionReason || "Request rejected by Approver 1") : null
        }
      });

      // Notification to Requester
      try {
        await prisma.notification.create({
          data: {
            userId: subdomain.requestedById,
            type: `SUBDOMAIN_${decision}`,
            message: `Subdomain route "${subdomain.subdomain}" in namespace "${subdomain.namespace?.name}" has been ${decision.toLowerCase()} directly by Approver 1${rejectionReason ? `: ${rejectionReason}` : "."}`,
            link: "/my-vms"
          }
        });
      } catch (_) { }

      // Audit Log
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: `SUBDOMAIN_${decision}`,
          entityType: "REQUEST",
          entityId: subdomain.namespaceId,
          details: JSON.stringify({
            subdomainId,
            subdomain: subdomain.subdomain,
            decision,
            rejectionReason,
            executedBy: "APPROVER_1"
          }),
        }
      });

      revalidatePath("/approvals");
      revalidatePath("/my-vms");
      revalidatePath("/inventory/namespaces");
      return {
        success: true,
        message: `Subdomain "${subdomain.subdomain}" has been directly ${decision === "ACTIVE" ? "approved & activated" : "rejected"} by Approver 1.`
      };
    }

    // Fallback: Check if it's a legacy K8sNode
    const node = await prisma.k8sNode.findUnique({
      where: { id: subdomainId }
    });

    if (node) {
      await prisma.k8sNode.update({
        where: { id: subdomainId },
        data: {
          subdomainStatus: decision
        }
      });

      // Audit Log
      await prisma.auditLog.create({
        data: {
          actorId: session.user.id,
          action: `SUBDOMAIN_${decision}`,
          entityType: "REQUEST",
          entityId: subdomainId,
          details: JSON.stringify({ nodeId: subdomainId, decision, executedBy: "APPROVER_1" }),
        }
      });

      revalidatePath("/approvals");
      revalidatePath("/my-vms");
      return { success: true, message: `Subdomain request has been ${decision.toLowerCase()}` };
    }

    throw new Error("Subdomain record not found");
  } catch (error) {
    console.error("Error approving subdomain:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export interface K8sInventorySummary {
  totalNamespaces: number;
  totalClusters: number;
  totalNodes: number;
  totalMasterNodes: number;
  totalWorkerNodes: number;
  totalVcpu: number;
  totalRamGb: number;
  totalStorageGb: number;
  totalSubdomains: number;
}

export async function getK8sInventorySummary(): Promise<K8sInventorySummary> {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const [
    totalNamespaces,
    totalClusters,
    clustersWithGroups,
    nodes,
    totalSubdomains
  ] = await Promise.all([
    prisma.k8sNamespace.count(),
    prisma.k8sCluster.count(),
    prisma.k8sCluster.findMany({
      select: {
        totalSpaceGb: true,
        nodeGroups: {
          select: {
            role: true,
            nodeCount: true,
            vcpu: true,
            ramGb: true,
          }
        }
      }
    }),
    prisma.k8sNode.findMany({
      select: {
        id: true,
        nodeGroup: {
          select: {
            role: true,
          }
        }
      }
    }),
    prisma.k8sSubdomain.count({
      where: { status: "ACTIVE" }
    })
  ]);

  let totalStorageGb = 0;
  let totalVcpu = 0;
  let totalRamGb = 0;

  for (const c of clustersWithGroups) {
    totalStorageGb += c.totalSpaceGb || 0;
    for (const ng of c.nodeGroups) {
      totalVcpu += (ng.vcpu || 0) * (ng.nodeCount || 0);
      totalRamGb += (ng.ramGb || 0) * (ng.nodeCount || 0);
    }
  }

  let totalMasterNodes = 0;
  let totalWorkerNodes = 0;
  for (const n of nodes) {
    if (n.nodeGroup?.role === "MASTER") {
      totalMasterNodes++;
    } else {
      totalWorkerNodes++;
    }
  }

  return {
    totalNamespaces,
    totalClusters,
    totalNodes: nodes.length,
    totalMasterNodes,
    totalWorkerNodes,
    totalVcpu,
    totalRamGb,
    totalStorageGb,
    totalSubdomains,
  };
}

export interface CreateK8sNamespaceNodeGroupInput {
  role: "MASTER" | "WORKER";
  nodeCount: number;
  vcpu: number;
  ramGb: number;
}

export interface CreateK8sNamespaceInput {
  name: string;
  supervisorIp: string;
  clusterName?: string;
  totalSpaceGb?: number;
  subdomain?: string;
  subdomainIp?: string;
  nodeGroups?: CreateK8sNamespaceNodeGroupInput[];
}

export async function createK8sNamespace(data: CreateK8sNamespaceInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  const isDCOps = userRoles.includes("DC_OPS");
  const isAdminUser = userRoles.includes("ADMIN");

  if (!isDCOps && !isAdminUser) {
    throw new Error("Only Admin or DC_OPS can create Kubernetes namespaces");
  }

  const name = data.name.trim().toLowerCase();
  const supervisorIp = data.supervisorIp.trim();

  if (!name) {
    throw new Error("Namespace name is required");
  }

  const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!k8sNameRegex.test(name)) {
    throw new Error("Namespace name must consist of lowercase alphanumeric characters or '-', and must start and end with an alphanumeric character (RFC 1123).");
  }

  if (!supervisorIp) {
    throw new Error("Supervisor IP is required");
  }

  const existing = await prisma.k8sNamespace.findUnique({
    where: { name }
  });
  if (existing) {
    throw new Error(`Namespace "${name}" already exists`);
  }

  const namespace = await prisma.$transaction(async (tx) => {
    const ns = await tx.k8sNamespace.create({
      data: {
        name,
        supervisorIp,
      }
    });

    const clusterName = data.clusterName?.trim() || `${name}-cluster`;
    const cluster = await tx.k8sCluster.create({
      data: {
        namespaceId: ns.id,
        clusterName,
        totalSpaceGb: data.totalSpaceGb ? Number(data.totalSpaceGb) : null,
        status: "ACTIVE"
      }
    });

    // Create subdomain if provided
    if (data.subdomain && data.subdomain.trim()) {
      const cleanSub = data.subdomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
      await tx.k8sSubdomain.create({
        data: {
          namespaceId: ns.id,
          subdomain: cleanSub,
          externalIp: data.subdomainIp?.trim() || null,
          status: "ACTIVE",
          requestedById: session.user.id,
          approvedById: session.user.id,
        }
      });
    }

    // Create node groups and nodes if provided
    if (data.nodeGroups && data.nodeGroups.length > 0) {
      for (const group of data.nodeGroups) {
        if (group.nodeCount > 0) {
          const ng = await tx.k8sNodeGroup.create({
            data: {
              clusterId: cluster.id,
              role: group.role,
              nodeCount: group.nodeCount,
              vcpu: group.vcpu,
              ramGb: group.ramGb,
              isClonable: true,
            }
          });

          const rolePrefix = group.role.toLowerCase();
          for (let i = 1; i <= group.nodeCount; i++) {
            await tx.k8sNode.create({
              data: {
                nodeGroupId: ng.id,
                name: `${name}-${rolePrefix}-${i}`,
                subdomainStatus: "PENDING",
              }
            });
          }
        }
      }
    }

    return ns;
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "CREATE_K8S_NAMESPACE",
        entityType: "K8S_NAMESPACE",
        entityId: namespace.id,
        details: JSON.stringify({ name, supervisorIp, clusterName: data.clusterName })
      }
    });
  } catch (auditErr) {
    console.warn("[K8s] Failed to write audit log:", auditErr);
  }

  revalidatePath("/inventory/namespaces");
  return { success: true, namespace, message: "Namespace created successfully" };
}

export async function updateK8sNamespace(
  id: string,
  data: {
    name: string;
    supervisorIp: string;
    clusterName?: string;
    totalSpaceGb?: number;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  if (!userRoles.includes("ADMIN") && !userRoles.includes("DC_OPS")) {
    throw new Error("Only Admin or DC_OPS can edit Kubernetes namespaces");
  }

  const name = data.name.trim().toLowerCase();
  const supervisorIp = data.supervisorIp.trim();

  if (!name || !supervisorIp) {
    throw new Error("Namespace name and supervisor IP are required");
  }

  const k8sNameRegex = /^[a-z0-9]([-a-z0-9]*[a-z0-9])?$/;
  if (!k8sNameRegex.test(name)) {
    throw new Error("Namespace name must consist of lowercase alphanumeric characters or '-' (RFC 1123).");
  }

  // Check unique name if changed
  const existing = await prisma.k8sNamespace.findFirst({
    where: { name, NOT: { id } }
  });
  if (existing) {
    throw new Error(`Namespace name "${name}" is already in use`);
  }

  const updated = await prisma.$transaction(async (tx) => {
    const ns = await tx.k8sNamespace.update({
      where: { id },
      data: {
        name,
        supervisorIp,
      }
    });

    if (data.clusterName !== undefined || data.totalSpaceGb !== undefined) {
      const cluster = await tx.k8sCluster.findFirst({ where: { namespaceId: id } });
      if (cluster) {
        await tx.k8sCluster.update({
          where: { id: cluster.id },
          data: {
            clusterName: data.clusterName?.trim() || cluster.clusterName,
            totalSpaceGb: data.totalSpaceGb !== undefined ? Number(data.totalSpaceGb) : cluster.totalSpaceGb,
          }
        });
      }
    }

    return ns;
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "UPDATE_K8S_NAMESPACE",
        entityType: "K8S_NAMESPACE",
        entityId: id,
        details: JSON.stringify(data),
      }
    });
  } catch (err) {
    console.warn("[K8s] Failed to record audit log:", err);
  }

  revalidatePath("/inventory/namespaces");
  return { success: true, namespace: updated, message: "Namespace updated successfully" };
}

export async function deleteK8sNamespace(id: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  if (!userRoles.includes("ADMIN") && !userRoles.includes("DC_OPS")) {
    throw new Error("Only Admin or DC_OPS can delete Kubernetes namespaces");
  }

  const ns = await prisma.k8sNamespace.findUnique({
    where: { id },
    include: { clusters: true }
  });

  if (!ns) {
    throw new Error("Namespace not found");
  }

  await prisma.$transaction(async (tx) => {
    // 1. Delete subdomains
    await tx.k8sSubdomain.deleteMany({ where: { namespaceId: id } });

    // 2. Find clusters
    const clusters = await tx.k8sCluster.findMany({ where: { namespaceId: id }, select: { id: true } });
    const clusterIds = clusters.map(c => c.id);

    if (clusterIds.length > 0) {
      // 3. Find node groups
      const groups = await tx.k8sNodeGroup.findMany({ where: { clusterId: { in: clusterIds } }, select: { id: true } });
      const groupIds = groups.map(g => g.id);

      if (groupIds.length > 0) {
        // 4. Delete nodes
        await tx.k8sNode.deleteMany({ where: { nodeGroupId: { in: groupIds } } });
        // 5. Delete node groups
        await tx.k8sNodeGroup.deleteMany({ where: { id: { in: groupIds } } });
      }

      // 6. Delete clusters
      await tx.k8sCluster.deleteMany({ where: { id: { in: clusterIds } } });
    }

    // 7. Delete namespace
    await tx.k8sNamespace.delete({ where: { id } });
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "DELETE_K8S_NAMESPACE",
        entityType: "K8S_NAMESPACE",
        entityId: id,
        details: JSON.stringify({ name: ns.name, supervisorIp: ns.supervisorIp }),
      }
    });
  } catch (err) {
    console.warn("[K8s] Failed to record audit log:", err);
  }

  revalidatePath("/inventory/namespaces");
  return { success: true, message: `Namespace "${ns.name}" deleted successfully` };
}

export async function deleteK8sNode(nodeId: string) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  if (!userRoles.includes("ADMIN") && !userRoles.includes("DC_OPS")) {
    throw new Error("Only Admin or DC_OPS can delete Kubernetes nodes");
  }

  const node = await prisma.k8sNode.findUnique({
    where: { id: nodeId },
    include: { nodeGroup: true }
  });

  if (!node) {
    throw new Error("Node not found");
  }

  await prisma.$transaction(async (tx) => {
    await tx.k8sNode.delete({ where: { id: nodeId } });
    await tx.k8sNodeGroup.update({
      where: { id: node.nodeGroupId },
      data: {
        nodeCount: { decrement: 1 }
      }
    });
  });

  revalidatePath("/inventory/namespaces");
  return { success: true, message: `Node "${node.name}" deleted successfully` };
}

export async function addNodeGroupToCluster(data: {
  clusterId: string;
  role: "MASTER" | "WORKER";
  nodeCount: number;
  vcpu: number;
  ramGb: number;
  storageGb?: number;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  if (!userRoles.includes("ADMIN") && !userRoles.includes("DC_OPS")) {
    throw new Error("Only Admin or DC_OPS can add node groups");
  }

  const cluster = await prisma.k8sCluster.findUnique({
    where: { id: data.clusterId },
    include: { namespace: true }
  });

  if (!cluster) {
    throw new Error("Cluster not found");
  }

  const count = Math.max(1, data.nodeCount || 1);
  const vcpu = Math.max(1, data.vcpu || 4);
  const ramGb = Math.max(1, data.ramGb || 8);
  const storageGb = Math.max(10, data.storageGb || 50);

  const newGroup = await prisma.$transaction(async (tx) => {
    const ng = await tx.k8sNodeGroup.create({
      data: {
        clusterId: cluster.id,
        role: data.role,
        nodeCount: count,
        vcpu,
        ramGb,
        storageGb,
        isClonable: true,
      }
    });

    await tx.k8sCluster.update({
      where: { id: cluster.id },
      data: {
        totalSpaceGb: (cluster.totalSpaceGb || 0) + (storageGb * count)
      }
    });

    const roleLower = data.role.toLowerCase();
    for (let i = 1; i <= count; i++) {
      await tx.k8sNode.create({
        data: {
          nodeGroupId: ng.id,
          name: `${cluster.namespace.name}-${roleLower}-${i}`,
          subdomainStatus: "PENDING",
        }
      });
    }

    return ng;
  });

  revalidatePath("/inventory/namespaces");
  return { success: true, nodeGroup: newGroup, message: `${data.role} node group added successfully` };
}

export interface UpdateK8sNodeInput {
  name: string;
  ipAddress?: string | null;
  externalIp?: string | null;
  subdomain?: string | null;
  subdomainStatus?: string;
}

export async function updateK8sNode(nodeId: string, data: UpdateK8sNodeInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  const isDCOps = userRoles.includes("DC_OPS");
  const isAdmin = userRoles.includes("ADMIN");

  const node = await prisma.k8sNode.findUnique({
    where: { id: nodeId },
    include: {
      nodeGroup: {
        include: {
          cluster: {
            include: {
              namespace: {
                include: {
                  requests: {
                    where: {
                      requesterId: session.user.id,
                      status: "PROVISIONED"
                    }
                  }
                }
              },
              request: true
            }
          }
        }
      }
    }
  });

  if (!node) throw new Error("Node not found");

  const isOwner =
    node.nodeGroup.cluster.request?.requesterId === session.user.id ||
    (node.nodeGroup.cluster.namespace?.requests && node.nodeGroup.cluster.namespace.requests.length > 0);
  if (!isOwner && !isDCOps && !isAdmin) {
    throw new Error("Only Admin, DC_OPS, or cluster owner can update Kubernetes nodes");
  }

  const name = data.name.trim();
  if (!name) throw new Error("Node name is required");

  const updatedNode = await prisma.k8sNode.update({
    where: { id: nodeId },
    data: {
      name,
      ipAddress: data.ipAddress?.trim() || null,
      externalIp: data.externalIp?.trim() || null,
      subdomain: data.subdomain?.trim() || null,
      subdomainStatus: data.subdomainStatus || (data.subdomain ? "ACTIVE" : "PENDING"),
    }
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "UPDATE_K8S_NODE",
        entityType: "K8S_NODE",
        entityId: nodeId,
        details: JSON.stringify({ nodeId, ...data }),
      }
    });
  } catch (err) {
    console.warn("[K8s] Failed to record audit log:", err);
  }

  revalidatePath("/inventory/namespaces");
  revalidatePath("/my-vms");
  return { success: true, message: `Node "${updatedNode.name}" updated successfully`, node: updatedNode };
}

export async function updateK8sNodeGroup(
  nodeGroupId: string,
  data: { vcpu?: number; ramGb?: number; storageGb?: number }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  const isDCOps = userRoles.includes("DC_OPS");
  const isAdmin = userRoles.includes("ADMIN");

  if (!isDCOps && !isAdmin) {
    throw new Error("Only Admin or DC_OPS can update node group specifications");
  }

  const ng = await prisma.k8sNodeGroup.findUnique({
    where: { id: nodeGroupId }
  });
  if (!ng) throw new Error("Node group not found");

  const updated = await prisma.k8sNodeGroup.update({
    where: { id: nodeGroupId },
    data: {
      vcpu: data.vcpu ? Math.max(1, Number(data.vcpu)) : ng.vcpu,
      ramGb: data.ramGb ? Math.max(1, Number(data.ramGb)) : ng.ramGb,
      storageGb: data.storageGb ? Math.max(10, Number(data.storageGb)) : ng.storageGb,
    }
  });

  // Recalculate cluster totalSpaceGb
  if (data.storageGb && ng.clusterId) {
    const allGroups = await prisma.k8sNodeGroup.findMany({
      where: { clusterId: ng.clusterId }
    });
    const totalClusterStorage = allGroups.reduce((acc, g) => acc + ((g.storageGb || 0) * (g.nodeCount || 1)), 0);
    await prisma.k8sCluster.update({
      where: { id: ng.clusterId },
      data: { totalSpaceGb: totalClusterStorage }
    });
  }

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "UPDATE_K8S_NODE_GROUP",
        entityType: "K8S_NODE_GROUP",
        entityId: nodeGroupId,
        details: JSON.stringify(data),
      }
    });
  } catch (err) {
    console.warn("[K8s] Failed to record audit log:", err);
  }

  revalidatePath("/inventory/namespaces");
  return { success: true, message: "Node group specifications updated successfully", nodeGroup: updated };
}

export interface AddK8sSubdomainInput {
  namespaceId: string;
  subdomain: string;
  externalIp?: string;
  serviceName?: string;
  targetPort?: number;
  purpose?: string;
}

export async function addSubdomainToNamespace(data: AddK8sSubdomainInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  const isDCOps = userRoles.includes("DC_OPS");
  const isAdmin = userRoles.includes("ADMIN");

  const namespace = await prisma.k8sNamespace.findUnique({
    where: { id: data.namespaceId },
    include: {
      clusters: { include: { request: true } },
      requests: {
        where: {
          requesterId: session.user.id,
          status: "PROVISIONED"
        }
      }
    }
  });
  if (!namespace) throw new Error("Namespace not found");

  const isOwner =
    namespace.clusters.some((c: any) => c.request?.requesterId === session.user.id) ||
    (namespace.requests && namespace.requests.length > 0);
  if (!isOwner && !isDCOps && !isAdmin) {
    throw new Error("You do not have permission to add subdomains to this namespace");
  }

  const cleanSub = data.subdomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!cleanSub) throw new Error("Subdomain is required");

  const status = (isAdmin || isDCOps) ? "ACTIVE" : "PENDING";

  const newSub = await prisma.k8sSubdomain.create({
    data: {
      namespaceId: data.namespaceId,
      subdomain: cleanSub,
      externalIp: data.externalIp?.trim() || null,
      serviceName: data.serviceName?.trim() || null,
      targetPort: data.targetPort ? Number(data.targetPort) : 443,
      purpose: data.purpose?.trim() || null,
      status,
      requestedById: session.user.id,
      approvedById: (isAdmin || isDCOps) ? session.user.id : null,
    }
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "ADD_K8S_SUBDOMAIN",
        entityType: "K8S_SUBDOMAIN",
        entityId: newSub.id,
        details: JSON.stringify({
          namespaceId: data.namespaceId,
          namespaceName: namespace.name,
          subdomain: cleanSub,
          externalIp: data.externalIp,
          status,
        })
      }
    });
  } catch (err) {
    console.warn("[K8s] Failed to record audit log:", err);
  }

  revalidatePath("/inventory/namespaces");
  revalidatePath("/my-vms");
  return { success: true, subdomain: newSub, message: `Subdomain "${cleanSub}" added successfully` };
}

export async function updateK8sSubdomain(
  id: string,
  data: {
    subdomain: string;
    externalIp?: string | null;
    serviceName?: string | null;
    targetPort?: number | null;
    status?: string;
  }
) {
  const session = await getServerSession(authOptions);
  if (!session?.user) throw new Error("Unauthorized");

  const userRoles = session.user.roles || [];
  const isDCOps = userRoles.includes("DC_OPS");
  const isAdmin = userRoles.includes("ADMIN");

  const sub = await prisma.k8sSubdomain.findUnique({
    where: { id },
    include: {
      namespace: {
        include: {
          clusters: { include: { request: true } },
          requests: {
            where: {
              requesterId: session.user.id,
              status: "PROVISIONED"
            }
          }
        }
      }
    }
  });
  if (!sub) throw new Error("Subdomain not found");

  const isOwner =
    sub.namespace.clusters.some((c: any) => c.request?.requesterId === session.user.id) ||
    (sub.namespace.requests && sub.namespace.requests.length > 0);
  if (!isOwner && !isDCOps && !isAdmin) {
    throw new Error("You do not have permission to update this subdomain");
  }

  const cleanSub = data.subdomain.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/$/, "");
  if (!cleanSub) throw new Error("Subdomain is required");

  const updated = await prisma.k8sSubdomain.update({
    where: { id },
    data: {
      subdomain: cleanSub,
      externalIp: data.externalIp?.trim() || null,
      serviceName: data.serviceName?.trim() || null,
      targetPort: data.targetPort ? Number(data.targetPort) : sub.targetPort,
      status: data.status || sub.status,
    }
  });

  try {
    await prisma.auditLog.create({
      data: {
        actorId: session.user.id,
        action: "UPDATE_K8S_SUBDOMAIN",
        entityType: "K8S_SUBDOMAIN",
        entityId: id,
        details: JSON.stringify(data)
      }
    });
  } catch (err) {
    console.warn("[K8s] Failed to record audit log:", err);
  }

  revalidatePath("/inventory/namespaces");
  revalidatePath("/my-vms");
  return { success: true, subdomain: updated, message: "Subdomain updated successfully" };
}