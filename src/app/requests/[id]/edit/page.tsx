// src/app/requests/[id]/edit/page.tsx
"use client";
import { RequestForm } from "@/app/requests/components/RequestForm";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";

interface Request {
  id: string;
  requesterId: string;
  status: string;
  type?: "REQUEST";
  targetVmId?: string;
}

export default function EditRequestPage({
  params,
}: {
  params: { id: string };
}) {
  const { data: session } = useSession();
  const [request, setRequest] = useState<Request | null>(null);
  const [loading, setLoading] = useState(true);

  if (!session?.user) {
    redirect("/auth");
  }

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [reqRes] = await Promise.all([
          fetch(`/api/requests/${params.id}`),
        ]);
        
        const reqData = await reqRes.json();
        setRequest(reqData);
      } catch (error) {
        console.error("Error fetching data:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [params.id, session.user.id]);

  if (loading) return <div className="p-6">Loading...</div>;

  if (!request || request.requesterId !== session.user.id || request.status !== "DRAFT") {
    redirect("/requests");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">
        Edit 
      </h1>
        <RequestForm userId={session.user.id} editId={params.id} />
    </div>
  );
}
