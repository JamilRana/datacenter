export interface Role {
    name: string;
    id: string;
}


export interface User {
  id: string;
  name: string | null;
  email: string | null;
  isActive: boolean;
  designation?: string | null;
  roles: { role: { name: string ;} }[];
}

export interface UserFormData {
  id?: string;
  name: string;
  email: string;
  password?: string;
  designation: string;
  organization: string;
  contact: string;
  roles: string[]
}
