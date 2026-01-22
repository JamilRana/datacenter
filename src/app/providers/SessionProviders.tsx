// app/providers/SessionProviders.tsx
"use client";

import { SessionProvider, useSession } from "next-auth/react";
import { LoadingProvider } from "@/context/LoadingContext";
import { RouteLoader } from "@/components/RouteLoader";

export default function AuthSessionProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <SessionProvider>
      <LoadingProvider>
        <AuthStatusLoader>{children}</AuthStatusLoader>
      </LoadingProvider>
    </SessionProvider>
  );
}

function AuthStatusLoader({ children }: { children: React.ReactNode }) {
  const { status } = useSession();

  if (status === "loading") {
    return <RouteLoader />;
  }

  return <>{children}</>;
}
