// app/inventory/licenses/page.tsx
import { fetchLicenseDetails } from "@/app/actions/license-actions";
import { Suspense } from "react";
import LicenseFilters from "./components/LicenseFilters";
import { Pagination } from "@/components/Pagination";
import LicenseList from "./components/LicenseList";
import CreateLicenseModal from "./components/CreateLicenseModal";

interface Props {
  searchParams?: { [key: string]: string | undefined };
}

export default async function LicensesPage({ searchParams }: Props) {
  const page = Number(searchParams?.page) || 1;
  const search = searchParams?.search || undefined;
  const type = searchParams?.type || undefined;

  const { licenses, totalPages, currentPage, total } =
    await fetchLicenseDetails(page, search, type);

  return (
    <div className="p-4 sm:p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
          Software Licenses
        </h1>
        <p className="text-gray-600 mt-1">
          Manage {total} software license{total !== 1 ? "s" : ""}
        </p>
        <CreateLicenseModal />
      </div>

      <Suspense
        key={`filters-${search}-${type}`}
        fallback={<div>Loading filters...</div>}
      >
        <LicenseFilters search={search} type={type} />
      </Suspense>

      <Suspense
        key={`cards-${page}-${search}-${type}`}
        fallback={<div>Loading licenses...</div>}
      >
        <LicenseList licenses={licenses} />
      </Suspense>

      {totalPages > 1 && (
        <div className="mt-8">
          <Pagination totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
