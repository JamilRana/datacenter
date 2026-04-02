// src/app/reports/components/UserVmModal.tsx
"use client";

import { useState, useEffect } from "react";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription 
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
  ExternalLink,
  Layers,
  Search,
  Clock
} from "lucide-react";
import { getUserVmDetails } from "@/app/actions/report-tabular-actions";
import { UserVmDetail } from "@/types/reports";
import { format, differenceInDays } from "date-fns";
import { Input } from "@/components/ui/input";
import { exportToExcel, exportToCSV } from "@/lib/export-utils";

interface UserVmModalProps {
  userId: string | null;
  userName: string | null;
  isOpen: boolean;
  onClose: () => void;
}

export function UserVmModal({ userId, userName, isOpen, onClose }: UserVmModalProps) {
  const [vms, setVms] = useState<UserVmDetail[]>([]);
  const [filteredVms, setFilteredVms] = useState<UserVmDetail[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  useEffect(() => {
    if (userId && isOpen) {
      loadDetails();
    }
  }, [userId, isOpen]);

  useEffect(() => {
    if (searchTerm === "") {
      setFilteredVms(vms);
    } else {
      setFilteredVms(
        vms.filter(vm => 
          vm.hostname.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vm.ipAddress.toLowerCase().includes(searchTerm.toLowerCase()) ||
          vm.requestId.toLowerCase().includes(searchTerm.toLowerCase())
        )
      );
    }
  }, [searchTerm, vms]);

  async function loadDetails() {
    if (!userId) return;
    setLoading(true);
    try {
      const data = await getUserVmDetails(userId);
      setVms(data);
      setFilteredVms(data);
    } catch (error) {
      console.error("Failed to load user VMs", error);
    } finally {
      setLoading(false);
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "ACTIVE":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">Active</Badge>;
      case "SUSPENDED":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">Suspended</Badge>;
      case "RETIRED":
        return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">Retired</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getRenewalStatus = (dateStr: string) => {
    if (!dateStr) return null;
    const date = new Date(dateStr);
    const days = differenceInDays(date, new Date());
    
    if (days <= 30) return <span className="text-rose-600 font-medium flex items-center gap-1"><Clock size={12}/> {format(date, "MMM dd, yyyy")}</span>;
    if (days <= 90) return <span className="text-amber-600 font-medium flex items-center gap-1"><Clock size={12}/> {format(date, "MMM dd, yyyy")}</span>;
    return <span className="text-slate-600">{format(date, "MMM dd, yyyy")}</span>;
  };

const handleExport = (exportFormat: 'xlsx' | 'csv') => {
  const dataToExport = filteredVms.map(vm => ({
    "VM Name": vm.hostname,
    "IP Address": vm.ipAddress,
    "Environment": vm.environment,
    "vCPU": vm.vcpu,
    "RAM (GB)": vm.ramGb,
    "Storage (GB)": vm.storageGb,
    "OS": vm.os,
    "Cluster": vm.cluster,
    "Status": vm.status,
    // Now this 'format' correctly refers to date-fns
    "Renewal Date": vm.renewalDate ? format(new Date(vm.renewalDate), "yyyy-MM-dd") : "N/A",
    "Request ID": vm.requestId
  }));
  
  const baseFilename = `UserVms_${userName?.replace(/\s+/g, '_')}`;
  if (exportFormat === 'xlsx') {
    exportToExcel(baseFilename, dataToExport);
  } else {
    exportToCSV(baseFilename, dataToExport);
  }
};

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col p-6">
        <DialogHeader className="mb-4">
          <div className="flex justify-between items-start pr-8">
            <div>
              <DialogTitle className="text-2xl font-bold text-slate-900 leading-none mb-2">
                {userName} — Allocated VMs
              </DialogTitle>
              <DialogDescription className="text-slate-500">
                A detailed view of resources allocated to this user.
              </DialogDescription>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => handleExport('xlsx')}>
                <Download size={14} /> Excel
              </Button>
              <Button size="sm" variant="outline" className="h-8 gap-2" onClick={() => handleExport('csv')}>
                <Download size={14} /> CSV
              </Button>
            </div>
          </div>
        </DialogHeader>

        <div className="flex items-center gap-4 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <Input 
              placeholder="Search by hostname, IP or Request ID..." 
              className="pl-9 h-9 border-slate-200 focus-visible:ring-indigo-500"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex gap-4">
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total</span>
              <span className="text-lg font-bold text-indigo-600 leading-tight">{vms.length}</span>
            </div>
            <div className="w-[1px] h-8 bg-slate-200 self-center"></div>
            <div className="flex flex-col">
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active</span>
              <span className="text-lg font-bold text-emerald-600 leading-tight">{vms.filter(v => v.status === 'ACTIVE').length}</span>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-auto rounded-md border border-slate-200">
          {loading ? (
            <div className="flex items-center justify-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
            </div>
          ) : filteredVms.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-64 bg-slate-50/50">
              <Layers className="h-10 w-10 text-slate-300 mb-2" />
              <p className="text-slate-500">No VMs found matching your search.</p>
            </div>
          ) : (
            <Table>
              <TableHeader className="bg-slate-50 sticky top-0 z-10">
                <TableRow>
                  <TableHead className="font-bold whitespace-nowrap">VM Name / Hostname</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">IP Address</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Environment</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Resources</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">OS / Image</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Cluster</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Status</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Renewal Date</TableHead>
                  <TableHead className="font-bold whitespace-nowrap">Request ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredVms.map((vm) => (
                  <TableRow key={vm.id} className="hover:bg-slate-50/50">
                    <TableCell className="font-medium text-slate-900 group">
                      <div className="flex items-center gap-2">
                        {vm.hostname}
                        <ExternalLink size={12} className="text-slate-300 hidden group-hover:block transition-all" />
                      </div>
                    </TableCell>
                    <TableCell className="text-slate-600 font-mono text-[13px]">{vm.ipAddress}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-medium">
                        {vm.environment}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-0.5 whitespace-nowrap">
                        <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between gap-2">
                          <span>vCPU:</span>
                          <span className="text-slate-700">{vm.vcpu} core</span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between gap-2">
                          <span>RAM:</span>
                          <span className="text-slate-700">{vm.ramGb} GB</span>
                        </div>
                        <div className="text-[11px] font-bold text-slate-400 flex items-center justify-between gap-2">
                          <span>Disk:</span>
                          <span className="text-slate-700">{vm.storageGb} GB</span>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600">{vm.os}</TableCell>
                    <TableCell className="text-xs font-medium text-indigo-600/70">{vm.cluster}</TableCell>
                    <TableCell>{getStatusBadge(vm.status)}</TableCell>
                    <TableCell className="text-xs font-medium">{getRenewalStatus(vm.renewalDate)}</TableCell>
                    <TableCell className="text-xs font-mono text-slate-400">{vm.requestId}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
