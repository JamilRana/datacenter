// src/app/reports/components/tables/CapacityTable.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { 
  Loader2, 
  Download, 
  Activity,
  Database,
  RefreshCw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { getDcCapacityReport } from "@/app/actions/report-tabular-actions";
import { DcCapacityItem } from "@/types/reports";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export function CapacityTable(_props: { dateRange?: { from: Date; to: Date } }) {
  const [data, setData] = useState<DcCapacityItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    setLoading(true);
    try {
      const result = await getDcCapacityReport();
      setData(result.data);
    } catch (error) {
      console.error("Failed to load DC capacity report", error);
    } finally {
      setLoading(false);
    }
  }

  const getPercentageColor = (percent: number) => {
    if (percent >= 90) return "bg-rose-500";
    if (percent >= 70) return "bg-amber-500";
    return "bg-emerald-500";
  };

  const getPercentageText = (percent: number) => {
    if (percent >= 90) return "text-rose-600 font-bold";
    if (percent >= 70) return "text-amber-600 font-bold";
    return "text-emerald-600 font-bold";
  };

  const handleExport = (formatType: 'xlsx' | 'csv') => {
    const dataToExport = data.map(item => ({
      "Cluster Name": item.clusterName,
      "Total vCPU": item.totalVcpu,
      "Used vCPU": item.usedVcpu,
      "Free vCPU": item.freeVcpu,
      "% CPU Used": `${Math.round((item.usedVcpu / (item.totalVcpu || 1)) * 100)}%`,
      "Total RAM (GB)": item.totalRamGb,
      "Used RAM (GB)": item.usedRamGb,
      "Free RAM (GB)": item.freeRamGb,
      "% RAM Used": `${Math.round((item.usedRamGb / (item.totalRamGb || 1)) * 100)}%`,
      "Total Storage (GB)": item.totalStorageGb,
      "Used Storage (GB)": item.usedStorageGb,
      "Free Storage (GB)": item.freeStorageGb,
      "% Storage Used": `${Math.round((item.usedStorageGb / (item.totalStorageGb || 1)) * 100)}%`,
      "Last Synced": format(new Date(item.lastSynced), "yyyy-MM-dd HH:mm")
    }));
    
    if (formatType === 'xlsx') {
      exportToExcel('DC_Capacity_Report', dataToExport);
    } else {
      exportToCSV('DC_Capacity_Report', dataToExport);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex flex-col">
        <div className="p-4 border-b border-slate-100 bg-slate-50/50 flex flex-row justify-between items-center">
          <div className="flex items-center gap-2">
            <Activity className="text-indigo-600" size={20} />
            <h3 className="font-bold text-slate-800">Cluster Capacity Breakdown</h3>
          </div>
          <div className="flex gap-2">
             <Button size="sm" variant="outline" className="h-9 gap-2 font-medium" onClick={() => handleExport('xlsx')}>
                <Download size={16} /> XLSX
              </Button>
              <Button size="sm" variant="outline" className="h-9 gap-2 font-medium" onClick={() => handleExport('csv')}>
                <Download size={16} /> CSV
              </Button>
              <Button size="sm" variant="ghost" className="h-9 w-9 p-0" onClick={loadData}>
                <RefreshCw size={16} className={cn(loading && "animate-spin")} />
              </Button>
          </div>
        </div>

        <div className="relative overflow-x-auto">
          {loading ? (
            <div className="flex flex-col items-center justify-center p-20 gap-3">
              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
              <p className="text-slate-400 font-bold text-[10px]">Analyzing cluster resources...</p>
            </div>
          ) : data.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-20 opacity-40">
              <Database size={48} className="mb-4 text-indigo-200" />
              <p className="text-xl font-semibold">No cluster data available</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50/80 sticky top-0 z-10 border-b">
                <TableRow>
                  <TableHead className="font-bold border-r">Cluster Name</TableHead>
                  <TableHead className="font-bold text-center border-r" colSpan={3}>vCPU Optimization</TableHead>
                  <TableHead className="font-bold text-center border-r" colSpan={3}>RAM Usage (GB)</TableHead>
                  <TableHead className="font-bold text-center border-r" colSpan={3}>Storage Usage (GB)</TableHead>
                  <TableHead className="font-bold">Last Synced</TableHead>
                </TableRow>
                <TableRow className="bg-slate-50/30">
                  <TableHead></TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400">Used</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400">Total</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400 border-r">Utilization</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400">Used</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400">Total</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400 border-r">Utilization</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400">Used</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400">Total</TableHead>
                  <TableHead className="text-[10px] font-bold uppercase text-slate-400 border-r">Utilization</TableHead>
                  <TableHead></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.map((cluster) => {
                  const cpuPercent = Math.round((cluster.usedVcpu / (cluster.totalVcpu || 1)) * 100);
                  const ramPercent = Math.round((cluster.usedRamGb / (cluster.totalRamGb || 1)) * 100);
                  const storagePercent = Math.round((cluster.usedStorageGb / (cluster.totalStorageGb || 1)) * 100);

                  return (
                    <TableRow key={cluster.assetId} className="hover:bg-slate-50 border-slate-100">
                      <TableCell className="font-bold text-slate-900 border-r py-5">
                        <div className="flex flex-col">
                          {cluster.clusterName}
                          <span className="text-[10px] text-indigo-600/60 font-mono tracking-tighter uppercase">{cluster.assetId.slice(0,8)}</span>
                        </div>
                      </TableCell>
                      
                      {/* vCPU */}
                      <TableCell className="font-medium text-slate-600">{cluster.usedVcpu}</TableCell>
                      <TableCell className="text-slate-400">{cluster.totalVcpu}</TableCell>
                      <TableCell className="border-r">
                        <div className="w-24 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className={getPercentageText(cpuPercent)}>{cpuPercent}%</span>
                            <span className="text-slate-400">{cluster.freeVcpu} Free</span>
                          </div>
                          <Progress value={cpuPercent} className="h-1.5" indicatorClassName={getPercentageColor(cpuPercent)} />
                        </div>
                      </TableCell>

                      {/* RAM */}
                      <TableCell className="font-medium text-slate-600">{cluster.usedRamGb}</TableCell>
                      <TableCell className="text-slate-400">{cluster.totalRamGb}</TableCell>
                      <TableCell className="border-r">
                        <div className="w-24 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className={getPercentageText(ramPercent)}>{ramPercent}%</span>
                            <span className="text-slate-400">{cluster.freeRamGb} Free</span>
                          </div>
                          <Progress value={ramPercent} className="h-1.5" indicatorClassName={getPercentageColor(ramPercent)} />
                        </div>
                      </TableCell>

                      {/* Storage */}
                      <TableCell className="font-medium text-slate-600">{cluster.usedStorageGb}</TableCell>
                      <TableCell className="text-slate-400">{cluster.totalStorageGb}</TableCell>
                      <TableCell className="border-r">
                        <div className="w-24 flex flex-col gap-1.5">
                          <div className="flex justify-between items-center text-[10px]">
                            <span className={getPercentageText(storagePercent)}>{storagePercent}%</span>
                            <span className="text-slate-400">{cluster.freeStorageGb} Free</span>
                          </div>
                          <Progress value={storagePercent} className="h-1.5" indicatorClassName={getPercentageColor(storagePercent)} />
                        </div>
                      </TableCell>

                      <TableCell className="text-[11px] text-slate-400 italic">
                        {format(new Date(cluster.lastSynced), "HH:mm:ss")}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </div>
      </div>
    </div>
  );
}
