# System Upgrade Request — Implementation Prompt
> **Purpose:** Developer prompt for implementing the `SYSTEM_UPGRADE` request type in the MIS Datacenter Portal.  
> **Stack:** Next.js 14, TypeScript, Prisma (PostgreSQL), NextAuth, shadcn/ui, Tailwind CSS  
> **Pattern to follow:** Existing `clone-actions.ts` + `RequestForm` structure

---

## Context

The system currently handles `NEW_VM`, `CUSTOMIZED`, `RENEWAL`, `DECOMMISSION`, `CLONE_VM`, `K8S_NAMESPACE`, and `VIRTUAL_IP` requests through a standard 4-level approval workflow. A requester needs to be able to request a resource upgrade for an existing provisioned VM they own (increase vCPU, RAM, or storage). This is different from `CUSTOMIZED` — which handles firewall, network, and software changes — `SYSTEM_UPGRADE` specifically targets compute resource scaling.

---

## Task 1: Prisma Schema Changes

Add to `prisma/schema.prisma`:

```prisma
// 1. Add to RequestType enum
enum RequestType {
  // ...existing values...
  SYSTEM_UPGRADE
}

// 2. Add to Request model (all nullable — only populated for SYSTEM_UPGRADE requests)
model Request {
  // ...existing fields...
  upgradeVmId           String?    // FK to VmInstance being upgraded
  upgradeCpu            Int?       // new requested vCPU count (full new value, not delta)
  upgradeRamGb          Int?       // new requested RAM in GB (full new value)
  upgradeStorageGb      Int?       // additional storage in GB (additive)
  upgradeJustification  String?    @db.Text
  upgradeVm             VmInstance? @relation("UpgradeTarget", fields: [upgradeVmId], references: [id])
}

// 3. Add back-relation to VmInstance
model VmInstance {
  // ...existing fields...
  upgradeRequests  Request[]  @relation("UpgradeTarget")
}
```

Run migration:
```bash
npx prisma migrate dev --name add_system_upgrade_request
```

---

## Task 2: TypeScript Enum Update

In `src/types/enums.ts`, add to the `RequestType` enum:
```typescript
export enum RequestType {
  // ...existing values...
  SYSTEM_UPGRADE = "SYSTEM_UPGRADE",
}
```

Also update any `REQUEST_TYPE_CONFIG` or label maps in components that render request type names (search for `REQUEST_TYPES` or `requestTypeLabel` across the codebase).

---

## Task 3: Create `upgrade-actions.ts`

Create `src/app/actions/upgrade-actions.ts`:

```typescript
"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { RequestType, RequestStatus, VmStatus } from "@/types/enums";
import { generateApprovals } from "@/app/actions/approval-actions";
import { notifyApprovers } from "@/lib/notifications";
import { ROLES, hasRole } from "@/lib/roles";
import { uploadBuffer } from "@/lib/services/minio.service";

// ─── Types ───────────────────────────────────────────────────────────────────

type Attachment = {
  name: string;
  type: string;
  size: number;
  buffer: number[];
};

export type CreateSystemUpgradeInput = {
  upgradeVmId: string;
  upgradeCpu?: number;          // new total vCPU (omit if not changing)
  upgradeRamGb?: number;        // new total RAM in GB (omit if not changing)
  upgradeStorageGb?: number;    // additional storage in GB (omit if not changing)
  upgradeJustification: string;
  expectedDeliveryDate?: string; // ISO date string
  attachments?: Attachment[];
};

// ─── Fetch requester's upgradeable VMs ───────────────────────────────────────

/**
 * Returns VMs owned by the current requester that are ACTIVE and eligible
 * for an upgrade request (no pending upgrade already in flight).
 */
export async function getUpgradeableVms() {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  const pendingUpgradeVmIds = await prisma.request.findMany({
    where: {
      requestType: RequestType.SYSTEM_UPGRADE,
      requestedById: session.user.id,
      status: {
        notIn: [RequestStatus.COMPLETED, RequestStatus.REJECTED, RequestStatus.CANCELLED],
      },
    },
    select: { upgradeVmId: true },
  });
  const lockedIds = pendingUpgradeVmIds
    .map((r) => r.upgradeVmId)
    .filter(Boolean) as string[];

  const vms = await prisma.vmInstance.findMany({
    where: {
      ownerId: session.user.id,
      status: VmStatus.ACTIVE,
      id: { notIn: lockedIds },
    },
    select: {
      id: true,
      systemName: true,
      ipAddress: true,
      environment: true,
      vmSpec: {
        select: { vcpu: true, ram: true, storage: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return vms;
}

// ─── Create upgrade request ───────────────────────────────────────────────────

export async function createSystemUpgradeRequest(data: CreateSystemUpgradeInput) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) throw new Error("Unauthorized");

  // Validate requester owns the target VM
  const vm = await prisma.vmInstance.findFirst({
    where: { id: data.upgradeVmId, ownerId: session.user.id, status: VmStatus.ACTIVE },
    include: { vmSpec: true },
  });
  if (!vm) throw new Error("VM not found or not owned by requester");

  // Must request at least one resource change
  if (!data.upgradeCpu && !data.upgradeRamGb && !data.upgradeStorageGb) {
    throw new Error("At least one resource upgrade (CPU, RAM, or Storage) must be specified");
  }

  // Ensure new values are actually higher than current (prevent downgrade via this form)
  if (data.upgradeCpu !== undefined && vm.vmSpec && data.upgradeCpu <= (vm.vmSpec.vcpu ?? 0)) {
    throw new Error("Requested CPU must be greater than current allocation");
  }
  if (data.upgradeRamGb !== undefined && vm.vmSpec && data.upgradeRamGb <= (vm.vmSpec.ram ?? 0)) {
    throw new Error("Requested RAM must be greater than current allocation");
  }

  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the Request record
    const request = await tx.request.create({
      data: {
        requestType: RequestType.SYSTEM_UPGRADE,
        status: RequestStatus.PENDING,
        requestedById: session.user.id,
        upgradeVmId: data.upgradeVmId,
        upgradeCpu: data.upgradeCpu,
        upgradeRamGb: data.upgradeRamGb,
        upgradeStorageGb: data.upgradeStorageGb,
        upgradeJustification: data.upgradeJustification,
        expectedDeliveryDate: data.expectedDeliveryDate
          ? new Date(data.expectedDeliveryDate)
          : null,
      },
    });

    // 2. Upload attachments if provided
    if (data.attachments?.length) {
      for (const file of data.attachments) {
        const buffer = Buffer.from(file.buffer);
        const path = `${session.user.id}/${file.name}`;
        await uploadBuffer(buffer, path, file.type);
        await tx.attachment.create({
          data: {
            requestId: request.id,
            fileName: file.name,
            fileType: file.type,
            fileSize: file.size,
            filePath: path,
          },
        });
      }
    }

    // 3. Generate approval chain (standard 4-level workflow)
    await generateApprovals(request.id, RequestType.SYSTEM_UPGRADE, tx);

    return request;
  });

  // 4. Notify first-level approvers
  await notifyApprovers(result.id, 1);

  revalidatePath("/requests");
  return { success: true, requestId: result.id };
}
```

---

## Task 4: Workflow Configuration

Open `src/lib/workflow.ts`. In `DEFAULT_WORKFLOW_CONFIG` (or wherever per-type configs are defined), check if `SYSTEM_UPGRADE` needs a custom config. If all request types share the same 4-level chain, no change is needed. If the config is type-gated, add:

```typescript
[RequestType.SYSTEM_UPGRADE]: DEFAULT_WORKFLOW_CONFIG,
```

---

## Task 5: Request Form — New Section

In `src/app/requests/components/RequestForm.tsx`, add a case for `SYSTEM_UPGRADE` in the type-conditional form section renderer:

### 5a. VM selector with current spec display
```tsx
// Fetch upgradeable VMs in the parent page and pass as prop, or use a client-side fetch
// Display: VM name + IP + current CPU / RAM / Storage for reference
<div className="space-y-2">
  <Label>Select VM to Upgrade</Label>
  <Select onValueChange={(vmId) => { setSelectedVmId(vmId); loadVmSpec(vmId); }}>
    <SelectTrigger>
      <SelectValue placeholder="Select a VM" />
    </SelectTrigger>
    <SelectContent>
      {upgradeableVms.map((vm) => (
        <SelectItem key={vm.id} value={vm.id}>
          {vm.systemName} — {vm.ipAddress} ({vm.environment})
        </SelectItem>
      ))}
    </SelectContent>
  </Select>
</div>
```

### 5b. Current spec read-only display + new spec inputs
```tsx
{selectedVm && (
  <div className="rounded-md border p-4 space-y-4">
    <p className="text-sm font-medium text-muted-foreground">Current Specification</p>
    <div className="grid grid-cols-3 gap-4 text-sm">
      <div>vCPU: <strong>{selectedVm.vmSpec?.vcpu ?? "—"}</strong></div>
      <div>RAM: <strong>{selectedVm.vmSpec?.ram ?? "—"} GB</strong></div>
      <div>Storage: <strong>{selectedVm.vmSpec?.storage ?? "—"} GB</strong></div>
    </div>
    <Separator />
    <p className="text-sm font-medium">Requested New Specification</p>
    <div className="grid grid-cols-3 gap-4">
      <div className="space-y-1">
        <Label>New vCPU (optional)</Label>
        <Input type="number" min={selectedVm.vmSpec?.vcpu + 1} placeholder="Leave blank to keep" />
      </div>
      <div className="space-y-1">
        <Label>New RAM in GB (optional)</Label>
        <Input type="number" min={selectedVm.vmSpec?.ram + 1} placeholder="Leave blank to keep" />
      </div>
      <div className="space-y-1">
        <Label>Additional Storage in GB (optional)</Label>
        <Input type="number" min={1} placeholder="Additive — leave blank to skip" />
      </div>
    </div>
  </div>
)}
```

### 5c. Justification textarea
```tsx
<div className="space-y-1">
  <Label>Justification <span className="text-destructive">*</span></Label>
  <Textarea
    placeholder="Explain why this upgrade is needed (workload increase, compliance requirement, etc.)"
    rows={4}
    required
  />
</div>
```

---

## Task 6: Approver View — Spec Delta

In the request detail view (`RequestDetail.tsx` or `ApprovalPanel.tsx`), add a spec comparison block for `SYSTEM_UPGRADE` requests:

```tsx
{request.requestType === "SYSTEM_UPGRADE" && request.upgradeVm && (
  <div className="rounded-md border p-4 space-y-3">
    <p className="font-semibold text-sm">Resource Upgrade Request</p>
    <p className="text-sm text-muted-foreground">
      Target VM: <strong>{request.upgradeVm.systemName}</strong> ({request.upgradeVm.ipAddress})
    </p>
    <table className="w-full text-sm">
      <thead>
        <tr className="text-muted-foreground text-xs uppercase">
          <th className="text-left pb-1">Resource</th>
          <th className="text-left pb-1">Current</th>
          <th className="text-left pb-1">Requested</th>
          <th className="text-left pb-1">Delta</th>
        </tr>
      </thead>
      <tbody>
        {request.upgradeCpu && (
          <tr>
            <td>vCPU</td>
            <td>{request.upgradeVm.vmSpec?.vcpu}</td>
            <td className="text-green-600 font-medium">{request.upgradeCpu}</td>
            <td>+{request.upgradeCpu - (request.upgradeVm.vmSpec?.vcpu ?? 0)}</td>
          </tr>
        )}
        {request.upgradeRamGb && (
          <tr>
            <td>RAM (GB)</td>
            <td>{request.upgradeVm.vmSpec?.ram}</td>
            <td className="text-green-600 font-medium">{request.upgradeRamGb}</td>
            <td>+{request.upgradeRamGb - (request.upgradeVm.vmSpec?.ram ?? 0)}</td>
          </tr>
        )}
        {request.upgradeStorageGb && (
          <tr>
            <td>Storage (GB)</td>
            <td>{request.upgradeVm.vmSpec?.storage}</td>
            <td className="text-green-600 font-medium">
              {(request.upgradeVm.vmSpec?.storage ?? 0) + request.upgradeStorageGb}
            </td>
            <td>+{request.upgradeStorageGb}</td>
          </tr>
        )}
      </tbody>
    </table>
    {request.upgradeJustification && (
      <p className="text-sm"><strong>Justification:</strong> {request.upgradeJustification}</p>
    )}
  </div>
)}
```

---

## Task 7: DCOPS Provisioning

In `ProvisionVMModal.tsx` (or `VmExecutionModal.tsx`), add a `SYSTEM_UPGRADE` case to the provisioning handler. The DCOPS operator needs to:
1. See the current spec vs. requested spec delta (same table as Task 6)
2. Confirm execution (which should call `vm-management-actions.ts` → `updateVmResources()` — this already exists per the graph: `actions_vm_actions_updatevmresources`)

```typescript
// In the provisioning submit handler, for SYSTEM_UPGRADE:
if (request.requestType === "SYSTEM_UPGRADE") {
  await updateVmResources({
    vmId: request.upgradeVmId,
    vcpu: request.upgradeCpu,
    ram: request.upgradeRamGb,
    additionalStorage: request.upgradeStorageGb,
  });
}
```

> **Note:** `updateVmResources()` already exists in `vm-actions.ts` (confirmed in graph: `actions_vm_actions_updatevmresources`). Verify its signature before calling.

---

## Task 8: Navigation + Route

1. Add a route entry for system upgrade in the requests section:
   - Route: `/requests/upgrade/page.tsx`
   - Or handle as a conditional section in the existing `/requests/new/page.tsx` based on `?type=SYSTEM_UPGRADE`

2. Add `SYSTEM_UPGRADE` to the `REQUEST_TYPE_CONFIG` in `ApproverDashboardClient.tsx` (confirmed node: `components_approverdashboardclient_request_type_config`) so it displays correctly in the approver queue.

3. Add to `RequestStepper` steps if the multi-step form pattern is used.

---

## Task 9: Permission Rules

| Action | Allowed Roles |
|---|---|
| Create upgrade request | `REQUESTER` — own active VMs only |
| View upgrade request | Request owner, Approvers, `ADMIN`, `DC_OPS` |
| Approve/reject | Standard approval chain roles |
| Execute (DCOPS) | `DC_OPS` only |
| Cancel before approval | Request owner, `ADMIN` |

Enforce in `upgrade-actions.ts`:
- `getServerSession` check on every server action
- `ownerId === session.user.id` check before `createSystemUpgradeRequest`
- Use existing `hasRole(session, ROLES.DC_OPS)` pattern for DCOPS gating

---

## Checklist

- [ ] `prisma/schema.prisma` — `SYSTEM_UPGRADE` enum value + upgrade fields on `Request` + back-relation on `VmInstance`
- [ ] `npx prisma migrate dev --name add_system_upgrade_request`
- [ ] `src/types/enums.ts` — `RequestType.SYSTEM_UPGRADE`
- [ ] `src/app/actions/upgrade-actions.ts` created with `createSystemUpgradeRequest()` + `getUpgradeableVms()`
- [ ] `src/lib/workflow.ts` — confirm `SYSTEM_UPGRADE` routes to correct config
- [ ] `RequestForm.tsx` — upgrade form section (VM selector, spec display, new spec inputs, justification)
- [ ] `RequestDetail.tsx` / `ApprovalPanel.tsx` — spec delta table for approver view
- [ ] `ProvisionVMModal.tsx` — DCOPS execution calls `updateVmResources()`
- [ ] `ApproverDashboardClient.tsx` — add to `REQUEST_TYPE_CONFIG`
- [ ] Route: `/requests/upgrade` or conditional in `/requests/new`
- [ ] Permission guards in all server actions
