"use client";

import { useEffect, useState } from "react";
import { getComplianceTags, createComplianceTag, deleteComplianceTag } from "@/app/actions/tag-actions";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tag, Plus, Trash2, Loader2, Info } from "lucide-react";
import { toast } from "sonner";

interface ComplianceTagItem {
  id: string;
  name: string;
  description: string | null;
  createdAt: Date;
  _count: {
    requests: number;
    vmInstances: number;
  };
}

export default function AdminTagsPage() {
  const [tags, setTags] = useState<ComplianceTagItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Create tag states
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const fetchTags = async () => {
    try {
      setIsLoading(true);
      const data = await getComplianceTags();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      setTags(data as any);
    } catch (error) {
      toast.error("Failed to load compliance tags");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchTags();
  }, []);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      setIsSaving(true);
      const res = await createComplianceTag(name, description);
      if (res.success) {
        toast.success(`Tag "${name}" created successfully`);
        setName("");
        setDescription("");
        fetchTags();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create tag");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string, tagName: string) => {
    if (!confirm(`Are you sure you want to delete the tag "${tagName}"?`)) return;

    try {
      const res = await deleteComplianceTag(id);
      if (res.success) {
        toast.success(`Tag "${tagName}" deleted successfully`);
        fetchTags();
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to delete tag");
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-slate-900">Tag Management</h1>
        <p className="text-sm text-slate-500 mt-1">
          Define and organize classification/compliance tags for VM instances and requests.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Create Tag Card */}
        <Card className="lg:col-span-1 border-none shadow-sm ring-1 ring-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Plus className="h-4 w-4 text-blue-600" />
              Create Compliance Tag
            </CardTitle>
            <CardDescription className="text-xs">Add a new metadata classification tag.</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreate} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name" className="text-xs font-semibold text-slate-700">Tag Name *</Label>
                <Input 
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. HIPAA_COMPLIANT"
                  className="h-9 border-slate-200"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="desc" className="text-xs font-semibold text-slate-700">Description</Label>
                <Textarea 
                  id="desc"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe compliance or metadata context..."
                  className="min-h-[80px] text-xs border-slate-200"
                />
              </div>
              <Button type="submit" disabled={isSaving} className="w-full h-9 gap-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 shadow-sm">
                {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Plus className="h-3.5 w-3.5" />}
                Add Tag
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Tags List Card */}
        <Card className="lg:col-span-2 border-none shadow-sm ring-1 ring-slate-200">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Tag className="h-4 w-4 text-blue-600" />
              Active Compliance Tags
            </CardTitle>
            <CardDescription className="text-xs">Currently defined classification tags and usage counts.</CardDescription>
          </CardHeader>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 text-center text-slate-500 flex justify-center items-center gap-2 text-sm">
                <Loader2 className="h-4 w-4 animate-spin text-blue-600" /> Loading tags...
              </div>
            ) : tags.length === 0 ? (
              <div className="p-8 text-center text-slate-400 italic text-xs flex flex-col items-center gap-2">
                <Info className="h-8 w-8 text-slate-300" />
                No compliance tags defined yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-slate-50/50 border-b">
                    <tr>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Tag Name</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Description</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Requests</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">VMs</th>
                      <th className="px-6 py-3 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {tags.map((tag) => (
                      <tr key={tag.id} className="text-xs hover:bg-slate-50/20 transition-colors">
                        <td className="px-6 py-4 font-bold text-blue-600 font-mono">
                          {tag.name}
                        </td>
                        <td className="px-6 py-4 text-slate-500 max-w-xs truncate">
                          {tag.description || <span className="italic text-slate-300">No description</span>}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-600">
                          {tag._count.requests}
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-slate-600">
                          {tag._count.vmInstances}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <Button 
                            variant="ghost" 
                            size="sm"
                            className="h-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => handleDelete(tag.id, tag.name)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
