// types/next-auth.d.ts
import "next-auth";
import "next-auth/jwt";

// Extend the built-in session types
declare module "next-auth" {
  interface User {
    id: string;
    name: string;
    email: string;
    contact: string | null;
    designation: string | null;
    organization: string | null;
    role: string;
  }

  interface Session {
    user: User & {
      id: string;
      name: string;
      email: string;
      contact: string | null;
      designation: string | null;
      organization: string | null;
      role: string;
    };
  }
}

// Extend JWT token types
declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    name: string;
    email: string;
    contact: string | null;
    designation: string | null;
    organization: string | null;
    role: string;
  }
}
