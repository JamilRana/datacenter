// src/app/api/admin/backup/route.ts
export const dynamic = 'force-dynamic';
import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";

export async function GET() {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.roles?.includes("ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Export all tables
    const systemSettings = await prisma.systemSetting.findMany();
    const approvalWorkflows = await prisma.approvalWorkflow.findMany();
    const roles = await prisma.role.findMany();
    const users = await prisma.user.findMany();
    const userRoles = await prisma.userRole.findMany();
    const complianceTags = await prisma.complianceTag.findMany();
    const physicalClusters = await prisma.physicalCluster.findMany();
    const assets = await prisma.asset.findMany();
    const softwareLicenses = await prisma.softwareLicense.findMany();
    const k8sNamespaces = await prisma.k8sNamespace.findMany();
    const requests = await prisma.request.findMany();
    const additionalDisks = await prisma.additionalDisk.findMany();
    const firewallPorts = await prisma.firewallPort.findMany();
    const networkAccessEntries = await prisma.networkAccessEntry.findMany();
    const vmSpecifications = await prisma.vmSpecification.findMany();
    const approvals = await prisma.approval.findMany();
    const attachments = await prisma.attachment.findMany();
    const vmInstances = await prisma.vmInstance.findMany();
    const vmSpecs = await prisma.vmSpec.findMany();
    const vmSpecDisks = await prisma.vmSpecDisk.findMany();
    const vmSpecFirewallPorts = await prisma.vmSpecFirewallPort.findMany();
    const vmSpecNetworkAccesses = await prisma.vmSpecNetworkAccess.findMany();
    const customizationRequests = await prisma.customizationRequest.findMany();
    const additionalDiskInputs = await prisma.additionalDiskInput.findMany();
    const firewallPortInputs = await prisma.firewallPortInput.findMany();
    const networkAccessInputs = await prisma.networkAccessInput.findMany();
    const customizationHistories = await prisma.customizationHistory.findMany();
    const auditLogs = await prisma.auditLog.findMany();
    const notifications = await prisma.notification.findMany();
    const k8sClusters = await prisma.k8sCluster.findMany();
    const k8sNodeGroups = await prisma.k8sNodeGroup.findMany();
    const k8sNodes = await prisma.k8sNode.findMany();
    const vmCredentials = await prisma.vmCredential.findMany();
    const credentialAccessLogs = await prisma.credentialAccessLog.findMany();
    const requestTags = await prisma.requestTag.findMany();
    const vmTags = await prisma.vmTag.findMany();
    const k8sRequestNodeGroups = await prisma.k8sRequestNodeGroup.findMany();
    const passwordResetOtps = await prisma.passwordResetOtp.findMany();
    const vpnAssignments = await prisma.vpnAssignment.findMany();
    const horizonAssignments = await prisma.horizonAssignment.findMany();

    const backup = {
      version: "1.0",
      timestamp: new Date().toISOString(),
      data: {
        systemSettings,
        approvalWorkflows,
        roles,
        users,
        userRoles,
        complianceTags,
        physicalClusters,
        assets,
        softwareLicenses,
        k8sNamespaces,
        requests,
        additionalDisks,
        firewallPorts,
        networkAccessEntries,
        vmSpecifications,
        approvals,
        attachments,
        vmInstances,
        vmSpecs,
        vmSpecDisks,
        vmSpecFirewallPorts,
        vmSpecNetworkAccesses,
        customizationRequests,
        additionalDiskInputs,
        firewallPortInputs,
        networkAccessInputs,
        customizationHistories,
        auditLogs,
        notifications,
        k8sClusters,
        k8sNodeGroups,
        k8sNodes,
        vmCredentials,
        credentialAccessLogs,
        requestTags,
        vmTags,
        k8sRequestNodeGroups,
        passwordResetOtps,
        vpnAssignments,
        horizonAssignments
      }
    };

    return NextResponse.json(backup);
  } catch (error) {
    console.error("Error creating database backup:", error);
    return NextResponse.json({ error: "Failed to create database backup" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.roles?.includes("ADMIN")) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const payload = await req.json();
    if (!payload || payload.version !== "1.0" || !payload.data) {
      return NextResponse.json({ error: "Invalid backup format" }, { status: 400 });
    }

    const { data } = payload;

    // 1. Clean Database
    console.log(" Wiping database for restore...");
    await prisma.$transaction([
      // Wiping child tables first
      prisma.notification.deleteMany({}),
      prisma.auditLog.deleteMany({}),
      prisma.approval.deleteMany({}),
      prisma.attachment.deleteMany({}),
      prisma.userRole.deleteMany({}),
      prisma.requestTag.deleteMany({}),
      prisma.vmTag.deleteMany({}),
      prisma.complianceTag.deleteMany({}),
      prisma.credentialAccessLog.deleteMany({}),
      prisma.vmCredential.deleteMany({}),
      prisma.vmSpecDisk.deleteMany({}),
      prisma.vmSpecFirewallPort.deleteMany({}),
      prisma.vmSpecNetworkAccess.deleteMany({}),
      prisma.additionalDisk.deleteMany({}),
      prisma.firewallPort.deleteMany({}),
      prisma.networkAccessEntry.deleteMany({}),
      prisma.vmSpecification.deleteMany({}),
      prisma.k8sRequestNodeGroup.deleteMany({}),
      prisma.k8sNode.deleteMany({}),
      prisma.k8sNodeGroup.deleteMany({}),
      prisma.k8sCluster.deleteMany({}),
      prisma.k8sNamespace.deleteMany({}),
      prisma.additionalDiskInput.deleteMany({}),
      prisma.firewallPortInput.deleteMany({}),
      prisma.networkAccessInput.deleteMany({}),
      prisma.customizationHistory.deleteMany({}),
      prisma.customizationRequest.deleteMany({}),
      prisma.vpnAssignment.deleteMany({}),
      prisma.horizonAssignment.deleteMany({}),
      prisma.passwordResetOtp.deleteMany({}),
      
      // Null out self-relations in Requests & VmInstances to prevent circular issues during wipe
      prisma.request.updateMany({
        data: {
          targetVmId: null,
          sourceVmId: null,
          upgradeVmId: null,
          accessTargetVmId: null
        }
      }),
      prisma.vmInstance.updateMany({
        data: {
          currentSpecId: null
        }
      })
    ]);

    await prisma.$transaction([
      prisma.vmSpec.deleteMany({}),
      prisma.vmInstance.deleteMany({}),
      prisma.request.deleteMany({}),
      prisma.user.deleteMany({}),
      prisma.approvalWorkflow.deleteMany({}),
      prisma.role.deleteMany({}),
      prisma.asset.deleteMany({}),
      prisma.physicalCluster.deleteMany({}),
      prisma.softwareLicense.deleteMany({}),
      prisma.systemSetting.deleteMany({})
    ]);

    console.log(" Wiped successfully. Restoring data...");

    // 2. Restore Database
    // We run the restore in sequential steps to satisfy foreign keys

    // Step A: Standalone Lookups
    if (data.systemSettings?.length) {
      await prisma.systemSetting.createMany({ data: data.systemSettings });
    }
    if (data.approvalWorkflows?.length) {
      await prisma.approvalWorkflow.createMany({ data: data.approvalWorkflows });
    }
    if (data.roles?.length) {
      await prisma.role.createMany({ data: data.roles });
    }
    if (data.users?.length) {
      await prisma.user.createMany({ data: data.users });
    }
    if (data.userRoles?.length) {
      await prisma.userRole.createMany({ data: data.userRoles });
    }
    if (data.complianceTags?.length) {
      await prisma.complianceTag.createMany({ data: data.complianceTags });
    }
    if (data.physicalClusters?.length) {
      await prisma.physicalCluster.createMany({ data: data.physicalClusters });
    }
    if (data.assets?.length) {
      await prisma.asset.createMany({ data: data.assets });
    }
    if (data.softwareLicenses?.length) {
      await prisma.softwareLicense.createMany({ data: data.softwareLicenses });
    }
    if (data.k8sNamespaces?.length) {
      await prisma.k8sNamespace.createMany({ data: data.k8sNamespaces });
    }
    if (data.passwordResetOtps?.length) {
      await prisma.passwordResetOtp.createMany({ data: data.passwordResetOtps });
    }

    // Step B: Requests (With VmInstance FKs set to Null temporarily)
    if (data.requests?.length) {
      const requestsWithNullVms = data.requests.map((r: any) => ({
        ...r,
        targetVmId: null,
        sourceVmId: null,
        upgradeVmId: null,
        accessTargetVmId: null
      }));
      await prisma.request.createMany({ data: requestsWithNullVms });
    }

    // Step C: VmInstances (With currentSpecId set to Null temporarily)
    if (data.vmInstances?.length) {
      const vmInstancesWithNullSpecs = data.vmInstances.map((v: any) => ({
        ...v,
        currentSpecId: null
      }));
      await prisma.vmInstance.createMany({ data: vmInstancesWithNullSpecs });
    }

    // Step D: VmSpecs
    if (data.vmSpecs?.length) {
      await prisma.vmSpec.createMany({ data: data.vmSpecs });
    }

    // Step E: VmInstance currentSpecId restoration
    if (data.vmInstances?.length) {
      for (const vm of data.vmInstances) {
        if (vm.currentSpecId) {
          await prisma.vmInstance.update({
            where: { id: vm.id },
            data: { currentSpecId: vm.currentSpecId }
          });
        }
      }
    }

    // Step F: Request VM relations restoration
    if (data.requests?.length) {
      for (const req of data.requests) {
        if (req.targetVmId || req.sourceVmId || req.upgradeVmId || req.accessTargetVmId) {
          await prisma.request.update({
            where: { id: req.id },
            data: {
              targetVmId: req.targetVmId || null,
              sourceVmId: req.sourceVmId || null,
              upgradeVmId: req.upgradeVmId || null,
              accessTargetVmId: req.accessTargetVmId || null
            }
          });
        }
      }
    }

    // Step G: Children & Leaf Nodes
    if (data.additionalDisks?.length) {
      await prisma.additionalDisk.createMany({ data: data.additionalDisks });
    }
    if (data.firewallPorts?.length) {
      await prisma.firewallPort.createMany({ data: data.firewallPorts });
    }
    if (data.networkAccessEntries?.length) {
      await prisma.networkAccessEntry.createMany({ data: data.networkAccessEntries });
    }
    if (data.vmSpecifications?.length) {
      await prisma.vmSpecification.createMany({ data: data.vmSpecifications });
    }
    if (data.approvals?.length) {
      await prisma.approval.createMany({ data: data.approvals });
    }
    if (data.attachments?.length) {
      await prisma.attachment.createMany({ data: data.attachments });
    }
    if (data.vmSpecDisks?.length) {
      await prisma.vmSpecDisk.createMany({ data: data.vmSpecDisks });
    }
    if (data.vmSpecFirewallPorts?.length) {
      await prisma.vmSpecFirewallPort.createMany({ data: data.vmSpecFirewallPorts });
    }
    if (data.vmSpecNetworkAccesses?.length) {
      await prisma.vmSpecNetworkAccess.createMany({ data: data.vmSpecNetworkAccesses });
    }
    if (data.customizationRequests?.length) {
      await prisma.customizationRequest.createMany({ data: data.customizationRequests });
    }
    if (data.additionalDiskInputs?.length) {
      await prisma.additionalDiskInput.createMany({ data: data.additionalDiskInputs });
    }
    if (data.firewallPortInputs?.length) {
      await prisma.firewallPortInput.createMany({ data: data.firewallPortInputs });
    }
    if (data.networkAccessInputs?.length) {
      await prisma.networkAccessInput.createMany({ data: data.networkAccessInputs });
    }
    if (data.customizationHistories?.length) {
      await prisma.customizationHistory.createMany({ data: data.customizationHistories });
    }
    if (data.auditLogs?.length) {
      await prisma.auditLog.createMany({ data: data.auditLogs });
    }
    if (data.notifications?.length) {
      await prisma.notification.createMany({ data: data.notifications });
    }
    if (data.k8sClusters?.length) {
      await prisma.k8sCluster.createMany({ data: data.k8sClusters });
    }
    if (data.k8sNodeGroups?.length) {
      await prisma.k8sNodeGroup.createMany({ data: data.k8sNodeGroups });
    }
    if (data.k8sNodes?.length) {
      await prisma.k8sNode.createMany({ data: data.k8sNodes });
    }
    if (data.vmCredentials?.length) {
      await prisma.vmCredential.createMany({ data: data.vmCredentials });
    }
    if (data.credentialAccessLogs?.length) {
      await prisma.credentialAccessLog.createMany({ data: data.credentialAccessLogs });
    }
    if (data.requestTags?.length) {
      await prisma.requestTag.createMany({ data: data.requestTags });
    }
    if (data.vmTags?.length) {
      await prisma.vmTag.createMany({ data: data.vmTags });
    }
    if (data.k8sRequestNodeGroups?.length) {
      await prisma.k8sRequestNodeGroup.createMany({ data: data.k8sRequestNodeGroups });
    }
    if (data.vpnAssignments?.length) {
      await prisma.vpnAssignment.createMany({ data: data.vpnAssignments });
    }
    if (data.horizonAssignments?.length) {
      await prisma.horizonAssignment.createMany({ data: data.horizonAssignments });
    }

    console.log(" Restore completed successfully!");
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error restoring database backup:", error);
    const message = error instanceof Error ? error.message : "Failed to restore database backup";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
