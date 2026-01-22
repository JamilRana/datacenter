// src/app/admin/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import Link from "next/link";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || session.user.role !== "ADMIN") {
    redirect("/unauthorized");
  }

  return (
    <div className="flex min-h-screen">
      <aside className="w-64 bg-slate-900 text-white p-6 space-y-4">
        <h2 className="text-xl font-bold mb-6">Admin Panel</h2>
        <nav className="flex flex-col gap-2">
          <Link href="/admin" className="hover:text-blue-400 p-2 rounded transition-colors">
            Dashboard
          </Link>
          <Link href="/admin/users" className="hover:text-blue-400 p-2 rounded transition-colors">
            User Management
          </Link>
          <Link href="/admin/settings" className="hover:text-blue-400 p-2 rounded transition-colors">
            Global Settings
          </Link>
          <Link href="/admin/audit" className="hover:text-blue-400 p-2 rounded transition-colors">
            Audit Logs
          </Link>
          <Link href="/requests" className="mt-10 hover:text-slate-400 text-sm flex items-center gap-2">
             ← Back to Frontend
          </Link>
        </nav>
      </aside>
      <main className="flex-1 bg-slate-50 p-10 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
