// src/app/admin/settings/page.tsx
"use client";
import SettingsForm from "./SettingsForm";
import { useSession } from "next-auth/react";
import { useEffect, useState } from "react";
import { getSettings } from "@/app/actions/settings-actions";
import { SystemSetting } from "@prisma/client";


export default async function AdminSettings() {
  const {data:session} = useSession();
  const [settings, setSettings] = useState<SystemSetting []>([]);

  if (!session?.user?.id) {
    throw new Error("Unauthorized");
  }

  const userId = session.user.id;

  useEffect(() => {
    const fetchSettings = async () => {
try {
  const res = await getSettings();
setSettings(res);
} catch (error) {
  console.error("Failed to fetch settings:", error);
}
    }
    fetchSettings();
  }, [session]);

  // Ensure default settings exist if not in DB
  const defaultSettings = [
    { key: "APPROVAL_FLOW", value: "L1-L2-L3", label: "Approval Flow", description: "Sequence of approval levels" },
    { key: "RENEWAL_PERIOD_MONTHS", value: "12", label: "Default Renewal Period", description: "Default period in months for VM renewals" },
    { key: "NOTIFICATION_EMAIL", value: "admin@example.com", label: "Notification Email", description: "Email for system notifications" },
  ];

  const mergedSettings = defaultSettings.map(ds => {
    const dbSetting = settings.find((s) => s.key === ds.key);
    return dbSetting ? { ...ds, value: dbSetting.value } : ds;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Global Settings</h1>
      <SettingsForm settings={mergedSettings} />
    </div>
  );
}
