"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface StatusItem {
  status: string;
  count: number;
  color: string;
}

interface StatusDistributionProps {
  title: string;
  data: StatusItem[];
  className?: string;
}

export function StatusDistribution({
  title,
  data,
  className,
}: StatusDistributionProps) {
  const total = data.reduce((sum, item) => sum + item.count, 0);

  return (
    <Card className={cn("", className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-medium text-slate-700">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {data.map((item) => {
          const percentage = total > 0 ? (item.count / total) * 100 : 0;
          return (
            <div key={item.status} className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <div className="flex items-center gap-2">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{ backgroundColor: item.color }}
                  />
                  <span className="text-slate-600">{item.status}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-medium text-slate-900">
                    {item.count}
                  </span>
                  <span className="text-xs text-slate-400">
                    ({percentage.toFixed(1)}%)
                  </span>
                </div>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: item.color,
                  }}
                />
              </div>
            </div>
          );
        })}
        {data.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No data available
          </p>
        )}
      </CardContent>
    </Card>
  );
}
