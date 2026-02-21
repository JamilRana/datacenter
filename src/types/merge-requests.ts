// src/types/merged-request.ts
import {
  Environment,
  RequestStatus,
  RequestType,
  VmStatus,
} from "@prisma/client";

export interface MergedRequest {
  id: string;
  requestType: RequestType;
  status: RequestStatus;

  systemName: string;
  projectName?: string | null;
  environment: Environment;
  purpose: string;

  createdAt: Date;
  updatedAt: Date;
  submittedAt?: Date | null;

  approvals: {
    id: string;
    level: string;
    decision: string;
    approver: {
      id: string;
      name: string;
    };
  }[];

  vmInstances: {
    id: string;
    hostname: string | null;
    ipAddress: string | null;
    status: VmStatus;
  }[];
}
