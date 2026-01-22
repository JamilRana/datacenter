// src/app/requests/vms/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

import { useRouter } from "next/navigation";
import { VmList } from "../components/VmList";

export default function MyVmsPage() {
  const { data: session, status } = useSession();
  const [vms, setVms] = useState<any[]>([]);
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
    const fetchVms = async () => {
      const res = await fetch(`/api/vms?ownerId=${session?.user.id}`);
      const data = await res.json();
      setVms(data);
    };
    if (session) fetchVms();
  }, [session]);

  return (
    <div className="p-6 max-w-6xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">My Provisioned VMs</h1>
      <VmList vms={vms} />
    </div>
  );
}
