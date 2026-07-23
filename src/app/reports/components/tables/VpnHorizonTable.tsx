"use client";

import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { 
  Search, 
  Loader2, 
  User, 
  Calendar,
  AlertCircle,
  FileSpreadsheet
} from "lucide-react";
import { getVpnHorizonReportData, type VpnHorizonReportItem } from "@/app/actions/report-actions";
import { format } from "date-fns";

export function VpnHorizonTable({ dateRange }: { dateRange: { from: Date; to: Date } }) {
  const [data, setData] = useState<VpnHorizonReportItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const res = await getVpnHorizonReportData();
        if (res.success && res.data) {
          // Filter by dateRange on client side or take the returned dataset
          const filtered = res.data.filter(item => {
            const date = new Date(item.createdAt);
            return date >= dateRange.from && date <= dateRange.to;
          });
          setData(filtered);
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [dateRange]);

  const filteredData = data.filter(item => 
    item.systemName.toLowerCase().includes(search.toLowerCase()) ||
    (item.projectName && item.projectName.toLowerCase().includes(search.toLowerCase())) ||
    item.requesterName.toLowerCase().includes(search.toLowerCase()) ||
    item.requesterOrg?.toLowerCase().includes(search.toLowerCase()) ||
    (item.targetVmName && item.targetVmName.toLowerCase().includes(search.toLowerCase()))
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[300px]">
        <Loader2 className="h-8 w-8 animate-spin text-indigo-650" />
      </div>
    );
  }

  return (
    <div className="space-y-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <Input
            placeholder="Search by system, requester, department, VM..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9 h-10 bg-slate-50/50 border-slate-100 focus:bg-white focus:ring-indigo-500"
          />
        </div>
        <div className="text-xs text-slate-500 font-semibold flex items-center gap-1">
          <FileSpreadsheet className="h-4 w-4 text-slate-400" />
          Showing {filteredData.length} active allocation records
        </div>
      </div>

      <div className="overflow-x-auto border border-slate-100 rounded-xl">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-100">
            <tr>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">System / Project</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Type</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Requester</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Target VM & IP</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Date Granted</th>
              <th className="px-6 py-4 text-xs font-bold text-slate-500 uppercase tracking-wider">Status</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-400">
                  <div className="flex flex-col items-center gap-2">
                    <AlertCircle className="h-6 w-6 text-slate-300" />
                    <p className="text-sm font-semibold">No VPN/Horizon allocations found</p>
                  </div>
                </td>
              </tr>
            ) : (
              filteredData.map((item) => (
                <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900 text-sm">{item.systemName}</span>
                      <span className="text-xs text-slate-400 mt-0.5">{item.projectName || "No Project"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={
                      item.requestType === "VPN_ACCESS"
                        ? "bg-purple-100 text-purple-700 hover:bg-purple-100 border-none font-bold text-[10px]"
                        : "bg-blue-100 text-blue-700 hover:bg-blue-100 border-none font-bold text-[10px]"
                    }>
                      {item.requestType === "VPN_ACCESS" ? "VPN Access" : "Horizon Client"}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2.5">
                      <div className="h-7 w-7 rounded-full bg-slate-100 flex items-center justify-center flex-shrink-0">
                        <User className="h-3.5 w-3.5 text-slate-500" />
                      </div>
                      <div className="flex flex-col">
                        <span className="font-semibold text-slate-800 text-xs">{item.requesterName}</span>
                        <span className="text-[10px] text-slate-400">{item.requesterOrg || "N/A"}</span>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs">
                    <div className="flex flex-col">
                      <span className="font-semibold text-slate-800">{item.targetVmName || "N/A"}</span>
                      <span className="text-slate-400 mt-0.5">{item.targetVmIp || "N/A"}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs text-slate-500">
                    <span className="flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-slate-400" />
                      {format(new Date(item.createdAt), "MMM dd, yyyy")}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge className={
                      item.status === "PROVISIONED"
                        ? "bg-green-100 text-green-700 hover:bg-green-100 border-none font-black text-[9px] uppercase tracking-tighter"
                        : "bg-amber-100 text-amber-700 hover:bg-amber-100 border-none font-black text-[9px] uppercase tracking-tighter"
                    }>
                      {item.status === "PROVISIONED" ? "Active" : "Approved"}
                    </Badge>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
