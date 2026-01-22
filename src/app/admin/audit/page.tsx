// src/app/admin/audit/page.tsx
import prisma from "@/lib/prisma";
import { format } from "date-fns";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function AuditLogPage() {
  const logs = await (prisma as any).auditLog.findMany({
    include: {
      actor: { select: { name: true, email: true } },
    },
    orderBy: { timestamp: "desc" },
    take: 100,
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">System Audit Logs</h1>
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 border-b">
                <tr>
                  <th className="p-4 font-semibold">Timestamp</th>
                  <th className="p-4 font-semibold">User</th>
                  <th className="p-4 font-semibold">Action</th>
                  <th className="p-4 font-semibold">Entity</th>
                  <th className="p-4 font-semibold">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {(logs as any[]).map((log: any) => (
                  <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 whitespace-nowrap text-slate-500">
                      {format(new Date(log.timestamp), "MMM d, yyyy HH:mm:ss")}
                    </td>
                    <td className="p-4">
                      <div className="font-medium text-slate-900">{log.actor.name}</div>
                      <div className="text-xs text-slate-500">{log.actor.email}</div>
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium uppercase tracking-wider">
                        {log.action}
                      </span>
                    </td>
                    <td className="p-4 text-slate-600">
                      {log.entityType} ({log.entityId?.substring(0, 8) || "N/A"})
                    </td>
                    <td className="p-4 text-slate-500 max-w-xs truncate">
                      {log.details ? (
                        <span title={JSON.stringify(log.details, null, 2) || ""}>
                          {typeof log.details === "string" ? log.details : JSON.stringify(log.details)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
