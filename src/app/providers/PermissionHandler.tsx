"use client";

import { useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { toast } from "sonner";

export default function PermissionHandler() {
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    const error = searchParams.get("error");
    if (error === "permission_denied") {
      toast.error("Permission Denied", {
        description: "You do not have permission to access that page.",
      });
      const url = new URL(window.location.href);
      url.searchParams.delete("error");
      router.replace(url.toString());
    }
  }, [searchParams, router]);

  return null;
}
