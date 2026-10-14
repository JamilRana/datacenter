// src/lib/reports/spec-resolver.ts

export interface ResolvedVmSpecs {
  vcpu: number;
  ramGb: number;
  storageGb: number;
  os: string;
  source: "currentSpec" | "specHistory" | "vmSpecification" | "request" | "missing";
  isMissing: boolean;
}

export function resolveVmResourceSpecs(vm: {
  currentSpec?: {
    vcpu?: number | null;
    ramGb?: number | null;
    storageGb?: number | null;
    osName?: string | null;
    osVersion?: string | null;
  } | null;
  specHistory?: {
    vcpu: number;
    ramGb: number;
    storageGb: number;
    osName?: string | null;
    osVersion?: string | null;
  }[] | null;
  sequenceNumber?: number | null;
  request?: {
    vcpu?: number | null;
    ramGb?: number | null;
    storageGb?: number | null;
    osName?: string | null;
    osVersion?: string | null;
    vmSpecifications?: {
      vcpu: number;
      ramGb: number;
      storageGb: number;
    }[] | null;
  } | null;
}): ResolvedVmSpecs {
  // 1. currentSpec
  if (vm.currentSpec && (vm.currentSpec.vcpu || vm.currentSpec.ramGb || vm.currentSpec.storageGb)) {
    const os = `${vm.currentSpec.osName || ""} ${vm.currentSpec.osVersion || ""}`.trim() || "N/A";
    return {
      vcpu: vm.currentSpec.vcpu || 0,
      ramGb: vm.currentSpec.ramGb || 0,
      storageGb: vm.currentSpec.storageGb || 0,
      os,
      source: "currentSpec",
      isMissing: false,
    };
  }

  // 2. latest VmSpec from specHistory
  if (vm.specHistory && vm.specHistory.length > 0) {
    const latest = vm.specHistory[0];
    if (latest && (latest.vcpu || latest.ramGb || latest.storageGb)) {
      const os = `${latest.osName || ""} ${latest.osVersion || ""}`.trim() || "N/A";
      return {
        vcpu: latest.vcpu || 0,
        ramGb: latest.ramGb || 0,
        storageGb: latest.storageGb || 0,
        os,
        source: "specHistory",
        isMissing: false,
      };
    }
  }

  // 3. VmSpecification on Request
  if (vm.request?.vmSpecifications && vm.request.vmSpecifications.length > 0) {
    const matchedSpec = vm.request.vmSpecifications[0];
    if (matchedSpec && (matchedSpec.vcpu || matchedSpec.ramGb || matchedSpec.storageGb)) {
      const os = `${vm.request.osName || ""} ${vm.request.osVersion || ""}`.trim() || "N/A";
      return {
        vcpu: matchedSpec.vcpu || 0,
        ramGb: matchedSpec.ramGb || 0,
        storageGb: matchedSpec.storageGb || 0,
        os,
        source: "vmSpecification",
        isMissing: false,
      };
    }
  }

  // 4. Request-level specs
  if (vm.request && (vm.request.vcpu || vm.request.ramGb || vm.request.storageGb)) {
    const os = `${vm.request.osName || ""} ${vm.request.osVersion || ""}`.trim() || "N/A";
    return {
      vcpu: vm.request.vcpu || 0,
      ramGb: vm.request.ramGb || 0,
      storageGb: vm.request.storageGb || 0,
      os,
      source: "request",
      isMissing: false,
    };
  }

  // 5. Fallthrough: missing spec
  return {
    vcpu: 0,
    ramGb: 0,
    storageGb: 0,
    os: "N/A",
    source: "missing",
    isMissing: true,
  };
}
