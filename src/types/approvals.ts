// src/types/approvals.ts
import { CustomizationStatus, RequestStatus } from "@prisma/client";
import { Requester } from "./users";

export interface Approval {
  id: string;
  entityType: string;
  requestId: string|null;
  customizationRequestId: string|null;
  level: number;
  approverId: string;
  approver: { id: string; name: string; email: string; designation: string | null };
  decision: string;
  comments: string | null;
  decidedAt: Date | string | null;
  createdAt: Date | string;
}

// ✅ SEPARATE BASE INTERFACES FOR DIFFERENT ENUMS
export interface BaseRequest {
  id: string;
  createdAt: Date;
  status: RequestStatus; // For Request model
  requester: Requester | null;
}

export interface BaseCustomizationRequest {
  id: string;
  createdAt: Date;
  status: CustomizationStatus; // For CustomizationRequest model
  requester: Requester | null;
}

export interface DashboardRequest {
  id: string;
  createdAt: Date;
  status: string;
  requestType?: string;
  systemName: string;
  projectName: string | null;
  requester: Requester | null;
  targetVm?: { hostname: string | null } | null;
  approvals?: Approval[];
  quantity?: number;
  vmInstances?: { length: number };
  subdomain?: string | null;
}