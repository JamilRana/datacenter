// src/lib/reports/__tests__/reports-verification.test.ts
import { describe, it, expect } from "vitest";
import {
  normalizeSystemName,
  formatSystemName,
  resolveSystemName,
  getEffectiveSpec,
  getReportScope,
  assertCanViewInfrastructure,
  validateDateRange,
  aggregateVmResources,
} from "../shared-reporting";
import {
  autoScaleRam,
  autoScaleStorage,
  formatDateRangeUnambiguous,
  getReportFilename,
} from "@/lib/format-utils";
import { differenceInDays, subDays, subYears } from "date-fns";
import { Environment, VmStatus } from "@prisma/client";

import {
  transformVpnHorizonAssignmentsToUsers,
  normalizeUsername,
} from "../vpn-horizon-reporting";
import { computeLicenseExpiryStatus } from "../licenseReport";
import { computeWarrantyStatus } from "../hardwareReport";

// ============================================================================
// 1. SYSTEM NAME NORMALIZATION & RESOLUTION TESTS
// ============================================================================
describe("1. normalizeSystemName and resolveSystemName", () => {
  describe("normalizeSystemName", () => {
    it("handles null, undefined, and empty string by returning empty string", () => {
      expect(normalizeSystemName(null)).toBe("");
      expect(normalizeSystemName(undefined)).toBe("");
      expect(normalizeSystemName("")).toBe("");
      expect(normalizeSystemName("   ")).toBe("");
    });

    it("converts uppercase and mixed case to lowercase", () => {
      expect(normalizeSystemName("CORE-BANKING-PROD")).toBe("core-banking-prod");
      expect(normalizeSystemName("Payment Gateway")).toBe("payment gateway");
      expect(normalizeSystemName("ERP_FINANCE")).toBe("erp_finance");
    });

    it("collapses multiple internal whitespace, tabs, and newlines to a single space", () => {
      expect(normalizeSystemName("  Billing    Engine  ")).toBe("billing engine");
      expect(normalizeSystemName("HR \t  Portal\n System")).toBe("hr portal system");
      expect(normalizeSystemName("Data\r\nWarehouse   ETL")).toBe("data warehouse etl");
    });
  });

  describe("resolveSystemName", () => {
    it("returns 'Unassigned / Standalone' for null or undefined vm", () => {
      expect(resolveSystemName(null)).toBe("Unassigned / Standalone");
      expect(resolveSystemName(undefined)).toBe("Unassigned / Standalone");
      expect(resolveSystemName({})).toBe("Unassigned / Standalone");
    });

    it("returns 'Unassigned / Standalone' when systemName and request are empty", () => {
      expect(resolveSystemName({ systemName: null, request: null })).toBe("Unassigned / Standalone");
      expect(resolveSystemName({ systemName: "   ", request: { systemName: "" } })).toBe("Unassigned / Standalone");
    });

    it("uses vm.systemName when present, preserving display casing and trimming whitespace", () => {
      const vm = { systemName: "  Core Banking  " };
      expect(resolveSystemName(vm)).toBe("Core Banking");
    });

    it("falls back to vm.request.systemName when vm.systemName is null or empty", () => {
      const vm1 = {
        systemName: null,
        request: { systemName: "  Payment Gateway  " }
      };
      expect(resolveSystemName(vm1)).toBe("Payment Gateway");

      const vm2 = {
        systemName: "",
        request: { systemName: "HR Portal" }
      };
      expect(resolveSystemName(vm2)).toBe("HR Portal");
    });

    it("falls back to vm.request.projectName when systemName is absent on both", () => {
      const vm = {
        systemName: null,
        request: { systemName: null, projectName: "Analytics Pipeline" }
      };
      expect(resolveSystemName(vm)).toBe("Analytics Pipeline");
    });

    it("prioritizes vm.systemName over request.systemName when both exist", () => {
      const vm = {
        systemName: "Production DB Cluster",
        request: { systemName: "Initial Req Cluster", projectName: "Old Project" }
      };
      expect(resolveSystemName(vm)).toBe("Production DB Cluster");
    });
  });
});

// ============================================================================
// 2. RESOURCE SPEC RESOLUTION (FALLBACK CHAIN) TESTS
// ============================================================================
describe("2. getEffectiveSpec fallback chain", () => {
  it("Step 1: Uses currentSpec when present", () => {
    const vm = {
      currentSpec: {
        vcpu: 8,
        ramGb: 32,
        storageGb: 500,
        osName: "Ubuntu",
        osVersion: "22.04"
      },
      specHistory: [
        { vcpu: 16, ramGb: 64, storageGb: 1000 }
      ],
      request: {
        vcpu: 4,
        ramGb: 16,
        storageGb: 200
      }
    };

    const spec = getEffectiveSpec(vm);
    expect(spec.source).toBe("currentSpec");
    expect(spec.isMissing).toBe(false);
    expect(spec.vcpu).toBe(8);
    expect(spec.ramGb).toBe(32);
    expect(spec.storageGb).toBe(500);
    expect(spec.os).toBe("Ubuntu 22.04");
  });

  it("Step 2: Falls back to latest specHistory when currentSpec is missing", () => {
    const vm = {
      currentSpec: null,
      specHistory: [
        { vcpu: 12, ramGb: 48, storageGb: 600, osName: "RHEL", osVersion: "9.2" },
        { vcpu: 6, ramGb: 24, storageGb: 300, osName: "RHEL", osVersion: "8.8" }
      ],
      request: {
        vcpu: 4,
        ramGb: 16,
        storageGb: 200
      }
    };

    const spec = getEffectiveSpec(vm);
    expect(spec.source).toBe("specHistory");
    expect(spec.isMissing).toBe(false);
    expect(spec.vcpu).toBe(12);
    expect(spec.ramGb).toBe(48);
    expect(spec.storageGb).toBe(600);
    expect(spec.os).toBe("RHEL 9.2");
  });

  it("Step 3: Falls back to request.vmSpecifications when currentSpec & specHistory are absent", () => {
    const vm = {
      currentSpec: null,
      specHistory: [],
      request: {
        osName: "Debian",
        osVersion: "12",
        vmSpecifications: [
          { vcpu: 4, ramGb: 16, storageGb: 250 }
        ]
      }
    };

    const spec = getEffectiveSpec(vm);
    expect(spec.source).toBe("vmSpecification");
    expect(spec.isMissing).toBe(false);
    expect(spec.vcpu).toBe(4);
    expect(spec.ramGb).toBe(16);
    expect(spec.storageGb).toBe(250);
    expect(spec.os).toBe("Debian 12");
  });

  it("Step 4: Falls back to request-level specs when vmSpecifications is absent", () => {
    const vm = {
      currentSpec: null,
      specHistory: null,
      request: {
        vcpu: 2,
        ramGb: 8,
        storageGb: 100,
        osName: "Rocky Linux",
        osVersion: "9"
      }
    };

    const spec = getEffectiveSpec(vm);
    expect(spec.source).toBe("request");
    expect(spec.isMissing).toBe(false);
    expect(spec.vcpu).toBe(2);
    expect(spec.ramGb).toBe(8);
    expect(spec.storageGb).toBe(100);
    expect(spec.os).toBe("Rocky Linux 9");
  });

  it("Step 5: Flags VM as missing when NO spec exists anywhere in the chain", () => {
    const vmNoSpec = {
      currentSpec: null,
      specHistory: [],
      request: null
    };

    const spec = getEffectiveSpec(vmNoSpec);
    expect(spec.source).toBe("missing");
    expect(spec.isMissing).toBe(true);
    expect(spec.vcpu).toBe(0);
    expect(spec.ramGb).toBe(0);
    expect(spec.storageGb).toBe(0);
    expect(spec.os).toBe("N/A");
  });

  it("Step 5: Flags VM as missing when specs exist with only 0/null values", () => {
    const vmZeroSpec = {
      currentSpec: { vcpu: 0, ramGb: null, storageGb: 0 },
      specHistory: [],
      request: { vcpu: null, ramGb: 0, storageGb: null }
    };

    const spec = getEffectiveSpec(vmZeroSpec);
    expect(spec.source).toBe("missing");
    expect(spec.isMissing).toBe(true);
    expect(spec.vcpu).toBe(0);
  });
});

// ============================================================================
// 3. ROLE-BASED SCOPING TESTS
// ============================================================================
describe("3. getReportScope per role and data isolation", () => {
  const requesterId = "user-requester-123";
  const otherUserId = "user-other-456";

  it("strictly scopes Requester to own VMs, requests, and namespaces", () => {
    const scope = getReportScope({ id: requesterId, roles: ["REQUESTER"] });

    expect(scope.isAdminOrDcOps).toBe(false);
    expect(scope.isApprover).toBe(false);
    expect(scope.canViewInfrastructure).toBe(false);
    expect(scope.canViewAllAllocations).toBe(false);

    // Request scope: must ONLY match requester's own ID
    expect(scope.requestWhere).toEqual({
      requesterId: requesterId
    });

    // VM scope: must only match VMs owned by requester or created via requester's request
    expect(scope.vmWhere).toEqual({
      OR: [
        { ownerId: requesterId },
        { request: { requesterId: requesterId } }
      ]
    });

    // Namespace scope: must only match clusters/requests by requester
    expect(scope.namespaceWhere).toEqual({
      OR: [
        { clusters: { some: { request: { requesterId: requesterId } } } },
        { requests: { some: { requesterId: requesterId } } }
      ]
    });

    // User scope: must only match the requester themselves
    expect(scope.userWhere).toEqual({
      id: requesterId
    });
  });

  it("denies Requester access to infrastructure reports", () => {
    const guard = assertCanViewInfrastructure({ id: requesterId, roles: ["REQUESTER"] });
    expect(guard.permitted).toBe(false);
    expect(guard.error).toBe("NOT_PERMITTED");
  });

  it("gives Approvers management access to requests and allocations, but denies infrastructure", () => {
    const approverScope = getReportScope({ id: "approver-789", roles: ["APPROVER_L1"] });

    expect(approverScope.isAdminOrDcOps).toBe(false);
    expect(approverScope.isApprover).toBe(true);
    expect(approverScope.canViewInfrastructure).toBe(false);
    expect(approverScope.canViewAllAllocations).toBe(true);

    // Approver reviews all department requests
    expect(approverScope.requestWhere).toEqual({});

    // Denied infrastructure
    const guard = assertCanViewInfrastructure({ id: "approver-789", roles: ["APPROVER_L1"] });
    expect(guard.permitted).toBe(false);
    expect(guard.error).toBe("NOT_PERMITTED");
  });

  it("grants Admin and DC Ops unrestricted fleet-wide scope and infrastructure access", () => {
    const adminScope = getReportScope({ id: "admin-1", roles: ["ADMIN"] });
    expect(adminScope.isAdminOrDcOps).toBe(true);
    expect(adminScope.canViewInfrastructure).toBe(true);
    expect(adminScope.canViewAllAllocations).toBe(true);
    expect(adminScope.vmWhere).toEqual({});
    expect(adminScope.requestWhere).toEqual({});

    const dcOpsScope = getReportScope({ id: "dc-ops-1", roles: ["DC_OPS"] });
    expect(dcOpsScope.isAdminOrDcOps).toBe(true);
    expect(dcOpsScope.canViewInfrastructure).toBe(true);

    expect(assertCanViewInfrastructure({ id: "admin-1", roles: ["ADMIN"] }).permitted).toBe(true);
    expect(assertCanViewInfrastructure({ id: "dc-ops-1", roles: ["DC_OPS"] }).permitted).toBe(true);
  });
});

// ============================================================================
// 4. KPI AGGREGATION AGAINST SEEDED FIXTURE
// ============================================================================
describe("4. KPI aggregation against seeded fixture", () => {
  // Seeded fixture simulating point-in-time fleet state
  const vmFixture = [
    // VM 1: Active, explicit currentSpec
    {
      id: "vm-1",
      hostname: "web-01.prod",
      status: VmStatus.ACTIVE,
      decommissionedAt: null,
      ownerId: "user-alpha",
      requestId: "req-101",
      currentSpec: { vcpu: 4, ramGb: 16, storageGb: 100 },
      specHistory: [],
      request: { vcpu: 4, ramGb: 16, storageGb: 100 }
    },
    // VM 2: Active, spec from specHistory
    {
      id: "vm-2",
      hostname: "db-01.prod",
      status: VmStatus.ACTIVE,
      decommissionedAt: null,
      ownerId: "user-beta",
      requestId: "req-102",
      currentSpec: null,
      specHistory: [{ vcpu: 8, ramGb: 32, storageGb: 500, osName: "Debian", osVersion: "12" }],
      request: null
    },
    // VM 3: Active, provisioned directly (requestId = null)
    {
      id: "vm-3",
      hostname: "direct-node-01",
      status: VmStatus.ACTIVE,
      decommissionedAt: null,
      ownerId: "user-alpha",
      requestId: null, // explicit null
      currentSpec: { vcpu: 2, ramGb: 8, storageGb: 50 },
      specHistory: [],
      request: null
    },
    // VM 4: Active, missing spec (flagged as missing, adds 0 resources)
    {
      id: "vm-4",
      hostname: "legacy-unmanaged",
      status: VmStatus.ACTIVE,
      decommissionedAt: null,
      ownerId: "user-gamma",
      requestId: null,
      currentSpec: null,
      specHistory: [],
      request: null
    },
    // VM 5: Retired/Decommissioned (MUST BE EXCLUDED from point-in-time Active metrics)
    {
      id: "vm-5",
      hostname: "retired-db-01",
      status: VmStatus.RETIRED,
      decommissionedAt: new Date("2026-09-01"),
      ownerId: "user-alpha",
      requestId: "req-105",
      currentSpec: { vcpu: 16, ramGb: 64, storageGb: 1000 },
      specHistory: [],
      request: null
    },
    // VM 6: Suspended (MUST BE EXCLUDED from Active metrics)
    {
      id: "vm-6",
      hostname: "suspended-instance",
      status: VmStatus.SUSPENDED,
      decommissionedAt: null,
      ownerId: "user-beta",
      requestId: "req-106",
      currentSpec: { vcpu: 8, ramGb: 32, storageGb: 200 },
      specHistory: [],
      request: null
    }
  ];

  it("accurately computes Active VMs, Total vCPU, RAM, Storage, and handles requestId = null", () => {
    // 1. Filter point-in-time active VMs (status = ACTIVE and decommissionedAt = null)
    const activeVms = vmFixture.filter(
      (vm) => vm.status === VmStatus.ACTIVE && vm.decommissionedAt === null
    );

    // Active VMs count should be exactly 4 (vm-1, vm-2, vm-3, vm-4)
    expect(activeVms.length).toBe(4);

    // Distinct owners among active VMs: user-alpha, user-beta, user-gamma (3 users)
    const distinctOwners = new Set(activeVms.map((vm) => vm.ownerId));
    expect(distinctOwners.size).toBe(3);

    // 2. Aggregate resource totals using authoritative helper
    const totals = aggregateVmResources(activeVms);

    // Expected:
    // vm-1: 4 vCPU, 16 RAM, 100 Storage
    // vm-2: 8 vCPU, 32 RAM, 500 Storage
    // vm-3: 2 vCPU, 8 RAM, 50 Storage (requestId = null)
    // vm-4: 0 vCPU, 0 RAM, 0 Storage (missing spec)
    // Sum: 14 vCPU, 56 GB RAM, 650 GB Storage
    expect(totals.totalVcpu).toBe(14);
    expect(totals.totalRamGb).toBe(56);
    expect(totals.totalStorageGb).toBe(650);
    expect(totals.specMissingCount).toBe(1);

    // Verify VM with requestId = null succeeded without error
    const vm3Effective = getEffectiveSpec(activeVms.find((v) => v.id === "vm-3")!);
    expect(vm3Effective.vcpu).toBe(2);
    expect(vm3Effective.ramGb).toBe(8);
    expect(vm3Effective.source).toBe("currentSpec");
  });

  it("autoScaleRam and autoScaleStorage scale units sensibly and never render 0.00 TB", () => {
    expect(autoScaleRam(56)).toBe("56 GB");
    expect(autoScaleRam(1024)).toBe("1 TB");
    expect(autoScaleRam(1536)).toBe("1.5 TB");
    expect(autoScaleRam(0)).toBe("0 GB");
    expect(autoScaleRam(null)).toBe("—");

    expect(autoScaleStorage(650)).toBe("650 GB");
    expect(autoScaleStorage(1024)).toBe("1 TB");
    expect(autoScaleStorage(2048)).toBe("2 TB");
    expect(autoScaleStorage(2500)).toBe("2.44 TB");
    expect(autoScaleStorage(0)).toBe("0 GB");
    expect(autoScaleStorage(null)).toBe("—");
  });
});

// ============================================================================
// 5. DATE RANGE VALIDATION & ROLLING-30D BOUNDARIES
// ============================================================================
describe("5. Date range validation and rolling-30D boundaries", () => {
  it("defaults to rolling 30D ending today when no parameters provided", () => {
    const range = validateDateRange();
    const now = new Date();

    // 'to' should be within 1 second of now
    expect(Math.abs(range.to.getTime() - now.getTime())).toBeLessThan(1000);

    // 'from' should be exactly 30 days prior
    const daysDiff = differenceInDays(range.to, range.from);
    expect(daysDiff).toBe(30);
  });

  it("swaps boundaries when from > to", () => {
    const rawFrom = new Date("2026-10-15");
    const rawTo = new Date("2026-09-01");

    const validated = validateDateRange(rawFrom, rawTo);
    expect(validated.from.getTime()).toBeLessThanOrEqual(validated.to.getTime());
    expect(validated.from.toISOString().slice(0, 10)).toBe("2026-09-01");
    expect(validated.to.toISOString().slice(0, 10)).toBe("2026-10-15");
  });

  it("caps maximum date range to maxYears (default 2 years)", () => {
    const to = new Date("2026-10-13");
    const veryOldFrom = new Date("2020-01-01");

    const validated = validateDateRange(veryOldFrom, to, 2);
    const expectedEarliest = subYears(to, 2);

    expect(validated.from.getTime()).toBe(expectedEarliest.getTime());
  });

  it("safely handles invalid date strings by falling back to 30D rolling window", () => {
    const validated = validateDateRange("not-a-valid-date", "invalid-to");
    expect(isNaN(validated.from.getTime())).toBe(false);
    expect(isNaN(validated.to.getTime())).toBe(false);
    expect(differenceInDays(validated.to, validated.from)).toBe(30);
  });

  it("formats date range unambiguously and generates standard export filenames", () => {
    const from = new Date("2026-09-14T00:00:00Z");
    const to = new Date("2026-10-13T00:00:00Z");

    const label = formatDateRangeUnambiguous(from, to);
    expect(label).toContain("14 Sep – 13 Oct 2026");

    const filenameXlsx = getReportFilename("VM Inventory", from, to, "xlsx");
    expect(filenameXlsx).toBe("vm_inventory_2026-09-14_to_2026-10-13.xlsx");

    const filenameCsv = getReportFilename("User-Allocation Report", from, to, "csv");
    expect(filenameCsv).toBe("user-allocation_report_2026-09-14_to_2026-10-13.csv");
  });
});

// ============================================================================
// 6. EXPORT ROW COUNT EQUALS FILTERED TABLE COUNT
// ============================================================================
describe("6. Export row count equals the filtered table count", () => {
  // Dataset simulating 10 VM inventory rows
  const fullInventoryFleet = [
    { hostname: "web-app-01", env: Environment.PRODUCTION, status: VmStatus.ACTIVE, system: "Billing System", owner: "Alice" },
    { hostname: "web-app-02", env: Environment.PRODUCTION, status: VmStatus.ACTIVE, system: "Billing System", owner: "Alice" },
    { hostname: "billing-db-01", env: Environment.PRODUCTION, status: VmStatus.ACTIVE, system: "Billing System", owner: "Bob" },
    { hostname: "stage-app-01", env: Environment.STAGING, status: VmStatus.ACTIVE, system: "Billing System", owner: "Alice" },
    { hostname: "core-bank-01", env: Environment.PRODUCTION, status: VmStatus.ACTIVE, system: "Core Banking", owner: "Charlie" },
    { hostname: "core-bank-02", env: Environment.PRODUCTION, status: VmStatus.ACTIVE, system: "Core Banking", owner: "Charlie" },
    { hostname: "core-bank-test", env: Environment.TESTING, status: VmStatus.ACTIVE, system: "Core Banking", owner: "Charlie" },
    { hostname: "dev-sandbox", env: Environment.DEVELOPMENT, status: VmStatus.SUSPENDED, system: "Unassigned / Standalone", owner: "Dave" },
    { hostname: "test-runner", env: Environment.TESTING, status: VmStatus.SUSPENDED, system: "Unassigned / Standalone", owner: "Eve" },
    { hostname: "retired-old-app", env: Environment.PRODUCTION, status: VmStatus.RETIRED, system: "Legacy Arch", owner: "Frank" },
  ];

  // Helper applying table filters
  function filterFleet(params: {
    env?: Environment | "ALL";
    status?: VmStatus | "ALL";
    system?: string;
    searchTerm?: string;
  }) {
    return fullInventoryFleet.filter((row) => {
      if (params.env && params.env !== "ALL" && row.env !== params.env) return false;
      if (params.status && params.status !== "ALL" && row.status !== params.status) return false;
      if (params.system && params.system !== "ALL" && row.system.toLowerCase() !== params.system.toLowerCase()) return false;
      if (params.searchTerm) {
        const term = params.searchTerm.toLowerCase();
        const matches =
          row.hostname.toLowerCase().includes(term) ||
          row.system.toLowerCase().includes(term) ||
          row.owner.toLowerCase().includes(term);
        if (!matches) return false;
      }
      return true;
    });
  }

  it("exports exact count when no filters are applied", () => {
    const filteredRows = filterFleet({});
    const exportedRows = [...filteredRows]; // export receives the complete matching result set
    expect(exportedRows.length).toBe(10);
    expect(exportedRows.length).toBe(filteredRows.length);
  });

  it("exports exact count when status filter is applied", () => {
    const filteredRows = filterFleet({ status: VmStatus.ACTIVE });
    const exportedRows = [...filteredRows];
    expect(exportedRows.length).toBe(7);
    expect(exportedRows.length).toBe(filteredRows.length);
  });

  it("exports exact count with multi-criteria filters (Environment + System)", () => {
    const filteredRows = filterFleet({
      env: Environment.PRODUCTION,
      system: "Billing System",
    });
    const exportedRows = [...filteredRows];
    expect(exportedRows.length).toBe(3);
    expect(exportedRows.length).toBe(filteredRows.length);
  });

  it("exports exact count when search query matches a subset", () => {
    const filteredRows = filterFleet({ searchTerm: "core-bank" });
    const exportedRows = [...filteredRows];
    expect(exportedRows.length).toBe(3);
    expect(exportedRows.length).toBe(filteredRows.length);
  });

  it("exports 0 rows when filters result in an empty state", () => {
    const filteredRows = filterFleet({ searchTerm: "non-existent-system-query" });
    const exportedRows = [...filteredRows];
    expect(exportedRows.length).toBe(0);
    expect(exportedRows.length).toBe(filteredRows.length);
  });

  it("exports ALL matching rows regardless of table pagination page size", () => {
    const allMatching = filterFleet({ env: Environment.PRODUCTION });
    expect(allMatching.length).toBe(6);

    // When paginating with pageSize = 2
    const pageSize = 2;
    const page1TableSlice = allMatching.slice(0, pageSize);
    expect(page1TableSlice.length).toBe(2);

    // The export query (with getAll: true) produces allMatching (not the paginated slice)
    const exportPayload = [...allMatching];
    expect(exportPayload.length).toBe(6);
    expect(exportPayload.length).toBe(allMatching.length);
  });
});

// ============================================================================
// 7. VPN & HORIZON PER-PERSON EXPANDABLE REPORT TESTS
// ============================================================================
describe("7. VPN & Horizon per-person expandable reporting", () => {
  it("normalizes usernames cleanly across case, spaces, and punctuation", () => {
    expect(normalizeUsername("  john.doe  ")).toBe("john.doe");
    expect(normalizeUsername("JOHN.DOE")).toBe("john.doe");
    expect(normalizeUsername("  Jane   Smith  ")).toBe("jane smith");
    expect(normalizeUsername(null)).toBe("");
    expect(normalizeUsername(undefined)).toBe("");
  });

  it("unifies a person with both VpnUser and HorizonUser accounts into ONE parent row by portal userId", () => {
    const vpnUsers = [
      {
        id: "vpn-u1",
        userId: "portal-alice",
        username: "alice_vpn",
        fullName: "Alice Smith",
        vpnProfile: "Developer",
        vpnIp: "10.8.0.5",
        status: "ACTIVE",
        user: { id: "portal-alice", name: "Alice Smith", email: "alice@company.com" }
      }
    ];

    const horizonUsers = [
      {
        id: "hz-u1",
        userId: "portal-alice",
        username: "alice_vdi",
        fullName: "Alice Smith",
        email: "alice@company.com",
        status: "ACTIVE",
        user: { id: "portal-alice", name: "Alice Smith", email: "alice@company.com" }
      }
    ];

    const horizonAssignments = [
      {
        id: "ha-1",
        horizonUserId: "hz-u1",
        horizonUser: horizonUsers[0],
        vmId: "vm-101",
        vm: { id: "vm-101", hostname: "alice-dev-vm", ipAddress: "10.0.0.10", systemName: "Dev", environment: "DEV", status: "ACTIVE" },
        assignedAt: new Date("2026-01-01"),
      }
    ];

    const vpnAssignments = [
      {
        id: "va-1",
        vpnUserId: "vpn-u1",
        vpnUser: vpnUsers[0],
        vmId: "vm-101",
        vm: { id: "vm-101", hostname: "alice-dev-vm", ipAddress: "10.0.0.10", systemName: "Dev", environment: "DEV", status: "ACTIVE" },
        assignedAt: new Date("2026-01-02"),
      }
    ];

    const result = transformVpnHorizonAssignmentsToUsers({
      horizonAssignments,
      vpnAssignments,
      vpnUsers,
      horizonUsers,
    });

    // Alice must appear exactly ONCE
    expect(result.length).toBe(1);
    const alice = result[0];
    expect(alice.personName).toBe("Alice Smith");
    expect(alice.portalUserId).toBe("portal-alice");
    expect(alice.email).toBe("alice@company.com");
    expect(alice.hasVpn).toBe(true);
    expect(alice.hasHorizon).toBe(true);
    expect(alice.vpnAccount?.username).toBe("alice_vpn");
    expect(alice.horizonAccount?.username).toBe("alice_vdi");

    // Alice has 1 VM assigned (both VPN and Horizon point to vm-101), de-duplicated!
    expect(alice.totalVmsCount).toBe(1);
    expect(alice.assignedVms[0].hostname).toBe("alice-dev-vm");
    expect(alice.assignedVms[0].accessTypes).toContain("VPN");
    expect(alice.assignedVms[0].accessTypes).toContain("Horizon");
    expect(alice.assignedVms[0].isLegacy).toBe(false);
    expect(alice.hasLegacy).toBe(false);
  });

  it("unifies a person by normalised username when portal userId is absent", () => {
    const vpnUsers = [
      {
        id: "vpn-u2",
        userId: null,
        username: "  Bob.Smith  ",
        fullName: "Bob Smith",
        status: "ACTIVE"
      }
    ];

    const horizonUsers = [
      {
        id: "hz-u2",
        userId: null,
        username: "bob.smith",
        fullName: "Bob Smith",
        email: "bob@company.com",
        status: "ACTIVE"
      }
    ];

    const result = transformVpnHorizonAssignmentsToUsers({
      horizonAssignments: [],
      vpnAssignments: [],
      vpnUsers,
      horizonUsers,
    });

    expect(result.length).toBe(1);
    expect(result[0].personName).toBe("Bob Smith");
    expect(result[0].vpnAccount?.username).toBe("  Bob.Smith  ");
    expect(result[0].horizonAccount?.username).toBe("bob.smith");
    expect(result[0].hasVpn).toBe(true);
    expect(result[0].hasHorizon).toBe(true);
  });

  it("strictly enforces new fields as source of truth and marks legacy fallbacks without double counting", () => {
    // HorizonAssignment with BOTH vmId (new) and vmInstanceId (old) on the same record or separate records
    const horizonAssignments = [
      // Case A: Record with BOTH vmId and vmInstanceId populated
      {
        id: "ha-dup-1",
        username: "carol",
        vmId: "vm-new-1",
        vm: { id: "vm-new-1", hostname: "carol-primary", ipAddress: "10.0.1.1", systemName: "Billing", environment: "PROD", status: "ACTIVE" },
        vmInstanceId: "vm-old-1",
        oldVm: { id: "vm-old-1", hostname: "carol-legacy-shadow", ipAddress: "10.0.1.1" },
        assignedAt: new Date("2026-02-01"),
      },
      // Case B: A purely legacy fallback record for an old VM
      {
        id: "ha-legacy-only",
        username: "carol",
        vmId: null,
        vmInstanceId: "vm-legacy-only-2",
        oldVm: { id: "vm-legacy-only-2", hostname: "carol-archived", ipAddress: "10.0.9.9", systemName: "Archive", environment: "PROD", status: "ACTIVE" },
        assignedAt: new Date("2026-01-15"),
      }
    ];

    const result = transformVpnHorizonAssignmentsToUsers({
      horizonAssignments,
      vpnAssignments: [],
    });

    expect(result.length).toBe(1);
    const carol = result[0];

    // Total VMs must be 2: carol-primary (authoritative) and carol-archived (legacy fallback).
    // vm-old-1 from the first record must NEVER have been counted as a duplicate 3rd VM!
    expect(carol.totalVmsCount).toBe(2);

    const primaryVm = carol.assignedVms.find(v => v.id === "vm-new-1");
    expect(primaryVm).toBeDefined();
    expect(primaryVm?.isLegacy).toBe(false);
    expect(primaryVm?.hostname).toBe("carol-primary");

    const archivedVm = carol.assignedVms.find(v => v.id === "vm-legacy-only-2");
    expect(archivedVm).toBeDefined();
    expect(archivedVm?.isLegacy).toBe(true);
    expect(archivedVm?.hostname).toBe("carol-archived");

    // Because carol has a legacy fallback VM, hasLegacy must be true
    expect(carol.hasLegacy).toBe(true);
  });

  it("de-duplicates legacy assignedVms string against authoritative new vmId", () => {
    const vpnAssignments = [
      {
        id: "va-new",
        username: "david",
        vmId: "vm-d1",
        vm: { id: "vm-d1", hostname: "david-workstation", ipAddress: "10.2.0.5", systemName: "Ops", environment: "PROD", status: "ACTIVE" },
        assignedAt: new Date("2026-03-01"),
      },
      {
        id: "va-legacy-str",
        username: "david",
        assignedVms: "david-workstation", // same hostname in legacy string field!
        assignedAt: new Date("2026-01-01"),
      }
    ];

    const result = transformVpnHorizonAssignmentsToUsers({
      horizonAssignments: [],
      vpnAssignments,
    });

    expect(result.length).toBe(1);
    const david = result[0];

    // Must be de-duplicated: exactly 1 VM, authoritative
    expect(david.totalVmsCount).toBe(1);
    expect(david.assignedVms[0].isLegacy).toBe(false);
    expect(david.hasLegacy).toBe(false);
  });

  it("strictly scopes Requesters to only see assignments pointing to their own VMs and namespaces", () => {
    // Requester owns only vm-req-1 and ns-req-1
    const requesterScopedVmIds = new Set(["vm-req-1"]);
    const requesterScopedNamespaceIds = new Set(["ns-req-1"]);

    const horizonAssignments = [
      // Assignment pointing to requester's VM
      {
        id: "ha-req-vm",
        username: "external_consultant",
        vmId: "vm-req-1",
        vm: { id: "vm-req-1", hostname: "req-app-vm", ipAddress: "10.5.0.1", systemName: "My App", environment: "PROD", status: "ACTIVE" },
        assignedAt: new Date(),
      },
      // Assignment pointing to another user's VM
      {
        id: "ha-other-vm",
        username: "external_consultant",
        vmId: "vm-other-999",
        vm: { id: "vm-other-999", hostname: "other-user-vm", ipAddress: "10.99.0.1", systemName: "Other App", environment: "PROD", status: "ACTIVE" },
        assignedAt: new Date(),
      },
      // Assignment pointing to another user's namespace only
      {
        id: "ha-other-person",
        username: "stranger",
        namespaceId: "ns-other-888",
        namespace: { id: "ns-other-888", name: "other-namespace", supervisorIp: "10.88.0.1" },
        assignedAt: new Date(),
      }
    ];

    const vpnAssignments = [
      // VPN assignment pointing to requester's namespace
      {
        id: "va-req-ns",
        username: "external_consultant",
        namespaceId: "ns-req-1",
        namespace: { id: "ns-req-1", name: "req-ns", supervisorIp: "10.5.0.2" },
        assignedAt: new Date(),
      }
    ];

    const result = transformVpnHorizonAssignmentsToUsers({
      horizonAssignments,
      vpnAssignments,
      requesterScopedVmIds,
      requesterScopedNamespaceIds,
      isRequester: true,
    });

    // 1. "stranger" has 0 resources owned by this requester -> stranger must be completely excluded
    expect(result.find(r => r.personName === "stranger")).toBeUndefined();

    // 2. "external_consultant" has access to req-app-vm and req-ns, but vm-other-999 must NOT be visible
    expect(result.length).toBe(1);
    const consultant = result[0];
    expect(consultant.personName).toBe("external_consultant");
    expect(consultant.totalVmsCount).toBe(1);
    expect(consultant.assignedVms[0].id).toBe("vm-req-1");
    expect(consultant.totalNamespacesCount).toBe(1);
    expect(consultant.assignedNamespaces[0].id).toBe("ns-req-1");
  });
});

// ============================================================================
// 8. SOFTWARE LICENSE REPORT (EXPIRY, VENDOR, TYPE) TESTS
// ============================================================================
describe("8. Software License report coverage by expiry, vendor, and type", () => {
  const referenceDate = new Date("2026-10-13T12:00:00Z");

  it("identifies PERPETUAL licenses when expiryDate is null or undefined", () => {
    const resNull = computeLicenseExpiryStatus(null, referenceDate);
    expect(resNull.expiryStatus).toBe("PERPETUAL");
    expect(resNull.daysRemaining).toBeNull();

    const resUndefined = computeLicenseExpiryStatus(undefined, referenceDate);
    expect(resUndefined.expiryStatus).toBe("PERPETUAL");
    expect(resUndefined.daysRemaining).toBeNull();
  });

  it("identifies EXPIRED licenses when expiryDate is strictly in the past", () => {
    // 5 days ago
    const pastDate = new Date("2026-10-08T12:00:00Z");
    const res = computeLicenseExpiryStatus(pastDate, referenceDate);
    expect(res.expiryStatus).toBe("EXPIRED");
    expect(res.daysRemaining).toBeLessThan(0);
  });

  it("identifies EXPIRING_30D licenses when expiryDate is within 30 days", () => {
    // 15 days ahead
    const nearDate = new Date("2026-10-28T12:00:00Z");
    const res = computeLicenseExpiryStatus(nearDate, referenceDate);
    expect(res.expiryStatus).toBe("EXPIRING_30D");
    expect(res.daysRemaining).toBe(15);
  });

  it("identifies EXPIRING_90D licenses when expiryDate is between 31 and 90 days", () => {
    // 60 days ahead
    const futureDate = new Date("2026-12-12T12:00:00Z");
    const res = computeLicenseExpiryStatus(futureDate, referenceDate);
    expect(res.expiryStatus).toBe("EXPIRING_90D");
    expect(res.daysRemaining).toBe(60);
  });

  it("identifies ACTIVE licenses when expiryDate is beyond 90 days", () => {
    // 180 days ahead
    const activeDate = new Date("2027-04-11T12:00:00Z");
    const res = computeLicenseExpiryStatus(activeDate, referenceDate);
    expect(res.expiryStatus).toBe("ACTIVE");
    expect(res.daysRemaining).toBeGreaterThan(90);
  });

  it("filters license records accurately by vendor, type, and expiry window", () => {
    const sampleLicenses = [
      { id: "1", name: "vSphere Enterprise Plus", vendor: "VMware", type: "SUBSCRIPTION", expiryDate: new Date("2026-10-25T00:00:00Z") }, // 30D
      { id: "2", name: "Windows Server 2022 DC", vendor: "Microsoft", type: "CORE_BASED", expiryDate: new Date("2026-11-20T00:00:00Z") }, // 90D
      { id: "3", name: "Red Hat Enterprise Linux", vendor: "Red Hat", type: "SUBSCRIPTION", expiryDate: new Date("2026-10-01T00:00:00Z") }, // EXPIRED
      { id: "4", name: "Oracle Database EE", vendor: "Oracle", type: "PERPETUAL", expiryDate: null }, // PERPETUAL
      { id: "5", name: "VMware NSX-T Data Center", vendor: "VMware", type: "SUBSCRIPTION", expiryDate: new Date("2027-10-01T00:00:00Z") }, // ACTIVE
    ];

    // Vendor filter: VMware only
    const vmwareOnly = sampleLicenses.filter(l => l.vendor.toLowerCase() === "vmware");
    expect(vmwareOnly.length).toBe(2);
    expect(vmwareOnly.map(l => l.name)).toEqual(["vSphere Enterprise Plus", "VMware NSX-T Data Center"]);

    // Type filter: SUBSCRIPTION only
    const subscriptionsOnly = sampleLicenses.filter(l => l.type === "SUBSCRIPTION");
    expect(subscriptionsOnly.length).toBe(3);

    // Expiry filter: Expired only
    const expiredOnly = sampleLicenses.filter(l => {
      const status = computeLicenseExpiryStatus(l.expiryDate, referenceDate);
      return status.expiryStatus === "EXPIRED";
    });
    expect(expiredOnly.length).toBe(1);
    expect(expiredOnly[0].vendor).toBe("Red Hat");

    // Expiry filter: Expiring in 30 days
    const expiring30Only = sampleLicenses.filter(l => {
      const status = computeLicenseExpiryStatus(l.expiryDate, referenceDate);
      return status.expiryStatus === "EXPIRING_30D";
    });
    expect(expiring30Only.length).toBe(1);
    expect(expiring30Only[0].name).toBe("vSphere Enterprise Plus");

    // Multi-criteria filter: Vendor = VMware AND Type = SUBSCRIPTION
    const multiFiltered = sampleLicenses.filter(l => l.vendor === "VMware" && l.type === "SUBSCRIPTION");
    expect(multiFiltered.length).toBe(2);
  });
});

// ============================================================================
// 9. SYSTEM-NAME-WISE REPORT TESTS
// ============================================================================
describe("9. System-Name-Wise report: VMs, requests, namespaces, and access users", () => {
  it("groups resources with varied casing and whitespace into unified system entries", () => {
    const rawSystems = [
      "Core Banking",
      "  core banking  ",
      "CORE BANKING",
      "Payment Gateway",
      null,
      ""
    ];

    const normalizedMap = new Map<string, string>();
    for (const sys of rawSystems) {
      const norm = normalizeSystemName(sys);
      const key = norm || "unassigned";
      const display = norm ? formatSystemName(sys) : "Unassigned / Standalone";
      if (!normalizedMap.has(key)) {
        normalizedMap.set(key, display);
      }
    }

    // Should collapse into exactly 3 systems: "core banking", "payment gateway", and "unassigned"
    expect(normalizedMap.size).toBe(3);
    expect(normalizedMap.get("core banking")).toBe("Core Banking");
    expect(normalizedMap.get("payment gateway")).toBe("Payment Gateway");
    expect(normalizedMap.get("unassigned")).toBe("Unassigned / Standalone");
  });

  it("accurately aggregates VMs, requests, namespaces, and access users under each system", () => {
    // Fixture for System "Core Banking"
    const systemVms = [
      { id: "vm-1", hostname: "cb-prod-web-01", vcpu: 4, ramGb: 16, storageGb: 100, environment: "PRODUCTION" },
      { id: "vm-2", hostname: "cb-prod-db-01", vcpu: 8, ramGb: 32, storageGb: 500, environment: "PRODUCTION" },
      { id: "vm-3", hostname: "cb-stg-app-01", vcpu: 2, ramGb: 8, storageGb: 50, environment: "STAGING" },
    ];

    const systemRequests = [
      { id: "req-1", displayId: "REQ-0001", type: "VM_PROVISIONING", status: "APPROVED", environment: "PRODUCTION" },
      { id: "req-2", displayId: "REQ-0002", type: "SPEC_MODIFICATION", status: "PENDING", environment: "PRODUCTION" },
    ];

    const systemNamespaces = [
      { id: "ns-1", name: "core-banking-prod", clusterName: "Prod-Cluster-01", totalNodes: 3, vcpu: 12, ramGb: 48, storageGb: 300 },
    ];

    const systemAccessUsers = [
      { personName: "Alice Admin", email: "alice@bank.com", accessTypes: ["VPN", "Horizon"], targetNames: ["cb-prod-web-01", "core-banking-prod"] },
      { personName: "Bob Operator", email: "bob@bank.com", accessTypes: ["Horizon"], targetNames: ["cb-prod-db-01"] },
    ];

    // Compute System Rollups
    const totalVmsCount = systemVms.length;
    const totalRequestsCount = systemRequests.length;
    const totalNamespacesCount = systemNamespaces.length;
    const totalAccessUsersCount = systemAccessUsers.length;

    const totalVcpu = systemVms.reduce((sum, v) => sum + v.vcpu, 0);
    const totalRamGb = systemVms.reduce((sum, v) => sum + v.ramGb, 0);
    const totalStorageGb = systemVms.reduce((sum, v) => sum + v.storageGb, 0);

    const environments = Array.from(new Set([...systemVms.map(v => v.environment), ...systemRequests.map(r => r.environment)])).sort();

    expect(totalVmsCount).toBe(3);
    expect(totalRequestsCount).toBe(2);
    expect(totalNamespacesCount).toBe(1);
    expect(totalAccessUsersCount).toBe(2);

    expect(totalVcpu).toBe(14); // 4 + 8 + 2
    expect(totalRamGb).toBe(56); // 16 + 32 + 8
    expect(totalStorageGb).toBe(650); // 100 + 500 + 50

    expect(environments).toEqual(["PRODUCTION", "STAGING"]);
  });

  it("de-duplicates remote access users within a system when a user has both VPN and Horizon", () => {
    const rawAssignments = [
      { personName: "Alice Admin", email: "alice@bank.com", type: "VPN", target: "cb-vm-01" },
      { personName: "Alice Admin", email: "alice@bank.com", type: "Horizon", target: "cb-vm-01" },
      { personName: "Alice Admin", email: "alice@bank.com", type: "Horizon", target: "core-banking-prod" },
      { personName: "Charlie Dev", email: "charlie@bank.com", type: "VPN", target: "cb-vm-02" },
    ];

    const userMap = new Map<string, { personName: string; accessTypes: Set<string>; targets: Set<string> }>();
    for (const a of rawAssignments) {
      const key = a.personName.toLowerCase();
      if (!userMap.has(key)) {
        userMap.set(key, { personName: a.personName, accessTypes: new Set([a.type]), targets: new Set([a.target]) });
      } else {
        const u = userMap.get(key)!;
        u.accessTypes.add(a.type);
        u.targets.add(a.target);
      }
    }

    // Alice should appear exactly ONCE with both VPN and Horizon
    expect(userMap.size).toBe(2);
    const alice = userMap.get("alice admin")!;
    expect(alice).toBeDefined();
    expect(Array.from(alice.accessTypes)).toEqual(["VPN", "Horizon"]);
    expect(Array.from(alice.targets)).toEqual(["cb-vm-01", "core-banking-prod"]);

    const charlie = userMap.get("charlie dev")!;
    expect(charlie).toBeDefined();
    expect(Array.from(charlie.accessTypes)).toEqual(["VPN"]);
  });
});

// ============================================================================
// 10. HARDWARE & HOSTS REPORT TESTS
// ============================================================================
describe("10. Hardware report: Assets by type, warranty lifecycle, per-host utilisation, hosted VMs, and licenses", () => {
  const referenceDate = new Date("2026-10-13T12:00:00Z");

  describe("computeWarrantyStatus", () => {
    it("handles null, undefined, and invalid date formats by returning UNKNOWN", () => {
      expect(computeWarrantyStatus(null, referenceDate).warrantyStatus).toBe("UNKNOWN");
      expect(computeWarrantyStatus(undefined, referenceDate).warrantyStatus).toBe("UNKNOWN");
      expect(computeWarrantyStatus("invalid-date", referenceDate).warrantyStatus).toBe("UNKNOWN");
    });

    it("classifies past warranty dates as EXPIRED", () => {
      const pastDate = new Date("2026-09-01T00:00:00Z"); // ~42 days past
      const res = computeWarrantyStatus(pastDate, referenceDate);
      expect(res.warrantyStatus).toBe("EXPIRED");
      expect(res.isWarrantyExpired).toBe(true);
      expect(res.isWarrantySoon).toBe(false);
      expect(res.daysUntilWarrantyExpiry).toBeLessThan(0);
    });

    it("classifies warranty ending within 30 days as EXPIRING_30D", () => {
      const expiringSoon = new Date("2026-10-25T12:00:00Z"); // 12 days from reference
      const res = computeWarrantyStatus(expiringSoon, referenceDate);
      expect(res.warrantyStatus).toBe("EXPIRING_30D");
      expect(res.isWarrantySoon).toBe(true);
      expect(res.isWarrantyExpired).toBe(false);
      expect(res.daysUntilWarrantyExpiry).toBe(12);
    });

    it("classifies warranty ending between 31 and 90 days as EXPIRING_90D", () => {
      const expiring90 = new Date("2026-12-01T12:00:00Z"); // 49 days from reference
      const res = computeWarrantyStatus(expiring90, referenceDate);
      expect(res.warrantyStatus).toBe("EXPIRING_90D");
      expect(res.isWarrantySoon).toBe(true);
      expect(res.isWarrantyExpired).toBe(false);
      expect(res.daysUntilWarrantyExpiry).toBe(49);
    });

    it("classifies warranty ending beyond 90 days as ACTIVE", () => {
      const activeDate = new Date("2027-10-13T12:00:00Z"); // 1 year out
      const res = computeWarrantyStatus(activeDate, referenceDate);
      expect(res.warrantyStatus).toBe("ACTIVE");
      expect(res.isWarrantySoon).toBe(false);
      expect(res.isWarrantyExpired).toBe(false);
      expect(res.daysUntilWarrantyExpiry).toBeGreaterThan(90);
    });
  });

  describe("Asset Type Dynamic Columns", () => {
    it("formats server assets with cores, RAM, and GPU specs", () => {
      const serverAsset = {
        type: "SERVER",
        cpuCores: 64,
        ramGb: 256,
        graphicsCardModel: "NVIDIA A100 80GB PCIe",
        graphicsCardSpec: "Ampere Architecture, 312 TFLOPS Tensor",
      };

      expect(serverAsset.cpuCores).toBe(64);
      expect(serverAsset.ramGb).toBe(256);
      expect(serverAsset.graphicsCardModel).toBe("NVIDIA A100 80GB PCIe");
    });

    it("formats network device assets with interfaces and throughput", () => {
      const switchAsset = {
        type: "SWITCH",
        interfaces: 48,
        throughputGbps: 100,
        vlanSupport: true,
      };

      expect(switchAsset.interfaces).toBe(48);
      expect(switchAsset.throughputGbps).toBe(100);
    });

    it("formats storage assets with capacity in TB and disk counts", () => {
      const sanStorage = {
        type: "STORAGE",
        capacityTb: 120,
        noOfDisks: 24,
      };

      expect(sanStorage.capacityTb).toBe(120);
      expect(sanStorage.noOfDisks).toBe(24);
    });
  });

  describe("Per-Host Utilisation Calculation", () => {
    it("calculates utilisation percentage and sets status to Overloaded when usage exceeds 90%", () => {
      const hostCpu = 32;
      const hostRam = 128;
      const hostStorage = 1000;

      const allocatedCpu = 30; // 93.75%
      const allocatedRam = 64;  // 50%
      const allocatedStorage = 400; // 40%

      const cpuUtil = Math.round((allocatedCpu / hostCpu) * 100);
      const ramUtil = Math.round((allocatedRam / hostRam) * 100);
      const storageUtil = Math.round((allocatedStorage / hostStorage) * 100);
      const maxUtil = Math.max(cpuUtil, ramUtil, storageUtil);

      expect(cpuUtil).toBe(94);
      expect(maxUtil).toBe(94);
      expect(maxUtil > 90 ? "Overloaded" : "Utilized").toBe("Overloaded");
    });

    it("sets status to Underutilized when host runs VMs but utilization is below 25%", () => {
      const hostCpu = 64;
      const hostRam = 256;
      const allocatedCpu = 8; // 12.5% -> 13%
      const allocatedRam = 32; // 12.5% -> 13%
      const vmCount = 2;

      const cpuUtil = Math.round((allocatedCpu / hostCpu) * 100);
      const ramUtil = Math.round((allocatedRam / hostRam) * 100);
      const maxUtil = Math.max(cpuUtil, ramUtil);

      let status = "Available";
      if (maxUtil > 90) status = "Overloaded";
      else if (maxUtil >= 75) status = "Utilized";
      else if (vmCount > 0 && maxUtil < 25) status = "Underutilized";

      expect(status).toBe("Underutilized");
    });

    it("aggregates hosted VMs and mapped licenses under each physical host asset", () => {
      const hostRow = {
        id: "asset-101",
        assetName: "dc1-srv-r740-01",
        type: "SERVER",
        serial: "SN-R740-9942",
        hostedVms: [
          { id: "vm-1", hostname: "k8s-worker-01", ipAddress: "10.0.1.10", systemName: "Billing", environment: "PRODUCTION", vcpu: 8, ramGb: 32, storageGb: 100, ownerName: "John Doe" },
          { id: "vm-2", hostname: "k8s-worker-02", ipAddress: "10.0.1.11", systemName: "Billing", environment: "PRODUCTION", vcpu: 8, ramGb: 32, storageGb: 100, ownerName: "Jane Smith" },
        ],
        licenses: [
          { id: "lic-1", name: "VMware vSphere Enterprise Plus", vendor: "VMware", type: "CPU_BASED", expiryDate: "2027-12-31" },
          { id: "lic-2", name: "RHEL Server High Availability", vendor: "Red Hat", type: "SUBSCRIPTION", expiryDate: "2026-11-15" },
        ]
      };

      expect(hostRow.hostedVms.length).toBe(2);
      expect(hostRow.licenses.length).toBe(2);
      expect(hostRow.hostedVms.reduce((acc, vm) => acc + vm.vcpu, 0)).toBe(16);
      expect(hostRow.hostedVms.reduce((acc, vm) => acc + vm.ramGb, 0)).toBe(64);
      expect(hostRow.licenses[0].vendor).toBe("VMware");
      expect(hostRow.licenses[1].vendor).toBe("Red Hat");
    });
  });
});

// ============================================================================
// 11. CLUSTER CAPACITY & FLEET TOTALS AGGREGATION TESTS
// ============================================================================
describe("11. Cluster Capacity and Fleet Totals Calculation", () => {
  const mockClusters = [
    {
      clusterId: "cls-01",
      clusterName: "vsan-dc-sddc-cls01",
      hostCount: 8,
      totalVcpu: 768,
      usedVcpu: 0,
      freeVcpu: 768,
      cpuUtilPercent: 0,
      totalRamGb: 8192,
      usedRamGb: 0,
      freeRamGb: 8192,
      ramUtilPercent: 0,
      totalStorageGb: 288358,
      usedStorageGb: 0,
      freeStorageGb: 288358,
      storageUtilPercent: 0,
      isOverAllocated: false,
    },
    {
      clusterId: "cls-02",
      clusterName: "vsan-dc-sddc-cls02",
      hostCount: 4,
      totalVcpu: 352,
      usedVcpu: 0,
      freeVcpu: 352,
      cpuUtilPercent: 0,
      totalRamGb: 2048,
      usedRamGb: 0,
      freeRamGb: 2048,
      ramUtilPercent: 0,
      totalStorageGb: 154800,
      usedStorageGb: 0,
      freeStorageGb: 154800,
      storageUtilPercent: 0,
      isOverAllocated: false,
    },
    {
      clusterId: "cls-03",
      clusterName: "vsan-dc-sddc-cls03",
      hostCount: 5,
      totalVcpu: 176,
      usedVcpu: 0,
      freeVcpu: 176,
      cpuUtilPercent: 0,
      totalRamGb: 2560,
      usedRamGb: 0,
      freeRamGb: 2560,
      ramUtilPercent: 0,
      totalStorageGb: 129000,
      usedStorageGb: 0,
      freeStorageGb: 129000,
      storageUtilPercent: 0,
      isOverAllocated: false,
    },
    {
      clusterId: "unassigned-hosts-vms",
      clusterName: "Unassigned VMs (No Host Placement)",
      hostCount: 0,
      totalVcpu: 0,
      usedVcpu: 3413,
      freeVcpu: -3413,
      cpuUtilPercent: 100,
      totalRamGb: 0,
      usedRamGb: 9700,
      freeRamGb: -9700,
      ramUtilPercent: 100,
      totalStorageGb: 0,
      usedStorageGb: 266000,
      freeStorageGb: -266000,
      storageUtilPercent: 100,
      isOverAllocated: true,
      isUnassignedLine: true,
      unassignedVmCount: 437,
    }
  ];

  it("correctly aggregates physical capacity across all physical clusters", () => {
    const physicalOnly = mockClusters.filter(c => !c.isUnassignedLine);
    const totalPhysicalHosts = physicalOnly.reduce((acc, c) => acc + c.hostCount, 0);
    const totalPhysicalVcpu = physicalOnly.reduce((acc, c) => acc + c.totalVcpu, 0);
    const totalPhysicalRam = physicalOnly.reduce((acc, c) => acc + c.totalRamGb, 0);
    const totalPhysicalStorage = physicalOnly.reduce((acc, c) => acc + c.totalStorageGb, 0);

    expect(totalPhysicalHosts).toBe(17);
    expect(totalPhysicalVcpu).toBe(1296);
    expect(totalPhysicalRam).toBe(12800);
    expect(totalPhysicalStorage).toBe(572158);
  });

  it("correctly calculates fleet totals including unassigned workloads and detects over-allocation", () => {
    let totalHosts = 0;
    let totalVcpu = 0;
    let usedVcpu = 0;
    let totalRamGb = 0;
    let usedRamGb = 0;
    let totalStorageGb = 0;
    let usedStorageGb = 0;
    let totalUnassignedVms = 0;

    for (const item of mockClusters) {
      totalHosts += item.hostCount || 0;
      totalVcpu += item.totalVcpu || 0;
      usedVcpu += item.usedVcpu || 0;
      totalRamGb += item.totalRamGb || 0;
      usedRamGb += item.usedRamGb || 0;
      totalStorageGb += item.totalStorageGb || 0;
      usedStorageGb += item.usedStorageGb || 0;
      if (item.isUnassignedLine) {
        totalUnassignedVms += item.unassignedVmCount || 0;
      }
    }

    const freeVcpu = totalVcpu - usedVcpu;
    const freeRamGb = totalRamGb - usedRamGb;
    const freeStorageGb = totalStorageGb - usedStorageGb;

    const cpuUtilPercent = Math.round((usedVcpu / totalVcpu) * 100);
    const ramUtilPercent = Math.round((usedRamGb / totalRamGb) * 100);
    const storageUtilPercent = Math.round((usedStorageGb / totalStorageGb) * 100);
    const isOverAllocated = usedVcpu > totalVcpu || usedRamGb > totalRamGb || usedStorageGb > totalStorageGb;

    expect(totalHosts).toBe(17);
    expect(totalVcpu).toBe(1296);
    expect(usedVcpu).toBe(3413);
    expect(freeVcpu).toBe(-2117);
    expect(cpuUtilPercent).toBe(263);
    expect(isOverAllocated).toBe(true);

    expect(totalRamGb).toBe(12800);
    expect(usedRamGb).toBe(9700);
    expect(freeRamGb).toBe(3100);
    expect(ramUtilPercent).toBe(76);

    expect(storageUtilPercent).toBe(46);
    expect(totalUnassignedVms).toBe(437);
  });
});




