// src/app/inventory/vms/[id]/page.tsx
import { notFound } from "next/navigation";
import { fetchVmDetails } from "@/app/actions/vm-actions";
import Link from "next/link";
import { format } from "date-fns";
import { Badge } from "../components/Badge";

export default async function VmDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const vm = await fetchVmDetails(params.id);

  if (!vm) {
    notFound();
  }

  // Get status color for badge
  const getStatusColor = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return "bg-green-100 text-green-800";
      case "SUSPENDED":
        return "bg-yellow-100 text-yellow-800";
      case "RETIRED":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  // Get environment color
  const getEnvColor = (env: string) => {
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
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">
            {vm.request?.systemName || "Unnamed VM"}
          </h1>
          <div className="flex flex-wrap gap-2 mt-2">
            <Badge color={getStatusColor(vm.status)}>{vm.status}</Badge>
            {vm.request?.environment && (
              <Badge color={getEnvColor(vm.request.environment)}>
                {vm.request.environment}
              </Badge>
            )}
            {vm.owner && (
              <span className="text-sm text-gray-600">
                Owner: {vm.owner.name}
              </span>
            )}
          </div>
        </div>

        <div className="flex gap-3">
          <Link
            href="/inventory/vms"
            className="px-4 py-2 bg-gray-200 text-gray-800 rounded-lg hover:bg-gray-300"
          >
            Back to List
          </Link>
          {vm.status !== "RETIRED" && (
            <Link
              href={`/requests/customizations/new?vmId=${vm.id}`}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              Request Change
            </Link>
          )}
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - VM Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Basic Info */}
          <section className="bg-white rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">VM Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <InfoItem label="Hostname" value={vm.hostname || "—"} />
              <InfoItem label="IP Address" value={vm.ipAddress || "—"} />
              <InfoItem label="Public IP" value={vm.publicIpAddress || "—"} />
              <InfoItem label="Subdomain" value={vm.subdomain || "—"} />
              <InfoItem
                label="Created"
                value={format(new Date(vm.createdAt), "PPP")}
              />
              <InfoItem
                label="Last Updated"
                value={format(new Date(vm.updatedAt), "PPP")}
              />
              {vm.provisionedAt && (
                <InfoItem
                  label="Provisioned"
                  value={format(new Date(vm.provisionedAt), "PPP")}
                />
              )}
              {vm.renewalDate && (
                <InfoItem
                  label="Renewal Date"
                  value={format(new Date(vm.renewalDate), "PPP")}
                />
              )}
              {vm.decommissionedAt && (
                <InfoItem
                  label="Decommissioned"
                  value={format(new Date(vm.decommissionedAt), "PPP")}
                />
              )}
            </div>
          </section>

          {/* Current Resources */}
          {vm.currentSpec && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">Current Resources</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4">
                <ResourceCard
                  title="vCPU"
                  value={vm.currentSpec.vcpu}
                  unit="cores"
                />
                <ResourceCard
                  title="RAM"
                  value={vm.currentSpec.ramGb}
                  unit="GB"
                />
                <ResourceCard
                  title="Storage"
                  value={vm.currentSpec.storageGb}
                  unit="GB"
                />
                <ResourceCard
                  title="RAID"
                  value={vm.currentSpec.raid || "None"}
                  unit=""
                />
              </div>
            </section>
          )}

          {/* Customization Requests */}
          {vm.customizationRequests.length > 0 && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">
                Pending Customization Requests (
                {vm.customizationRequests.length})
              </h2>
              <div className="space-y-3">
                {vm.customizationRequests.map((req) => (
                  <div
                    key={req.id}
                    className="border-l-4 border-indigo-500 pl-4 py-2"
                  >
                    <div className="flex justify-between">
                      <span className="font-medium">
                        {req.vcpu && `vCPU: ${req.vcpu} `}
                        {req.ramGb && `RAM: ${req.ramGb}GB `}
                        {req.storageGb && `Storage: ${req.storageGb}GB`}
                      </span>
                      <span className="text-sm text-gray-600">
                        {format(new Date(req.createdAt), "MMM d, yyyy")}
                      </span>
                    </div>
                    <div className="text-sm text-gray-600 mt-1">
                      Status: <span className="font-medium">{req.status}</span>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        {/* Right Column - Audit Logs & Request Info */}
        <div className="space-y-6">
          {/* Request Info */}
          {vm.request && (
            <section className="bg-white rounded-xl border p-5 shadow-sm">
              <h2 className="text-lg font-semibold mb-4">
                Request Information
              </h2>
              <div className="space-y-3">
                <InfoItem label="System Name" value={vm.request.systemName} />
                <InfoItem label="Environment" value={vm.request.environment} />
                <InfoItem label="Purpose" value={vm.request.purpose || "—"} />
                {vm.request.requestId && (
                  <InfoItem label="Request ID" value={vm.request.requestId} />
                )}
                <div>
                  <span className="text-sm font-medium text-gray-700">
                    Requester
                  </span>
                  <div className="mt-1 text-sm">
                    {vm.request.requester?.name || "—"}
                    {vm.request.requester?.email && (
                      <div className="text-gray-600">
                        {vm.request.requester.email}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </section>
          )}

          {/* Audit Logs */}
          <section className="bg-white rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Recent Activity</h2>
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {/* In a real app, you'd fetch these separately */}
              <div className="text-sm text-gray-600 italic">
                Audit logs would appear here
              </div>
            </div>
          </section>

          {/* Actions */}
          <section className="bg-white rounded-xl border p-5 shadow-sm">
            <h2 className="text-lg font-semibold mb-4">Actions</h2>
            <div className="space-y-3">
              <button className="w-full text-left px-3 py-2 text-indigo-600 hover:bg-indigo-50 rounded-lg">
                Edit VM Details
              </button>
              {vm.status !== "RETIRED" && (
                <button className="w-full text-left px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg">
                  Decommission VM
                </button>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

// Reusable components
function InfoItem({
  label,
  value,
}: {
  label: string;
  value: string | null | undefined;
}) {
  return (
    <div>
      <span className="text-sm font-medium text-gray-700">{label}</span>
      <div className="mt-1 text-sm">{value || "—"}</div>
    </div>
  );
}

function ResourceCard({
  title,
  value,
  unit,
}: {
  title: string;
  value: number | string;
  unit: string;
}) {
  return (
    <div className="bg-gray-50 rounded-lg p-4 text-center">
      <div className="text-2xl font-bold text-gray-900">{value}</div>
      <div className="text-sm text-gray-600 mt-1">
        {title} {unit}
      </div>
    </div>
  );
}
