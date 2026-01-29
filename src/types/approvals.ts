// src/types/approvals.ts
import { RequestStatus, RequestType } from "@prisma/client";

export interface Requester {
  name: string;
  email: string;
}

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