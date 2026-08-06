// src/lib/authOptions.ts
import  { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: "jwt" },
  cookies: {
    sessionToken: {
      name: '__sess',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
      },
    },
    callbackUrl: {
      name: '__cb_url',
      options: { sameSite: 'lax', path: '/', secure: true },
    },
    csrfToken: {
      name: '__csrf',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true },
    },
  },
  providers: [
    CredentialsProvider({
      name: "Credentials",
      credentials: {
        email: { label: "Email", type: "text" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: credentials.email },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });

        if (!user || !user.password) {
          return null;
        }

        const isValid = await bcrypt.compare(
          credentials.password,
          user.password
        );
        if (!isValid) {
          return null;
        }

        if (!user.isActive) {
          return null;
        }

        const roles = user.roles.map((ur: any) => ur.role.name);

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          contact: user.contact ?? "",
          designation: user.designation ?? "",
          organization: user.organization ?? "",
          roles: roles,
        };
      },
    }),
  ],
  pages: {
    signIn: "/auth",
  },
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.designation = user.designation;
        token.contact = user.contact;
        token.roles = user.roles;
        token.organization = user.organization;
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: token.id as string,
          email: token.email as string,
          name: token.name as string,
          designation: token.designation as string,
          roles: token.roles as string[],
          contact: token.contact as string,
          organization: token.organization as string,
        };
      }
      return session;
    },
  },
};
