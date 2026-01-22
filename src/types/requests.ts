// src/types/request.ts
export type RequestStatus =
  | "DRAFT"
  | "PENDING_L1"
  | "PENDING_L2"
  | "PENDING_L3"
  | "APPROVED"
  | "REJECTED"
  | "PROVISIONED"
  | "CLOSED"; // ← Add this

  export const requestStatus = [
    "PENDING_L1",
    "PENDING_L2",
    "PENDING_L3",
    "APPROVED",
    "REJECTED",
    "PROVISIONED",
    "CLOSED"
  ] as const;

export type RequestType = "NEW_VM" | "CLONE_VM" | "CUSTOMIZE_VM";

export type ApprovalEntityType = "REQUEST" | "VM_INSTANCE";

export interface Request {
  id: string;
  userId: string;
  type: RequestType;
  status: RequestStatus;
  createdAt: Date;
  updatedAt: Date;
}