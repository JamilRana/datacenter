"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Database, Network, HardDrive, AlertCircle } from "lucide-react";
import { ResourceGauge } from "@/components/charts/ResourceGauge";
import { AlertList } from "@/components/alerts/AlertList";
import { useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";

export default function OpsHubPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = async () => {
    try {
      const response = await fetch("/api/dashboards/ops");
      const result = await response.json();
      setData(result);
    } catch (error) {
      console.error("Failed to fetch ops data:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !data) {
    return (
      <div className="p-8 flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-7xl mx-auto space-y-8">
      <header>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">Operations Hub</h1>
        <p className="text-slate-500 mt-1">Real-time system health and provisioning monitor.</p>
      </header>

      {/* System Health Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <HealthCard 
          title="Compute Nodes" 
          value={`${data?.systemHealth?.computeNodes?.value}%`} 
          status={data?.systemHealth?.computeNodes?.status} 
          icon={Server}
        />
        <HealthCard 
          title="Storage Cluster" 
          value={`${data?.systemHealth?.storageCluster?.value}%`} 
          status={data?.systemHealth?.storageCluster?.status} 
          icon={HardDrive}
        />
        <HealthCard 
          title="Network" 
          value={`${data?.systemHealth?.network?.value}%`} 
          status={data?.systemHealth?.network?.status} 
          icon={Network}
        />
        <HealthCard 
          title="Database" 
          value={`${data?.systemHealth?.database?.value}%`} 
          status={data?.systemHealth?.database?.status} 
          icon={Database}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Resource Gauges */}
        <Card className="lg:col-span-2 border-none shadow-sm bg-white">
          <CardHeader>
            <CardTitle className="text-lg font-bold">Resource Utilization</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 p-4">
              <ResourceGauge title="CPU Utilization" value={data?.resourceUsage?.cpu || 0} max={100} color="blue" />
              <ResourceGauge title="Memory Pressure" value={data?.resourceUsage?.memory || 0} max={100} color="indigo" />
              <ResourceGauge title="Disk I/O Weight" value={data?.resourceUsage?.diskIo || 0} max={100} color="green" />
            </div>
          </CardContent>
        </Card>

        {/* Active Alerts */}
        <Card className="border-none shadow-sm bg-white">
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-lg font-bold">Active Alerts</CardTitle>
            <Badge variant="outline" className="bg-red-50 text-red-600 border-red-100">
              {data?.alerts?.length || 0} New
            </Badge>
          </CardHeader>
          <CardContent>
            <AlertList alerts={data?.alerts || []} />
          </CardContent>
        </Card>
      </div>

      {/* Provisioning Queue */}
      <Card className="border-none shadow-sm bg-white">
        <CardHeader>
          <CardTitle className="text-lg font-bold">Provisioning Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {data?.provisioningQueue?.length > 0 ? (
              data.provisioningQueue.map((req: any) => (
                <div key={req.id} className="p-4 rounded-lg border bg-slate-50 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div className="flex items-center gap-4">
                    <div className="bg-white p-2 rounded border">
                      <Zap className="h-5 w-5 text-blue-500" />
                    </div>
                    <div>
                      <p className="font-semibold text-slate-900">{req.name}</p>
                      <p className="text-xs text-slate-500">ID: {req.id}</p>
                    </div>
                  </div>
                  
                  <div className="flex-1 max-w-md">
                    <div className="flex justify-between mb-1 text-xs">
                      <span className="font-medium text-slate-700">{req.status}</span>
                      <span className="text-slate-500">{req.progress}%</span>
                    </div>
                    <div className="w-full bg-slate-200 rounded-full h-2">
                      <div 
                        className="bg-blue-600 h-2 rounded-full transition-all duration-1000" 
                        style={{ width: `${req.progress}%` }}
                      ></div>
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-10 text-slate-500 italic">
                No active provisioning tasks in queue.
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Zap(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 14a1 1 0 0 1-.78-1.63l9.9-10.2a.5.5 0 0 1 .86.46l-1.92 6.02A1 1 0 0 0 13 10h7a1 1 0 0 1 .78 1.63l-9.9 10.2a.5.5 0 0 1-.86-.46l1.92-6.02A1 1 0 0 0 11 14z" />
    </svg>
  );
}

function HealthCard({ title, value, status, icon: Icon }: any) {
  const statusConfig = {
    healthy: { color: "text-green-600", bg: "bg-green-50", label: "Healthy" },
    warning: { color: "text-yellow-600", bg: "bg-yellow-50", label: "Warning" },
    critical: { color: "text-red-600", bg: "bg-red-50", label: "Critical" },
  };

  const config = (statusConfig as any)[status] || statusConfig.healthy;

  return (
    <Card className="border-none shadow-sm bg-white overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium text-slate-500 uppercase tracking-wider">{title}</CardTitle>
        <Icon className={`h-5 w-5 ${config.color}`} />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold text-slate-900">{value}</div>
        <div className={`mt-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${config.bg} ${config.color}`}>
          <div className={`h-1.5 w-1.5 rounded-full ${config.color.replace('text', 'bg')} mr-1.5`} />
          {config.label}
        </div>
      </CardContent>
    </Card>
  );
}
