// src/app/layout.tsx
import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import AuthSessionProvider from "./providers/SessionProviders";
import Sidebar from "@/components/Sidebar";
import { Toaster } from "sonner";
import NextTopLoader from "nextjs-toploader";
import PermissionHandler from "./providers/PermissionHandler";
import { Suspense } from "react";
import { LoadingProvider } from "@/context/LoadingContext";
import { ThemeProvider } from "./providers/ThemeProvider";

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
  title: "MIS Datacenter",
  description: "Monitor and Maintain Virtual Machine Request and Provisioning System.",
  icons: {
    icon: "/dghs_logo.svg",
    shortcut: "/dghs_logo.svg",
    apple: "/dghs_logo.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                localStorage.setItem('theme', 'light');
                document.documentElement.classList.remove('dark');
                document.documentElement.classList.add('light');
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100`}
      >
        <NextTopLoader 
          color="#4f46e5"
          initialPosition={0.08}
          crawlSpeed={200}
          height={3}
          crawl={true}
          showSpinner={false}
          easing="ease"
          speed={200}
          shadow="0 0 10px #4f46e5,0 0 5px #4f46e5"
        />
        <AuthSessionProvider>
          <ThemeProvider>
            <LoadingProvider>
              <Sidebar>
                {children}
              </Sidebar>
              <Toaster position="top-right" richColors />
              <Suspense fallback={null}>
                <PermissionHandler />
              </Suspense>
            </LoadingProvider>
          </ThemeProvider>
        </AuthSessionProvider>
      </body>
    </html>
  );
}
