# Revised Implementation Plan v2 — VM Requisition System Enhancement
> **Updated:** 2026-07-07 · Reconciled against `.graphify` codebase analysis  
> **Previous version:** `VM_CLONE_K8S_REVISED_PLAN.md` (v1, based on SYSTEM_DOCUMENTATION.md only)

---

## Changelog from v1

| Change | Detail |
|---|---|
| Phase 4 added | `SYSTEM_UPGRADE`, `VPN_ACCESS`, `HORIZON_ACCESS` confirmed absent — added as genuine new work |
| `clone-actions.ts` scope corrected | Only exports `createCloneRequest()` — no `getSourceVmDetails()`. That function still needs to be written |
| `k8s-actions.ts` scope corrected | Only exports `createK8sNamespaceRequest()` — single shallow function. Full cluster model is new work |
| `vip-actions.ts` confirmed | Exports `createVirtualIpRequest()` — workflow entry point exists, provisioning may be incomplete |
| Workflow engine confirmed complete | `workflow.ts` has all needed helpers: `getWorkflowConfig()`, `initializeDefaultWorkflows()`, `canForward()`, `isFinalLevel()`, `isExecutionLevel()`, etc. — no changes needed |
| Enums file correctly located | `src/types/enums.ts` (not `src/lib/types/enums.ts`) is the active one. Contains `RequestType` at L2 — `CLONE_VM`, `K8S_NAMESPACE`, `VIRTUAL_IP` present; `SYSTEM_UPGRADE`, `VPN_ACCESS`, `HORIZON_ACCESS` absent |

---

## 1. Reconciliation: Confirmed Existing (No Reconstruction Needed)

| Item | File | Exports Confirmed |
|---|---|---|
| Clone request entry point | `src/app/actions/clone-actions.ts` | `createCloneRequest()` |
| K8s request entry point | `src/app/actions/k8s-actions.ts` | `createK8sNamespaceRequest()` |
| VIP request entry point | `src/app/actions/vip-actions.ts` | `createVirtualIpRequest()` |
| RequestType enum | `src/types/enums.ts` L2 | `CLONE_VM`, `K8S_NAMESPACE`, `VIRTUAL_IP` (and existing types) |
| Workflow engine | `src/lib/workflow.ts` | Full set of config/level helpers |
| Approval generation | `src/app/actions/approval-actions.ts` | `generateApprovals()` — used by all three action files |
| Notification | `src/lib/notifications.ts` | `notifyApprovers()`, `notifyDcops()`, `notifyRequester()` — used by all three |

---

## 2. Confirmed Gaps (All Phases Below Address These)

| Gap | Evidence |
|---|---|
| `getSourceVmDetails()` missing | Not in `clone-actions.ts` node list from graph |
| K8s cluster data model absent | No `K8sCluster`, `K8sNamespace`, `K8sNodeGroup` node anywhere in graph |
| `SYSTEM_UPGRADE` / `VPN_ACCESS` / `HORIZON_ACCESS` absent | Searched full graph JSON + labels — zero matches |
| No `upgrade-actions.ts` | Not in manifest file list |
| No `access-actions.ts` | Not in manifest file list |
| No `updateVmSystemName()` | Not in any action file nodes |
| No `VmCredential` model | Not in any graph node |
| No `ComplianceTag` model | Not in any graph node |
| `expectedDeliveryDate` absent | Not on Request model |

---

## 3. Schema Changes (Additive Only)

### 3.1 New `RequestType` enum values
```prisma
// src/types/enums.ts — ADD to RequestType enum
SYSTEM_UPGRADE = "SYSTEM_UPGRADE"
VPN_ACCESS     = "VPN_ACCESS"
HORIZON_ACCESS = "HORIZON_ACCESS"
```
Also add matching values to the Prisma `schema.prisma` enum block.

### 3.2 Extend `Request` model
```prisma
model Request {
  // ...existing fields unchanged...

  // K8s cluster request fields
  underExistingNamespace   Boolean    @default(false)
  existingNamespaceId      String?    // FK → K8sNamespace

  // System upgrade fields
  upgradeVmId              String?    // FK → VmInstance being upgraded
  upgradeCpu               Int?       // requested new vCPU count
  upgradeRamGb             Int?       // requested new RAM (GB)
  upgradeStorageGb         Int?       // requested additional storage (GB)
  upgradeJustification     String?    @db.Text

  // Access request fields (VPN / Horizon)
  accessTargetVmId         String?    // FK → VmInstance access is for
  accessType               AccessType?  // VPN | HORIZON
  accessJustification      String?    @db.Text

  // Common new fields
  expectedDeliveryDate     DateTime?
}

enum AccessType {
  VPN
  HORIZON
}
```

### 3.3 K8s Cluster data models (new)
```prisma
model K8sNamespace {
  id           String       @id @default(uuid())
  name         String       @unique
  supervisorIp String
  clusters     K8sCluster[]
  createdAt    DateTime     @default(now())
}

model K8sCluster {
  id           String         @id @default(uuid())
  namespaceId  String
  namespace    K8sNamespace   @relation(fields: [namespaceId], references: [id])
  requestId    String?        // originating Request
  clusterName  String
  username     String?        // DCOPS-provisioned
  totalSpaceGb Int?
  status       VmStatus       @default(ACTIVE)
  createdAt    DateTime       @default(now())
  nodeGroups   K8sNodeGroup[]
}

model K8sNodeGroup {
  id         String      @id @default(uuid())
  clusterId  String
  cluster    K8sCluster  @relation(fields: [clusterId], references: [id])
  role       K8sNodeRole
  nodeCount  Int
  vcpu       Int
  ramGb      Int
  isClonable Boolean     @default(true)
}

enum K8sNodeRole {
  MASTER
  WORKER
}
```

### 3.4 VM rename, credentials, compliance tags (unchanged from v1)
See v1 plan sections 3.3 – 3.5. No changes needed.

---

## 4. New Action Files Required

| File | Key Exports | Status |
|---|---|---|
| `src/app/actions/upgrade-actions.ts` | `createSystemUpgradeRequest()`, `getUpgradeableVms()` | ❌ Does not exist |
| `src/app/actions/access-actions.ts` | `createVpnAccessRequest()`, `createHorizonAccessRequest()`, `getAccessibleVms()` | ❌ Does not exist |

### Existing files needing extension

| File | Missing Function | Why Needed |
|---|---|---|
| `clone-actions.ts` | `getSourceVmDetails()` | Source VM selector needs to fetch VM spec for pre-filling the clone form |
| `k8s-actions.ts` | `createK8sCluster()`, `cloneNodeGroup()`, `updateNodeGroup()`, `getNamespaceOptions()` | Current file only has the flat namespace request; full cluster workflow is missing |
| `vm-management-actions.ts` | `updateVmSystemName()` | Post-provisioning rename not implemented |

---

## 5. Implementation Phases

### Phase 0: Reconciliation (2–3 days) ← DO FIRST
**Goal:** Understand exactly what `clone-actions.ts`, `k8s-actions.ts`, and `vip-actions.ts` currently do so later phases extend rather than duplicate.

Tasks:
- Read all three action files end-to-end
- Check the `RequestForm` component (`src/app/requests/components/RequestForm.tsx`) to confirm which request types currently have UI sections built
- Confirm whether any K8s or clone provisioning path exists in `ProvisionVMModal` or `VmExecutionModal`
- Map `DEFAULT_WORKFLOW_CONFIG` in `workflow.ts` to see if CLONE/K8S/VIP have their own configs or share the standard 4-level chain

### Phase 1: K8s Cluster Data Model (Week 1–2)
1. Add `K8sNamespace`, `K8sCluster`, `K8sNodeGroup` Prisma models + migration
2. Extend `k8s-actions.ts`:
   - `createK8sCluster(data)` — creates cluster + node groups from request
   - `cloneNodeGroup(nodeGroupId)` — duplicates a node group row (editable copy)
   - `updateNodeGroup(id, data)` — only allowed while parent request is `DRAFT`
   - `getNamespaceOptions()` — returns existing namespaces for dropdown
3. K8s request form section:
   - Subdomain(s), system name, developer info
   - Master/worker node group editor (count, CPU, RAM, "+ Clone" per group)
   - Total space, existing-namespace dropdown
   - Draft-save: node groups remain editable while `Request.status = DRAFT`

### Phase 2: Clone VM Extension (Week 3)
1. Add `getSourceVmDetails(vmId)` to `clone-actions.ts` — fetches spec of existing VM for form pre-fill
2. Clone form: source VM selector (requester sees only own VMs), editable system name field, disk copy confirmation
3. DCOPS provisioning: extend `ProvisionVMModal` or `VmExecutionModal` to handle `CLONE_VM` type with disk-clone action

### Phase 3: System Upgrade Request (Week 4)
*(See separate System Upgrade Prompt document for full implementation spec)*

1. Create `upgrade-actions.ts` with `createSystemUpgradeRequest()`, `getUpgradeableVms()`
2. Add `SYSTEM_UPGRADE` to `RequestType` enum (Prisma + TypeScript)
3. Add upgrade fields to `Request` schema (`upgradeVmId`, `upgradeCpu`, `upgradeRamGb`, `upgradeStorageGb`, `upgradeJustification`)
4. Upgrade request form section: VM selector (own active VMs), current spec display, new spec inputs, justification
5. DCOPS provisioning: upgrade execution modal showing current vs. requested spec delta
6. Workflow: standard 4-level chain (same as `NEW_VM`)

### Phase 4: VPN & Horizon Access Requests (Week 5)
1. Create `access-actions.ts` with `createVpnAccessRequest()`, `createHorizonAccessRequest()`, `getAccessibleVms()`
2. Add `VPN_ACCESS`, `HORIZON_ACCESS` to `RequestType` enum
3. Add `AccessType` enum and `accessTargetVmId`, `accessType`, `accessJustification` to `Request`
4. Access request form: VM selector, access type radio, justification
5. DCOPS provisioning: access provisioning modal (configure VPN credentials / Horizon desktop assignment)
6. Workflow: standard 4-level chain

### Phase 5: DCOPS K8s Provisioning + Inventory (Week 6)
1. Extend DCOPS provisioning modal to write cluster provisioning data (username, cluster name, supervisor IP, namespace name) into `K8sCluster` / `K8sNamespace` on execution
2. New inventory route `/inventory/k8s` — hierarchy view: Supervisor IP → Namespace → Cluster → Node Group
3. Extend DCOPS dashboard (`dcopsDashboard.ts`) to surface K8s clusters in provisioning queue

### Phase 6: VM Rename + Credentials + Tags (Week 7)
1. `updateVmSystemName()` in `vm-management-actions.ts` — owner/admin only, `AuditLog` entry
2. `VmCredential` + `CredentialAccessLog` models, AES-256 storage (reuse `emailService.ts` encrypt/decrypt pattern), email delivery action
3. `ComplianceTag` / `RequestTag` models + admin UI
4. `expectedDeliveryDate` on `Request`, surfaced in list + DCOPS dashboard

### Phase 7: Testing & Deployment (Week 8)
- Integration tests for all new request types
- Permission tests: requester can only upgrade/clone/access own VMs
- Workflow tests: all new types pass through correct approval chain
- Documentation update

---

## 6. File Creation Summary

### New files
```
src/app/actions/upgrade-actions.ts
src/app/actions/access-actions.ts
src/app/requests/upgrade/page.tsx
src/app/requests/access/page.tsx
src/app/inventory/k8s/page.tsx
src/app/inventory/k8s/components/K8sInventoryClient.tsx
```

### Files to extend
```
src/app/actions/clone-actions.ts       — add getSourceVmDetails()
src/app/actions/k8s-actions.ts        — add cluster CRUD functions
src/app/actions/vm-management-actions.ts — add updateVmSystemName()
src/app/approvals/components/ProvisionVMModal.tsx — add CLONE_VM, K8S, UPGRADE, ACCESS handling
src/app/requests/components/RequestForm.tsx — add new request type sections
src/lib/workflow.ts                    — add workflow configs for new types if needed
src/types/enums.ts                     — add SYSTEM_UPGRADE, VPN_ACCESS, HORIZON_ACCESS
prisma/schema.prisma                   — all schema additions above
```

---

## 7. Open Questions (Unresolved)

1. Does `VmInstance` need its own `systemName` field independent of `Request.systemName` for post-provisioning rename?
2. For VPN access provisioning — does DCOPS enter credentials into the system, or just confirm externally?
3. Does "under existing namespace" for K8s cluster reuse require re-approval, or just DCOPS execution?
4. Should `SYSTEM_UPGRADE` requests show the diff (old spec → new spec) in the approver view, or just the requested new spec?
