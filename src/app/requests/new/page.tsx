// src/app/requests/new/page.tsx
"use client";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { RequestForm } from "../components/RequestForm";
import { useEffect, useState } from "react";
import { Route } from "lucide-react";
import { RouteLoader } from "@/components/RouteLoader";

export default function NewVmPage({
  params,
}: {
  params: { copyFromId?: string };
}) {
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

  return (
    <div className="p-6 max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">New VM Request</h1>
      <RequestForm userId={session?.user.id as string} />
    </div>
  );
}
