// src/app/profile/page.tsx
"use client";

import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { ChevronRight, User, Mail, Building2, Phone, BadgeCheck, Lock, Save, X } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { updateOwnProfile, changePassword } from "@/app/actions/user-actions";

export default function ProfilePage() {
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  
  // Profile form state
  const [profileForm, setProfileForm] = useState({
    name: "",
    designation: "",
    organization: "",
    contact: "",
  });
  
  // Password form state
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  
  const [isEditingProfile, setIsEditingProfile] = useState(false);
  const [showPasswordForm, setShowPasswordForm] = useState(false);

  // Initialize form with session data
  useEffect(() => {
    if (status === "unauthenticated") {
      router.push("/auth");
      return;
    }
    
    if (session?.user) {
      setProfileForm({
        name: session.user.name || "",
        designation: session.user.designation || "",
        organization: session.user.organization || "",
        contact: session.user.contact || "",
      });
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-6">
        <div className="h-8 w-48 bg-slate-200 animate-pulse rounded" />
        <div className="space-y-4">
          <div className="h-48 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
          <div className="h-48 bg-slate-100 animate-pulse rounded-xl border border-slate-200" />
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const handleProfileChange = (field: string, value: string) => {
    setProfileForm(prev => ({ ...prev, [field]: value }));
  };

  const handlePasswordChange = (field: string, value: string) => {
    setPasswordForm(prev => ({ ...prev, [field]: value }));
  };

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!profileForm.name.trim()) {
      toast.error("Name is required");
      return;
    }

    startTransition(async () => {
      try {
        const formData = new FormData();
        formData.append("name", profileForm.name);
        formData.append("designation", profileForm.designation);
        formData.append("organization", profileForm.organization);
        formData.append("contact", profileForm.contact);
        
        await updateOwnProfile(formData);
        await update(); // Refresh session
        toast.success("Profile updated successfully");
        setIsEditingProfile(false);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to update profile");
      }
    });
  };

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (passwordForm.newPassword.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      toast.error("New passwords do not match");
      return;
    }

    startTransition(async () => {
      try {
        await changePassword(passwordForm.currentPassword, passwordForm.newPassword);
        toast.success("Password changed successfully");
        setShowPasswordForm(false);
        setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Failed to change password");
      }
    });
  };

  const userRoles = session.user?.roles || [];

  return (
    <div className="p-6 md:p-10 max-w-4xl mx-auto space-y-8">
      {/* Breadcrumbs */}
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/" className="hover:text-slate-900 transition-colors">Home</Link>
        <ChevronRight className="h-4 w-4 mx-2 flex-shrink-0" />
        <span className="text-slate-900 font-medium">Profile</span>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-slate-900">My Profile</h1>
        <p className="text-slate-500 mt-1">
          Manage your account information and security settings
        </p>
      </div>

      {/* Profile Information Card */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <User className="h-5 w-5 text-indigo-600" />
                Personal Information
              </CardTitle>
              <CardDescription>
                Update your personal details and contact information
              </CardDescription>
            </div>
            {!isEditingProfile ? (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setIsEditingProfile(true)}
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              >
                Edit Profile
              </Button>
            ) : (
              <Button 
                variant="ghost" 
                size="sm"
                onClick={() => {
                  setIsEditingProfile(false);
                  // Reset form to original values
                  setProfileForm({
                    name: session.user?.name || "",
                    designation: session.user.designation || "",
                    organization: session.user.organization || "",
                    contact: session.user.contact || "",
                  });
                }}
                className="text-slate-500 hover:text-slate-700"
              >
                <X className="h-4 w-4 mr-1" /> Cancel
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleProfileSubmit} className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Name */}
              <div className="space-y-2">
                <Label htmlFor="name" className="flex items-center gap-2">
                  <User className="h-4 w-4 text-slate-400" />
                  Full Name *
                </Label>
                {isEditingProfile ? (
                  <Input
                    id="name"
                    value={profileForm.name}
                    onChange={(e) => handleProfileChange("name", e.target.value)}
                    className="bg-slate-50 border-slate-200"
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-slate-900 font-medium py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                    {session.user?.name || "Not set"}
                  </p>
                )}
              </div>

              {/* Email (Read-only) */}
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-slate-400" />
                  Email Address
                </Label>
                <p className="text-slate-900 font-medium py-2 px-3 bg-slate-50 rounded-md border border-slate-200 flex items-center gap-2">
                  {session.user?.email}
                  <BadgeCheck className="h-4 w-4 text-green-500" />
                </p>
                <p className="text-xs text-slate-400">Email cannot be changed</p>
              </div>

              {/* Designation */}
              <div className="space-y-2">
                <Label htmlFor="designation" className="flex items-center gap-2">
                  <BadgeCheck className="h-4 w-4 text-slate-400" />
                  Designation
                </Label>
                {isEditingProfile ? (
                  <Input
                    id="designation"
                    value={profileForm.designation}
                    onChange={(e) => handleProfileChange("designation", e.target.value)}
                    placeholder="e.g., Senior Developer"
                    className="bg-slate-50 border-slate-200"
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-slate-700 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                    {profileForm.designation || "Not set"}
                  </p>
                )}
              </div>

              {/* Organization */}
              <div className="space-y-2">
                <Label htmlFor="organization" className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-slate-400" />
                  Organization
                </Label>
                {isEditingProfile ? (
                  <Input
                    id="organization"
                    value={profileForm.organization}
                    onChange={(e) => handleProfileChange("organization", e.target.value)}
                    placeholder="e.g., IT Department"
                    className="bg-slate-50 border-slate-200"
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-slate-700 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                    {profileForm.organization || "Not set"}
                  </p>
                )}
              </div>

              {/* Contact */}
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="contact" className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-slate-400" />
                  Contact Number
                </Label>
                {isEditingProfile ? (
                  <Input
                    id="contact"
                    value={profileForm.contact}
                    onChange={(e) => handleProfileChange("contact", e.target.value)}
                    placeholder="e.g., +880 1XXX-XXXXXX"
                    className="bg-slate-50 border-slate-200"
                    disabled={isPending}
                  />
                ) : (
                  <p className="text-slate-700 py-2 px-3 bg-slate-50 rounded-md border border-slate-200">
                    {profileForm.contact || "Not set"}
                  </p>
                )}
              </div>
            </div>

            {/* Roles Display */}
            <div className="pt-4 border-t border-slate-200">
              <Label className="text-sm font-medium text-slate-700 mb-2 block">
                Assigned Roles
              </Label>
              <div className="flex flex-wrap gap-2">
                {userRoles.length > 0 ? (
                  userRoles.map((role: string) => (
                    <span 
                      key={role}
                      className="px-3 py-1 bg-indigo-50 text-indigo-700 rounded-full text-sm font-medium border border-indigo-200"
                    >
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="text-slate-400 text-sm">No roles assigned</span>
                )}
              </div>
            </div>

            {/* Action Buttons */}
            {isEditingProfile && (
              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsEditingProfile(false);
                    setProfileForm({
                      name: session.user?.name || "",
                      designation: session.user.designation || "",
                      organization: session.user.organization || "",
                      contact: session.user.contact || "",
                    });
                  }}
                  disabled={isPending}
                  className="border-slate-300"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isPending ? (
                    <>
                      <span className="animate-spin mr-2">⟳</span>
                      Saving...
                    </>
                  ) : (
                    <>
                      <Save className="h-4 w-4 mr-2" />
                      Save Changes
                    </>
                  )}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>

      {/* Security Section - Password Change */}
      <Card className="border-slate-200 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl flex items-center gap-2">
                <Lock className="h-5 w-5 text-indigo-600" />
                Security
              </CardTitle>
              <CardDescription>
                Update your password to keep your account secure
              </CardDescription>
            </div>
            {!showPasswordForm && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => setShowPasswordForm(true)}
                className="border-indigo-200 text-indigo-600 hover:bg-indigo-50"
              >
                Change Password
              </Button>
            )}
          </div>
        </CardHeader>
        
        {showPasswordForm && (
          <CardContent>
            <form onSubmit={handlePasswordSubmit} className="space-y-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="currentPassword">Current Password *</Label>
                  <Input
                    id="currentPassword"
                    type="password"
                    value={passwordForm.currentPassword}
                    onChange={(e) => handlePasswordChange("currentPassword", e.target.value)}
                    className="bg-slate-50 border-slate-200"
                    disabled={isPending}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="newPassword">New Password *</Label>
                  <Input
                    id="newPassword"
                    type="password"
                    value={passwordForm.newPassword}
                    onChange={(e) => handlePasswordChange("newPassword", e.target.value)}
                    className="bg-slate-50 border-slate-200"
                    disabled={isPending}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-slate-400">Must be at least 6 characters</p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm New Password *</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    value={passwordForm.confirmPassword}
                    onChange={(e) => handlePasswordChange("confirmPassword", e.target.value)}
                    className="bg-slate-50 border-slate-200"
                    disabled={isPending}
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-4">
                <Button 
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowPasswordForm(false);
                    setPasswordForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
                  }}
                  disabled={isPending}
                  className="border-slate-300"
                >
                  Cancel
                </Button>
                <Button 
                  type="submit"
                  disabled={isPending}
                  className="bg-indigo-600 hover:bg-indigo-700"
                >
                  {isPending ? "Updating..." : "Update Password"}
                </Button>
              </div>
            </form>
          </CardContent>
        )}
      </Card>
    </div>
  );
}