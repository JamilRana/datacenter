// src/app/inventory/vms/page.tsx
import { Suspense } from "react";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import VmCard from "./components/VmCard";
import VmFilters from "./components/VmFilters";
import { fetchAllVms } from "@/app/actions/vm-actions"; // ✅ removed prisma import
import { VmStatus } from "@prisma/client";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";

const ITEMS_PER_PAGE = 10;

export default async function VmsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const search = (searchParams?.search as string) || "";
  const page = Number(searchParams?.page) || 1;
  const statusFilter = (searchParams?.status as VmStatus | "all") || "all";

  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth");
  }

  // ✅ PASS AS SINGLE OBJECT
  const { vms, totalPages, total } = await fetchAllVms({
    page,
    perPage: ITEMS_PER_PAGE,
    search,
    statusFilter,
    userId: session.user.id,
    role: session.user.role,
  });

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Virtual Machines</h1>
        <SearchBar />
      </div>

      {/* Filters */}
      <VmFilters currentStatus={statusFilter} />

      {/* VM Grid */}
      {vms.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          No virtual machines found.
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {vms.map((vm) => (
            <VmCard key={vm.id} vm={vm} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
