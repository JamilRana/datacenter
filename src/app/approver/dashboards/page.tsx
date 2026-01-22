// src/app/approvals/page.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Eye, 
  Check, 
  X, 
  Server, 
  TrendingUp,
  ShieldCheck
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ResourceChart } from "@/components/charts/ResourceChart";

export default function ApproverDashboard() {
  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Approval Dashboard</h1>
      
      {/* Approval Queue */}
      <Card>
        <CardHeader>
          <CardTitle>Pending Approvals</CardTitle>
        </CardHeader>
        <CardContent>
          <ApprovalQueue requests={[
            { 
              id: "REQ-004", 
              name: "HR System", 
              requester: "Jannatul Ferdous Mona", 
              level: "L1", 
              resources: "8 vCPU / 32GB RAM" 
            },
            { 
              id: "REQ-005", 
              name: "Finance DB", 
              requester: "Younus Jamil Rana", 
              level: "L2", 
              resources: "16 vCPU / 64GB RAM" 
            }
          ]} />
        </CardContent>
      </Card>

      {/* Resource Monitoring */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Resource Utilization Trends</CardTitle>
          </CardHeader>
          <CardContent>
            <ResourceChart data={[
              { date: "Jan", cpu: 45, ram: 62 },
              { date: "Feb", cpu: 52, ram: 70 },
              { date: "Mar", cpu: 68, ram: 85 }
            ]} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Compliance Status</CardTitle>
          </CardHeader>
          <CardContent>
            <ComplianceStats stats={[
              { name: "Public IP Requests", value: "12", status: "warning" },
              { name: "VPN Access", value: "8", status: "ok" },
              { name: "Missing VA Reports", value: "3", status: "critical" }
            ]} />
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <ActivityLog activities={[
            { action: "Approved", item: "REQ-003", user: "L2 Approver", time: "2h ago" },
            { action: "Rejected", item: "REQ-002", user: "L1 Approver", time: "5h ago" }
          ]} />
        </CardContent>
      </Card>
    </div>
  );
}

function ApprovalQueue({ requests }: { requests: any[] }) {
  return (
    <div className="space-y-4">
      {requests.map((req) => (
        <div key={req.id} className="p-4 border rounded-lg flex justify-between items-center">
          <div>
            <div className="font-medium">{req.name}</div>
            <div className="text-sm text-muted-foreground">
              {req.requester} • {req.resources}
            </div>
            <div className="text-xs mt-1">
              <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                {req.level}
              </span>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline">
              <Eye className="w-4 h-4 mr-1" /> Review
            </Button>
            <Button size="sm" variant="default">
              <Check className="w-4 h-4 mr-1" /> Approve
            </Button>
            <Button size="sm" variant="destructive">
              <X className="w-4 h-4 mr-1" /> Reject
            </Button>
          </div>
        </div>
      ))}
    </div>
  );
}

function ComplianceStats({ stats }: { stats: any[] }) {
  return (
    <div className="space-y-4">
      {stats.map((stat) => (
        <div key={stat.name} className="flex justify-between items-center">
          <div className="flex items-center gap-2">
            <ShieldCheck className={`w-4 h-4 ${
              stat.status === "critical" ? "text-red-500" : 
              stat.status === "warning" ? "text-yellow-500" : "text-green-500"
            }`} />
            <span>{stat.name}</span>
          </div>
          <span className="font-bold">{stat.value}</span>
        </div>
      ))}
    </div>
  );
}

function ActivityLog({ activities }: { activities: any[] }) {
  return (
    <div className="space-y-3">
      {activities.map((activity, i) => (
        <div key={i} className="flex items-center gap-3">
          <div className="w-2 h-2 rounded-full bg-primary"></div>
          <div className="flex-1">
            <span className="font-medium">{activity.action}</span> 
            {" "} {activity.item} by {activity.user}
          </div>
          <div className="text-sm text-muted-foreground">{activity.time}</div>
        </div>
      ))}
    </div>
  );
}