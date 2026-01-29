// src/app/admin/settings/SettingsForm.tsx
"use client";

import { useState } from "react";
import { updateSetting } from "@/app/actions/settings-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface Setting { key: string; value: string; label: string; description: string; }
export default function SettingsForm({ settings }: { settings: Setting[] }) {
  const [formValues, setFormValues] = useState<Record<string, string>>(
    settings.reduce((acc, s) => ({ ...acc, [s.key]: s.value }), {})
  );

  const handleSave = async (key: string) => {
    try {
      await updateSetting(key, formValues[key]);
      toast.success(`Setting '${key}' updated.`);
    } catch (err) {
      toast.error(`Failed to update setting.${err as string}`);
    }
  };

  return (
    <div className="space-y-6">
      {settings.map((setting) => (
        <Card key={setting.key}>
          <CardHeader className="pb-2">
            <CardTitle className="text-lg">{setting.label}</CardTitle>
            <p className="text-sm text-slate-500">{setting.description}</p>
          </CardHeader>
          <CardContent className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
              <Label htmlFor={setting.key}>Value</Label>
              <Input
                id={setting.key}
                value={formValues[setting.key]}
                onChange={(e) =>
                  setFormValues({ ...formValues, [setting.key]: e.target.value })
                }
              />
            </div>
            <Button onClick={() => handleSave(setting.key)}>Save</Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
