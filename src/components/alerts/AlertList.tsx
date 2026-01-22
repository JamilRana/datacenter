// src/components/alerts/alert-list.tsx
import { AlertCircle, Zap, Info, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { formatDistanceToNow } from "date-fns";

interface Alert {
  id: string;
  severity: "critical" | "warning" | "info";
  message: string;
  source: string; // e.g., "node-03", "storage-01"
  timestamp: string; // ISO date string
}

export function AlertList({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <ShieldCheck className="w-12 h-12 mx-auto mb-2 text-green-500" />
        <p>No active alerts</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {alerts.map((alert) => (
        <div 
          key={alert.id} 
          className={`p-3 rounded-lg border ${
            alert.severity === "critical" 
              ? "border-red-200 bg-red-50" 
              : alert.severity === "warning" 
                ? "border-yellow-200 bg-yellow-50" 
                : "border-blue-200 bg-blue-50"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`mt-0.5 ${
              alert.severity === "critical" 
                ? "text-red-500" 
                : alert.severity === "warning" 
                  ? "text-yellow-500" 
                  : "text-blue-500"
            }`}>
              {alert.severity === "critical" ? (
                <AlertCircle className="w-5 h-5" />
              ) : alert.severity === "warning" ? (
                <Zap className="w-5 h-5" />
              ) : (
                <Info className="w-5 h-5" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex justify-between">
                <span className="font-medium text-sm">{alert.message}</span>
                <Badge variant={
                  alert.severity === "critical" ? "destructive" : 
                  alert.severity === "warning" ? "secondary" : "default"
                }>
                  {alert.severity}
                </Badge>
              </div>
              
              <div className="flex justify-between mt-1 text-xs text-muted-foreground">
                <span>{alert.source}</span>
                <span>{formatDistanceToNow(new Date(alert.timestamp))} ago</span>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}