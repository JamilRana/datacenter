// src/app/unauthorized/page.tsx
"use client";
import { RouteLoader } from "@/components/RouteLoader";
import { Button } from "@/components/ui/button";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function UnauthorizedPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const router = useRouter();
  useEffect(() => {
    if (status !== "loading") {
      setLoading(false);
      if (!session) {
        router.push("/auth");
      }
    }
  }, [session, status, router]);

  if (status === "loading" || loading) return <RouteLoader />;
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center space-y-4">
        <h1 className="text-2xl font-bold text-destructive">Access Denied</h1>
        <p className="text-muted-foreground">
          You don't have permission to access this page.
        </p>
        <Button asChild>
          <Link href="/requests">Go to Dashboard</Link>
        </Button>
      </div>
    </div>
  );
}
