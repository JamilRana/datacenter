// src/app/admin/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";
import { ROLES } from "@/lib/roles";
import { Users, GitBranch, Mail, FileText, LayoutDashboard } from "lucide-react";

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard },
  { href: "/admin/users", label: "User Management", icon: Users },
  { href: "/admin/workflows", label: "Workflows", icon: GitBranch },
  { href: "/admin/email-settings", label: "Email Settings", icon: Mail },
  { href: "/admin/audit-logs", label: "Audit Logs", icon: FileText },
];

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.roles.includes(ROLES.ADMIN)) {
    redirect("/unauthorized");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 text-white p-4 space-y-2">
        <div className="mb-6 px-2">
          <h2 className="text-lg font-bold">Admin Panel</h2>
          <p className="text-xs text-slate-400">VM Management System</p>
        </div>
        <nav className="flex flex-col gap-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-slate-300 hover:text-white hover:bg-slate-800 transition-colors"
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="absolute bottom-4 left-4">
          <Link
            href="/dashboard"
            className="text-xs text-slate-500 hover:text-slate-300 flex items-center gap-1"
          >
            ← Back to Dashboard
          </Link>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
