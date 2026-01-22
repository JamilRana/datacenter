// src/app/requests/[id]/edit/page.tsx
import { RequestForm } from "@/app/requests/components/RequestForm";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { redirect } from "next/navigation";

export default async function EditRequestPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/auth");
  }

  const request = await prisma.request.findUnique({
    where: { id: params.id },
    select: { requesterId: true, status: true },
  });

  if (!request || request.requesterId !== session.user.id || request.status !== "DRAFT") {
    redirect("/requests");
  }

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-6 text-slate-800">Edit Request</h1>
      <RequestForm userId={session.user.id} editId={params.id} />
    </div>
  );
}
