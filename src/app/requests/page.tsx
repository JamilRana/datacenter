// src/app/requests/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { RequestList } from "./components/RequestList";
import { RequestSummary } from "./components/RequestSummary";
import { getRequests } from "@/app/actions/request-actions";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Loader2 } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { detailsRequest } from "@/types/requests";

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(() => {
    const pageParam = searchParams.get("page");
    return pageParam ? parseInt(pageParam, 10) : 1;
  });
  
  const [loading, setLoading] = useState(true);
  const [requestsData, setRequestsData] = useState<{
    requests: detailsRequest[];
    total: number;
    totalPages: number;
    currentPage: number;
  } | null>(null);
  
  const [filters, setFilters] = useState({
    status: "ALL",
    type: "ALL",
    search: "",
  });

  // Fetch data when filters or page changes
  useEffect(() => {
    if (status === "loading" || !session) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const data = await getRequests(filters, currentPage, 10);
        setRequestsData({
          ...data,
          requests: data.requests as unknown as detailsRequest[]
        });
      } catch (err) {
        console.error("Failed to fetch requests", err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [session, status, filters, currentPage]);

  // Update URL when page changes
  useEffect(() => {
    if (currentPage === 1 && !searchParams.toString()) return;
    
    const params = new URLSearchParams(searchParams.toString());
    if (currentPage > 1) {
      params.set("page", currentPage.toString());
    } else {
      params.delete("page");
    }
    
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }, [currentPage, pathname, router, searchParams]);

  // Handle filter changes
  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1); // Reset to first page on filter change
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-6 max-w-6xl mx-auto space-y-6">
        <div className="flex justify-between items-center h-10">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
          <div className="h-10 w-32 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="h-96 w-full bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
      </div>
    );
  }

  if (!session) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <RequestSummary requests={requestsData?.requests || []} />
      
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by system or project name..."
              className="pl-9 bg-slate-50 border-slate-200"
              value={filters.search}
              onChange={(e) => handleFilterChange("search", e.target.value)}
            />
          </div>
          
          <div className="w-full md:w-48">
            <Select 
              value={filters.status} 
              onValueChange={(v) => handleFilterChange("status", v)}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_L1">Pending L1</SelectItem>
                <SelectItem value="PENDING_L2">Pending L2</SelectItem>
                <SelectItem value="PENDING_L3">Pending L3</SelectItem>
                <SelectItem value="PENDING_L4">Pending Director</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PROVISIONED">Provisioned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          
          <div className="w-full md:w-48">
            <Select 
              value={filters.type} 
              onValueChange={(v) => handleFilterChange("type", v)}
            >
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Types</SelectItem>
                <SelectItem value="NEW_VM">New VM</SelectItem>
                <SelectItem value="CUSTOMIZED">Customize</SelectItem>
                <SelectItem value="RENEWAL">Renewal</SelectItem>
                <SelectItem value="DECOMMISSION">Decommission</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <RequestList requests={requestsData?.requests || []} />
          
          {requestsData && requestsData.totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination  
                totalPages={requestsData.totalPages}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}