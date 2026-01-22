// src/app/requests/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { RequestList } from "./components/RequestList";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";

export default function MyRequestsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [requests, setRequests] = useState<any[]>([]);
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchRequests = async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/requests?userId=${session?.user.id}`);
        const data = await res.json();
        setRequests(data);
      } catch (err) {
        console.error("Failed to fetch requests", err);
      } finally {
        setLoading(false);
      }
    };
    if (session) fetchRequests();
  }, [session]);

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
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Requests</h1>
          <p className="text-slate-500 mt-1">Manage and track your VM provision requests.</p>
        </div>
        <Link href="/requests/new">
          <Button className="bg-blue-600 hover:bg-blue-700 shadow-sm transition-all hover:translate-y-[-1px]">
            <Plus className="w-4 h-4 mr-2" /> New Request
          </Button>
        </Link>
      </div>

      <RequestList requests={requests} />
    </div>
  );
}
