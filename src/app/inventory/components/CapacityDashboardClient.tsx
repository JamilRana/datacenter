// "use client";

import { Cpu, Database, HardDrive, LucideIcon } from "lucide-react";

interface CapacityMetrics {
  physical: { cpu: number; ram: number; storage: number; serverCount: number };
  allocated: { cpu: number; ram: number; storage: number; vmCount: number };
  available: { cpu: number; ram: number; storage: number };
}

export function CapacityDashboardClient({ metrics }: { metrics: CapacityMetrics }) {
  const cpuPercent = metrics.physical.cpu > 0 ? Math.min(100, (metrics.allocated.cpu / metrics.physical.cpu) * 100) : 0;
  const ramPercent = metrics.physical.ram > 0 ? Math.min(100, (metrics.allocated.ram / metrics.physical.ram) * 100) : 0;
  const storagePercent = metrics.physical.storage > 0 ? Math.min(100, (metrics.allocated.storage / metrics.physical.storage) * 100) : 0;

  return (
    <div className="space-y-12">
      <UsageRow 
        title="CPU Core Allocation" 
        current={metrics.allocated.cpu} 
        total={metrics.physical.cpu} 
        percent={cpuPercent} 
        unit="Cores"
        icon={Cpu}
        color="bg-indigo-600"
      />

      <UsageRow 
        title="System RAM Utilization" 
        current={metrics.allocated.ram} 
        total={metrics.physical.ram} 
        percent={ramPercent} 
        unit="GB"
        icon={Database}
        color="bg-emerald-500"
      />

      <UsageRow 
        title="San Storage Provisioning" 
        current={+(metrics.allocated.storage / 1024).toFixed(1)} 
        total={+(metrics.physical.storage / 1024).toFixed(1)} 
        percent={storagePercent} 
        unit="TB"
        icon={HardDrive}
        color="bg-blue-600"
      />
      
      {/* Visual Legend */}
      <div className="flex items-center gap-6 pt-6 border-t border-slate-50 justify-end">
         <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-slate-200" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Available Capacity</span>
         </div>
         <div className="flex items-center gap-2">
            <div className="h-3 w-3 rounded-sm bg-blue-500" />
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Reserved Workloads</span>
         </div>
      </div>
    </div>
  );
}

interface UsageRowProps {
  title: string;
  current: number;
  total: number;
  percent: number;
  unit: string;
  icon: LucideIcon; 
  color: string;
}

function UsageRow({ title, current, total, percent, unit, icon: Icon, color }: UsageRowProps) {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-end">
         <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-lg ${color} bg-opacity-10 text-current`}>
               <Icon className={`h-5 w-5 ${color.replace('bg-', 'text-')}`} />
            </div>
            <div>
               <p className="text-sm font-bold text-slate-800">{title}</p>
               <p className="text-xs text-slate-500 font-medium">Provisioned: {current} {unit} of {total} {unit}</p>
            </div>
         </div>
         <div className="text-right">
            <p className="text-2xl font-black text-slate-900 leading-none">{percent.toFixed(0)}%</p>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter mt-1">Utilization</p>
         </div>
      </div>
      
      <div className="relative h-3 w-full bg-slate-100 rounded-full overflow-hidden shadow-inner border border-slate-200/50">
         <div 
            className={`absolute top-0 left-0 h-full ${color} transition-all duration-1000 ease-out shadow-lg`}
            style={{ width: `${percent}%` }}
         />
      </div>
    </div>
  );
}