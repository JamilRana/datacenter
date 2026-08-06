// src/app/admin/settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import { redirect } from "next/navigation";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Settings, 
  Mail, 
  HardDrive, 
  Database, 
  Save, 
  RefreshCw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Server,
  Download,
  Upload
} from "lucide-react";

interface SystemHealth {
  database: "connected" | "disconnected";
  diskUsage: number;
  uploadPath: string;
  uploadSize: number;
}

interface Setting {
  key: string;
  value: string;
  label?: string | null;
  description?: string | null;
}

export default function AdminSettingsPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<string | null>(null);
  const [health, setHealth] = useState<SystemHealth | null>(null);
  
  // SMTP Form
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("");
  const [smtpSecure, setSmtpSecure] = useState("false");
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  
  // General Settings
  const [approvalFlow, setApprovalFlow] = useState("");
  const [renewalPeriod, setRenewalPeriod] = useState("");
  const [notificationEmail, setNotificationEmail] = useState("");

  // Backup & Restore
  const [backingUp, setBackingUp] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleExportBackup = async () => {
    setBackingUp(true);
    try {
      const res = await fetch("/api/admin/backup");
      if (!res.ok) throw new Error("Failed to generate backup");
      
      const data = await res.json();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `datacenter-backup-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      
      toast.success("Backup downloaded successfully");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create backup");
    } finally {
      setBackingUp(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      setSelectedFile(e.target.files[0]);
    }
  };

  const handleRestoreBackup = async () => {
    if (!selectedFile) {
      toast.error("Please select a backup file first");
      return;
    }

    const confirmRestore = window.confirm(
      "WARNING: Restoring this backup will completely wipe the current database and replace it. This cannot be undone. Do you want to proceed?"
    );
    if (!confirmRestore) return;

    setRestoring(true);
    try {
      const fileText = await selectedFile.text();
      const backupData = JSON.parse(fileText);

      const res = await fetch("/api/admin/backup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(backupData),
      });

      if (res.ok) {
        toast.success("Database restored successfully!");
        setSelectedFile(null);
        fetchHealth();
      } else {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to restore backup");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to restore backup");
    } finally {
      setRestoring(false);
    }
  };

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      redirect("/auth");
      return;
    }
    if (!session.user.roles.includes("ADMIN")) {
      redirect("/");
      return;
    }
    fetchSettings();
    fetchHealth();
  }, [session, status]);

  const fetchSettings = async () => {
    try {
      const res = await fetch("/api/admin/settings");
      const data = await res.json();
      
      // Populate form fields
      data.settings?.forEach((s: Setting) => {
        switch (s.key) {
          case "smtp_host": setSmtpHost(s.value); break;
          case "smtp_port": setSmtpPort(s.value); break;
          case "smtp_secure": setSmtpSecure(s.value); break;
          case "smtp_user": setSmtpUser(s.value); break;
          case "smtp_password": setSmtpPassword(s.value); break;
          case "smtp_from": setSmtpFrom(s.value); break;
          case "APPROVAL_FLOW": setApprovalFlow(s.value); break;
          case "RENEWAL_PERIOD_MONTHS": setRenewalPeriod(s.value); break;
          case "NOTIFICATION_EMAIL": setNotificationEmail(s.value); break;
        }
      });
    } catch (error) {
      console.error("Failed to load settings:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchHealth = async () => {
    try {
      const res = await fetch("/api/admin/health");
      const data = await res.json();
      setHealth(data);
    } catch (error) {
      console.error("Failed to load health:", error);
    }
  };

  const handleSaveSMTP = () => {
    const settingsToSave = [
      { key: "smtp_host", value: smtpHost },
      { key: "smtp_port", value: smtpPort },
      { key: "smtp_secure", value: smtpSecure },
      { key: "smtp_user", value: smtpUser },
      { key: "smtp_password", value: smtpPassword },
      { key: "smtp_from", value: smtpFrom },
    ];
    saveSettings(settingsToSave);
  };

  const handleSaveGeneral = () => {
    const settingsToSave = [
      { key: "APPROVAL_FLOW", value: approvalFlow },
      { key: "RENEWAL_PERIOD_MONTHS", value: renewalPeriod },
      { key: "NOTIFICATION_EMAIL", value: notificationEmail },
    ];
    saveSettings(settingsToSave);
  };

  const saveSettings = async (settingsToSave: { key: string; value: string }[]) => {
    setSaving("bulk");
    try {
      const res = await fetch("/api/admin/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ settings: settingsToSave }),
      });
      
      if (res.ok) {
        toast.success("Settings saved successfully");
        fetchSettings();
      } else {
        throw new Error("Failed to save settings");
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save settings");
    } finally {
      setSaving(null);
    }
  };

  if (loading || status === "loading") {
    return (
      <div className="p-6 md:p-10">
        <div className="animate-pulse space-y-6">
          <div className="h-8 bg-slate-200 rounded w-64"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">System Settings</h1>
        <p className="text-slate-500 mt-1">Configure system-level settings and monitor health</p>
      </div>

      {/* System Health Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className={health?.database === "connected" ? "border-emerald-300" : "border-red-300"}>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${health?.database === "connected" ? "bg-emerald-100" : "bg-red-100"}`}>
                  <Database className={`h-5 w-5 ${health?.database === "connected" ? "text-emerald-600" : "text-red-600"}`} />
                </div>
                <div>
                  <p className="font-medium">Database</p>
                  <p className="text-sm text-slate-500">{health?.database === "connected" ? "Connected" : "Disconnected"}</p>
                </div>
              </div>
              {health?.database === "connected" ? (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              ) : (
                <XCircle className="h-5 w-5 text-red-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <HardDrive className="h-5 w-5 text-blue-600" />
                </div>
                <div>
                  <p className="font-medium">Disk Usage</p>
                  <p className="text-sm text-slate-500">{health?.diskUsage || 0}% used</p>
                </div>
              </div>
              {(health?.diskUsage || 0) > 90 ? (
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              ) : (
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              )}
            </div>
            <div className="mt-3 h-2 bg-slate-100 rounded-full overflow-hidden">
              <div 
                className={`h-full ${(health?.diskUsage || 0) > 90 ? "bg-amber-500" : "bg-blue-500"}`} 
                style={{ width: `${health?.diskUsage || 0}%` }}
              />
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-200">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-purple-100">
                  <Server className="h-5 w-5 text-purple-600" />
                </div>
                <div>
                  <p className="font-medium">Upload Storage</p>
                  <p className="text-sm text-slate-500">{formatBytes(health?.uploadSize || 0)}</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" onClick={fetchHealth}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Settings Tabs */}
      <Tabs defaultValue="smtp" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="smtp" className="gap-2">
            <Mail className="h-4 w-4" /> SMTP Configuration
          </TabsTrigger>
          <TabsTrigger value="general" className="gap-2">
            <Settings className="h-4 w-4" /> General Settings
          </TabsTrigger>
          <TabsTrigger value="backup" className="gap-2">
            <Database className="h-4 w-4" /> Backup & Restore
          </TabsTrigger>
        </TabsList>

        <TabsContent value="smtp">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="h-5 w-5 text-indigo-600" />
                SMTP Email Configuration
              </CardTitle>
              <CardDescription>
                Configure the mail server for sending notifications and alerts
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>SMTP Host</Label>
                  <Input 
                    value={smtpHost} 
                    onChange={(e) => setSmtpHost(e.target.value)}
                    placeholder="smtp.example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Port</Label>
                  <Input 
                    value={smtpPort} 
                    onChange={(e) => setSmtpPort(e.target.value)}
                    placeholder="587"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Username</Label>
                  <Input 
                    value={smtpUser} 
                    onChange={(e) => setSmtpUser(e.target.value)}
                    placeholder="user@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>SMTP Password</Label>
                  <Input 
                    type="password"
                    value={smtpPassword} 
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••"
                  />
                </div>
                <div className="space-y-2">
                  <Label>From Email Address</Label>
                  <Input 
                    value={smtpFrom} 
                    onChange={(e) => setSmtpFrom(e.target.value)}
                    placeholder="noreply@example.com"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Use SSL/TLS</Label>
                  <select 
                    className="w-full h-10 px-3 rounded-md border border-slate-200 bg-background"
                    value={smtpSecure}
                    onChange={(e) => setSmtpSecure(e.target.value)}
                  >
                    <option value="false">No (STARTTLS)</option>
                    <option value="true">Yes (SSL/TLS)</option>
                  </select>
                </div>
              </div>
              <div className="pt-4">
                <Button 
                  onClick={handleSaveSMTP} 
                  disabled={saving === "bulk"}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving === "bulk" ? "Saving..." : "Save SMTP Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="general">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="h-5 w-5 text-indigo-600" />
                General System Settings
              </CardTitle>
              <CardDescription>
                Configure default behaviors and system-wide options
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Approval Flow</Label>
                <Input 
                  value={approvalFlow} 
                  onChange={(e) => setApprovalFlow(e.target.value)}
                  placeholder="L1-L2-L3"
                />
                <p className="text-xs text-slate-500">Sequence of approval levels</p>
              </div>
              
              <div className="space-y-2">
                <Label>Default Renewal Period (Months)</Label>
                <Input 
                  value={renewalPeriod} 
                  onChange={(e) => setRenewalPeriod(e.target.value)}
                  placeholder="12"
                />
              </div>
              
              <div className="space-y-2">
                <Label>Notification Email</Label>
                <Input 
                  value={notificationEmail} 
                  onChange={(e) => setNotificationEmail(e.target.value)}
                  placeholder="admin@example.com"
                />
                <p className="text-xs text-slate-500">Email for system notifications</p>
              </div>
              
              <div className="pt-4">
                <Button 
                  onClick={handleSaveGeneral} 
                  disabled={saving === "bulk"}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  <Save className="h-4 w-4 mr-2" />
                  {saving === "bulk" ? "Saving..." : "Save General Settings"}
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="backup">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Database className="h-5 w-5 text-indigo-600" />
                Database Backup & Restore
              </CardTitle>
              <CardDescription>
                Export the database to a file or restore the database from a previously exported backup file
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div>
                  <h4 className="font-semibold text-amber-800">Critical warning for Administrators</h4>
                  <p className="text-sm text-amber-700 mt-1">
                    Restoring a backup will overwrite all current system data, including VM instances, user credentials, approval history, and audit logs. Please ensure you have a current export before restoring.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                {/* Export Section */}
                <div className="p-5 border border-slate-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                    <Download className="h-5 w-5 text-indigo-600" />
                    Export Backup
                  </h3>
                  <p className="text-sm text-slate-500">
                    Generate and download a snapshot of the current database state as a JSON file.
                  </p>
                  <Button 
                    onClick={handleExportBackup} 
                    disabled={backingUp}
                    className="w-full bg-indigo-600 hover:bg-indigo-700"
                  >
                    {backingUp ? "Generating Backup..." : "Download Backup File"}
                  </Button>
                </div>

                {/* Import Section */}
                <div className="p-5 border border-slate-200 rounded-lg space-y-4">
                  <h3 className="font-semibold text-lg text-slate-800 flex items-center gap-2">
                    <Upload className="h-5 w-5 text-amber-600" />
                    Restore Backup
                  </h3>
                  <p className="text-sm text-slate-500">
                    Select a previously exported `.json` backup file to overwrite the database.
                  </p>
                  
                  <div className="space-y-2">
                    <input 
                      type="file" 
                      accept=".json"
                      onChange={handleFileChange}
                      className="hidden"
                      id="backup-file-upload"
                    />
                    <label 
                      htmlFor="backup-file-upload"
                      className="flex items-center justify-center border border-dashed border-slate-300 rounded-md p-3 text-sm text-slate-600 cursor-pointer hover:bg-slate-50 transition"
                    >
                      {selectedFile ? selectedFile.name : "Choose backup file (.json)"}
                    </label>
                  </div>

                  <Button 
                    onClick={handleRestoreBackup} 
                    disabled={restoring || !selectedFile}
                    className="w-full bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {restoring ? "Restoring Database..." : "Restore Database"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
