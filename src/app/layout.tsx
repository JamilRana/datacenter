// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthSessionProvider from "./providers/SessionProviders";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "sonner";
import PermissionHandler from "./providers/PermissionHandler";
import { Suspense } from "react";
import { LoadingProvider } from "@/context/LoadingContext";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "MIS DC Portal",
  description: "Virtual Machine Request and Provisioning System",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50`}
      >
        <AuthSessionProvider>
            <LoadingProvider>
              <Sidebar>
                {children}
              </Sidebar>
              <Toaster position="top-right" richColors />
              <Suspense fallback={null}>
                <PermissionHandler />
              </Suspense>
            </LoadingProvider>
          </AuthSessionProvider>
      </body>
    </html>
  );
}
