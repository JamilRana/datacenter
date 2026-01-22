// Only accessible to roles: DEPLOYER, DC_OPS
"use client";
import { useEffect, useState } from "react";
import { getPendingRequests } from "@/app/actions/deploy-actions";
import Link from "next/link";

export default function PendingRequestsPage() {
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    getPendingRequests().then(setRequests);
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Pending Provisioning</h1>
      <div className="space-y-2">
        {requests.map((req) => (
          <Link
            key={req.id}
            href={`/deploy/${req.id}`}
            className="block p-4 border rounded hover:bg-muted"
          >
            {req.systemName} ({req.quantity} VMs) — {req.environment}
          </Link>
        ))}
      </div>
    </div>
  );
}
