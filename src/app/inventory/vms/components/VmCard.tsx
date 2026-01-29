// src/app/inventory/vms/components/VmCard.tsx
"use client";

import { VmInstance } from "@prisma/client";
import Link from "next/link";
import { RenewButton } from "@/app/requests/components/RenewButton";
import { Settings, Trash2, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";

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
      <div className="mt-4 grid grid-cols-2 gap-2">
        <Button asChild variant="outline" size="sm" className="bg-blue-50 text-blue-700 border-blue-100 hover:bg-blue-100">
          <Link href={`/requests/customize?vmId=${vm.id}`}>
            <Settings className="h-3.5 w-3.5 mr-1.5" /> Customize
          </Link>
        </Button>
        
        <Button asChild variant="outline" size="sm" className="bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100">
          <Link href={`/inventory/vms/${vm.id}`}>
            <Eye className="h-3.5 w-3.5 mr-1.5" /> Details
          </Link>
        </Button>

        {vm.status !== "RETIRED" && (
          <Button asChild variant="outline" size="sm" className="bg-red-50 text-red-700 border-red-100 hover:bg-red-100">
            <Link href={`/requests/decommission?vmId=${vm.id}`}>
              <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Decommission
            </Link>
          </Button>
        )}

        {vm.status !== "RETIRED" && (
           <RenewButton vmId={vm.id} />
        )}
      </div>
    </div>
  );
}
