"use client";

import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { LucideIcon, Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";

interface StatCardProps {
  title: string;
  value: string | number;
  icon?: LucideIcon | React.ReactNode;
  description?: string;
  subtitle?: string;
  periodType?: "Current" | "In selected period";
  tooltip?: string;
  trend?: {
    value: number;
    isPositive: boolean;
  };
  className?: string;
}

export function StatCard({
  title,
  value,
  icon,
  description,
  subtitle,
  periodType,
  tooltip,
  trend,
  className,
}: StatCardProps) {
  const renderIcon = () => {
    if (!icon) return null;
    if (React.isValidElement(icon)) {
      return icon;
    }
    if (typeof icon === "function" || (typeof icon === "object" && icon !== null)) {
      const IconComp = icon as React.ComponentType<{ className?: string }>;
      return <IconComp className="h-5 w-5 text-indigo-600" />;
    }
    return null;
  };

  return (
    <Card className={cn("overflow-hidden border-slate-200 shadow-sm", className)}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              <p className="text-xs font-bold text-slate-600 uppercase tracking-wider">{title}</p>
              {tooltip && (
                <span title={tooltip} className="inline-flex cursor-help focus:outline-none focus-visible:ring-1 focus-visible:ring-indigo-500 rounded">
                  <Info size={12} className="text-slate-500 hover:text-indigo-600 transition-colors" />
                </span>
              )}
              {periodType && (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-semibold px-1.5 py-0 border leading-tight",
                    periodType === "Current"
                      ? "bg-slate-50 text-slate-700 border-slate-200"
                      : "bg-indigo-50 text-indigo-700 border-indigo-200"
                  )}
                >
                  {periodType}
                </Badge>
              )}
            </div>

            <p className="text-2xl md:text-3xl font-extrabold text-slate-900 tracking-tight">{value}</p>

            {(subtitle || description) && (
              <p className="text-xs text-slate-600 font-medium">{subtitle || description}</p>
            )}

            {trend && (
              <p
                className={cn(
                  "text-xs font-semibold flex items-center gap-1 mt-1",
                  trend.isPositive ? "text-emerald-600" : "text-rose-600"
                )}
              >
                <span>{trend.isPositive ? "↑" : "↓"}</span>
                <span>{Math.abs(trend.value)}%</span>
              </p>
            )}
          </div>

          {icon && (
            <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100 text-slate-700 flex-shrink-0">
              {renderIcon()}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
