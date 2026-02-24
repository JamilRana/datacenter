// src/app/requests/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { RequestList } from "./components/RequestList";
import { getRequests } from "@/app/actions/request-actions";
import { 
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue 
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Plus, Zap, Trash2, Server, ArrowRight, Clock, CheckCircle2, XCircle, FileText } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { detailsRequest } from "@/types/requests";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RequestType = "NEW_VM" | "CUSTOMIZED" | "DECOMMISSION";

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
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
  
  const [activeTab, setActiveTab] = useState<RequestType | "ALL">("ALL");
  
  const [filters, setFilters] = useState({
    status: "ALL",
    type: "ALL",
    search: "",
  });

  useEffect(() => {
    if (status === "loading" || !session) return;
    
    const fetchData = async () => {
      setLoading(true);
      try {
        const filterWithType = {
          ...filters,
          type: activeTab === "ALL" ? "ALL" : activeTab,
        };
        const data = await getRequests(filterWithType, currentPage, 10);
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
  }, [session, status, filters, currentPage, activeTab]);

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

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const stats = {
    total: requestsData?.requests?.length || 0,
    pending: requestsData?.requests?.filter((r) => r.status?.startsWith("PENDING")).length || 0,
    approved: requestsData?.requests?.filter((r) => r.status === "APPROVED").length || 0,
    rejected: requestsData?.requests?.filter((r) => r.status === "REJECTED").length || 0,
  };

  const requestTypeCards = [
    {
      type: "NEW_VM" as RequestType,
      title: "New VM Requests",
      description: "Request provisioning of new virtual machines",
      icon: Server,
      href: "/requests/new",
      color: "bg-blue-50 border-blue-200 hover:border-blue-400",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
      count: requestsData?.requests?.filter(r => r.requestType === "NEW_VM").length || 0,
    },
    {
      type: "CUSTOMIZED" as RequestType,
      title: "Customization Requests",
      description: "Upgrade or modify existing VM specifications",
      icon: Zap,
      href: "/requests/customize",
      color: "bg-amber-50 border-amber-200 hover:border-amber-400",
      iconBg: "bg-amber-100",
      iconColor: "text-amber-600",
      count: requestsData?.requests?.filter(r => r.requestType === "CUSTOMIZED").length || 0,
    },
    {
      type: "DECOMMISSION" as RequestType,
      title: "Decommission Requests",
      description: "Request removal of VMs from infrastructure",
      icon: Trash2,
      href: "/requests/decommission",
      color: "bg-red-50 border-red-200 hover:border-red-400",
      iconBg: "bg-red-100",
      iconColor: "text-red-600",
      count: requestsData?.requests?.filter(r => r.requestType === "DECOMMISSION").length || 0,
    },
  ];

  if (status === "loading" || loading) {
    return (
      <div className="p-6 max-w-7xl mx-auto space-y-6">
        <div className="flex justify-between items-center h-10">
          <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
          <div className="h-10 w-32 bg-slate-200 animate-pulse rounded" />
        </div>
        <div className="h-32 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
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
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Requests</h1>
          <p className="text-slate-500 mt-1">
            Manage your infrastructure requests and track their status
          </p>
        </div>
        <Button asChild className="bg-indigo-600 hover:bg-indigo-700">
          <Link href="/requests/new">
            <Plus className="h-4 w-4 mr-2" /> New Request
          </Link>
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Total</CardTitle>
            <FileText className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Pending</CardTitle>
            <Clock className="h-4 w-4 text-amber-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Approved</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rejected</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Request Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {requestTypeCards.map((card) => (
          <Link key={card.type} href={card.href} className="group">
            <Card className={`h-full transition-all duration-300 ${card.color} border-2 hover:shadow-lg cursor-pointer`}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <div className={`p-3 rounded-xl ${card.iconBg} ${card.iconColor}`}>
                    <card.icon className="h-6 w-6" />
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-xs font-bold">
                      {card.count}
                    </Badge>
                    <ArrowRight className="h-5 w-5 text-slate-400 group-hover:text-slate-600 group-hover:translate-x-1 transition-all" />
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <CardTitle className="text-lg text-slate-900">{card.title}</CardTitle>
                <CardDescription className="mt-2 text-slate-600">
                  {card.description}
                </CardDescription>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Request Type Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => setActiveTab("ALL")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === "ALL"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-700"
          }`}
        >
          All Requests
        </button>
        {requestTypeCards.map((card) => (
          <button
            key={card.type}
            onClick={() => setActiveTab(card.type)}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${
              activeTab === card.type
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-700"
            }`}
          >
            <card.icon className="h-4 w-4" />
            {card.type === "NEW_VM" ? "New VM" : card.type === "CUSTOMIZED" ? "Customize" : "Decommission"}
            <Badge variant="secondary" className="text-xs">{card.count}</Badge>
          </button>
        ))}
      </div>

      {/* Filters */}
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
        </div>
      </div>

      {/* Request List */}
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
