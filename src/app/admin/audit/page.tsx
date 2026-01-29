import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { getAuditLogs } from "@/app/actions/audit-actions";
import { AuditExplorerClient } from "./components/AuditExplorerClient";
import { Shield } from "lucide-react";

interface AuditPageProps {
  searchParams?: Promise<{
    search?: string;
    action?: string;
    page?: string;
  }>;
}

export default async function AuditExplorerPage(props: AuditPageProps) {
  const searchParams = await props.searchParams;
  const session = await getServerSession(authOptions);
  
  if (!session?.user?.roles?.includes(ROLES.ADMIN)) 
    redirect("/unauthorized");

  // Parse params safely
  const page = searchParams?.page ? parseInt(searchParams.page) : 1;
  const search = searchParams?.search?.trim() || undefined;
  const action = searchParams?.action || undefined;

  const { logs, total, totalPages, currentPage, uniqueActions } = 
    await getAuditLogs({ search, action, page });

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/20 min-h-screen">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-red-600 rounded-lg text-white shadow-lg shadow-red-100">
            <Shield className="h-5 w-5" />
          </div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase italic">
            Audit Ledger
          </h1>
        </div>
        <p className="text-slate-500 font-medium ml-12">
          Authoritative, immutable record of all system activities and security pulses.
        </p>
      </div>

      <AuditExplorerClient 
        initialLogs={logs}
        total={total}
        totalPages={totalPages}
        currentPage={currentPage}
        uniqueActions={uniqueActions}
        initialFilters={{ search: searchParams?.search, action: searchParams?.action }}
      />
    </div>
  );
}