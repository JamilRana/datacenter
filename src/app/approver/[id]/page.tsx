// src/app/approver/[level]/[id]/page.tsx
import { notFound } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/authOptions";
import prisma from "@/lib/prisma";
import { RequestStatus } from "@prisma/client";
import Link from "next/link";
import { format } from "date-fns";
import { ApprovalActionForm } from "./ApprovalActionForm";

export default async function ApprovalDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user) return notFound();

  // Fetch the approval + related request
  const approval = await prisma.approval.findUnique({
    where: { id: params.id },
    include: {
      request: {
        include: {
          requester: true,
          additionalDisks: true,
          firewallPorts: true,
          networkAccess: true,
        },
      },
    },
  });

  if (!approval || approval.approverId !== session.user.id) {
    return notFound();
  }

  if (approval.decision !== "PENDING") {
    return (
      <div className="p-6 max-w-4xl mx-auto">
        <h1 className="text-2xl font-bold text-red-600">Already Processed</h1>
        <p>This request has already been {approval.decision.toLowerCase()}.</p>
        <Link href="/approver" className="text-blue-600 mt-4 inline-block">
          ← Back to Inbox
        </Link>
      </div>
    );
  }

  const req = approval.request;
  if (!req) return notFound();

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-2xl font-bold">Review Request: {req.systemName}</h1>
          <p className="text-gray-600">
            Project: {req.projectName} • Environment: {req.environment}
          </p>
        </div>
        <span className="px-3 py-1 bg-yellow-100 text-yellow-800 rounded-full">
          Awaiting {approval.level}
        </span>
      </div>

      {/* Requester Info */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <h2 className="font-semibold">Requester</h2>
        <p>{req.requester.name} ({req.requester.email})</p>
        <p>Submitted: {format(new Date(req.submittedAt!), "PPP p")}</p>
      </div>

      {/* VM Specs Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h3 className="font-medium">VM Configuration</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Quantity: {req.quantity}</li>
            <li>vCPU: {req.vcpu}, RAM: {req.ramGb} GB, Storage: {req.storageGb} GB</li>
            <li>OS: {req.osName} {req.osVersion}</li>
            <li>Environment: {req.environment}</li>
          </ul>
        </div>
        <div>
          <h3 className="font-medium">Network & Security</h3>
          <ul className="text-sm text-gray-700 space-y-1">
            <li>Public IP: {req.requiredPublicIP ? "Yes" : "No"}</li>
            <li>VPN Required: {req.vpnRequired ? "Yes" : "No"}</li>
            <li>Firewall Ports: {req.firewallPorts.length} rules</li>
          </ul>
        </div>
      </div>

      {/* Action Form */}
      <ApprovalActionForm
        approvalId={approval.id}
        currentLevel={approval.level}
        requestId={req.id}
      />
    </div>
  );
}