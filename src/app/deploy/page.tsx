// src/app/deploy/page.tsx
"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { getDeployRequests } from "@/app/actions/deploy-actions";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";

const ITEMS_PER_PAGE = 20;

type RequestStatusFilter = "PENDING" | "PROVISIONED" | "ALL";

export default function DeployDashboard() {
  const searchParams = useSearchParams();
  const filter = (searchParams.get("filter") as RequestStatusFilter) || "PENDING";
  const searchTerm = searchParams.get("search") || "";
  const page = Math.max(1, parseInt(searchParams.get("page") || "1", 10));

  const [requests, setRequests] = useState<any[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [pendingCount, setPendingCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getDeployRequests({ filter, searchTerm, page, itemsPerPage: ITEMS_PER_PAGE })
      .then(({ data, totalPages: tp, pendingCount: pc }) => {
        setRequests(data);
        setTotalPages(tp);
        setPendingCount(pc);
      })
      .finally(() => setLoading(false));
  }, [filter, searchTerm, page]);

  if (loading) return <div className="p-6">Loading...</div>;

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Deployment Dashboard</h1>

      <div className="mb-6">
        <SearchBar />
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6 border-b pb-2">
        {([
          { key: "PENDING", label: `Pending (${pendingCount})`, color: "blue" },
          { key: "PROVISIONED", label: "Provisioned", color: "green" },
          { key: "ALL", label: "All", color: "gray" },
        ] as const).map(({ key, label, color }) => (
          <Link
            key={key}
            href={`?filter=${key}`}
            className={`px-4 py-2 text-sm font-medium rounded-full whitespace-nowrap ${
              filter === key
                ? `bg-${color}-50 text-${color}-700`
                : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            {label}
          </Link>
        ))}
      </div>

      {/* Results */}
      {requests.length === 0 ? (
        <p className="text-gray-500">
          No {filter === "ALL" ? "" : `${filter.toLowerCase()} `}requests found.
        </p>
      ) : (
        <>
          <div className="space-y-4">
            {requests.map((req) => (
              <Link
                key={req.id}
                href={`/deploy/${req.id}`}
                className="block p-4 border rounded-lg hover:shadow transition-shadow"
              >
                <div className="flex justify-between">
                  <div>
                    <h3 className="font-semibold">{req.systemName}</h3>
                    <p className="text-gray-600">
                      {req.quantity} VM(s) • {req.environment}
                    </p>
                    <p className="text-sm text-gray-500">
                      Submitted: {new Date(req.submittedAt).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <span
                      className={`px-2 py-1 rounded-full text-xs font-medium ${
                        req.status === "APPROVED"
                          ? "bg-blue-100 text-blue-800"
                          : req.status === "PROVISIONED"
                          ? "bg-green-100 text-green-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {req.status === "APPROVED" ? "Pending Provisioning" : "Provisioned"}
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {totalPages > 1 && (
            <div className="mt-6">
              <Pagination totalPages={totalPages} />
            </div>
          )}
        </>
      )}
    </div>
  );
}