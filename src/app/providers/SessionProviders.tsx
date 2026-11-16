"use client";

import { SessionProvider } from "next-auth/react";
import { IdleTimer } from "@/components/auth/IdleTimer";

export default function AuthSessionProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <IdleTimer />
      {children}
    </SessionProvider>
  );
}
