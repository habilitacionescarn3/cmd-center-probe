import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ReactNode } from "react";

import { Toaster } from "@/components/ui/toaster";
import { QueryProvider } from "@/providers/query-client-provider";
import { cn } from "@/lib/utils";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
  display: "swap",
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "Dafiti Command Center",
    template: "%s · Dafiti Command Center",
  },
  description:
    "Monitoramento em tempo real, insights e relatórios de confiabilidade da plataforma Dafiti.",
  metadataBase: new URL("https://status.dafiti.com"),
  applicationName: "Dafiti Command Center",
  keywords: [
    "status page",
    "incident management",
    "SRE",
    "reliability",
    "Dafiti",
  ],
  authors: [{ name: "Dafiti SRE Platform", url: "https://dafitigroup.com" }],
  robots: {
    index: true,
    follow: true,
  },
  icons: {
    icon: [
      { url: "/media/favicon-command.ico" },
      {
        url: "/media/logo-cc-short.png",
        type: "image/png",
        sizes: "512x512",
      },
    ],
    shortcut: "/media/favicon-command.ico",
    apple: "/media/logo-cc-short.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#030712",
};

const currentYear = new Date().getFullYear();

function PlatformFooter() {
  return (
    <footer className="border-t border-slate-800/60 bg-slate-950/70 px-6 py-6 text-center text-xs text-slate-500 backdrop-blur">
      Powered by{" "}
      <span className="font-semibold text-slate-200">JaH</span> © {currentYear} ·
      {" "}
      Made with{" "}
      <span
        aria-hidden="true"
        className="mx-1 inline-flex animate-pulse text-cyan-300"
      >
        ♥
      </span>
      <span className="sr-only">love</span>
      {" "}
      with AI
    </footer>
  );
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" className="dark" suppressHydrationWarning>
      <body
        className={cn(
          "min-h-screen bg-background font-sans text-foreground antialiased",
          geistSans.variable,
          geistMono.variable,
        )}
      >
        <QueryProvider>
          <div className="flex min-h-screen flex-col bg-background">
            <main className="flex-1">{children}</main>
            <PlatformFooter />
          </div>
          <Toaster />
        </QueryProvider>
      </body>
    </html>
  );
}
