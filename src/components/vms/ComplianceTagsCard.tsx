"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tag, Plus, Loader2, Info } from "lucide-react";
import { toast } from "sonner";
import { getComplianceTags, assignTagsToVm, assignTagsToRequest } from "@/app/actions/tag-actions";
import { ROLES, hasRole } from "@/lib/roles";

interface TagInfo {
  tag: {
    id: string;
    name: string;
    description: string | null;
  };
}

interface ComplianceTagsCardProps {
  entityId: string;
  entityType: "VM" | "REQUEST";
  assignedTags: TagInfo[];
  currentUser: {
    roles: string[];
  };
}

export default function ComplianceTagsCard({
  entityId,
  entityType,
  assignedTags,
  currentUser,
}: ComplianceTagsCardProps) {
  const isAdmin = hasRole(currentUser.roles, ROLES.ADMIN);

  const [currentAssigned, setCurrentAssigned] = useState<TagInfo[]>(assignedTags);
  const [allTags, setAllTags] = useState<{ id: string; name: string; description: string | null }[]>([]);
  const [isEditing, setIsEditing] = useState(false);
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(assignedTags.map((t) => t.tag.id));
  const [isLoadingTags, setIsLoadingTags] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state if prop changes
  useEffect(() => {
    setCurrentAssigned(assignedTags);
    setSelectedTagIds(assignedTags.map((t) => t.tag.id));
  }, [assignedTags]);

  const handleOpenEdit = async () => {
    if (isEditing) {
      setIsEditing(false);
      return;
    }

    try {
      setIsLoadingTags(true);
      const data = await getComplianceTags();
      setAllTags(data);
      setIsEditing(true);
    } catch (error) {
      toast.error("Failed to load compliance tags");
    } finally {
      setIsLoadingTags(false);
    }
  };

  const handleCheckboxChange = (tagId: string, checked: boolean) => {
    if (checked) {
      setSelectedTagIds((prev) => [...prev, tagId]);
    } else {
      setSelectedTagIds((prev) => prev.filter((id) => id !== tagId));
    }
  };

  const handleSave = async () => {
    try {
      setIsSaving(true);
      if (entityType === "VM") {
        const res = await assignTagsToVm(entityId, selectedTagIds);
        if (res.success) {
          toast.success("VM tags updated successfully!");
          updateCurrentAssigned();
          setIsEditing(false);
        }
      } else {
        const res = await assignTagsToRequest(entityId, selectedTagIds);
        if (res.success) {
          toast.success("Request tags updated successfully!");
          updateCurrentAssigned();
          setIsEditing(false);
        }
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to save tag assignments");
    } finally {
      setIsSaving(false);
    }
  };

  const updateCurrentAssigned = () => {
    const updated = allTags
      .filter((t) => selectedTagIds.includes(t.id))
      .map((t) => ({
        tag: t,
      }));
    setCurrentAssigned(updated);
  };

  return (
    <Card className="border-none shadow-sm ring-1 ring-slate-200">
      <CardHeader className="bg-slate-50/50 border-b flex flex-row items-center justify-between py-4">
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 flex items-center gap-2">
          <Tag className="h-4 w-4 text-blue-500" />
          Compliance & Tags
        </CardTitle>
        {isAdmin && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs text-blue-600 hover:text-blue-700 font-semibold"
            onClick={handleOpenEdit}
            disabled={isLoadingTags}
          >
            {isLoadingTags ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : isEditing ? (
              "Cancel"
            ) : (
              "Assign"
            )}
          </Button>
        )}
      </CardHeader>
      <CardContent className="pt-4">
        {isEditing ? (
          <div className="space-y-4">
            {allTags.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">No compliance tags defined in admin panel.</p>
            ) : (
              <div className="max-h-[160px] overflow-y-auto space-y-2 pr-1">
                {allTags.map((tag) => (
                  <div key={tag.id} className="flex items-start gap-2.5 p-2 bg-slate-50 rounded-md border border-slate-100 hover:bg-slate-100/50 transition-colors">
                    <Checkbox
                      id={`tag-${tag.id}`}
                      checked={selectedTagIds.includes(tag.id)}
                      onCheckedChange={(checked) => handleCheckboxChange(tag.id, !!checked)}
                      className="mt-0.5 border-slate-300"
                    />
                    <div className="space-y-0.5">
                      <Label
                        htmlFor={`tag-${tag.id}`}
                        className="text-xs font-bold text-slate-700 font-mono cursor-pointer"
                      >
                        {tag.name}
                      </Label>
                      {tag.description && (
                        <p className="text-[10px] text-slate-400 leading-normal">{tag.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Button
              size="sm"
              className="w-full h-8 text-xs font-bold bg-blue-600 hover:bg-blue-700 text-white"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Save Tag Assignments"}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-1.5">
            {currentAssigned.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2 flex items-center gap-1">
                <Info className="h-3.5 w-3.5" /> No compliance tags assigned.
              </p>
            ) : (
              currentAssigned.map((t) => (
                <span
                  key={t.tag.id}
                  title={t.tag.description || undefined}
                  className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold font-mono bg-blue-50 text-blue-700 border border-blue-200"
                >
                  {t.tag.name}
                </span>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
