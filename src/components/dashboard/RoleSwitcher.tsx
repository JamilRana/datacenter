"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Shield, User, Server, Key } from "lucide-react";

const ROLE_OPTIONS = [
  { value: "ADMIN", label: "Admin", icon: Shield },
  { value: "DC_OPS", label: "DCOPS", icon: Server },
  { value: "REQUESTER", label: "Requester", icon: User },
  { value: "DEVELOPER", label: "Developer", icon: Key },
];

const DEV_USER_EMAIL = "dev@datacenter.local";

export function RoleSwitcher() {
  const { data: session, update } = useSession();
  const [selectedRole, setSelectedRole] = useState<string>("ADMIN");

  const handleRoleSwitch = async (role: string) => {
    setSelectedRole(role);
    
    const roleMap: Record<string, string[]> = {
      ADMIN: ["ADMIN", "DC_OPS", "REQUESTER", "APPROVER_L1", "APPROVER_L2", "APPROVER_L3", "APPROVER_L4"],
      DC_OPS: ["DC_OPS", "REQUESTER", "APPROVER_L1", "APPROVER_L2", "APPROVER_L3", "APPROVER_L4"],
      REQUESTER: ["REQUESTER"],
      DEVELOPER: ["DEVELOPER", "REQUESTER"],
    };

    const roles = roleMap[role] || ["REQUESTER"];

    await update({
      ...session,
      user: {
        ...session?.user,
        roles,
      },
    });
  };

  const isDevUser = session?.user?.email === DEV_USER_EMAIL;

  if (!isDevUser) {
    return null;
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 bg-white border shadow-lg rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="outline" className="text-xs">DEV MODE</Badge>
        <span className="text-xs text-slate-500">Role Switcher</span>
      </div>
      <Select value={selectedRole} onValueChange={handleRoleSwitch}>
        <SelectTrigger className="w-[140px] h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {ROLE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              <div className="flex items-center gap-2">
                <option.icon className="h-3 w-3" />
                {option.label}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
