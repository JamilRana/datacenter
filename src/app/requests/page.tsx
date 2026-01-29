// src/app/requests/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { RequestList } from "./components/RequestList";
import {  Search } from "lucide-react";
import { RequestSummary } from "./components/RequestSummary";
import { getRequests } from "@/app/actions/request-actions";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { RequestDetailsData } from "@/types/requests";

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<RequestDetailsData[]>([]);
  const [filteredRequests, setFilteredRequests] = useState<RequestDetailsData[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [typeFilter, setTypeFilter] = useState<string>("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }
  }, [session, status, router]);

 useEffect(() => {
   if (!session) return;
   const fetchData = async () => {
     setLoading(true);
     try {
       const data = await getRequests({
         status: statusFilter === "ALL" ? undefined : statusFilter,
         type: typeFilter === "ALL" ? undefined : typeFilter,
         search: searchQuery
       });
       setRequests(data);
     } catch (err) {
       console.error("Failed to fetch requests", err);
     } finally {
       setLoading(false);
     }
   };
   fetchData();
 }, [session, statusFilter, typeFilter, searchQuery]);
  useEffect(() => {
    let result = [...requests];

    if (statusFilter !== "ALL") {
      result = result.filter((r) => r.status === statusFilter);
    }

    if (typeFilter !== "ALL") {
      result = result.filter((r) => r.requestType === typeFilter);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (r) =>
          r.systemName.toLowerCase().includes(query) ||
          (r.projectName && r.projectName.toLowerCase().includes(query))
      );
    }

    setFilteredRequests(result);
  }, [requests, statusFilter, typeFilter, searchQuery]);

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

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <RequestSummary requests={requests} />

      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm space-y-4">
        <div className="flex flex-col md:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search by system or project name..."
              className="pl-9 bg-slate-50 border-slate-200"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="w-full md:w-48">
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="bg-slate-50 border-slate-200">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Statuses</SelectItem>
                <SelectItem value="DRAFT">Draft</SelectItem>
                <SelectItem value="PENDING_L1">Pending L1</SelectItem>
                <SelectItem value="PENDING_L2">Pending L2</SelectItem>
                <SelectItem value="PENDING_L3">Pending L3</SelectItem>
                <SelectItem value="APPROVED">Approved</SelectItem>
                <SelectItem value="REJECTED">Rejected</SelectItem>
                <SelectItem value="PROVISIONED">Provisioned</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="w-full md:w-48">
            <Select value={typeFilter} onValueChange={setTypeFilter}>
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

      <RequestList requests={filteredRequests} />
    </div>
  );
}
