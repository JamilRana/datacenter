"use client";
import { useEffect, useState } from "react";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { exportToCsv } from "@/lib/export-utils";
import { Download, PieChart, LayoutDashboard, Database } from "lucide-react";

export default function ReportsDashboard() {
  const [stats, setStats] = useState<any>(null);
  const [requests, setRequests] = useState<any[]>([]);

  useEffect(() => {
    fetch("/api/inventory").then(res => res.json()).then(setStats);
    fetch("/api/requests").then(res => res.json()).then(setRequests);
  }, []);

  const exportRequests = () => {
    const rows = requests.map(r => ({
      ID: r.id,
      System: r.systemName,
      Status: r.status,
      Environment: r.environment,
      Requester: r.requesterId,
      Created: r.createdAt
    }));
    exportToCsv("requests-report.csv", rows);
  };

  if (!stats) return <div className="p-10 text-center">Loading stats...</div>;

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold flex items-center gap-2">
          <LayoutDashboard className="w-8 h-8" />
          Reports & Dashboard
        </h1>
        <Button onClick={exportRequests} className="flex items-center gap-2">
          <Download className="w-4 h-4" />
          Export All Requests
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Total VMs" value={stats.summary.vms} icon={Database} color="text-blue-600" />
        <StatCard title="Physical Assets" value={stats.summary.assets} icon={PieChart} color="text-green-600" />
        <StatCard title="Active Licenses" value={stats.summary.licenses} icon={LayoutDashboard} color="text-purple-600" />
        <StatCard title="Pending Requests" value={requests.filter(r => r.status.startsWith('PENDING')).length} icon={Database} color="text-orange-600" />
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Requests</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>System Name</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Environment</TableHead>
                <TableHead>Created At</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.slice(0, 10).map((req) => (
                <TableRow key={req.id}>
                  <TableCell className="font-medium">{req.systemName}</TableCell>
                  <TableCell>{req.status.replace(/_/g, ' ')}</TableCell>
                  <TableCell>{req.environment}</TableCell>
                  <TableCell>{new Date(req.createdAt).toLocaleDateString()}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color }: any) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
          <Icon className={`w-8 h-8 ${color} opacity-20`} />
        </div>
      </CardContent>
    </Card>
  );
}
