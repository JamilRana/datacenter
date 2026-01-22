// src/app/ops/page.tsx
"use client"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Server, 
  Database, 
  Network, 
  Cpu, 
  HardDrive,
  AlertCircle,
  Zap
} from "lucide-react";
import { ResourceGauge } from "@/components/charts/ResourceGauge";
import { AlertList } from "@/components/alerts/AlertList";
import { useState, useEffect } from "react";

export default function DcOpsDashboard() {
    const [alerts, setAlerts] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const response = await fetch("/api/alerts");
                const data = await response.json();
                setAlerts(data.alerts || []);
            } catch (error) {
                console.error("Failed to fetch alerts:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchAlerts();
        
        // Poll for updates every 30 seconds
        const interval = setInterval(fetchAlerts, 30000);
        return () => clearInterval(interval);
    }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Operations Dashboard</h1>
      
      {/* System Health */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <SystemHealthCard 
          title="Compute Nodes" 
          value="98%" 
          icon={Server} 
          status="healthy" 
        />
        <SystemHealthCard 
          title="Storage Cluster" 
          value="87%" 
          icon={HardDrive} 
          status="warning" 
        />
        <SystemHealthCard 
          title="Network" 
          value="100%" 
          icon={Network} 
          status="healthy" 
        />
        <SystemHealthCard 
          title="Database" 
          value="92%" 
          icon={Database} 
          status="healthy" 
        />
      </div>

      {/* Resource Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Real-time Resource Monitoring</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <ResourceGauge 
                title="CPU Usage" 
                value={68} 
                max={100} 
                color="blue" 
              />
              <ResourceGauge 
                title="Memory Usage" 
                value={75} 
                max={100} 
                color="purple" 
              />
              <ResourceGauge 
                title="Disk I/O" 
                value={42} 
                max={100} 
                color="green" 
              />
            </div>
          </CardContent>
        </Card>

<Card>
      <CardHeader>
        <CardTitle>Active Alerts</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="text-center py-8">Loading alerts...</div>
        ) : (
          <AlertList alerts={alerts} />
        )}
      </CardContent>
    </Card>
      </div>

      {/* Provisioning Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Provisioning Queue</CardTitle>
        </CardHeader>
        <CardContent>
          <ProvisioningQueue requests={[
            { id: "REQ-006", name: "Analytics Platform", status: "PROVISIONING", progress: 65 },
            { id: "REQ-007", name: "Backup Server", status: "QUEUED", progress: 0 }
          ]} />
        </CardContent>
      </Card>
    </div>
  );
}

function SystemHealthCard({ title, value, icon: Icon, status }: { 
  title: string; 
  value: string; 
  icon: any; 
  status: "healthy" | "warning" | "critical"; 
}) {
  const statusColors = {
    healthy: "text-green-500",
    warning: "text-yellow-500",
    critical: "text-red-500"
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        <Icon className={`w-4 h-4 ${statusColors[status]}`} />
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        <div className={`text-xs ${
          status === "healthy" ? "text-green-500" : 
          status === "warning" ? "text-yellow-500" : "text-red-500"
        }`}>
          {status.charAt(0).toUpperCase() + status.slice(1)}
        </div>
      </CardContent>
    </Card>
  );
}

function ProvisioningQueue({ requests }: { requests: any[] }) {
  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <div key={req.id} className="p-3 border rounded-lg">
          <div className="flex justify-between mb-2">
            <span className="font-medium">{req.name}</span>
            <span className="text-sm bg-blue-100 text-blue-800 px-2 py-1 rounded">
              {req.status}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-600 h-2 rounded-full" 
              style={{ width: `${req.progress}%` }}
            ></div>
          </div>
          <div className="text-right text-sm text-muted-foreground mt-1">
            {req.progress}%
          </div>
        </div>
      ))}
    </div>
  );
}