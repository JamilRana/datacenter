// src/app/requests/decommission/page.tsx
"use client";
import { redirect } from "next/navigation";
import { fetchAllVms } from "@/app/actions/vm-actions";
import { DecommissionForm } from "../components/DecommissionForm";
import { useEffect, useState } from "react";
import { useSession } from "next-auth/react";
import { VmInstance } from "@/types/inventory";

export default async function DecommissionVmPage({
  searchParams,
}: {
  searchParams: { vmId?: string };
}) {
  

const { data: session } = useSession();
  const [vms, setVms] = useState<VmInstance[]>([]);
  if (!session?.user) redirect("/auth");

  useEffect(() => {
    const fetchVms = async () => {
      try {
      const res = await fetchAllVms({
        userId: session.user.id,
        role: "REQUESTER",
        statusFilter: "ACTIVE",
        perPage: 100, // Show all possible candidates
      });
      if(!res) return;
      setVms(res.vms);
    } catch (error) {
      console.error("Error fetching VMs:", error);
    }    
    };
    fetchVms();
  }, []);

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