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

    // ✅ CREATE REQUEST WITH CORRECT FIELDS
    const newCreatedRequest = await prisma.request.create({
        data: {
          requestType: RequestType.K8S_NAMESPACE,
          status: (formData.get("status") as RequestStatus) || RequestStatus.DRAFT,
          quantity: 1,
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

          // K8s Namespace fields - minimal specs
          vcpu: 0,
          ramGb: 0,
          storageGb: 0,
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

    // Check if namespace name already exists
    const existingNamespace = await prisma.k8sNamespace.findUnique({
      where: { name: namespaceName }
    });
    if (existingNamespace) {
      return { success: false, message: `Namespace "${namespaceName}" already exists. Please choose a unique name.` };
    }

    await prisma.$transaction(async (tx: any) => {
      // 1. Create Namespace
      const namespace = await tx.k8sNamespace.create({
        data: {
          name: namespaceName,
          supervisorIp: supervisorIp
        }
      });

      // 2. Create Cluster
      const cluster = await tx.k8sCluster.create({
        data: {
          namespaceId: namespace.id,
          requestId: request.id,
          clusterName: `${namespaceName}-cluster`,
          status: "ACTIVE"
        }
      });

      // 3. Create Node Groups & Nodes
      for (const group of request.k8sRequestNodeGroups) {
        const nodeGroup = await tx.k8sNodeGroup.create({
          data: {
            clusterId: cluster.id,
            role: group.role,
            nodeCount: group.nodeCount,
            vcpu: group.vcpu,
            ramGb: group.ramGb,
            isClonable: true
          }
        });

        // Create individual K8s Nodes
        for (let i = 1; i <= group.nodeCount; i++) {
          await tx.k8sNode.create({
            data: {
              nodeGroupId: nodeGroup.id,
              name: `${namespaceName}-${group.role.toLowerCase()}-${i}`,
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

    const userRoles = session.user.roles || [];
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    let namespaces;
    if (isDCOps || isAdmin) {
      namespaces = await prisma.k8sNamespace.findMany({
        include: {
          clusters: {
            include: {
              nodeGroups: {
                include: {
                  nodes: true
                }
              }
            }
          }
        }
      });
    } else {
      namespaces = await prisma.k8sNamespace.findMany({
        where: {
          clusters: {
            some: {
              request: {
                requesterId: session.user.id
              }
            }
          }
        },
        include: {
          clusters: {
            include: {
              nodeGroups: {
                include: {
                  nodes: true
                }
              }
            }
          }
        }
      });
    }

    return { success: true, namespaces };
  } catch (error) {
    console.error("Error fetching namespaces:", error);
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
            namespace: true,
            request: true
          }
        },
        nodes: true
      }
    });

    if (!nodeGroup) throw new Error("Node group not found");

    // Check permission
    const userRoles = session.user.roles || [];
    const isOwner = nodeGroup.cluster.request?.requesterId === session.user.id;
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
          entityType: "REQUEST",
          entityId: nodeGroup.cluster.requestId || "",
          details: JSON.stringify({ nodeGroupId, nodeId: newNode.id, nodeName: newNode.name }),
        }
      });

      return newNode;
    });

    revalidatePath("/my-vms");
    return { success: true, message: `Node ${result.name} added successfully`, node: result };
  } catch (error) {
    console.error("Error adding K8s node:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
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
    const isOwner = node.nodeGroup.cluster.request?.requesterId === session.user.id;
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
      return { success: true, pendingNodes: [] };
    }

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

    return { success: true, pendingNodes };
  } catch (error) {
    console.error("Error fetching pending subdomains:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}

export async function approveSubdomain(nodeId: string, decision: "ACTIVE" | "REJECTED") {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user) throw new Error("Unauthorized");

    const userRoles = session.user.roles || [];
    const isL1 = userRoles.includes("APPROVER_L1");
    const isDCOps = userRoles.includes("DC_OPS");
    const isAdmin = userRoles.includes("ADMIN");

    if (!isL1 && !isDCOps && !isAdmin) {
      throw new Error("You do not have permission to approve subdomains");
    }

    await prisma.k8sNode.update({
      where: { id: nodeId },
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
        entityId: nodeId,
        details: JSON.stringify({ nodeId, decision }),
      }
    });

    revalidatePath("/approvals");
    revalidatePath("/my-vms");
    return { success: true, message: `Subdomain request has been ${decision.toLowerCase()}` };
  } catch (error) {
    console.error("Error approving subdomain:", error);
    return { success: false, message: error instanceof Error ? error.message : "Unknown error" };
  }
}