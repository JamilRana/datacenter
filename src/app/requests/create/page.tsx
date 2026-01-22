// src/app/requests/create/page.tsx
"use client";
import { RouteLoader } from "@/components/RouteLoader";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function CreateRequestPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }
  }, [session, status, router]);

  // if (status === "loading" || loading) return <RouteLoader />;
  return (
    <div className="p-6 max-w-2xl mx-auto space-y-4">
      <h1 className="text-2xl font-bold">Create New Request</h1>
      <Link href="/requests/new">
        <Button className="w-full">New VM</Button>
      </Link>
      <Link href="/requests/vms">
        <Button variant="outline" className="w-full">
          Customize Existing VM
        </Button>
      </Link>
    </div>
  );
}
