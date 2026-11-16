// src/lib/authOptions.ts
import  { type NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import { PrismaAdapter } from "@next-auth/prisma-adapter";
import bcrypt from "bcryptjs";
import prisma from "@/lib/prisma";

// Dummy hash to prevent timing attacks / user enumeration
const DUMMY_HASH = "$2b$10$epBzX9gW8FzM9eHlEaLReeA2HjV7O0X7gZtS9Yg8J8vFzW0FpB8a2";

export const authOptions: NextAuthOptions = {
  adapter: PrismaAdapter(prisma),
  secret: process.env.NEXTAUTH_SECRET,
  session: {
    strategy: "jwt",
    maxAge: 60 * 60, // 1 hour absolute session lifetime
    updateAge: 60,   // Update token activity every 60 seconds
  },
  jwt: {
    maxAge: 60 * 60, // 1 hour JWT lifespan
  },
  cookies: {
    sessionToken: {
      name: '__sess',
      options: {
        httpOnly: true,
        sameSite: 'lax',
        path: '/',
        secure: process.env.NODE_ENV === 'production',
        maxAge: undefined, // Browser session cookie: deleted when browser is closed
      },
    },
    callbackUrl: {
      name: '__cb_url',
      options: { sameSite: 'lax', path: '/', secure: true, maxAge: undefined },
    },
    csrfToken: {
      name: '__csrf',
      options: { httpOnly: true, sameSite: 'lax', path: '/', secure: true, maxAge: undefined },
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

        const email = credentials.email.trim();
        const user = await prisma.user.findFirst({
          where: {
            email: { equals: email, mode: "insensitive" },
          },
          include: {
            roles: {
              include: { role: true },
            },
          },
        });

        // Always run bcrypt comparison to prevent response timing enumeration
        const passwordToCompare = user?.password || DUMMY_HASH;
        const isValid = await bcrypt.compare(
          credentials.password,
          passwordToCompare
        );

        if (!user || !user.password || !isValid || !user.isActive) {
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
      const now = Math.floor(Date.now() / 1000);
      const IDLE_TIMEOUT_SECONDS = 10 * 60; // 10 minutes

      // Check inactivity on subsequent requests
      if (token.lastActivity && (now - (token.lastActivity as number) > IDLE_TIMEOUT_SECONDS)) {
        return {} as any; // Invalidate stale token
      }
      token.lastActivity = now;

      if (user) {
        token.id = user.id;
        token.email = user.email;
        token.name = user.name;
        token.designation = user.designation;
        token.contact = user.contact;
        token.roles = user.roles;
        token.organization = user.organization;
      } else if (token.email) {
        try {
          const dbUser = await prisma.user.findFirst({
            where: { email: { equals: token.email as string, mode: "insensitive" } },
            select: { id: true, isActive: true, roles: { include: { role: true } } }
          });
          if (dbUser && dbUser.isActive) {
            token.id = dbUser.id;
            token.roles = dbUser.roles.map((ur: any) => ur.role.name);
          }
        } catch {
          // Keep existing token if db check fails temporarily
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (token) {
        session.user = {
          ...session.user,
          id: (token.id || token.sub) as string,
          email: token.email as string,
          name: token.name as string,
          designation: token.designation as string,
          roles: (token.roles as string[]) || [],
          contact: token.contact as string,
          organization: token.organization as string,
        };
      }
      return session;
    },
  },
};
