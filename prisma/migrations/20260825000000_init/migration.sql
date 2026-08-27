-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "RequestType" AS ENUM ('NEW_VM', 'CLONE_VM', 'K8S_NAMESPACE', 'CUSTOMIZED', 'RENEWAL', 'DECOMMISSION', 'VPN_ACCESS', 'HORIZON_ACCESS', 'SYSTEM_UPGRADE');

-- CreateEnum
CREATE TYPE "RequestStatus" AS ENUM ('DRAFT', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3', 'APPROVED', 'REJECTED', 'PROVISIONED', 'PARTIALLY_PROVISIONED', 'CLOSED', 'REQUESTER_APPROVED', 'PENDING_L4');

-- CreateEnum
CREATE TYPE "CustomizationStatus" AS ENUM ('DRAFT', 'PENDING_L1', 'PENDING_L2', 'PENDING_L3', 'APPROVED', 'REJECTED', 'APPLIED', 'PENDING_L4');

-- CreateEnum
CREATE TYPE "Protocol" AS ENUM ('TCP', 'UDP', 'OTHER');

-- CreateEnum
CREATE TYPE "ServerType" AS ENUM ('APPLICATION', 'MAIL', 'DATABASE', 'FTP', 'OTHER');

-- CreateEnum
CREATE TYPE "Environment" AS ENUM ('DEVELOPMENT', 'STAGING', 'PRODUCTION', 'TESTING');

-- CreateEnum
CREATE TYPE "LicenseProvider" AS ENUM ('REQUESTER', 'PARTNER', 'OPEN_SOURCE');

-- CreateEnum
CREATE TYPE "SSLProvider" AS ENUM ('REQUESTER', 'MIS');

-- CreateEnum
CREATE TYPE "NetworkAccess" AS ENUM ('LOCAL', 'INTERNET', 'REMOTE', 'VPN');

-- CreateEnum
CREATE TYPE "ApprovalDecision" AS ENUM ('PENDING', 'APPROVED', 'REJECTED', 'RETURNED', 'FORWARDED');

-- CreateEnum
CREATE TYPE "ApprovalEntityType" AS ENUM ('REQUEST', 'CUSTOMIZATION');

-- CreateEnum
CREATE TYPE "VmStatus" AS ENUM ('ACTIVE', 'SUSPENDED', 'RETIRED');

-- CreateEnum
CREATE TYPE "AttachmentType" AS ENUM ('SECURITY_REPORT', 'JUSTIFICATION');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SERVER', 'ROUTER', 'SWITCH', 'FIREWALL', 'STORAGE', 'UPS', 'CONSOLE_SERVER', 'OTHER');

-- CreateEnum
CREATE TYPE "ApprovalLevel" AS ENUM ('L1', 'L2', 'L3');

-- CreateEnum
CREATE TYPE "AccessType" AS ENUM ('VPN', 'HORIZON');

-- CreateEnum
CREATE TYPE "K8sNodeRole" AS ENUM ('MASTER', 'WORKER');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "designation" TEXT,
    "organization" TEXT,
    "contact" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "password" TEXT NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserRole" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "requests" (
    "id" TEXT NOT NULL,
    "requestType" "RequestType" NOT NULL,
    "status" "RequestStatus" NOT NULL DEFAULT 'DRAFT',
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "requestId" TEXT,
    "projectName" TEXT,
    "systemName" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "environment" "Environment" NOT NULL,
    "requesterId" TEXT NOT NULL,
    "alternativePersonName" TEXT,
    "alternativePersonDesignation" TEXT,
    "alternativePersonOrganization" TEXT,
    "alternativePersonContact" TEXT,
    "alternativePersonEmail" TEXT,
    "developerName" TEXT,
    "developerContact" TEXT,
    "developerEmail" TEXT,
    "serverType" "ServerType" NOT NULL,
    "vcpu" INTEGER,
    "ramGb" INTEGER,
    "osName" TEXT,
    "osVersion" TEXT,
    "osLicenseBy" "LicenseProvider",
    "storageGb" INTEGER,
    "subdomain" TEXT,
    "sslProvider" "SSLProvider",
    "sslCostPaidBy" TEXT,
    "retentionPeriod" TEXT,
    "requiredPublicIP" BOOLEAN NOT NULL DEFAULT false,
    "vaReportSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "justificationSubmitted" BOOLEAN NOT NULL DEFAULT false,
    "renewalRequired" BOOLEAN NOT NULL DEFAULT false,
    "renewalPeriodMonths" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provisioned_at" TIMESTAMP(3),
    "frontendTech" TEXT,
    "backendTech" TEXT,
    "serverArchitecture" TEXT,
    "additionalTechNotes" TEXT,
    "dataBase" TEXT,
    "vpnRequired" BOOLEAN NOT NULL DEFAULT false,
    "vpnDetails" TEXT,
    "targetVmId" TEXT,
    "developerDesignation" TEXT,
    "developerId" TEXT,
    "developerOrganization" TEXT,
    "sourceVmId" TEXT,
    "cloneFullDisk" BOOLEAN NOT NULL DEFAULT true,
    "kubernetesOption" BOOLEAN NOT NULL DEFAULT false,
    "kubernetesNamespace" TEXT,
    "virtualIpType" TEXT,
    "assignedIpAddress" TEXT,
    "credentialsDelivered" BOOLEAN NOT NULL DEFAULT false,
    "credentialsDeliveredAt" TIMESTAMP(3),
    "underExistingNamespace" BOOLEAN NOT NULL DEFAULT false,
    "existingNamespaceId" TEXT,
    "upgradeVmId" TEXT,
    "upgradeCpu" INTEGER,
    "upgradeRamGb" INTEGER,
    "upgradeStorageGb" INTEGER,
    "upgradeJustification" TEXT,
    "accessTargetVmId" TEXT,
    "accessType" "AccessType",
    "accessJustification" TEXT,

    CONSTRAINT "requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalDisk" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "sizeGb" INTEGER NOT NULL,
    "purpose" TEXT,
    "sequence" INTEGER NOT NULL,
    "vmSpecificationId" TEXT,

    CONSTRAINT "AdditionalDisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallPort" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" "Protocol" NOT NULL,
    "purpose" TEXT NOT NULL,
    "source" TEXT,
    "vmSpecificationId" TEXT,

    CONSTRAINT "FirewallPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkAccessEntry" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "accessType" "NetworkAccess" NOT NULL,
    "vmSpecificationId" TEXT,

    CONSTRAINT "NetworkAccessEntry_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmSpecification" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "stack" TEXT,
    "environment" "Environment" NOT NULL,
    "vcpu" INTEGER NOT NULL,
    "ramGb" INTEGER NOT NULL,
    "storageGb" INTEGER NOT NULL,
    "gpuEnabled" BOOLEAN NOT NULL DEFAULT false,
    "gpuVramGb" INTEGER,
    "gpuStorageGb" INTEGER,
    "osVersion" TEXT,
    "subdomain" TEXT,
    "vpnDetails" TEXT,

    CONSTRAINT "VmSpecification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Approval" (
    "id" TEXT NOT NULL,
    "entityType" "ApprovalEntityType" NOT NULL,
    "level" INTEGER NOT NULL,
    "approverId" TEXT NOT NULL,
    "decision" "ApprovalDecision" NOT NULL DEFAULT 'PENDING',
    "comments" TEXT,
    "decidedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "customizationRequestId" TEXT,
    "requestId" TEXT,

    CONSTRAINT "Approval_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vm_instances" (
    "id" TEXT NOT NULL,
    "requestId" TEXT,
    "sequenceNumber" INTEGER NOT NULL,
    "ownerId" TEXT,
    "hostname" TEXT,
    "ipAddress" TEXT,
    "publicIpAddress" TEXT,
    "status" "VmStatus" NOT NULL DEFAULT 'ACTIVE',
    "renewalDate" TIMESTAMP(3),
    "decommissionedAt" TIMESTAMP(3),
    "hasRemoteAccess" BOOLEAN NOT NULL DEFAULT false,
    "vpnRequired" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "provisioned_at" TIMESTAMP(3),
    "currentSpecId" TEXT,
    "subdomain" TEXT,
    "environment" "Environment",
    "hostAssetId" TEXT,
    "systemName" TEXT,
    "cloneOfRequestId" TEXT,

    CONSTRAINT "vm_instances_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmSpec" (
    "id" TEXT NOT NULL,
    "vmInstanceId" TEXT NOT NULL,
    "vcpu" INTEGER NOT NULL,
    "ramGb" INTEGER NOT NULL,
    "storageGb" INTEGER NOT NULL,
    "osName" TEXT,
    "osVersion" TEXT,
    "effectiveFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "appliedById" TEXT,
    "sourceRequestId" TEXT,
    "customizationRequestId" TEXT,

    CONSTRAINT "VmSpec_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmSpecDisk" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "sizeGb" INTEGER NOT NULL,
    "purpose" TEXT,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "VmSpecDisk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmSpecFirewallPort" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" "Protocol" NOT NULL,
    "purpose" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "VmSpecFirewallPort_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmSpecNetworkAccess" (
    "id" TEXT NOT NULL,
    "specId" TEXT NOT NULL,
    "accessType" "NetworkAccess" NOT NULL,

    CONSTRAINT "VmSpecNetworkAccess_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationRequest" (
    "id" TEXT NOT NULL,
    "parentRequestId" TEXT,
    "targetVmId" TEXT NOT NULL,
    "vcpu" INTEGER,
    "ramGb" INTEGER,
    "storageGb" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "requesterId" TEXT,
    "purpose" TEXT,
    "submittedAt" TIMESTAMP(3),
    "status" "CustomizationStatus" NOT NULL DEFAULT 'DRAFT',

    CONSTRAINT "CustomizationRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AdditionalDiskInput" (
    "id" TEXT NOT NULL,
    "customizationId" TEXT NOT NULL,
    "sizeGb" INTEGER NOT NULL,
    "purpose" TEXT,
    "sequence" INTEGER NOT NULL,

    CONSTRAINT "AdditionalDiskInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FirewallPortInput" (
    "id" TEXT NOT NULL,
    "customizationId" TEXT NOT NULL,
    "port" INTEGER NOT NULL,
    "protocol" "Protocol" NOT NULL,
    "purpose" TEXT NOT NULL,
    "source" TEXT,

    CONSTRAINT "FirewallPortInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "NetworkAccessInput" (
    "id" TEXT NOT NULL,
    "customizationId" TEXT NOT NULL,
    "accessType" "NetworkAccess" NOT NULL,

    CONSTRAINT "NetworkAccessInput_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomizationHistory" (
    "id" TEXT NOT NULL,
    "vmId" TEXT NOT NULL,
    "beforeSpecId" TEXT NOT NULL,
    "afterSpecId" TEXT NOT NULL,
    "appliedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reason" TEXT,

    CONSTRAINT "CustomizationHistory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "filePath" TEXT NOT NULL,
    "attachmentType" "AttachmentType" NOT NULL,
    "uploadedBy" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "entityType" TEXT,
    "entityId" TEXT,
    "details" JSONB,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vmId" TEXT,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SoftwareLicense" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT NOT NULL,
    "expiryDate" TIMESTAMP(3),
    "maintenanceExpiry" TIMESTAMP(3),
    "type" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SoftwareLicense_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "type" "AssetType" NOT NULL,
    "name" TEXT NOT NULL,
    "vendor" TEXT,
    "model" TEXT,
    "serial" TEXT,
    "location" TEXT,
    "warrantyExpiry" TIMESTAMP(3),
    "cpuCores" INTEGER,
    "ramGb" INTEGER,
    "storageGb" INTEGER,
    "graphicsCardModel" TEXT,
    "graphicsCardSpec" TEXT,
    "interfaces" INTEGER,
    "throughputGbps" DOUBLE PRECISION,
    "vlanSupport" BOOLEAN,
    "capacityTb" DOUBLE PRECISION,
    "noOfDisks" INTEGER,
    "details" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "clusterId" TEXT,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PhysicalCluster" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PhysicalCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SystemSetting" (
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "label" TEXT,
    "description" TEXT,
    "category" TEXT NOT NULL DEFAULT 'general',
    "isSecret" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SystemSetting_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "ApprovalWorkflow" (
    "id" TEXT NOT NULL,
    "requestType" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "role" TEXT NOT NULL,
    "roleLabel" TEXT,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ApprovalWorkflow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "link" TEXT,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "K8sNamespace" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "supervisorIp" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "K8sNamespace_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "K8sCluster" (
    "id" TEXT NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "requestId" TEXT,
    "clusterName" TEXT NOT NULL,
    "username" TEXT,
    "totalSpaceGb" INTEGER,
    "status" "VmStatus" NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "K8sCluster_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "K8sNodeGroup" (
    "id" TEXT NOT NULL,
    "clusterId" TEXT NOT NULL,
    "role" "K8sNodeRole" NOT NULL,
    "nodeCount" INTEGER NOT NULL,
    "vcpu" INTEGER NOT NULL,
    "ramGb" INTEGER NOT NULL,
    "isClonable" BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "K8sNodeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VmCredential" (
    "id" TEXT NOT NULL,
    "vmInstanceId" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VmCredential_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CredentialAccessLog" (
    "id" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "vmInstanceId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "accessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CredentialAccessLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ComplianceTag" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ComplianceTag_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RequestTag" (
    "requestId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "RequestTag_pkey" PRIMARY KEY ("requestId","tagId")
);

-- CreateTable
CREATE TABLE "VmTag" (
    "vmInstanceId" TEXT NOT NULL,
    "tagId" TEXT NOT NULL,

    CONSTRAINT "VmTag_pkey" PRIMARY KEY ("vmInstanceId","tagId")
);

-- CreateTable
CREATE TABLE "K8sRequestNodeGroup" (
    "id" TEXT NOT NULL,
    "requestId" TEXT NOT NULL,
    "role" "K8sNodeRole" NOT NULL,
    "nodeCount" INTEGER NOT NULL,
    "vcpu" INTEGER NOT NULL,
    "ramGb" INTEGER NOT NULL,
    "storageGb" INTEGER NOT NULL,

    CONSTRAINT "K8sRequestNodeGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "K8sNode" (
    "id" TEXT NOT NULL,
    "nodeGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "ipAddress" TEXT,
    "externalIp" TEXT,
    "subdomain" TEXT,
    "subdomainStatus" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "K8sNode_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "K8sSubdomain" (
    "id" TEXT NOT NULL,
    "namespaceId" TEXT NOT NULL,
    "subdomain" TEXT NOT NULL,
    "externalIp" TEXT,
    "serviceName" TEXT,
    "targetPort" INTEGER DEFAULT 443,
    "purpose" TEXT,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "rejectionReason" TEXT,
    "requestedById" TEXT NOT NULL,
    "approvedById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "K8sSubdomain_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PasswordResetOtp" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "otp" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PasswordResetOtp_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "horizon_users" (
    "id" TEXT NOT NULL,
    "horizon_username" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "email" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "horizon_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "HorizonAssignment" (
    "id" TEXT NOT NULL,
    "horizon_user_id" TEXT,
    "vm_id" TEXT,
    "namespace_id" TEXT,
    "assigned_ip" TEXT,
    "assignment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "horizon_user" TEXT,
    "vm_instance_id" TEXT,
    "assigned_ip_old" TEXT,

    CONSTRAINT "HorizonAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "vpn_users" (
    "id" TEXT NOT NULL,
    "vpn_username" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "vpn_profile" TEXT NOT NULL,
    "vpn_ip" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "vpn_users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VpnAssignment" (
    "id" TEXT NOT NULL,
    "vpn_user_id" TEXT,
    "vm_id" TEXT,
    "namespace_id" TEXT,
    "assignment_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assigned_by_id" TEXT,
    "expiration_date" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "vpn_user" TEXT,
    "assigned_vpn_ip_old" TEXT,
    "vpn_profile_old" TEXT,
    "assigned_vms_old" TEXT,

    CONSTRAINT "VpnAssignment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "request_resources" (
    "id" TEXT NOT NULL,
    "request_id" TEXT NOT NULL,
    "vm_id" TEXT,
    "namespace_id" TEXT,

    CONSTRAINT "request_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "_AssetToSoftwareLicense" (
    "A" TEXT NOT NULL,
    "B" TEXT NOT NULL,

    CONSTRAINT "_AssetToSoftwareLicense_AB_pkey" PRIMARY KEY ("A","B")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Role_name_key" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "requests_requestId_key" ON "requests"("requestId");

-- CreateIndex
CREATE INDEX "requests_targetVmId_idx" ON "requests"("targetVmId");

-- CreateIndex
CREATE INDEX "requests_sourceVmId_idx" ON "requests"("sourceVmId");

-- CreateIndex
CREATE INDEX "requests_requesterId_idx" ON "requests"("requesterId");

-- CreateIndex
CREATE INDEX "requests_status_idx" ON "requests"("status");

-- CreateIndex
CREATE INDEX "requests_environment_idx" ON "requests"("environment");

-- CreateIndex
CREATE INDEX "requests_requesterId_status_idx" ON "requests"("requesterId", "status");

-- CreateIndex
CREATE INDEX "requests_environment_status_idx" ON "requests"("environment", "status");

-- CreateIndex
CREATE INDEX "requests_submittedAt_idx" ON "requests"("submittedAt");

-- CreateIndex
CREATE INDEX "requests_requestType_targetVmId_idx" ON "requests"("requestType", "targetVmId");

-- CreateIndex
CREATE INDEX "requests_existingNamespaceId_idx" ON "requests"("existingNamespaceId");

-- CreateIndex
CREATE INDEX "requests_upgradeVmId_idx" ON "requests"("upgradeVmId");

-- CreateIndex
CREATE INDEX "requests_accessTargetVmId_idx" ON "requests"("accessTargetVmId");

-- CreateIndex
CREATE INDEX "AdditionalDisk_requestId_idx" ON "AdditionalDisk"("requestId");

-- CreateIndex
CREATE INDEX "AdditionalDisk_vmSpecificationId_idx" ON "AdditionalDisk"("vmSpecificationId");

-- CreateIndex
CREATE INDEX "FirewallPort_requestId_idx" ON "FirewallPort"("requestId");

-- CreateIndex
CREATE INDEX "FirewallPort_vmSpecificationId_idx" ON "FirewallPort"("vmSpecificationId");

-- CreateIndex
CREATE INDEX "NetworkAccessEntry_requestId_idx" ON "NetworkAccessEntry"("requestId");

-- CreateIndex
CREATE INDEX "NetworkAccessEntry_vmSpecificationId_idx" ON "NetworkAccessEntry"("vmSpecificationId");

-- CreateIndex
CREATE INDEX "VmSpecification_requestId_idx" ON "VmSpecification"("requestId");

-- CreateIndex
CREATE INDEX "Approval_requestId_idx" ON "Approval"("requestId");

-- CreateIndex
CREATE INDEX "Approval_customizationRequestId_idx" ON "Approval"("customizationRequestId");

-- CreateIndex
CREATE INDEX "Approval_approverId_decision_idx" ON "Approval"("approverId", "decision");

-- CreateIndex
CREATE INDEX "Approval_entityType_decision_idx" ON "Approval"("entityType", "decision");

-- CreateIndex
CREATE UNIQUE INDEX "vm_instances_hostname_key" ON "vm_instances"("hostname");

-- CreateIndex
CREATE UNIQUE INDEX "vm_instances_ipAddress_key" ON "vm_instances"("ipAddress");

-- CreateIndex
CREATE UNIQUE INDEX "vm_instances_currentSpecId_key" ON "vm_instances"("currentSpecId");

-- CreateIndex
CREATE INDEX "vm_instances_ownerId_idx" ON "vm_instances"("ownerId");

-- CreateIndex
CREATE INDEX "vm_instances_status_idx" ON "vm_instances"("status");

-- CreateIndex
CREATE INDEX "vm_instances_ownerId_status_idx" ON "vm_instances"("ownerId", "status");

-- CreateIndex
CREATE INDEX "vm_instances_environment_status_idx" ON "vm_instances"("environment", "status");

-- CreateIndex
CREATE INDEX "vm_instances_hostAssetId_idx" ON "vm_instances"("hostAssetId");

-- CreateIndex
CREATE INDEX "vm_instances_cloneOfRequestId_idx" ON "vm_instances"("cloneOfRequestId");

-- CreateIndex
CREATE UNIQUE INDEX "vm_instances_requestId_sequenceNumber_key" ON "vm_instances"("requestId", "sequenceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "VmSpec_customizationRequestId_key" ON "VmSpec"("customizationRequestId");

-- CreateIndex
CREATE INDEX "VmSpec_vmInstanceId_idx" ON "VmSpec"("vmInstanceId");

-- CreateIndex
CREATE INDEX "VmSpec_effectiveFrom_idx" ON "VmSpec"("effectiveFrom");

-- CreateIndex
CREATE INDEX "VmSpecDisk_specId_idx" ON "VmSpecDisk"("specId");

-- CreateIndex
CREATE INDEX "VmSpecFirewallPort_specId_idx" ON "VmSpecFirewallPort"("specId");

-- CreateIndex
CREATE INDEX "VmSpecNetworkAccess_specId_idx" ON "VmSpecNetworkAccess"("specId");

-- CreateIndex
CREATE INDEX "CustomizationRequest_targetVmId_idx" ON "CustomizationRequest"("targetVmId");

-- CreateIndex
CREATE INDEX "CustomizationRequest_status_idx" ON "CustomizationRequest"("status");

-- CreateIndex
CREATE INDEX "CustomizationRequest_requesterId_idx" ON "CustomizationRequest"("requesterId");

-- CreateIndex
CREATE INDEX "CustomizationRequest_createdAt_idx" ON "CustomizationRequest"("createdAt");

-- CreateIndex
CREATE INDEX "CustomizationHistory_vmId_idx" ON "CustomizationHistory"("vmId");

-- CreateIndex
CREATE INDEX "CustomizationHistory_beforeSpecId_idx" ON "CustomizationHistory"("beforeSpecId");

-- CreateIndex
CREATE INDEX "CustomizationHistory_afterSpecId_idx" ON "CustomizationHistory"("afterSpecId");

-- CreateIndex
CREATE INDEX "CustomizationHistory_appliedById_idx" ON "CustomizationHistory"("appliedById");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_idx" ON "AuditLog"("actorId");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_timestamp_idx" ON "AuditLog"("timestamp");

-- CreateIndex
CREATE INDEX "AuditLog_vmId_idx" ON "AuditLog"("vmId");

-- CreateIndex
CREATE INDEX "AuditLog_actorId_timestamp_idx" ON "AuditLog"("actorId", "timestamp");

-- CreateIndex
CREATE UNIQUE INDEX "SoftwareLicense_name_vendor_key" ON "SoftwareLicense"("name", "vendor");

-- CreateIndex
CREATE UNIQUE INDEX "Asset_serial_key" ON "Asset"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "PhysicalCluster_name_key" ON "PhysicalCluster"("name");

-- CreateIndex
CREATE INDEX "SystemSetting_category_idx" ON "SystemSetting"("category");

-- CreateIndex
CREATE INDEX "ApprovalWorkflow_requestType_idx" ON "ApprovalWorkflow"("requestType");

-- CreateIndex
CREATE UNIQUE INDEX "ApprovalWorkflow_requestType_level_key" ON "ApprovalWorkflow"("requestType", "level");

-- CreateIndex
CREATE UNIQUE INDEX "K8sNamespace_name_key" ON "K8sNamespace"("name");

-- CreateIndex
CREATE UNIQUE INDEX "VmCredential_vmInstanceId_key" ON "VmCredential"("vmInstanceId");

-- CreateIndex
CREATE UNIQUE INDEX "ComplianceTag_name_key" ON "ComplianceTag"("name");

-- CreateIndex
CREATE INDEX "K8sSubdomain_namespaceId_idx" ON "K8sSubdomain"("namespaceId");

-- CreateIndex
CREATE INDEX "K8sSubdomain_status_idx" ON "K8sSubdomain"("status");

-- CreateIndex
CREATE INDEX "PasswordResetOtp_email_idx" ON "PasswordResetOtp"("email");

-- CreateIndex
CREATE UNIQUE INDEX "horizon_users_horizon_username_key" ON "horizon_users"("horizon_username");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_users_vpn_username_key" ON "vpn_users"("vpn_username");

-- CreateIndex
CREATE UNIQUE INDEX "vpn_users_vpn_ip_key" ON "vpn_users"("vpn_ip");

-- CreateIndex
CREATE INDEX "request_resources_request_id_idx" ON "request_resources"("request_id");

-- CreateIndex
CREATE INDEX "request_resources_vm_id_idx" ON "request_resources"("vm_id");

-- CreateIndex
CREATE INDEX "request_resources_namespace_id_idx" ON "request_resources"("namespace_id");

-- CreateIndex
CREATE INDEX "_AssetToSoftwareLicense_B_index" ON "_AssetToSoftwareLicense"("B");

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_developerId_fkey" FOREIGN KEY ("developerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_targetVmId_fkey" FOREIGN KEY ("targetVmId") REFERENCES "vm_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_sourceVmId_fkey" FOREIGN KEY ("sourceVmId") REFERENCES "vm_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_existingNamespaceId_fkey" FOREIGN KEY ("existingNamespaceId") REFERENCES "K8sNamespace"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_upgradeVmId_fkey" FOREIGN KEY ("upgradeVmId") REFERENCES "vm_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "requests" ADD CONSTRAINT "requests_accessTargetVmId_fkey" FOREIGN KEY ("accessTargetVmId") REFERENCES "vm_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalDisk" ADD CONSTRAINT "AdditionalDisk_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalDisk" ADD CONSTRAINT "AdditionalDisk_vmSpecificationId_fkey" FOREIGN KEY ("vmSpecificationId") REFERENCES "VmSpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallPort" ADD CONSTRAINT "FirewallPort_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallPort" ADD CONSTRAINT "FirewallPort_vmSpecificationId_fkey" FOREIGN KEY ("vmSpecificationId") REFERENCES "VmSpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkAccessEntry" ADD CONSTRAINT "NetworkAccessEntry_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkAccessEntry" ADD CONSTRAINT "NetworkAccessEntry_vmSpecificationId_fkey" FOREIGN KEY ("vmSpecificationId") REFERENCES "VmSpecification"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpecification" ADD CONSTRAINT "VmSpecification_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_approverId_fkey" FOREIGN KEY ("approverId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_customizationRequestId_fkey" FOREIGN KEY ("customizationRequestId") REFERENCES "CustomizationRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Approval" ADD CONSTRAINT "Approval_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vm_instances" ADD CONSTRAINT "vm_instances_hostAssetId_fkey" FOREIGN KEY ("hostAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vm_instances" ADD CONSTRAINT "vm_instances_currentSpecId_fkey" FOREIGN KEY ("currentSpecId") REFERENCES "VmSpec"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vm_instances" ADD CONSTRAINT "vm_instances_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vm_instances" ADD CONSTRAINT "vm_instances_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "vm_instances" ADD CONSTRAINT "vm_instances_cloneOfRequestId_fkey" FOREIGN KEY ("cloneOfRequestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpec" ADD CONSTRAINT "VmSpec_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpec" ADD CONSTRAINT "VmSpec_customizationRequestId_fkey" FOREIGN KEY ("customizationRequestId") REFERENCES "CustomizationRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpec" ADD CONSTRAINT "VmSpec_sourceRequestId_fkey" FOREIGN KEY ("sourceRequestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpec" ADD CONSTRAINT "VmSpec_vmInstanceId_fkey" FOREIGN KEY ("vmInstanceId") REFERENCES "vm_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpecDisk" ADD CONSTRAINT "VmSpecDisk_specId_fkey" FOREIGN KEY ("specId") REFERENCES "VmSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpecFirewallPort" ADD CONSTRAINT "VmSpecFirewallPort_specId_fkey" FOREIGN KEY ("specId") REFERENCES "VmSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmSpecNetworkAccess" ADD CONSTRAINT "VmSpecNetworkAccess_specId_fkey" FOREIGN KEY ("specId") REFERENCES "VmSpec"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationRequest" ADD CONSTRAINT "CustomizationRequest_parentRequestId_fkey" FOREIGN KEY ("parentRequestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationRequest" ADD CONSTRAINT "CustomizationRequest_requesterId_fkey" FOREIGN KEY ("requesterId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationRequest" ADD CONSTRAINT "CustomizationRequest_targetVmId_fkey" FOREIGN KEY ("targetVmId") REFERENCES "vm_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AdditionalDiskInput" ADD CONSTRAINT "AdditionalDiskInput_customizationId_fkey" FOREIGN KEY ("customizationId") REFERENCES "CustomizationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FirewallPortInput" ADD CONSTRAINT "FirewallPortInput_customizationId_fkey" FOREIGN KEY ("customizationId") REFERENCES "CustomizationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "NetworkAccessInput" ADD CONSTRAINT "NetworkAccessInput_customizationId_fkey" FOREIGN KEY ("customizationId") REFERENCES "CustomizationRequest"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationHistory" ADD CONSTRAINT "CustomizationHistory_afterSpecId_fkey" FOREIGN KEY ("afterSpecId") REFERENCES "VmSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationHistory" ADD CONSTRAINT "CustomizationHistory_appliedById_fkey" FOREIGN KEY ("appliedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationHistory" ADD CONSTRAINT "CustomizationHistory_beforeSpecId_fkey" FOREIGN KEY ("beforeSpecId") REFERENCES "VmSpec"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomizationHistory" ADD CONSTRAINT "CustomizationHistory_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedBy_fkey" FOREIGN KEY ("uploadedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_vmId_fkey" FOREIGN KEY ("vmId") REFERENCES "vm_instances"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "PhysicalCluster"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sCluster" ADD CONSTRAINT "K8sCluster_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "K8sNamespace"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sCluster" ADD CONSTRAINT "K8sCluster_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sNodeGroup" ADD CONSTRAINT "K8sNodeGroup_clusterId_fkey" FOREIGN KEY ("clusterId") REFERENCES "K8sCluster"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmCredential" ADD CONSTRAINT "VmCredential_vmInstanceId_fkey" FOREIGN KEY ("vmInstanceId") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccessLog" ADD CONSTRAINT "CredentialAccessLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CredentialAccessLog" ADD CONSTRAINT "CredentialAccessLog_vmInstanceId_fkey" FOREIGN KEY ("vmInstanceId") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestTag" ADD CONSTRAINT "RequestTag_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RequestTag" ADD CONSTRAINT "RequestTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ComplianceTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmTag" ADD CONSTRAINT "VmTag_vmInstanceId_fkey" FOREIGN KEY ("vmInstanceId") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VmTag" ADD CONSTRAINT "VmTag_tagId_fkey" FOREIGN KEY ("tagId") REFERENCES "ComplianceTag"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sRequestNodeGroup" ADD CONSTRAINT "K8sRequestNodeGroup_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sNode" ADD CONSTRAINT "K8sNode_nodeGroupId_fkey" FOREIGN KEY ("nodeGroupId") REFERENCES "K8sNodeGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sSubdomain" ADD CONSTRAINT "K8sSubdomain_namespaceId_fkey" FOREIGN KEY ("namespaceId") REFERENCES "K8sNamespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sSubdomain" ADD CONSTRAINT "K8sSubdomain_requestedById_fkey" FOREIGN KEY ("requestedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "K8sSubdomain" ADD CONSTRAINT "K8sSubdomain_approvedById_fkey" FOREIGN KEY ("approvedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorizonAssignment" ADD CONSTRAINT "HorizonAssignment_horizon_user_id_fkey" FOREIGN KEY ("horizon_user_id") REFERENCES "horizon_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorizonAssignment" ADD CONSTRAINT "HorizonAssignment_vm_id_fkey" FOREIGN KEY ("vm_id") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorizonAssignment" ADD CONSTRAINT "HorizonAssignment_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "K8sNamespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorizonAssignment" ADD CONSTRAINT "HorizonAssignment_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "HorizonAssignment" ADD CONSTRAINT "HorizonAssignment_vm_instance_id_fkey" FOREIGN KEY ("vm_instance_id") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnAssignment" ADD CONSTRAINT "VpnAssignment_vpn_user_id_fkey" FOREIGN KEY ("vpn_user_id") REFERENCES "vpn_users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnAssignment" ADD CONSTRAINT "VpnAssignment_vm_id_fkey" FOREIGN KEY ("vm_id") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnAssignment" ADD CONSTRAINT "VpnAssignment_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "K8sNamespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "VpnAssignment" ADD CONSTRAINT "VpnAssignment_assigned_by_id_fkey" FOREIGN KEY ("assigned_by_id") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_resources" ADD CONSTRAINT "request_resources_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "requests"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_resources" ADD CONSTRAINT "request_resources_vm_id_fkey" FOREIGN KEY ("vm_id") REFERENCES "vm_instances"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "request_resources" ADD CONSTRAINT "request_resources_namespace_id_fkey" FOREIGN KEY ("namespace_id") REFERENCES "K8sNamespace"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetToSoftwareLicense" ADD CONSTRAINT "_AssetToSoftwareLicense_A_fkey" FOREIGN KEY ("A") REFERENCES "Asset"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "_AssetToSoftwareLicense" ADD CONSTRAINT "_AssetToSoftwareLicense_B_fkey" FOREIGN KEY ("B") REFERENCES "SoftwareLicense"("id") ON DELETE CASCADE ON UPDATE CASCADE;

