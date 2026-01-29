// src/app/requests/decommission/page.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { fetchAllVms } from "@/app/actions/vm-actions";
import { DecommissionForm } from "../components/DecommissionForm";

export default async function DecommissionVmPage({
  searchParams,
}: {
  searchParams: { vmId?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) redirect("/auth");

  // Fetch only ACTIVE VMs owned by the user
  const { vms } = await fetchAllVms({
    userId: session.user.id,
    role: "REQUESTER",
    statusFilter: "ACTIVE",
    perPage: 100,
  });

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900 text-red-600">Decommission VM</h1>
        <p className="text-slate-500 mt-1">Request the termination and removal of a provisioned virtual machine.</p>
      </div>

      <DecommissionForm vms={vms} preselectedVmId={searchParams.vmId} userId={session.user.id} />
    </div>
  );
}