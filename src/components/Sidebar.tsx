"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import { ROLES } from "@/lib/roles";
import { NotificationBell } from "@/components/NotificationBell";
import {
  Server,
  PlusCircle,
  LogOut,
  HardDrive,
  Zap,
  Trash2,
  ListChecks,
  UserCircle,
  ChevronDown,
  ChevronRight,
  FileBarChart,
  LayoutDashboard,
  Settings,
  X,
  Menu,
  Code,
  ShieldCheck,
  Monitor,
  Layers,
} from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  href?: string;
  icon?: React.ElementType;
  children?: NavItem[];
  roles?: string[];
}

export function Sidebar({ children }: { children: React.ReactNode }) {
  const data = useSession();
  const session = data.data;
  const status = data.status;
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState<string[]>(["inventory"]);
  const [mobileOpen, setMobileOpen] = useState(false);

  const hasRole = (role: string) => session?.user?.roles?.includes(role);

  const navItems: NavItem[] = [
    {
      title: "Dashboard",
      href: "/",
      icon: LayoutDashboard,
    },
    {
      title: "My VMs",
      href: "/my-vms",
      icon: UserCircle,
    },
    {
      title: "Requests",
      href: "/requests",
      icon: ListChecks,
    },
    {
      title: "Create Request",
      icon: PlusCircle,
      children: [
        { title: "New VM", href: "/requests/new?type=NEW_VM", icon: Server },
        { title: "Clone VM", href: "/requests/new?type=CLONE_VM", icon: Layers },
        { title: "K8s Namespace", href: "/requests/new?type=K8S_NAMESPACE", icon: Code },
        { title: "VPN Access", href: "/requests/new?type=VPN_ACCESS", icon: ShieldCheck },
        { title: "Horizon Access", href: "/requests/new?type=HORIZON_ACCESS", icon: Monitor },
        { title: "Customize VM", href: "/requests/customize", icon: Zap },
        { title: "Decommission", href: "/requests/decommission", icon: Trash2 },
      ],
      roles: [ROLES.REQUESTER, ROLES.DEVELOPER, ROLES.ADMIN],
    },
    {
      title: "Approvals",
      href: "/approvals",
      icon: ListChecks,
      roles: [
        "APPROVER_L1",
        "APPROVER_L2",
        "APPROVER_L3",
        ROLES.DCOPS,
        ROLES.ADMIN,
      ],
    },
    {
      title: "Inventory",
      icon: HardDrive,
      children: [
        { title: "VM Instances", href: "/inventory/vms" },
        { title: "Hardware Assets", href: "/inventory/assets" },
        { title: "Software Licenses", href: "/inventory/licenses" },
      ],
      roles: [ROLES.DCOPS, ROLES.ADMIN],
    },
    {
      title: "Reports",
      href: "/reports",
      icon: FileBarChart,
      roles: [ROLES.DCOPS, ROLES.ADMIN],
    },
    {
      title: "Admin",
      href: "/admin",
      icon: Settings,
      roles: [ROLES.ADMIN],
    },
  ];

  const isActive = (path: string) => {
    if (path === "/" && pathname === "/") return true;
    if (path !== "/" && pathname.startsWith(path)) return true;
    return false;
  };

  const toggleExpanded = (title: string) => {
    setExpandedItems((prev) =>
      prev.includes(title)
        ? prev.filter((item) => item !== title)
        : [...prev, title],
    );
  };

  const filterByRole = (items: NavItem[]): NavItem[] => {
    return items.filter((item) => {
      if (!item.roles) return true;
      return item.roles.some((role) => hasRole(role));
    });
  };

  const SidebarContent = ({ mobile = false }: { mobile?: boolean }) => (
    <div className={cn("flex flex-col h-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100", mobile && "p-4")}>
      {/* Logo */}
      <div className="flex items-center justify-between h-16 px-4 border-b border-slate-200 dark:border-slate-800">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/mis_logo.png"
            alt="MIS Logo"
            width={32}
            height={32}
            className="object-contain"
          />
          <span className="font-bold text-xl tracking-tight text-slate-900 dark:text-slate-100">
            MIS DC Portal
          </span>
        </Link>
        <div className="flex items-center gap-2">
          <NotificationBell />
          {mobile && (
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
        {filterByRole(navItems).map((item) => (
          <div key={item.title}>
            {item.children ? (
              <div>
                <button
                  onClick={() => toggleExpanded(item.title)}
                  className={cn(
                    "w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                    "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
                    expandedItems.includes(item.title) && "bg-slate-100 dark:bg-slate-800",
                  )}
                >
                  <div className="flex items-center gap-3">
                    {item.icon && <item.icon className="h-5 w-5" />}
                    {item.title}
                  </div>
                  {expandedItems.includes(item.title) ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                {expandedItems.includes(item.title) && (
                  <div className="ml-4 mt-1 space-y-1">
                    {filterByRole(item.children).map((child) => (
                      <Link
                        key={child.href}
                        href={child.href || "#"}
                        className={cn(
                          "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                          isActive(child.href || "")
                            ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400"
                            : "text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
                        )}
                      >
                        {child.icon && <child.icon className="h-4 w-4" />}
                        {child.title}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <Link
                href={item.href || "#"}
                className={cn(
                  "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                  isActive(item.href || "")
                    ? "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-400"
                    : "text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 hover:text-slate-900 dark:hover:text-slate-100",
                )}
              >
                {item.icon && <item.icon className="h-5 w-5" />}
                {item.title}
              </Link>
            )}
          </div>
        ))}
      </nav>

      {/* User Section */}
      {session?.user && (
        <div className="border-t border-slate-200 dark:border-slate-800 p-4 bg-slate-50/50 dark:bg-slate-900/50">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-indigo-100 dark:bg-indigo-950 flex items-center justify-center">
              <UserCircle className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
                {session.user.name}
              </div>
              <div className="text-xs text-slate-500 dark:text-slate-400 truncate">
                {session.user.email}
              </div>
            </div>
          </div>
          <div className="flex gap-2">
            <Link href="/profile" className="flex-1">
              <Button variant="outline" size="sm" className="w-full border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200">
                Profile
              </Button>
            </Link>
            {!(pathname === "/requests/new" || (/^\/requests\/[a-zA-Z0-9-]+\/edit$/).test(pathname)) && (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="text-slate-500 dark:text-slate-400 hover:text-red-600 dark:hover:text-red-400"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );

  if (status === "loading") {
    return (
      <div className="w-64 h-screen bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 animate-pulse">
        <div className="h-16 border-b border-slate-200 dark:border-slate-800"></div>
        <div className="p-4 space-y-3">
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded"></div>
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded"></div>
          <div className="h-10 bg-slate-100 dark:bg-slate-800 rounded"></div>
        </div>
      </div>
    );
  }

  const shouldShowSidebar = status !== "unauthenticated";
  
  return (
    <>
      {shouldShowSidebar && (
        <>
          {/* Mobile Toggle */}
          <div className="lg:hidden fixed top-4 left-4 z-50">
            <Button
              variant="outline"
              size="icon"
              onClick={() => setMobileOpen(true)}
              className="bg-white dark:bg-slate-900 shadow-md border-slate-200 dark:border-slate-800"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </div>

          {/* Desktop Sidebar */}
          <aside className="hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:left-0 lg:w-64 lg:bg-white dark:lg:bg-slate-900 lg:border-r lg:border-slate-200 dark:lg:border-slate-800">
            <SidebarContent />
          </aside>

          {/* Mobile Sidebar */}
          <aside
            className={cn(
              "lg:hidden fixed inset-y-0 left-0 w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 z-50 transform transition-transform",
              mobileOpen ? "translate-x-0" : "-translate-x-full",
            )}
          >
            <SidebarContent mobile />
          </aside>
        </>
      )}

      {/* MAIN CONTENT ALWAYS RENDERS */}
      <div className={cn("min-h-screen", session && "lg:pl-64")}>
        {children}
      </div>
    </>
  );
}

export default Sidebar;