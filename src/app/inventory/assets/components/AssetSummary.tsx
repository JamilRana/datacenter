// src/app/inventory/assets/components/AssetSummary.tsx
"use client";

interface Asset {
  type: string;
  cpuCores: number | null;
  ramGb: number | null;
  capacityTb: number | null;
}


export default function AssetSummary({ assets }: { assets: Asset[] }) {
  // Compute totals
  const totalAssets = assets.length;
  const totalCpu = assets.reduce((sum, a) => sum + (a.cpuCores || 0), 0);
  const totalRam = assets.reduce((sum, a) => sum + (a.ramGb || 0), 0);
  const totalStorage = assets.reduce((sum, a) => sum + (a.capacityTb || 0), 0);
  const totalCapacity = assets.reduce((sum, a) => sum + (a.capacityTb || 0), 0);

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
      <SummaryCard title="Total Assets" value={totalAssets} />
      <SummaryCard title="Total CPU Cores" value={totalCpu} />
      <SummaryCard title="Total RAM (GB)" value={totalRam} />
      <SummaryCard title="Storage (GB)" value={totalStorage} />
      <SummaryCard title="Capacity (TB)" value={totalCapacity} unit="TB" />
    </div>
  );
}

function SummaryCard({
  title,
  value,
  unit = "",
}: {
  title: string;
  value: number;
  unit?: string;
}) {
  return (
    <div className="bg-white rounded-xl border p-4 shadow-sm">
      <p className="text-sm text-gray-600">{title}</p>
      <p className="text-2xl font-bold text-gray-900 mt-1">
        {value}
        {unit && <span className="text-sm font-normal ml-1">{unit}</span>}
      </p>
    </div>
  );
}
