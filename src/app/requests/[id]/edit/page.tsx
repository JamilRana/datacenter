// src/app/requests/[id]/edit/page.tsx
"use client";
import { RequestForm } from "@/app/requests/components/RequestForm";
import { useRouter } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

interface Request {
  id: string;
  requesterId: string;
  developerId?: string | null;
  status: string;
  type?: "REQUEST";
  targetVmId?: string;
}

export default function EditRequestPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { data: session, status } = useSession();
  const router = useRouter();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (status === "loading") return;
    if (!session?.user) {
      router.push("/auth");
      return;
    }
  }, [session, status, router]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`/api/requests/${id}`);
        if (!res.ok) throw new Error("Failed to fetch request");
        const reqData = await res.json();
        
        // If not in a state that allows editing, redirect
        // We now allow DRAFT and REJECTED (which becomes DRAFT)
        if (reqData.status !== "DRAFT" && reqData.status !== "REJECTED" && reqData.status !== "RETURNED") {
          router.push("/requests");
          return;
        }

        setRequest(reqData);
      } catch (error) {
        console.error("Error fetching data:", error);
        router.push("/requests");
      } finally {
        setLoading(false);
      }
    };
    
    if (session?.user) {
      fetchData();
    }
  }, [id, session, router]);

  if (loading || status === "loading") {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
        <div className="h-96 w-full bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
      </div>
    );
  }

  if (!request) return null;

  // Allow both requester and developer (who created draft) to edit
  const isRequester = request.requesterId === session?.user.id;
  const isDeveloper = request.developerId === session?.user.id;
  const isAdmin = session?.user.roles?.includes("ADMIN");

  if (!isRequester && !isDeveloper && !isAdmin) {
    router.push("/requests");
    return null;
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <Link href="/requests" className="hover:text-slate-900">Requests</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <Link href={`/requests/${id}/view`} className="hover:text-slate-900">Details</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-slate-900 font-medium">Edit</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Edit Request</h1>
        <p className="text-slate-500 mt-1">
          Update the details of your draft request.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <RequestForm userId={session?.user.id || ""} editId={id} />
      </div>
    </div>
  );
}