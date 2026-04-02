"use client";

import { useSession } from "next-auth/react";
import { ROLES } from "@/lib/roles";

interface PermissionGateProps {
  allowedRoles: string[];
  children: React.ReactNode;
  fallback?: React.ReactNode;
}

export function PermissionGate({ allowedRoles, children, fallback = null }: PermissionGateProps) {
  const { data: session } = useSession();
  
  const userRoles = session?.user?.roles || [];
  
  const hasAccess = allowedRoles.some(role => 
    userRoles.includes(role) || 
    (role === ROLES.REQUESTER && (userRoles.includes(ROLES.ADMIN) || userRoles.includes(ROLES.DCOPS)))
  );

  if (!hasAccess) {
    return <>{fallback}</>;
  }

  return <>{children}</>;
}
