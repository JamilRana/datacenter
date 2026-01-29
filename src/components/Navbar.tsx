// src/components/Navbar.tsx
"use client";
import Link from "next/link";
import { useSession, signOut } from "next-auth/react";
import { Button } from "@/components/ui/button";
import {  Server, PlusCircle,  LogOut } from "lucide-react";

export function Navbar() {
  const { data: session } = useSession();

  if (!session) return null;

  return (
    <nav className="bg-white border-b sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between h-16">
          <div className="flex items-center">
            <Link href="/" className="flex items-center gap-2">
              <div className="bg-blue-600 p-1.5 rounded-lg text-white">
                <Server size={20} />
              </div>
              <span className="font-bold text-xl tracking-tight text-slate-900">VMCloud</span>
            </Link>
            
            <div className="hidden md:ml-10 md:flex md:space-x-8">
              {/* Home/Dashboard Link is context-aware */}
              <Link
                href="/"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-slate-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-all"
              >
                Dashboard
              </Link>

              {/* Requester / All Roles Link */}
              <Link
                href="/requests"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-slate-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-all"
              >
                Requests
              </Link>

              {/* Inventory Link for Relevant Roles */}
              {(session.user.roles.some(r => r.startsWith("APPROVER") || r === "ADMIN" || r === "DCOPS")) && (
              <Link
                href="/inventory/vms"
                className="inline-flex items-center px-1 pt-1 text-sm font-medium text-slate-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-all"
              >
                Inventory
              </Link>
              )}

              {/* Role Specific Links */}
              {(session.user.roles.some(r => r.startsWith("APPROVER") || r === "ADMIN")) && (
                <Link
                  href="/approvals"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-slate-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-all"
                >
                  Approvals
                </Link>
              )}

              {(session.user.roles.some(r => r === "DCOPS" || r === "ADMIN")) && (
                <Link
                  href="/ops"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-slate-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-all"
                >
                  Ops Hub
                </Link>
              )}

              {session.user.roles.includes("ADMIN") && (
                <Link
                  href="/admin"
                  className="inline-flex items-center px-1 pt-1 text-sm font-medium text-slate-500 hover:text-blue-600 border-b-2 border-transparent hover:border-blue-600 transition-all"
                >
                  Admin
                </Link>
              )}
            </div>
          </div>

          <div className="flex items-center gap-4">
             <Link href="/requests/new">
                <Button size="sm" className="hidden sm:flex items-center gap-2">
                   <PlusCircle size={16} />
                   New Request
                </Button>
             </Link>
          
            <div className="flex items-center gap-3 pl-4 border-l">
              <div className="hidden sm:block text-right">
                <div className="text-sm font-semibold text-slate-900">{session.user.name}</div>
                <div className="text-[10px] text-slate-500 uppercase font-bold">{session.user.roles.join(" | ")}</div>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => signOut()}
                className="text-slate-500 hover:text-red-600"
              >
                <LogOut size={20} />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </nav>
  );
}
