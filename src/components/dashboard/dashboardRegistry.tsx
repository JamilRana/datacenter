// src/components/dashboard/dashboardRegistry.tsx
"use client";

import { ROLES } from "@/lib/roles";
import { AdminWidgets } from "./widgets/AdminWidgets";
import { DcopsWidgets } from "./widgets/DcopsWidgets";
import { RequesterWidgets } from "./widgets/RequesterWidgets";
import { AdminDashboardData } from "@/lib/dashboard/adminDashboard";
import { DcopsDashboardData } from "@/lib/dashboard/dcopsDashboard";
import { RequesterDashboardData } from "@/lib/dashboard/requesterDashboard";

export type DashboardData = 
  | { role: "ADMIN"; data: AdminDashboardData }
  | { role: "DCOPS"; data: DcopsDashboardData }
  | { role: "REQUESTER"; data: RequesterDashboardData };

interface DashboardRegistryProps {
  data: DashboardData;
}

export function DashboardRegistry({ data }: DashboardRegistryProps) {
  switch (data.role) {
    case "ADMIN":
      return <AdminWidgets data={data.data as AdminDashboardData} />;
    case "DCOPS":
      return <DcopsWidgets data={data.data as DcopsDashboardData} />;
    case "REQUESTER":
      return <RequesterWidgets data={data.data as RequesterDashboardData} />;
    default:
      return null;
  }
}

export function getPrimaryRole(userRoles: string[]): "ADMIN" | "DCOPS" | "REQUESTER" {
  if (userRoles.includes(ROLES.ADMIN)) return "ADMIN";
  if (userRoles.includes(ROLES.DCOPS)) return "DCOPS";
  return "REQUESTER";
}

export function getRoleLabel(role: "ADMIN" | "DCOPS" | "REQUESTER"): string {
  switch (role) {
    case "ADMIN":
      return "Administrator";
    case "DCOPS":
      return "Data Center Operations";
    case "REQUESTER":
      return "Requester";
    default:
      return "User";
  }
}
