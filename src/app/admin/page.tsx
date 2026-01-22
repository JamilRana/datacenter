// src/app/admin/page.tsx
import prisma from "@/lib/prisma";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, FileText, Server, Shield } from "lucide-react";

export default async function AdminDashboard() {
  const userCount = await prisma.user.count();
  const requestCount = await prisma.request.count();
  const vmCount = await prisma.vmInstance.count();
  const auditCount = await prisma.auditLog.count();

  const stats = [
    { title: "Total Users", value: userCount, icon: Users, color: "text-blue-600" },
    { title: "Total Requests", value: requestCount, icon: FileText, color: "text-green-600" },
    { title: "Active VMs", value: vmCount, icon: Server, color: "text-indigo-600" },
    { title: "Audit Logs", value: auditCount, icon: Shield, color: "text-orange-600" },
  ];

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Admin Overview</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat) => (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <stat.icon className={`h-4 w-4 ${stat.color}`} />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stat.value}</div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
