import { Badge } from "./ui/badge";

export function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    DRAFT: "bg-slate-200 text-slate-800",
    PENDING_L1: "bg-yellow-100 text-yellow-800",
    APPROVED: "bg-green-100 text-green-800",
    REJECTED: "bg-red-100 text-red-800",
    IN_PROGRESS: "bg-blue-100 text-blue-800",
    COMPLETED: "bg-purple-100 text-purple-800",
  };

  return (
    <Badge className={map[status] || "bg-slate-200 text-slate-800"}>
      {status.replace("_", " ")}
    </Badge>
  );
}