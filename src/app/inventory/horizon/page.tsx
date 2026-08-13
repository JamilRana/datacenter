// src/app/inventory/horizon/page.tsx
"use client";

import { useState, useEffect, useTransition, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  ChevronLeft,
  Search,
  Plus,
  Trash2,
  Edit,
  User as UserIcon,
  Tv,
  Loader2,
  ChevronLeft as ChevronLeftIcon,
  ChevronRight as ChevronRightIcon,
  ChevronDown,
  ChevronUp,
  Server,
  Globe,
  PlusCircle,
  MinusCircle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import {
  fetchHorizonAssignments,
  createHorizonAssignment,
  updateHorizonAssignment,
  deleteHorizonAssignment,
  addHorizonAssignment,
  removeHorizonAssignment,
  fetchActiveVmsList,
  fetchActiveNamespacesList
} from "@/app/actions/endpoint-actions";

export default function HorizonPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [users, setUsers] = useState<any[]>([]);
  const [vms, setVms] = useState<any[]>([]);
  const [namespaces, setNamespaces] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [isPending, startTransition] = useTransition();

  const [search, setSearch] = useState("");

  // Dialog Open States
  const [userDialogOpen, setUserDialogOpen] = useState(false);
  const [userEditDialogOpen, setUserEditDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);

  // Expanded users state
  const [expandedUserIds, setExpandedUserIds] = useState<string[]>([]);

  // User Form states
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [username, setUsername] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [userStatus, setUserStatus] = useState("ACTIVE");

  // Assignment Form states
  const [targetHorizonUserId, setTargetHorizonUserId] = useState("");
  const [assignmentType, setAssignmentType] = useState<"VM" | "K8S">("VM");
  const [selectedResourceIds, setSelectedResourceIds] = useState<string[]>([]);
  const [searchResourceQuery, setSearchResourceQuery] = useState("");
  const [assignedIp, setAssignedIp] = useState("");
  const [notes, setNotes] = useState("");

  const page = searchParams.get("page") ? parseInt(searchParams.get("page")!, 10) : 1;
  const pageSize = 10;
  const totalPages = Math.ceil(total / pageSize);

  const loadData = useCallback(async () => {
    try {
      const [usersRes, vmsRes, nsRes] = await Promise.all([
        fetchHorizonAssignments(page, pageSize, search),
        fetchActiveVmsList(),
        fetchActiveNamespacesList()
      ]);
      setUsers(usersRes.data);
      setTotal(usersRes.total);
      setVms(vmsRes);
      setNamespaces(nsRes);
    } catch (err) {
      console.error("Failed to load Horizon data", err);
      toast.error("Failed to load Horizon user data");
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => {
    if (status === "loading") return;
    if (!session) {
      router.push("/auth");
      return;
    }

    const roles = session.user.roles || [];
    const isAuthorized = roles.some(r =>
      ["ADMIN", "DC_OPS", "HORIZON_ADMIN", "VPN_ADMIN"].includes(r.toUpperCase())
    );

    if (!isAuthorized) {
      router.push("/inventory/vms");
      return;
    }

    loadData();
  }, [session, status, router, loadData]);

  const handlePageChange = (newPage: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set("page", newPage.toString());
    router.push(`/inventory/horizon?${params.toString()}`);
  };

  const toggleRow = (userId: string) => {
    setExpandedUserIds(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  // User Actions
  const openCreateUserDialog = () => {
    setCurrentUserId(null);
    setUsername("");
    setFullName("");
    setEmail("");
    setUserStatus("ACTIVE");
    setUserDialogOpen(true);
  };

  const openEditUserDialog = (user: any, e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentUserId(user.id);
    setUsername(user.username);
    setFullName(user.fullName);
    setEmail(user.email || "");
    setUserStatus(user.status);
    setUserEditDialogOpen(true);
  };

  const handleSaveUser = () => {
    if (!username.trim() || !fullName.trim()) {
      toast.error("Username and Full Name are required.");
      return;
    }

    startTransition(async () => {
      try {
        if (currentUserId) {
          await updateHorizonAssignment(currentUserId, {
            username,
            fullName,
            email,
            status: userStatus,
          });
          toast.success("Horizon user updated successfully!");
          setUserEditDialogOpen(false);
        } else {
          await createHorizonAssignment({
            username,
            fullName,
            email,
            status: userStatus,
          });
          toast.success("Horizon user created successfully!");
          setUserDialogOpen(false);
        }
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to save Horizon user");
      }
    });
  };

  const handleDeleteUser = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm("Are you sure you want to delete this Horizon user? This will cascade revoke all their assignments!")) return;

    startTransition(async () => {
      try {
        await deleteHorizonAssignment(id);
        toast.success("Horizon user and all their assignments deleted successfully");
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to delete user");
      }
    });
  };

  // Assignment Actions
  const openAssignDialog = (userId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setTargetHorizonUserId(userId);
    setAssignmentType("VM");
    setSelectedResourceIds([]);
    setSearchResourceQuery("");
    setAssignedIp("");
    setNotes("");
    setAssignDialogOpen(true);
  };

  const handleAddAssignment = () => {
    if (selectedResourceIds.length === 0) {
      toast.error(`Please select at least one target ${assignmentType === "VM" ? "Virtual Machine" : "Namespace"}`);
      return;
    }

    // IP validation format check (only for single selection)
    if (selectedResourceIds.length === 1 && assignedIp.trim()) {
      const ipv4Regex = /^(?:[0-9]{1,3}\.){3}[0-9]{1,3}$/;
      if (!ipv4Regex.test(assignedIp.trim())) {
        toast.error("Please enter a valid IPv4 address.");
        return;
      }
    }

    startTransition(async () => {
      try {
        for (let i = 0; i < selectedResourceIds.length; i++) {
          const resId = selectedResourceIds[i];
          await addHorizonAssignment({
            horizonUserId: targetHorizonUserId,
            vmId: assignmentType === "VM" ? resId : undefined,
            namespaceId: assignmentType === "K8S" ? resId : undefined,
            // Only assign IP if exactly 1 resource is selected
            assignedIp: (selectedResourceIds.length === 1 && assignedIp.trim()) ? assignedIp.trim() : undefined,
            notes: notes.trim() || undefined,
          });
        }
        toast.success("Resource assignments successfully saved!");
        setAssignDialogOpen(false);
        // Expand user card to show assignment
        if (!expandedUserIds.includes(targetHorizonUserId)) {
          setExpandedUserIds(prev => [...prev, targetHorizonUserId]);
        }
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to assign resources");
      }
    });
  };

  const handleRemoveAssignment = (assignmentId: string) => {
    if (!confirm("Are you sure you want to revoke this resource assignment?")) return;

    startTransition(async () => {
      try {
        await removeHorizonAssignment(assignmentId);
        toast.success("Assignment revoked successfully");
        loadData();
      } catch (err: any) {
        toast.error(err.message || "Failed to revoke assignment");
      }
    });
  };

  if (status === "loading" || loading) {
    return (
      <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 rounded-xl"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 md:p-10 max-w-6xl mx-auto space-y-6">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/inventory" className="hover:text-indigo-600 flex items-center gap-1">
          <ChevronLeft className="h-4 w-4" />
          Inventory Hub
        </Link>
        <span>/</span>
        <span className="text-slate-900 font-medium">Horizon Users & Assignments</span>
      </nav>

      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900">Horizon Users & Assignments</h1>
          <p className="text-slate-500 mt-1">
            Manage external Horizon user accounts mapping to internal VM and Namespace resources.
          </p>
        </div>
        <Button onClick={openCreateUserDialog} className="bg-indigo-600 hover:bg-indigo-700 text-white gap-2 shadow-lg shadow-indigo-100">
          <Plus className="h-4 w-4" /> Add Horizon User
        </Button>
      </div>

      {/* Filter and User List */}
      <Card className="border-none shadow-sm overflow-hidden bg-white">
        <div className="flex flex-col md:flex-row gap-4 p-5 items-center bg-slate-50/50 border-b border-slate-100">
          <div className="flex-1 relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="Search Horizon users..."
              className="pl-9 h-11 bg-white border-slate-200"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <div className="text-sm text-slate-500 font-medium bg-white px-3 py-1.5 rounded-full border border-slate-100 shadow-sm flex items-center gap-2">
            <div className="h-1.5 w-1.5 rounded-full bg-indigo-500 animate-pulse" />
            Total {total} Horizon Users
          </div>
        </div>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-[#f8fafc] border-b border-slate-200">
                <tr>
                  <th className="w-10 px-6 py-4"></th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Horizon User</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Full Name</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">Email</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Status</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-center">Assignments</th>
                  <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map((user) => {
                  const isExpanded = expandedUserIds.includes(user.id);
                  return (
                    <>
                      <tr
                        key={user.id}
                        className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                        onClick={() => toggleRow(user.id)}
                      >
                        <td className="px-6 py-4">
                          {isExpanded ? (
                            <ChevronUp className="h-4 w-4 text-slate-400" />
                          ) : (
                            <ChevronDown className="h-4 w-4 text-slate-400" />
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <div className="h-9 w-9 bg-indigo-50 text-indigo-600 rounded-lg flex items-center justify-center font-bold">
                              <UserIcon className="h-4.5 w-4.5" />
                            </div>
                            <span className="font-bold text-slate-800">{user.username}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-700">
                          {user.fullName}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-500 font-mono">
                          {user.email || "—"}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge className={
                            user.status === "ACTIVE" ? "bg-emerald-100 text-emerald-800 border-none hover:bg-emerald-200 font-bold" :
                              user.status === "PENDING" ? "bg-amber-100 text-amber-800 border-none hover:bg-amber-200 font-bold" :
                                "bg-red-100 text-red-800 border-none hover:bg-red-200 font-bold"
                          }>
                            {user.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <Badge variant="outline" className="font-bold border-indigo-100 text-indigo-650 bg-indigo-50/10">
                            {user.assignments?.length || 0} resources
                          </Badge>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <div className="flex justify-end gap-1.5">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-slate-400 hover:text-indigo-600 gap-1"
                              onClick={(e) => openAssignDialog(user.id, e)}
                            >
                              <PlusCircle className="h-4 w-4" /> Assign
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-indigo-600" onClick={(e) => openEditUserDialog(user, e)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-slate-400 hover:text-red-600" onClick={(e) => handleDeleteUser(user.id, e)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </td>
                      </tr>

                      {/* Expandable row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/20">
                          <td colSpan={7} className="px-6 py-4">
                            <div className="border border-slate-100 rounded-lg bg-white overflow-hidden shadow-inner max-w-4xl mx-auto my-2">
                              <div className="bg-slate-50 px-4 py-2.5 border-b border-slate-100 flex justify-between items-center">
                                <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                  Assigned resources for {user.username}
                                </span>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={(e) => openAssignDialog(user.id, e)}
                                  className="h-7 text-xs border-indigo-200 text-indigo-750 hover:bg-indigo-50"
                                >
                                  + Assign Resource
                                </Button>
                              </div>
                              <div className="p-0 overflow-x-auto">
                                <table className="w-full text-left text-xs divide-y divide-slate-100">
                                  <thead className="bg-[#fafafa]">
                                    <tr>
                                      <th className="px-4 py-2 font-semibold text-slate-400">Type</th>
                                      <th className="px-4 py-2 font-semibold text-slate-400">Resource Name</th>
                                      <th className="px-4 py-2 font-semibold text-slate-400">Assigned Horizon IP</th>
                                      <th className="px-4 py-2 font-semibold text-slate-400">IP</th>
                                      <th className="px-4 py-2 font-semibold text-slate-400">Notes</th>
                                      <th className="px-4 py-2 font-semibold text-slate-400 text-right">Action</th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-slate-100">
                                    {user.assignments?.map((asg: any) => (
                                      <tr key={asg.id} className="hover:bg-slate-50/50">
                                        <td className="px-4 py-2 whitespace-nowrap">
                                          <Badge className={`px-2 py-0.5 rounded text-[10px] font-bold ${asg.vmId ? 'bg-emerald-50 text-emerald-700 border-none' : 'bg-indigo-50 text-indigo-700 border-none'
                                            }`}>
                                            {asg.vmId ? 'VM' : 'K8S'}
                                          </Badge>
                                        </td>
                                        <td className="px-4 py-2">
                                          {asg.vmId ? (
                                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                                              <Server className="w-3.5 h-3.5 text-slate-400" />
                                              {asg.vm?.hostname || "Unnamed VM"}
                                            </span>
                                          ) : (
                                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                                              {asg.namespace?.name || "K8s Namespace"}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 font-mono text-slate-600">
                                          {asg.assignedIp || "—"}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500">
                                          {asg.vmId ? (
                                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                                              <Server className="w-3.5 h-3.5 text-slate-400" />
                                              {asg.vm?.ipAddress || "Unnamed VM"}
                                            </span>
                                          ) : (
                                            <span className="font-semibold text-slate-700 flex items-center gap-1">
                                              <Globe className="w-3.5 h-3.5 text-slate-400" />
                                              {asg.namespace?.ipAddress || "K8s Namespace"}
                                            </span>
                                          )}
                                        </td>
                                        <td className="px-4 py-2 text-slate-500 max-w-[150px] truncate">
                                          {asg.notes || "—"}
                                        </td>
                                        <td className="px-4 py-2 text-right">
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            className="h-6 w-6 text-slate-400 hover:text-red-650"
                                            onClick={() => handleRemoveAssignment(asg.id)}
                                          >
                                            <MinusCircle className="h-4.5 w-4.5" />
                                          </Button>
                                        </td>
                                      </tr>
                                    ))}
                                    {(!user.assignments || user.assignments.length === 0) && (
                                      <tr>
                                        <td colSpan={6} className="px-4 py-4 text-center text-slate-400">
                                          No resource assignments mapped yet.
                                        </td>
                                      </tr>
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  );
                })}
                {users.length === 0 && (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-slate-400 text-sm">
                      No Horizon users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between px-6 py-4 bg-slate-50 border-t border-slate-100">
              <div className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Page <span className="text-indigo-600 font-black">{page}</span> of <span className="text-slate-600">{totalPages}</span>
              </div>
              <div className="flex items-center gap-1">
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page - 1)} disabled={page <= 1} className="h-9 w-9 p-0">
                  <ChevronLeftIcon className="h-4 w-4" />
                </Button>
                <Button variant="outline" size="sm" onClick={() => handlePageChange(page + 1)} disabled={page >= totalPages} className="h-9 w-9 p-0">
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Dialog for Add Horizon User */}
      <Dialog open={userDialogOpen} onOpenChange={setUserDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-650">
              <Tv className="h-5 w-5" /> Add Horizon User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-bold">Horizon Username *</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ad.john.doe"
                className="border-slate-200 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Full Name *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Example"
                className="border-slate-200 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. example@dghs.gov.bd"
                className="border-slate-200 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Status *</Label>
              <Select value={userStatus} onValueChange={setUserStatus}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="REVOKED">REVOKED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Create User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Edit Horizon User */}
      <Dialog open={userEditDialogOpen} onOpenChange={setUserEditDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-650">
              <Edit className="h-5 w-5" /> Edit Horizon User
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-bold">Horizon Username *</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="e.g. ad.john.doe"
                disabled
                className="bg-slate-50 border-slate-200"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Full Name *</Label>
              <Input
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="e.g. Example"
                className="border-slate-200 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Email Address</Label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="e.g. example@dghs.gov.bd"
                className="border-slate-200 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-2">
              <Label className="font-bold">Status *</Label>
              <Select value={userStatus} onValueChange={setUserStatus}>
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ACTIVE">ACTIVE</SelectItem>
                  <SelectItem value="PENDING">PENDING</SelectItem>
                  <SelectItem value="REVOKED">REVOKED</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setUserEditDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleSaveUser} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Update User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Dialog for Add Resource Assignment */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent className="sm:max-w-[480px]">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-indigo-650">
              <PlusCircle className="h-5 w-5" /> Assign Resource
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label className="font-bold">Assignment Type</Label>
              <Select
                value={assignmentType}
                onValueChange={(val: "VM" | "K8S") => {
                  setAssignmentType(val);
                  setSelectedResourceIds([]);
                  setSearchResourceQuery("");
                }}
              >
                <SelectTrigger className="border-slate-200">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="VM">Virtual Machine</SelectItem>
                  <SelectItem value="K8S">Kubernetes Namespace</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Multi-select resource list */}
            <div className="space-y-2">
              <Label className="font-bold">Select Target {assignmentType === "VM" ? "Virtual Machines" : "Namespaces"} *</Label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                <Input
                  placeholder={`Search ${assignmentType === "VM" ? "VM by hostname or IP..." : "Namespace by name or IP..."}`}
                  value={searchResourceQuery}
                  onChange={(e) => setSearchResourceQuery(e.target.value)}
                  className="pl-9 border-slate-200 focus:border-indigo-500 text-xs h-9"
                />
              </div>

              {/* Scrollable Checkbox List */}
              <div className="border border-slate-200 rounded-lg max-h-48 overflow-y-auto p-2 space-y-1 bg-white">
                {(assignmentType === "VM"
                  ? vms.filter((vm: any) =>
                    vm.hostname.toLowerCase().includes(searchResourceQuery.toLowerCase()) ||
                    (vm.ipAddress && vm.ipAddress.includes(searchResourceQuery))
                  )
                  : namespaces.filter((ns: any) =>
                    ns.name.toLowerCase().includes(searchResourceQuery.toLowerCase()) ||
                    (ns.supervisorIp && ns.supervisorIp.includes(searchResourceQuery))
                  )
                ).map((opt: any) => {
                  const isSelected = selectedResourceIds.includes(opt.id);
                  return (
                    <div
                      key={opt.id}
                      onClick={() => {
                        setSelectedResourceIds(prev =>
                          prev.includes(opt.id)
                            ? prev.filter(id => id !== opt.id)
                            : [...prev, opt.id]
                        );
                      }}
                      className="flex items-center gap-2.5 p-2 hover:bg-slate-50 rounded-md cursor-pointer transition-colors"
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => { }} // Controlled via click wrapper
                        className="rounded border-slate-350 text-indigo-600 focus:ring-indigo-500 h-4.5 w-4.5 cursor-pointer accent-indigo-600"
                      />
                      <div className="text-xs">
                        <span className="font-semibold text-slate-800">
                          {assignmentType === "VM" ? opt.hostname : opt.name}
                        </span>
                        <span className="text-slate-400 ml-1.5 font-mono text-[10px]">
                          ({assignmentType === "VM" ? (opt.ipAddress || "No IP") : (opt.supervisorIp || "No IP")})
                        </span>
                      </div>
                    </div>
                  );
                })}
                {((assignmentType === "VM" ? vms : namespaces).length === 0) && (
                  <div className="text-xs text-slate-400 text-center py-4">No resources available.</div>
                )}
              </div>
            </div>

            {/* Selected items badges list */}
            {selectedResourceIds.length > 0 && (
              <div className="space-y-1.5">
                <Label className="font-bold text-xs text-slate-500 uppercase tracking-wider">
                  Selected ({selectedResourceIds.length})
                </Label>
                <div className="flex flex-wrap gap-1.5 p-2 bg-slate-50 rounded-lg border border-slate-100 min-h-[40px] max-h-24 overflow-y-auto">
                  {selectedResourceIds.map(id => {
                    const opt = assignmentType === "VM" ? vms.find((v: any) => v.id === id) : namespaces.find((n: any) => n.id === id);
                    if (!opt) return null;
                    return (
                      <Badge
                        key={id}
                        className="bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200 text-xs font-semibold gap-1 py-0.5 px-2 rounded-md transition-all shadow-sm"
                      >
                        {assignmentType === "VM" ? opt.hostname : opt.name}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedResourceIds(prev => prev.filter(x => x !== id));
                          }}
                          className="text-indigo-400 hover:text-indigo-600 font-bold ml-1"
                        >
                          ×
                        </button>
                      </Badge>
                    );
                  })}
                </div>
              </div>
            )}

            {selectedResourceIds.length === 1 ? (
              <div className="space-y-2">
                <Label className="font-bold">Assigned Horizon IP Address</Label>
                <Input
                  value={assignedIp}
                  onChange={(e) => setAssignedIp(e.target.value)}
                  placeholder={assignmentType === "VM" ? "e.g. 10.0.10.121" : "e.g. 10.0.10.121 (optional)"}
                  className="border-slate-200 focus:border-indigo-500 h-9 text-xs"
                />
                <p className="text-[10px] text-slate-400">Must be a unique IP address mapping.</p>
              </div>
            ) : selectedResourceIds.length > 1 ? (
              <div className="p-2.5 bg-slate-50 border rounded-lg text-[10px] text-slate-500 leading-relaxed">
                IP Address mapping is bypassed for multi-resource assignments. You can specify IP addresses for each resource individually in the assignments sub-tables.
              </div>
            ) : null}

            <div className="space-y-2">
              <Label className="font-bold">Assignment Notes</Label>
              <Textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Optional assignment background details or ports info..."
                className="border-slate-200 focus:border-indigo-500 resize-none h-20"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setAssignDialogOpen(false)} disabled={isPending}>Cancel</Button>
            <Button onClick={handleAddAssignment} disabled={isPending} className="bg-indigo-600 hover:bg-indigo-700 text-white">
              {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />} Save Assignment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
