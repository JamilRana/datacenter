// src/app/admin/workflows/page.tsx
"use client";

import { useState, useEffect } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { getWorkflows, getRequestTypes, getAvailableRoles, createWorkflowLevel, updateWorkflowLevel, deleteWorkflowLevel } from "@/app/actions/admin-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Loader2, Plus, Trash2, Save, X, Edit2 } from "lucide-react";
import { ROLES } from "@/lib/roles";

interface Workflow {
  id: string;
  requestType: string;
  level: number;
  role: string;
  roleLabel: string | null;
  isFinal: boolean;
}

const requestTypeLabels: Record<string, string> = {
  NEW_VM: "New VM Request",
  CUSTOMIZED: "Customization Request",
  DECOMMISSION: "Decommission Request",
  RENEWAL: "Renewal Request",
};

export default function WorkflowsPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [requestTypes, setRequestTypes] = useState<string[]>([]);
  const [availableRoles, setAvailableRoles] = useState<{value: string; label: string}[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string>("NEW_VM");
  const [isAdding, setIsAdding] = useState(false);
  const [newLevel, setNewLevel] = useState({ role: "", roleLabel: "", isFinal: false });
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLevel, setEditLevel] = useState({ role: "", roleLabel: "", isFinal: false });

  useEffect(() => {
    if (status === "loading") return;
    if (!session || !session.user.roles?.includes(ROLES.ADMIN)) {
      router.push("/");
      return;
    }

    const fetchData = async () => {
      try {
        setLoading(true);
        const [workflowsData, typesData, rolesData] = await Promise.all([
          getWorkflows(selectedType),
          getRequestTypes(),
          getAvailableRoles(),
        ]);
        setWorkflows(workflowsData);
        setRequestTypes(typesData);
        setAvailableRoles(rolesData);
      } catch (error) {
        console.error("Failed to fetch workflows:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [session, status, router, selectedType]);

  const handleAddLevel = async () => {
    if (!newLevel.role) return;
    try {
      const nextLevel = workflows.length + 1;
      const isFinalForLevel = newLevel.role === "DC_OPS" ? false : (newLevel.isFinal || nextLevel === 1);
      await createWorkflowLevel({
        requestType: selectedType,
        level: nextLevel,
        role: newLevel.role,
        roleLabel: newLevel.roleLabel,
        isFinal: isFinalForLevel,
      });
      setIsAdding(false);
      setNewLevel({ role: "", roleLabel: "", isFinal: false });
      const workflowsData = await getWorkflows(selectedType);
      setWorkflows(workflowsData);
    } catch (error) {
      console.error("Failed to add workflow level:", error);
    }
  };

  const handleDeleteLevel = async (id: string) => {
    if (!confirm("Are you sure you want to delete this workflow level?")) return;
    try {
      await deleteWorkflowLevel(id);
      const workflowsData = await getWorkflows(selectedType);
      setWorkflows(workflowsData);
    } catch (error) {
      console.error("Failed to delete workflow level:", error);
    }
  };

  const handleToggleFinal = async (workflow: Workflow) => {
    try {
      await updateWorkflowLevel(workflow.id, { isFinal: !workflow.isFinal });
      const workflowsData = await getWorkflows(selectedType);
      setWorkflows(workflowsData);
    } catch (error) {
      console.error("Failed to update workflow:", error);
    }
  };

  const handleStartEdit = (workflow: Workflow) => {
    setEditingId(workflow.id);
    setEditLevel({
      role: workflow.role,
      roleLabel: workflow.roleLabel || "",
      isFinal: workflow.isFinal,
    });
  };

  const handleSaveEdit = async (id: string) => {
    try {
      await updateWorkflowLevel(id, {
        role: editLevel.role,
        roleLabel: editLevel.roleLabel,
        isFinal: editLevel.role === "DC_OPS" ? false : editLevel.isFinal,
      });
      setEditingId(null);
      const workflowsData = await getWorkflows(selectedType);
      setWorkflows(workflowsData);
    } catch (error) {
      console.error("Failed to update workflow level:", error);
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800">Workflow Configuration</h1>
        <Select value={selectedType} onValueChange={setSelectedType}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Request Type" />
          </SelectTrigger>
          <SelectContent>
            {requestTypes.map((type) => (
              <SelectItem key={type} value={type}>
                {requestTypeLabels[type] || type}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            Approval Levels for {requestTypeLabels[selectedType] || selectedType}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Level</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Label</TableHead>
                <TableHead>Final</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workflows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-8 text-slate-500">
                    No workflow levels configured
                  </TableCell>
                </TableRow>
              ) : (
                workflows.map((workflow) => {
                  const isEditing = editingId === workflow.id;

                  if (isEditing) {
                    return (
                      <TableRow key={workflow.id}>
                        <TableCell className="font-medium">Level {workflow.level}</TableCell>
                        <TableCell>
                          <Select 
                            value={editLevel.role} 
                            onValueChange={(v) => setEditLevel({ ...editLevel, role: v, isFinal: v === "DC_OPS" ? false : editLevel.isFinal })}
                          >
                            <SelectTrigger className="w-[180px]">
                              <SelectValue placeholder="Select role" />
                            </SelectTrigger>
                            <SelectContent>
                              {availableRoles.map((role) => (
                                <SelectItem key={role.value} value={role.value}>
                                  {role.label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell>
                          <Input
                            placeholder="e.g., Section Officer"
                            value={editLevel.roleLabel}
                            onChange={(e) => setEditLevel({ ...editLevel, roleLabel: e.target.value })}
                            className="w-[180px]"
                          />
                        </TableCell>
                        <TableCell>
                          <Button
                            variant={editLevel.isFinal ? "default" : "outline"}
                            size="sm"
                            disabled={editLevel.role === "DC_OPS"}
                            onClick={() => setEditLevel({ ...editLevel, isFinal: !editLevel.isFinal })}
                          >
                            {editLevel.isFinal ? "Final" : "Set as Final"}
                          </Button>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button size="sm" onClick={() => handleSaveEdit(workflow.id)} className="bg-indigo-600 hover:bg-indigo-700 text-white">
                              <Save className="h-4 w-4 mr-1" /> Save
                            </Button>
                            <Button variant="outline" size="sm" onClick={() => setEditingId(null)}>
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    );
                  }

                  return (
                    <TableRow key={workflow.id}>
                      <TableCell className="font-medium">Level {workflow.level}</TableCell>
                      <TableCell>
                        <Badge variant="outline">{workflow.role}</Badge>
                      </TableCell>
                      <TableCell>{workflow.roleLabel || "-"}</TableCell>
                      <TableCell>
                        <Button
                          variant={workflow.isFinal ? "default" : "outline"}
                          size="sm"
                          disabled={workflow.role === "DC_OPS"}
                          onClick={() => handleToggleFinal(workflow)}
                        >
                          {workflow.isFinal ? "Final" : "Set as Final"}
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleStartEdit(workflow)}>
                            <Edit2 className="h-4 w-4 text-indigo-600 dark:text-indigo-400" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDeleteLevel(workflow.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
              {isAdding && (
                <TableRow>
                  <TableCell>Level {workflows.length + 1}</TableCell>
                  <TableCell>
                    <Select value={newLevel.role} onValueChange={(v) => setNewLevel({ ...newLevel, role: v, isFinal: v === "DC_OPS" ? false : newLevel.isFinal })}>
                      <SelectTrigger className="w-[180px]">
                        <SelectValue placeholder="Select role" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableRoles.map((role) => (
                          <SelectItem key={role.value} value={role.value}>
                            {role.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell>
                    <Input
                      placeholder="e.g., Section Officer"
                      value={newLevel.roleLabel}
                      onChange={(e) => setNewLevel({ ...newLevel, roleLabel: e.target.value })}
                      className="w-[180px]"
                    />
                  </TableCell>
                  <TableCell>
                    <Button
                      variant={newLevel.isFinal ? "default" : "outline"}
                      size="sm"
                      disabled={newLevel.role === "DC_OPS"}
                      onClick={() => setNewLevel({ ...newLevel, isFinal: !newLevel.isFinal })}
                    >
                      {newLevel.isFinal ? "Final" : "Set as Final"}
                    </Button>
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-2">
                      <Button size="sm" onClick={handleAddLevel}>
                        <Save className="h-4 w-4 mr-1" /> Save
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setIsAdding(false)}>
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {!isAdding && (
            <div className="mt-4">
              <Button variant="outline" onClick={() => setIsAdding(true)} className="gap-2">
                <Plus className="h-4 w-4" /> Add Approval Level
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Workflow Information</CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-slate-600">
          <ul className="list-disc pl-4 space-y-2">
            <li>Each request type has its own approval workflow</li>
            <li>The &quot;Final&quot; level marks the last approval step before provisioning</li>
            <li>Changes to workflows apply to new requests only</li>
            <li>Existing requests continue with their original workflow</li>
            <li>Users with matching roles will receive approval notifications</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
