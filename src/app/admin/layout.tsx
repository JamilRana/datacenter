// src/app/admin/layout.tsx
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import { redirect } from "next/navigation";
import { ROLES } from "@/lib/roles";
import { AdminClientLayout } from "./components/AdminClientLayout";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);

  if (!session || !session.user.roles.includes(ROLES.ADMIN)) {
    redirect("/unauthorized");
  }

  return <AdminClientLayout>{children}</AdminClientLayout>;
}
