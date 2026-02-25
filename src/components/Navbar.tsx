// src/components/Navbar.tsx
"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/roles";
import { Server, PlusCircle, LogOut, Menu, HardDrive, Zap, Trash2, ListChecks, UserCircle, ChevronDown } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from "@/components/ui/dialog";
import { useState } from "react";

export function Navbar() {
  const { data: session } = useSession();
  const pathname = usePathname();
  const [showUserMenu, setShowUserMenu] = useState(false);

  if (!session) return null;

  const hasRole = (role: string) => session.user.roles.includes(role);
  const isApprover = session.user.roles.some(r => r.startsWith("APPROVER"));
  const isDCOPSorAdmin = hasRole(ROLES.DCOPS) || hasRole(ROLES.ADMIN);
  const isRequester = hasRole(ROLES.REQUESTER);
  const isDeveloper = hasRole(ROLES.DEVELOPER);
  const canCreateRequest = isRequester || isDeveloper;

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const linkClass = (path: string) => `
    inline-flex items-center px-1 pt-1 text-sm font-medium border-b-2 transition-all
    ${isActive(path) 
      ? "text-indigo-600 border-indigo-600" 
      : "text-slate-500 border-transparent hover:text-indigo-600 hover:border-indigo-300"}
  `;

  return (
    <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-slate-200/50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center gap-4">
            {/* Mobile Menu Toggle */}
            <div className="md:hidden">
              <Dialog>
                <DialogTrigger asChild>
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6 text-slate-600" />
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-[300px] left-0 translate-x-0 h-screen rounded-none border-r">
                  <DialogHeader>
                    <DialogTitle className="flex items-center gap-2">
                      <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                        <Server size={18} />
                      </div>
                      MIS DC Portal
                    </DialogTitle>
                    <DialogDescription className="text-left py-4">
                      Navigation Menu
                    </DialogDescription>
                  </DialogHeader>
                  <div className="flex flex-col gap-2 mt-4">
                    <MobileNavLink href="/" active={isActive("/")}>Dashboard</MobileNavLink>
                    <MobileNavLink href="/profile" active={isActive("/profile")}>
                      <UserCircle className="h-4 w-4" /> My Profile
                    </MobileNavLink>
                    <MobileNavLink href="/requests" active={isActive("/requests")}>My Requests</MobileNavLink>
                    {canCreateRequest && (
                      <>
                        <MobileNavLink href="/requests/customize" active={isActive("/requests/customize")}>
                          <Zap className="h-4 w-4" /> Customize VM
                        </MobileNavLink>
                        <MobileNavLink href="/requests/decommission" active={isActive("/requests/decommission")}>
                          <Trash2 className="h-4 w-4" /> Decommission
                        </MobileNavLink>
                      </>
                    )}
                    {(isApprover || isDCOPSorAdmin) && (
                      <MobileNavLink href="/approvals" active={isActive("/approvals")}>
                        <ListChecks className="h-4 w-4" /> Task Queue
                      </MobileNavLink>
                    )}
                    {isDCOPSorAdmin && (
                      <MobileNavLink href="/inventory" active={isActive("/inventory")}>
                        <HardDrive className="h-4 w-4" /> Inventory
                      </MobileNavLink>
                    )}
                    {hasRole(ROLES.ADMIN) && (
                      <MobileNavLink href="/admin" active={isActive("/admin")}>Admin</MobileNavLink>
                    )}
                  </div>
                </DialogContent>
              </Dialog>
            </div>

            <Link href="/" className="flex items-center gap-2">
              <div className="bg-indigo-600 p-1.5 rounded-lg text-white">
                <Server size={20} />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">MIS DC Portal</span>
            </Link>
            
            <div className="hidden md:ml-10 md:flex md:space-x-6">
              <Link href="/" className={linkClass("/")}>Dashboard</Link>
              <Link href="/requests" className={linkClass("/requests")}>My Requests</Link>
              {canCreateRequest && (
                <>
                  <Link href="/requests/customize" className={linkClass("/requests/customize")}>
                    <Zap className="h-3 w-3 mr-1" />Customize
                  </Link>
                  <Link href="/requests/decommission" className={linkClass("/requests/decommission")}>
                    <Trash2 className="h-3 w-3 mr-1" />Decommission
                  </Link>
                </>
              )}
              {(isApprover || isDCOPSorAdmin) && (
                <Link href="/approvals" className={linkClass("/approvals")}>
                  <ListChecks className="h-3 w-3 mr-1" />Task Queue
                </Link>
              )}
              {isDCOPSorAdmin && (
                <Link href="/inventory" className={linkClass("/inventory")}>
                  <HardDrive className="h-3 w-3 mr-1" />Inventory
                </Link>
              )}
              {hasRole(ROLES.ADMIN) && (
                <Link href="/admin/settings" className={linkClass("/admin")}>Admin</Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
            {canCreateRequest && (
              <Link href="/requests/new">
                <Button size="sm" className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700">
                  <PlusCircle size={16} />
                  New Request
                </Button>
              </Link>
            )}
            
            <div className="relative">
              <div className="flex items-center gap-3 pl-4 border-l">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-2 hover:bg-slate-100 rounded-lg p-2 transition-colors"
                >
                  <div className="h-8 w-8 rounded-full bg-indigo-100 flex items-center justify-center">
                    <UserCircle className="h-5 w-5 text-indigo-600" />
                  </div>
                  <div className="hidden lg:block text-left">
                    <div className="text-sm font-semibold text-slate-900">{session.user.name}</div>
                    <div className="text-[10px] text-slate-500 uppercase font-bold">{session.user.roles[0]?.replace(/_/g, " ")}</div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>
              </div>
              
              {showUserMenu && (
                <div className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 py-2 z-50">
                  <Link
                    href="/profile"
                    onClick={() => setShowUserMenu(false)}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-slate-700 hover:bg-slate-50"
                  >
                    <UserCircle className="h-4 w-4" /> Profile Settings
                  </Link>
                  <div className="border-t my-1"></div>
                  <button
                    onClick={() => signOut()}
                    className="flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50 w-full"
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}

function MobileNavLink({ 
  href, 
  children, 
  active 
}: { 
  href: string; 
  children: React.ReactNode; 
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-base font-medium transition-colors ${
        active 
          ? "bg-indigo-50 text-indigo-700" 
          : "text-slate-600 hover:bg-slate-50 hover:text-indigo-600"
      }`}
    >
      {children}
    </Link>
  );
}
