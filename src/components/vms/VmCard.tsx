// src/app/components/vms/VmCard.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import DecommissionModal from "./DecommissionModal";
import { RenewButton } from "@/app/requests/components/RenewButton";
import { VmInstance } from "@/types/vm";

interface VmCardProps {
  vm: VmInstance & {
    currentSpec: {
      vcpu: number;
      ramGb: number;
      storageGb: number;
    } | null;
    owner: { name: string } | null;
    request: { systemName: string; environment: string } | null;
  };
}

export default function VmCard({ vm }: VmCardProps) {
  const [isDecommissionOpen, setIsDecommissionOpen] = useState(false);

  const getStatusColor = (status: VmInstance["status"]) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800";
      case "RETIRED":
        return "bg-gray-100 text-gray-800";
    }
  };

  const getEnvironmentColor = (env: string) => {
    switch (env) {
      case "PRODUCTION":
        return "bg-red-100 text-red-800";
      case "STAGING":
        return "bg-blue-100 text-blue-800";
      case "DEVELOPMENT":
      case "TESTING":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  return (
    <div className="bg-white rounded-xl border p-5 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-semibold text-gray-900 truncate">
            {vm.request?.systemName || "Unnamed VM"}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            {vm.hostname || vm.ipAddress || "No IP"}
          </p>
        </div>
        <span
          className={`text-xs px-2 py-1 rounded-full ${getStatusColor(
            vm.status
          )}`}
        >
          {vm.status}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {vm.request?.environment && (
          <span
            className={`text-xs px-2 py-1 rounded-full ${getEnvironmentColor(
              vm.request.environment
            )}`}
          >
            {vm.request.environment}
          </span>
        )}
        {vm.owner && (
          <span className="text-xs bg-indigo-100 text-indigo-800 px-2 py-1 rounded-full">
            Owner: {vm.owner.name}
          </span>
        )}
      </div>

      {/* Resources */}
      {vm.currentSpec && (
        <div className="mt-4 text-sm text-gray-700 space-y-1">
          <div>
            💻 {vm.currentSpec.vcpu} vCPU • {vm.currentSpec.ramGb} GB RAM
          </div>
          <div>💾 {vm.currentSpec.storageGb} GB Storage</div>
          {vm.publicIpAddress && <div>🌐 Public IP: {vm.publicIpAddress}</div>}
        </div>
      )}

      {/* Actions */}
      <div className="mt-4 flex gap-2">
        <Link
          href={`/inventory/vms/${vm.id}`}
          className="flex-1 text-center text-sm font-semibold bg-blue-50 text-blue-700 py-1.5 rounded-lg hover:bg-blue-100"
        >
          Customize
        </Link>
        {vm.status !== "RETIRED" && (
<RenewButton vmId={vm.id} />
        )}
        <Link
          href={`/inventory/vms/${vm.id}`}
          className="flex-1 text-center text-sm bg-indigo-50 font-semibold text-indigo-700 py-1.5 rounded-lg hover:bg-indigo-100"
        >
          Details
        </Link>
        {vm.status !== "RETIRED" && (
          <button
            onClick={() => setIsDecommissionOpen(true)}
            className="flex-1 text-center text-sm font-semibold bg-red-50 text-red-700 py-1.5 rounded-lg hover:bg-red-100"
          >
            Decommission
          </button>
        )}
      </div>

      {/* Decommission Modal */}
      <DecommissionModal
        isOpen={isDecommissionOpen}
        onClose={() => setIsDecommissionOpen(false)}
        vmId={vm.id}
      />
    </div>
  );
}
