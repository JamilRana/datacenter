// src/app/admin/settings/page.tsx
import prisma from "@/lib/prisma";
import SettingsForm from "./SettingsForm";


export default async function AdminSettings() {
  const settings = await (prisma as any).systemSetting.findMany();

  // Ensure default settings exist if not in DB
  const defaultSettings = [
    { key: "APPROVAL_FLOW", value: "L1-L2-L3", label: "Approval Flow", description: "Sequence of approval levels" },
    { key: "RENEWAL_PERIOD_MONTHS", value: "12", label: "Default Renewal Period", description: "Default period in months for VM renewals" },
    { key: "NOTIFICATION_EMAIL", value: "admin@example.com", label: "Notification Email", description: "Email for system notifications" },
  ];

  const mergedSettings = defaultSettings.map(ds => {
    const dbSetting = (settings as any[]).find((s: any) => s.key === ds.key);
    return dbSetting ? { ...ds, value: dbSetting.value } : ds;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold text-slate-800">Global Settings</h1>
      <SettingsForm settings={mergedSettings} />
    </div>
  );
}
