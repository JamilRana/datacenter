// src/components/dashboard/dashboardRegistry.tsx
"use client";

import { AdminWidgets } from "./widgets/AdminWidgets";
import { DcopsWidgets } from "./widgets/DcopsWidgets";
import { ApproverWidgets } from "./widgets/ApproverWidgets";
import { RequesterWidgets } from "./widgets/RequesterWidgets";
import { 
  AdminDashboardData, 
  DcopsDashboardData, 
  ApproverDashboardData, 
  RequesterDashboardData 
} from "@/types/dashboard";
import { DashboardRole, getPrimaryRole, getRoleLabel } from "@/lib/dashboard/registry";

export type DashboardData = 
  | { role: "ADMIN"; data: AdminDashboardData }
  | { role: "DCOPS"; data: DcopsDashboardData }
  | { role: "APPROVER"; data: ApproverDashboardData }
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
    case "APPROVER":
      return <ApproverWidgets data={data.data as ApproverDashboardData} />;
    case "REQUESTER":
      return <RequesterWidgets data={data.data as RequesterDashboardData} />;
    default:
      return null;
  }
}

export { getPrimaryRole, getRoleLabel };
export type { DashboardRole };
