// src/app/requests/[id]/page.tsx
"use client";

import { useRouter } from "next/navigation";

import { useEffect } from "react";
import { useSession } from "next-auth/react";
import { RequestDetails } from "../../components/RequestDetail";

export default function RequestDetailPage({
  params,
}: {
  // Use 'id' because your folder is [id]
  params: { id: string };
}) {
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
    }
  }, [session, status, router]);

  if (status === "loading") return <div>Loading...</div>;

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Pass params.id to the requestId prop */}
      <RequestDetails requestId={params.id} userId={session?.user?.id || ""} />
    </div>
  );
}
