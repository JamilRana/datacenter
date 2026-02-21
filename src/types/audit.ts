export interface AuditLogDetails {
  [key: string]: string | number | boolean | null | undefined | AuditLogDetails | AuditLogDetails[];
}

export interface Actor {
  id?: string;
  name: string;
  email: string;
}

export interface AuditLog {
  id: string;
  timestamp: Date;
  action: string;
  actor?: Actor;
  details?: AuditLogDetails;
  entityType?: string | null;
  entityId?: string | null;
}

export interface Notification {
  id: string;
  userId: string;
  type: string;
  message: string;
  isRead: boolean;
  createdAt: Date;
}