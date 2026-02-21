
export interface User {
    id: string;
    name: string;
    email: string;
    contact: string | null;
    designation: string | null;
    organization: string | null;
    isActive: boolean;
    roles: string[];
}

export interface UserRole {
  userId: string;
  roleId: string;
  createdAt: Date;
}

export interface Role {
  id: string;
  name: string;
}

export interface UserFormData {
  id?: string;
  name: string;
  email: string;
  password?: string;
  designation: string;
  organization: string;
  contact: string;
  roles: string[];
}