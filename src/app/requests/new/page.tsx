// src/app/requests/new/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { RequestForm } from "../components/RequestForm";
import { useEffect } from "react";
import Link from "next/link";
import { ChevronRight } from "lucide-react";

export default function NewVmPage() {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
        <div className="h-96 w-full bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900">Home</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <Link href="/requests" className="hover:text-slate-900">Requests</Link>
        <ChevronRight className="h-4 w-4 mx-2" />
        <span className="text-slate-900 font-medium">New Request</span>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">New VM Request</h1>
        <p className="text-slate-500 mt-1">
          Fill out the details below to request a new virtual machine.
        </p>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6">
        <RequestForm userId={session?.user.id as string} />
      </div>
    </div>
  );
}