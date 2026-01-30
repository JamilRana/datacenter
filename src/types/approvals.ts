// src/types/approvals.ts
import { Approval, RequestStatus, RequestType } from "@prisma/client";

// ✅ Make requester optional to match Prisma schema
export interface BaseRequest {
  id: string;
  createdAt: Date;
  status: RequestStatus;
  requester: Requester | null; // ✅ Nullable
}

export interface VmInstance {
  hostname: string | null;
}

export interface RequestItem extends BaseRequest {
  requestType: RequestType;
  systemName: string;
  projectName: string | null;
}

export interface CustomizationRequestItem extends BaseRequest {
  targetVm: VmInstance | null;
}


export interface Requester {
  name: string;
  email: string;
}

export interface DashboardRequest {
  id: string;
  createdAt: Date;
  status: RequestStatus;
  requestType: RequestType;
  systemName: string;
  projectName: string | null;
  requester: Requester | null;
  
  // Optional fields that may exist on some request types
  targetVm?: {
    hostname: string | null;
  } | null;
}

export interface ApprovalRequestDetail extends BaseRequest {
  requestType: RequestType;
  systemName: string;
  projectName: string | null;
  // Explicitly define included relations with correct nullability
  requester: (Requester & { designation: string | null }) | null;
  approvals: Approval[];
  vmInstances: Array<{ /* define minimal shape if used */ }>;
  targetVm: VmInstance | null;
}