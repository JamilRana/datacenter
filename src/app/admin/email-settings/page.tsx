// src/app/admin/email-settings/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getEmailSettings, saveEmailSettings, testEmailSettings } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Loader2, Save, Send, CheckCircle, XCircle } from "lucide-react";
import { ROLES } from "@/lib/roles";

interface EmailSettings {
  smtpHost: string;
  smtpPort: number;
  email: string;
  password: string;
  secure: boolean;
  enabled: boolean;
}

export default function EmailSettingsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [settings, setSettings] = useState<EmailSettings>({
    smtpHost: "",
    smtpPort: 587,
    email: "",
    password: "",
    secure: true,
    enabled: false,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [testEmail, setTestEmail] = useState("");

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !session.user.roles?.includes(ROLES.ADMIN)) {
      router.push("/");
      return;
    }

    const fetchSettings = async () => {
      try {
        const data = await getEmailSettings();
        if (data) {
          setSettings({
            smtpHost: data.smtpHost || "",
            smtpPort: data.smtpPort || 587,
            email: data.email || "",
            password: data.password || "",
            secure: data.secure ?? true,
            enabled: data.enabled ?? false,
          });
        }
      } catch (error) {
        console.error("Failed to fetch email settings:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchSettings();
  }, [session, status, router]);

  const handleSave = async () => {
    try {
      setSaving(true);
      await saveEmailSettings(settings);
      alert("Email settings saved successfully");
    } catch (error) {
      console.error("Failed to save email settings:", error);
      alert("Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const handleTest = async () => {
    if (!testEmail) {
      setTestResult({ success: false, message: "Please enter a test email address" });
      return;
    }
    try {
      setTesting(true);
      setTestResult(null);
      const result = await testEmailSettings(testEmail);
      setTestResult(result);
    } catch {
      setTestResult({ success: false, message: "Failed to send test email" });
    } finally {
      setTesting(false);
    }
  };

  if (status === "loading" || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <h1 className="text-2xl font-bold text-slate-800">Email Settings</h1>

      <Card>
        <CardHeader>
          <CardTitle>SMTP Configuration</CardTitle>
          <CardDescription>Configure the SMTP server for sending system emails</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <label className="text-sm font-medium">Enable Email Notifications</label>
              <p className="text-xs text-slate-500">Turn on to send system emails</p>
            </div>
            <Switch
              checked={settings.enabled}
              onCheckedChange={(checked) => setSettings({ ...settings, enabled: checked })}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-medium block mb-1">SMTP Host</label>
              <Input
                placeholder="smtp.example.com"
                value={settings.smtpHost}
                onChange={(e) => setSettings({ ...settings, smtpHost: e.target.value })}
              />
            </div>
            <div>
              <label className="text-sm font-medium block mb-1">SMTP Port</label>
              <Input
                type="number"
                placeholder="587"
                value={settings.smtpPort}
                onChange={(e) => setSettings({ ...settings, smtpPort: parseInt(e.target.value) || 587 })}
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Email Address</label>
            <Input
              type="email"
              placeholder="noreply@example.com"
              value={settings.email}
              onChange={(e) => setSettings({ ...settings, email: e.target.value })}
            />
          </div>

          <div>
            <label className="text-sm font-medium block mb-1">Password / App Password</label>
            <Input
              type="password"
              placeholder="Enter app password"
              value={settings.password}
              onChange={(e) => setSettings({ ...settings, password: e.target.value })}
            />
            <p className="text-xs text-slate-500 mt-1">
              For Gmail, use an App Password. For other services, use your email password.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Switch
              id="secure"
              checked={settings.secure}
              onCheckedChange={(checked) => setSettings({ ...settings, secure: checked })}
            />
            <label htmlFor="secure" className="text-sm">Use SSL/TLS (Port 465)</label>
          </div>

          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            Save Settings
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Test Email Configuration</CardTitle>
          <CardDescription>Send a test email to verify your settings</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-2">
            <Input
              type="email"
              placeholder="test@example.com"
              value={testEmail}
              onChange={(e) => setTestEmail(e.target.value)}
              className="flex-1"
            />
            <Button onClick={handleTest} disabled={testing || !settings.enabled} className="gap-2">
              {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Send Test
            </Button>
          </div>
          
          {testResult && (
            <div className={`flex items-center gap-2 p-3 rounded-lg ${testResult.success ? "bg-green-50 text-green-800" : "bg-red-50 text-red-800"}`}>
              {testResult.success ? <CheckCircle className="h-4 w-4" /> : <XCircle className="h-4 w-4" />}
              {testResult.message}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Email Notifications</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <ul className="list-disc pl-4 space-y-2">
            <li>Approval notifications - When a request is approved or rejected</li>
            <li>Provisioning notifications - When a VM is provisioned</li>
            <li>Status updates - When request status changes</li>
            <li>Password reset emails</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
