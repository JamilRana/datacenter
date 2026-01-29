"use client";

import { useState, useTransition, useEffect } from "react";
import {  useRouter, usePathname } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue 
} from "@/components/ui/select";
import { 
  Activity, 
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Search,
  Filter
} from "lucide-react";
import { format } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { AuditLog } from "@/types/audit";
import { Skeleton } from "@/components/ui/skeleton";

interface Props {
  initialLogs: AuditLog[];
  total: number;
  totalPages: number;
  currentPage: number;
  uniqueActions: string[];
  initialFilters: {
    search?: string;
    action?: string;
  };
}

export function AuditExplorerClient({
  initialLogs,
  total,
  totalPages,
  currentPage,
  uniqueActions,
  initialFilters,
}: Props) {
  //const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [isPending, startTransition] = useTransition();
  
  // Initialize from URL params
  const [searchTerm, setSearchTerm] = useState(initialFilters.search || "");
  const [selectedAction, setSelectedAction] = useState(initialFilters.action || "all");
  const [logs, setLogs] = useState(initialLogs);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // Sync state with URL params on mount
  useEffect(() => {
    setSearchTerm(initialFilters.search || "");
    setSelectedAction(initialFilters.action || "all");
    setLogs(initialLogs);
  }, [initialFilters, initialLogs]);

  // Update URL and fetch when filters change
  const applyFilters = (newPage: number = 1) => {
    const params = new URLSearchParams();
    
    if (searchTerm.trim()) params.set("search", searchTerm.trim());
    if (selectedAction && selectedAction !== "all") params.set("action", selectedAction);
    if (newPage > 1) params.set("page", newPage.toString());
    
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  };

  // Handlers
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    applyFilters(1); // Reset to page 1 on new search
  };

  const handleActionChange = (value: string) => {
    setSelectedAction(value);
    applyFilters(1); // Reset to page 1 on filter change
  };

  const handlePageChange = (page: number) => {
    if (page < 1 || page > totalPages) return;
    applyFilters(page);
  };

  return (
    <div className="space-y-6">
      {/* Filter Controls */}
      <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
        <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1 min-w-[250px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                placeholder="Search actions or details..."
                value={searchTerm}
                onChange={handleSearchChange}
                className="pl-9"
              />
            </div>
          </div>
          
          <div className="w-full sm:w-auto">
            <div className="flex items-center gap-2 text-slate-500 mb-1">
              <Filter className="h-4 w-4" />
              <span className="text-sm font-medium">Action Type</span>
            </div>
            <Select value={selectedAction} onValueChange={handleActionChange}>
              <SelectTrigger className="w-full sm:w-[200px]">
                <SelectValue placeholder="Select action" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Actions</SelectItem>
                {uniqueActions.map((action) => (
                  <SelectItem key={action} value={action}>
                    {action.replace(/_/g, " ")}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <Button 
            type="submit" 
            disabled={isPending}
            className="sm:w-auto w-full"
          >
            {isPending ? "Filtering..." : "Apply Filters"}
          </Button>
        </form>
      </div>

      {/* Results Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <p className="text-sm text-slate-600">
          Showing <span className="font-bold">{logs.length}</span> of{" "}
          <span className="font-bold">{total.toLocaleString()}</span> records
        </p>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage - 1)}
            disabled={currentPage === 1 || isPending}
          >
            Previous
          </Button>
          <span className="text-sm text-slate-600">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handlePageChange(currentPage + 1)}
            disabled={currentPage === totalPages || isPending}
          >
            Next
          </Button>
        </div>
      </div>

      {/* Audit Table */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50 border-b border-slate-100">
              <tr>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Timestamp
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Activity / Action
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
                  Principal Actor
                </th>
                <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] text-right">
                  Context
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {isPending ? (
                // Skeleton loaders during transition
                Array.from({ length: 5 }).map((_, i) => (
                  <tr key={i}>
                    <td colSpan={4} className="p-4">
                      <div className="flex items-center justify-between">
                        <Skeleton className="h-8 w-32" />
                        <Skeleton className="h-6 w-24" />
                      </div>
                    </td>
                  </tr>
                ))
              ) : logs.length > 0 ? (
                logs.map((log) => (
                  <LogEntry 
                    key={log.id} 
                    log={log} 
                    isExpanded={expandedId === log.id}
                    onToggle={() => setExpandedId(expandedId === log.id ? null : log.id)}
                  />
                ))
              ) : (
                <tr>
                  <td colSpan={4} className="p-20 text-center text-slate-300 italic">
                    No historical records match the specified parameters
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

interface LogEntryProps {
  log: AuditLog;
  isExpanded: boolean;
  onToggle: () => void;
}

function LogEntry({ log, isExpanded, onToggle }: LogEntryProps) {
  // ✅ Safe JSON parsing with proper error handling
  const getFormattedDetails = (): string => {
    if (!log.details) {
      return "No contextual details available for this event.";
    }
    
    try {
      // If details is already an object, stringify it
      if (typeof log.details === 'object' && log.details !== null) {
        return JSON.stringify(log.details, null, 2);
      }
      // If details is a string, try to parse and re-stringify
      const parsed = JSON.parse(log.details as string);
      return JSON.stringify(parsed, null, 2);
    } catch (error) {
      console.log(error);
      // If parsing fails, return as-is
      return typeof log.details === 'string' ? log.details : JSON.stringify(log.details);
    }
  };

  return (
    <>
      <tr className={`hover:bg-blue-50/20 transition-all cursor-pointer group ${isExpanded ? 'bg-blue-50/30' : ''}`} onClick={onToggle}>
        <td className="px-6 py-4">
          <div className="flex flex-col">
            <span className="text-xs font-black text-slate-700">{format(new Date(log.timestamp), "MMM dd, yyyy")}</span>
            <span className="text-[10px] font-bold text-slate-400">{format(new Date(log.timestamp), "HH:mm:ss")}</span>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="h-2 w-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.5)]" />
            <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{log.action.replace(/_/g, ' ')}</p>
          </div>
        </td>
        <td className="px-6 py-4">
          <div className="flex items-center gap-2">
            <div className="h-6 w-6 rounded-full bg-slate-100 flex items-center justify-center text-[8px] font-bold text-slate-500">
              {log.actor?.name?.charAt(0)}
            </div>
            <div className="flex flex-col">
              <span className="text-xs font-bold text-slate-600">{log.actor?.name}</span>
              <span className="text-[9px] font-medium text-slate-400">{log.actor?.email}</span>
            </div>
          </div>
        </td>
        <td className="px-6 py-4 text-right">
          <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-300 group-hover:text-blue-500">
            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </Button>
        </td>
      </tr>
      {isExpanded && (
        <tr className="bg-slate-50/50 animate-in fade-in slide-in-from-top-1 duration-200">
          <td colSpan={4} className="px-6 py-6 border-b border-slate-100">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="md:col-span-2 space-y-3">
                <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                  <Activity className="h-3 w-3" /> Event Payload Data
                </p>
                <div className="bg-white p-4 rounded-xl border border-slate-200 font-mono text-[10px] text-slate-600 whitespace-pre-wrap leading-relaxed shadow-inner">
                  {getFormattedDetails()}
                </div>
              </div>
              <div className="space-y-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entity Linkage</p>
                  <p className="text-xs font-bold text-slate-700">{log.entityType || "SYSTEM_GLOBAL"}</p>
                  <p className="text-[9px] font-mono text-slate-400">{log.entityId || "N/A"}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Security Pulse</p>
                  <Badge className="bg-emerald-50 text-emerald-700 border-emerald-100 text-[9px] font-black uppercase">Verified Integrity</Badge>
                </div>
                <div className="pt-4 border-t border-slate-100">
                  <Button variant="outline" className="w-full text-[10px] font-black uppercase h-9 gap-2">
                    <ExternalLink className="h-3 w-3" /> View Associated Request
                  </Button>
                </div>
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}