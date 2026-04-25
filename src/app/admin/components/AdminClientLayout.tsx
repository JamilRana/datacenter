"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  Users, 
  GitBranch, 
  Mail, 
  FileText, 
  LayoutDashboard, 
  Menu, 
  X, 
  ChevronLeft 
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/workflows", label: "Workflows", icon: GitBranch },
  { href: "/admin/email-settings", label: "Email Settings", icon: Mail },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileText },
];

export function AdminClientLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/50 z-40 lg:hidden backdrop-blur-sm"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed inset-y-0 left-0 z-50 w-64 bg-slate-900 text-white transform transition-transform duration-300 ease-in-out lg:relative lg:translate-x-0 shadow-2xl",
        isMobileMenuOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex flex-col h-full p-4">
          <div className="mb-8 px-2 flex items-center justify-between">
            <div>
              <h2 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-indigo-400 bg-clip-text text-transparent">
                Admin Panel
              </h2>
              <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">
                VM Management System
              </p>
            </div>
            <button 
              className="lg:hidden p-1 text-slate-400 hover:text-white"
              onClick={() => setIsMobileMenuOpen(false)}
            >
              <X className="h-6 w-6" />
            </button>
          </div>

          <nav className="flex-1 space-y-1">
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all group",
                    isActive 
                      ? "bg-blue-600 text-white shadow-lg shadow-blue-900/20" 
                      : "text-slate-400 hover:text-white hover:bg-slate-800"
                  )}
                >
                  <item.icon className={cn(
                    "h-4 w-4 transition-transform group-hover:scale-110",
                    isActive ? "text-white" : "text-slate-500"
                  )} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="pt-4 mt-4 border-t border-slate-800">
            <Link
              href="/dashboard"
              className="px-3 py-2 text-xs text-slate-500 hover:text-blue-400 flex items-center gap-2 transition-colors font-bold uppercase tracking-wider"
            >
              <ChevronLeft className="h-3 w-3" /> Back to Dashboard
            </Link>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-slate-200 h-16 flex items-center justify-between px-4 shrink-0">
          <h2 className="font-bold text-slate-800">Admin Panel</h2>
          <button 
            onClick={() => setIsMobileMenuOpen(true)}
            className="p-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <Menu className="h-6 w-6" />
          </button>
        </header>

        {/* Content Wrapper */}
        <main className="flex-1 overflow-y-auto p-4 lg:p-8">
          <div className="max-w-7xl mx-auto h-full">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
