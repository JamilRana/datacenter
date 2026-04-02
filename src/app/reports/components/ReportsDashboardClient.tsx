// src/app/reports/components/ReportsDashboardClient.tsx
"use client";

import { useState } from "react";
import { 
  Tabs, 
  TabsContent, 
  TabsList, 
  TabsTrigger 
} from "@/components/ui/tabs";
import { 
  Users, 
  HardDrive, 
  Activity, 
  ListChecks, 
  AlertCircle, 
  ShieldAlert,
  BarChart4
} from "lucide-react";
import { UserAllocationTable } from "./tables/UserAllocationTable";
import { VmInventoryTable } from "./tables/VmInventoryTable";
import { CapacityTable } from "./tables/CapacityTable";
import { RequestsTable } from "./tables/RequestsTable";
import { RenewalsTable } from "./tables/RenewalsTable";
import { AuditTrailTable } from "./tables/AuditTrailTable";
import { UserVmModal } from "./UserVmModal";
import { Badge } from "@/components/ui/badge";
import { format } from "date-fns";

interface ReportsDashboardClientProps {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
    id?: string | null;
    roles?: string[];
  };
  permissions: {
    canViewAllocation: boolean;
    canViewInventory: boolean;
    canViewCapacity: boolean;
    canViewRequests: boolean;
    canViewRenewals: boolean;
    canViewAudit: boolean;
  };
}

export function ReportsDashboardClient({ user, permissions }: ReportsDashboardClientProps) {
  const [activeTab, setActiveTab] = useState("allocation");
  const [modalUserId, setModalUserId] = useState<string | null>(null);
  const [modalUserName, setModalUserName] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [dateRange, setDateRange] = useState<{ from: Date; to: Date }>({
    from: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    to: new Date()
  });
  const [datePreset, setDatePreset] = useState("30D");

  const handleDatePreset = (preset: string) => {
    let from: Date;
    
    switch (preset) {
      case "Today":
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        from = today;
        break;
      case "7D":
        from = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "30D":
        from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "6M":
        from = new Date(Date.now() - 180 * 24 * 60 * 60 * 1000);
        break;
      default:
        from = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    }
    
    setDatePreset(preset);
    setDateRange({ from, to: new Date() });
  };

  const handleUserClick = (id: string, name: string) => {
    setModalUserId(id);
    setModalUserName(name);
    setIsModalOpen(true);
  };

  const tabs = [
    { id: "allocation", label: "User Allocation", icon: Users, show: permissions.canViewAllocation },
    { id: "inventory", label: "VM Inventory", icon: HardDrive, show: permissions.canViewInventory },
    { id: "capacity", label: "Cluster Capacity", icon: Activity, show: permissions.canViewCapacity },
    { id: "requests", label: "Requests", icon: ListChecks, show: permissions.canViewRequests },
    { id: "renewals", label: "Renewals", icon: AlertCircle, show: permissions.canViewRenewals },
    { id: "audit", label: "Audit Trail", icon: ShieldAlert, show: permissions.canViewAudit },
  ].filter(tab => tab.show);

  return (
    <div className="p-6 md:p-8 space-y-8 max-w-[1600px] mx-auto">
      {/* Header Section */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
             <div className="h-10 w-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <BarChart4 size={24} />
             </div>
             <div>
                <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Resource & Allocation Reports</h1>
                <div className="flex items-center gap-2 text-slate-500 mt-1">
                  <span className="text-sm font-medium">{format(new Date(), "EEEE, MMMM dd, yyyy")}</span>
                  <span className="h-1 w-1 rounded-full bg-slate-300"></span>
                  <Badge variant="secondary" className="bg-indigo-50 text-indigo-700 hover:bg-indigo-50 border-none px-2 py-0 text-[11px] font-bold uppercase">
                    {user?.roles?.[0] || "User"} Access
                  </Badge>
                </div>
             </div>
          </div>
        </div>

        {/* Global Controls / Date Picker */}
        <div className="flex items-center gap-3 p-1.5 bg-white border border-slate-200 rounded-xl shadow-sm">
           <div className="flex bg-slate-100 rounded-lg p-1">
              {['Today', '7D', '30D', '6M'].map((period) => (
                <button 
                  key={period}
                  onClick={() => handleDatePreset(period)}
                  className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${datePreset === period ? 'bg-white text-indigo-600 shadow-sm' : 'text-slate-500 hover:text-slate-700'}`}
                >
                  {period}
                </button>
              ))}
           </div>
           <div className="h-8 w-[1px] bg-slate-200"></div>
           <div className="flex items-center gap-2">
             <input 
               type="date" 
               className="text-xs border border-slate-200 rounded px-2 py-1"
               value={format(dateRange.from, "yyyy-MM-dd")}
               onChange={(e) => {
                 setDatePreset("Custom");
                 setDateRange({ 
                   from: new Date(e.target.value), 
                   to: dateRange.to 
                 });
               }}
             />
             <span className="text-xs text-slate-400">to</span>
             <input 
               type="date" 
               className="text-xs border border-slate-200 rounded px-2 py-1"
               value={format(dateRange.to, "yyyy-MM-dd")}
               onChange={(e) => {
                 setDatePreset("Custom");
                 setDateRange({ 
                   from: dateRange.from, 
                   to: new Date(e.target.value) 
                 });
               }}
             />
           </div>
        </div>
      </div>

      {/* Main Content Area */}
      <Tabs defaultValue="allocation" className="w-full" onValueChange={setActiveTab}>
        <div className="sticky top-0 z-40 bg-slate-50/95 backdrop-blur-md pt-2 -mt-2 pb-4">
          <TabsList className="h-14 bg-white p-1 rounded-2xl border border-slate-200 shadow-sm gap-1 w-full md:w-auto scrollbar-hide overflow-x-auto justify-start">
            {tabs.map(tab => (
              <TabsTrigger 
                key={tab.id} 
                value={tab.id}
                className="rounded-xl px-5 gap-3 data-[state=active]:bg-indigo-600 data-[state=active]:text-white data-[state=active]:shadow-lg data-[state=active]:shadow-indigo-100 font-bold transition-all h-full"
              >
                <tab.icon size={18} />
                <span className="whitespace-nowrap">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </div>

        <div className="mt-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
          <TabsContent value="allocation" className="m-0 focus-visible:outline-none">
            <UserAllocationTable onUserClick={handleUserClick} dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="inventory" className="m-0 focus-visible:outline-none">
            <VmInventoryTable dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="capacity" className="m-0 focus-visible:outline-none">
            <CapacityTable dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="requests" className="m-0 focus-visible:outline-none">
            <RequestsTable dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="renewals" className="m-0 focus-visible:outline-none">
            <RenewalsTable dateRange={dateRange} />
          </TabsContent>

          <TabsContent value="audit" className="m-0 focus-visible:outline-none">
            <AuditTrailTable dateRange={dateRange} />
          </TabsContent>
        </div>
      </Tabs>

      {/* Shared Modals */}
      <UserVmModal 
        userId={modalUserId}
        userName={modalUserName}
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />

      {/* Informational Footer */}
      <div className="flex flex-col md:flex-row justify-between items-center py-6 border-t border-slate-200 gap-4 opacity-60 grayscale hover:opacity-100 hover:grayscale-0 transition-all">
         <div className="flex items-center gap-4">
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
               <ShieldAlert size={16} className="text-slate-400" /> Secure Auditor Access Verified
            </div>
            <div className="w-[1px] h-4 bg-slate-300"></div>
            <div className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-widest">
               <Activity size={16} className="text-slate-400" /> Real-time Data Sync Enabled
            </div>
         </div>
         <p className="text-xs font-medium text-slate-400 font-mono">
            System Hash: {activeTab.toUpperCase()}_REV_2026.03.29
         </p>
      </div>
    </div>
  );
}