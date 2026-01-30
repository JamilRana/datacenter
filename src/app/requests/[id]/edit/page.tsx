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
}

export default function EditRequestPage({
  params,
}: {
  params: { id: string };
}) {
     const { data: session } = useSession();
     const [request, setRequest] = useState<Request | null>(null);
  if (!session?.user) {
    redirect("/auth");
  }

  useEffect(() => {
    const fetchRequest = async () => {
      try {
        const response = await fetch(`/api/requests/${params.id}`);
        const data = await response.json();
        setRequest(data);
      } catch (error) {
        console.error("Error fetching request:", error);
      }
    };
    fetchRequest();
  }, [params.id]);

  if (!request || request.requesterId  !== session.user.id || request.status !== "DRAFT") {
    redirect("/requests");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Edit Request</h1>
      <RequestForm userId={session.user.id} editId={params.id} />
    </div>
  );
}
