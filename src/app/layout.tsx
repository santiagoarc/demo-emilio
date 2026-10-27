import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { AppShell } from "@/components/shell/AppShell";
import { DemoProvider } from "@/state/DemoProvider";
import "./globals.css";

// The demo generates its data in the browser; there is no UI to validate on the server.
export const instant = false;

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Animal Care Platform · SeaWorld concept demo",
  description: "Concept demo for penguin and aviary care teams, built on simulated data.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full">
        <DemoProvider>
          <AppShell>{children}</AppShell>
        </DemoProvider>
      </body>
    </html>
  );
}
