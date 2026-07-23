// src/app/requests/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { RequestList } from "./components/RequestList";
import { getRequests, getRequestStats } from "@/app/actions/request-actions";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, Loader2, Plus, Zap, Trash2, Server, Clock, CheckCircle2, XCircle, FileText, ChevronRight, Code, Shield, Monitor } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { detailsRequest } from "@/types/requests";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type RequestType = "NEW_VM" | "CUSTOMIZED" | "DECOMMISSION" | "K8S_NAMESPACE" | "VPN_ACCESS" | "HORIZON_ACCESS";

interface RequestStats {
  total: number;
  draft: number;
  pending: number;
  approved: number;
  rejected: number;
  deployed: number;
  byType: Record<string, number>;
}

const STORAGE_KEY = "requests_page_state";

function getStoredState() {
  if (typeof window === "undefined") return { tab: "ALL" as RequestType | "ALL", page: 1, filters: { status: "ALL", search: "" } };
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { }
  return { tab: "ALL" as RequestType | "ALL", page: 1, filters: { status: "ALL", search: "" } };
}

function saveState(tab: RequestType | "ALL", page: number, filters: Record<string, unknown>) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ tab, page, filters }));
  } catch { }
}

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [currentPage, setCurrentPage] = useState(1);
  const [listLoading, setListLoading] = useState(false);
  const [requestsData, setRequestsData] = useState<{
    requests: detailsRequest[];
    total: number;
    totalPages: number;
    currentPage: number;
  } | null>(null);
  const [stats, setStats] = useState<RequestStats>({
    total: 0, draft: 0, pending: 0, approved: 0, rejected: 0, deployed: 0, byType: {}
  });
  const [activeTab, setActiveTab] = useState<RequestType | "ALL">("ALL");
  const [filters, setFilters] = useState({
    status: "ALL",
    search: "",
  });
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const isFirstRender = useRef(true);
  const initializedRef = useRef(false);
  const fetchingRef = useRef(false);
  const PAGE_SIZE = 10;

  // Initialize from sessionStorage on mount (only once)
  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const stored = getStoredState();
    setActiveTab(stored.tab);
    setCurrentPage(stored.page);
    setFilters(stored.filters);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(filters.search);
      setCurrentPage(1);
    }, 500);
    return () => clearTimeout(timer);
  }, [filters.search]);

  const fetchData = useCallback(async () => {
    if (!session?.user?.id || !initializedRef.current || fetchingRef.current) return;

    fetchingRef.current = true;
    setListLoading(true);
    try {
      const activeType = activeTab === "ALL" ? undefined : activeTab;
      const filterWithType = {
        ...filters,
        search: debouncedSearch,
        type: activeTab === "ALL" ? "ALL" : activeTab,
      };

      const [statsRes, requestsRes] = await Promise.all([
        getRequestStats(activeType),
        getRequests(filterWithType, currentPage, PAGE_SIZE)
      ]);

      if (statsRes.success && statsRes.data) {
        setStats(statsRes.data);
      }

      if (requestsRes.success && requestsRes.data) {
        setRequestsData({
          requests: requestsRes.data.requests as unknown as detailsRequest[],
          total: requestsRes.data.total,
          totalPages: requestsRes.data.totalPages,
          currentPage: requestsRes.data.currentPage
        });
      }
    } catch (err) {
      console.error("Failed to fetch dashboard data", err);
    } finally {
      setListLoading(false);
      fetchingRef.current = false;
    }
  }, [session?.user?.id, activeTab, filters, debouncedSearch, currentPage]);

  useEffect(() => {
    if (status === "loading" || !session?.user?.id || !initializedRef.current) return;
    fetchData();
  }, [status, session?.user?.id, fetchData]);

  // Save state to sessionStorage when it changes (but not on first render)
  useEffect(() => {
    if (!initializedRef.current || isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    saveState(activeTab, currentPage, filters);
  }, [activeTab, currentPage, filters]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
    setCurrentPage(1);
  };

  const handleTabChange = (tab: RequestType | "ALL") => {
    setActiveTab(tab);
    setCurrentPage(1);
  };

  if (status === "loading") {
    return (
      <div className="flex items-center justify-center p-20">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  const requestTypeCards = [
    {
      type: "NEW_VM" as RequestType,
      title: "New VM Requests",
      description: "Request provisioning of new virtual machines",
      icon: Server,
      href: "/requests/new?type=NEW_VM",
      color: "bg-blue-50 border-blue-200 hover:border-blue-400",
      iconBg: "bg-blue-100",
      iconColor: "text-blue-600",
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
    },
    {
      type: "K8S_NAMESPACE" as RequestType,
      title: "K8s Namespace Requests",
      description: "Request namespaces or clusters in Kubernetes",
      icon: Code,
      href: "/requests/new?type=K8S_NAMESPACE",
      color: "bg-emerald-50 border-emerald-200 hover:border-emerald-400",
      iconBg: "bg-emerald-100",
      iconColor: "text-emerald-600",
    },
    {
      type: "VPN_ACCESS" as RequestType,
      title: "VPN Access Requests",
      description: "Request secure external VPN connectivity to your VM",
      icon: Shield,
      href: "/requests/new?type=VPN_ACCESS",
      color: "bg-indigo-50 border-indigo-200 hover:border-indigo-400",
      iconBg: "bg-indigo-100",
      iconColor: "text-indigo-600",
    },
    {
      type: "HORIZON_ACCESS" as RequestType,
      title: "Horizon Access Requests",
      description: "Request Horizon client desktop access to your VM",
      icon: Monitor,
      href: "/requests/new?type=HORIZON_ACCESS",
      color: "bg-purple-50 border-purple-200 hover:border-purple-400",
      iconBg: "bg-purple-100",
      iconColor: "text-purple-600",
    },
  ];


  if (!session) {
    router.push("/auth");
    return null;
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-slate-900 font-medium">Requests</span>
      </div>

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
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Drafts</CardTitle>
            <FileText className="h-4 w-4 text-slate-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.draft}</div>
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
        <Card className="border-none shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
            <CardTitle className="text-xs font-medium text-slate-500 uppercase tracking-wider">Deployed</CardTitle>
            <Server className="h-4 w-4 text-indigo-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.deployed}</div>
          </CardContent>
        </Card>
      </div>

      {/* Request Type Cards 
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
                      {stats.byType[card.type] || 0}
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
*/}
      {/* Request Type Tabs */}
      <div className="flex gap-2 border-b border-slate-200 pb-1">
        <button
          onClick={() => handleTabChange("ALL")}
          className={`px-4 py-2 text-sm font-medium transition-colors ${activeTab === "ALL"
              ? "text-indigo-600 border-b-2 border-indigo-600"
              : "text-slate-500 hover:text-slate-700"
            }`}
        >
          All Requests
        </button>
        {requestTypeCards.map((card) => (
          <button
            key={card.type}
            onClick={() => handleTabChange(card.type)}
            className={`px-4 py-2 text-sm font-medium transition-colors flex items-center gap-2 ${activeTab === card.type
                ? "text-indigo-600 border-b-2 border-indigo-600"
                : "text-slate-500 hover:text-slate-700"
              }`}
          >
            <card.icon className="h-4 w-4" />
            {card.type === "NEW_VM" ? "New VM" :
              card.type === "CUSTOMIZED" ? "Customize" :
                card.type === "DECOMMISSION" ? "Decommission" :
                  card.type === "K8S_NAMESPACE" ? "K8s Namespace" :
                    card.type === "VPN_ACCESS" ? "VPN Access" :
                      card.type === "HORIZON_ACCESS" ? "Horizon Access" : card.type}
            <Badge variant="secondary" className="text-xs">{stats.byType[card.type] || 0}</Badge>
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
      {listLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      ) : (
        <>
          <RequestList requests={requestsData?.requests || []} />
          {requestsData && requestsData.totalPages > 1 && (
            <div className="mt-6 flex justify-center">
              <Pagination
                currentPage={currentPage}
                totalPages={requestsData.totalPages}
                onPageChange={handlePageChange}
              />
            </div>
          )}
          {requestsData && requestsData.totalPages === 1 && requestsData.total > 0 && (
            <p className="text-center text-sm text-slate-500 mt-4">
              Showing {((currentPage - 1) * PAGE_SIZE) + 1}-{Math.min(currentPage * PAGE_SIZE, requestsData.total)} of {requestsData.total} requests
            </p>
          )}
        </>
      )}
    </div>
  );
}