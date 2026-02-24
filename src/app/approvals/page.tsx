//src/app/approvals/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { ApproverDashboardClient } from "./components/ApproverDashboardClient";
import { Card, CardContent } from "@/components/ui/card";
import { CheckCircle2, Clock, XCircle, PlayCircle, Layers } from "lucide-react";
import { fetchDashboardData } from "./lib"; // Reuse shared logic
import type { MetricColor } from "./lib"; // Create this type file

// Keep MetricCard component identical (move to separate file if preferred)
interface MetricCardProps {
  title: string;
  value: number;
  icon: React.ElementType;
  color: MetricColor;
}

function MetricCard({ title, value, icon: Icon, color }: MetricCardProps) {
  const colors: Record<MetricColor, string> = {
    slate: "text-slate-600 bg-slate-100",
    amber: "text-amber-600 bg-amber-100",
    emerald: "text-emerald-600 bg-emerald-100",
    red: "text-red-600 bg-red-100",
    blue: "text-blue-600 bg-blue-100",
  };

  return (
    <Card className="border-none shadow-sm overflow-hidden group">
      <CardContent className="p-0">
        <div className="p-4 flex items-center justify-between">
           <div className="space-y-1">
             <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
             <p className="text-2xl font-bold text-slate-900">{value}</p>
           </div>
           <div className={`p-3 rounded-xl transition-all duration-300 group-hover:scale-110 ${colors[color]}`}>
             <Icon className="w-5 h-5" />
           </div>
        </div>
        <div className={`h-1 w-full bg-current opacity-20 ${colors[color].split(" ")[0]}`} />
      </CardContent>
    </Card>
  );
}

export default async function ApprovalsDashboard({
  searchParams,
}: {
  searchParams: { page?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  const page = searchParams.page ? parseInt(searchParams.page, 10) : 1;
  const userRoles = session.user.roles;
  const isAdmin = userRoles.includes(ROLES.ADMIN);
  
  // ✅ Single source of truth: Reuse shared data fetcher
  const { metrics, requests } = await fetchDashboardData(session.user.id, userRoles, isAdmin, page);

  return (
    <div className="p-6 md:p-10 space-y-8 bg-slate-50/30 min-h-screen">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 capitalize">
          {userRoles.map(r => r.replace(/_/g, " ")).join(" & ")} Dashboard
        </h1>
        <p className="text-slate-500">Manage and execute virtual machine requests across the datacenter.</p>
      </div>

      {/* Metrics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <MetricCard title="Assigned" value={metrics.totalVisible} icon={Layers} color="slate" />
        <MetricCard title="Pending Action" value={metrics.pendingCount} icon={Clock} color="amber" />
        <MetricCard title="Approved" value={metrics.approvedCount} icon={CheckCircle2} color="emerald" />
        <MetricCard title="Rejected" value={metrics.rejectedCount} icon={XCircle} color="red" />
        <MetricCard title="Executed" value={metrics.executedCount} icon={PlayCircle} color="blue" />
      </div>

      {/* Client Component with Serialized Initial Data */}
      <ApproverDashboardClient 
        initialRequests={JSON.parse(JSON.stringify(requests))} 
        userRoles={userRoles} 
        currentUserId={session.user.id}
      />
    </div>
  );
}