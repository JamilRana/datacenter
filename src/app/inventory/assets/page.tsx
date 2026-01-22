// src/app/inventory/assets/page.tsx
import { Suspense } from "react";
import { SearchBar } from "@/components/SearchBar";
import { Pagination } from "@/components/Pagination";
import AssetList from "./components/AssetList";
import AssetSummary from "./components/AssetSummary";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client"; // 👈 Import Prisma

const ITEMS_PER_PAGE = 10;

export default async function AssetsPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const search = (searchParams?.search as string) || "";
  const page = Number(searchParams?.page) || 1;
  const skip = (page - 1) * ITEMS_PER_PAGE;

  // ✅ Correct Prisma where input with typed QueryMode
  const where: Prisma.AssetWhereInput = search
    ? {
        OR: [
          { name: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { vendor: { contains: search, mode: Prisma.QueryMode.insensitive } },
          { model: { contains: search, mode: Prisma.QueryMode.insensitive } },
        ],
      }
    : {};

  const [assets, totalAssets] = await Promise.all([
    prisma.asset.findMany({
      where,
      skip,
      take: ITEMS_PER_PAGE,
      orderBy: { name: "asc" },
    }),
    prisma.asset.count({ where }),
  ]);

  const totalPages = Math.ceil(totalAssets / ITEMS_PER_PAGE);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Hardware Inventory</h1>
        <SearchBar />
      </div>

      <Suspense fallback={<div>Loading summary...</div>}>
        <AssetSummary assets={assets} />
      </Suspense>

      <AssetList assets={assets} />

      {totalPages > 1 && (
        <div className="mt-8 flex justify-center">
          <Pagination totalPages={totalPages} />
        </div>
      )}
    </div>
  );
}
