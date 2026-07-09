import { ReactNode } from "react";
import Link from "next/link";
import Image from "next/image";

import { requireAuthenticatedUser } from "@/server/auth";
import { AdminNav } from "@/components/admin/admin-nav";
import { SignOutButton } from "@/components/auth/sign-out-button";
import { getBrandingSettings } from "@/server/settings/branding";

type AdminLayoutProps = {
  children: ReactNode;
};

export default async function AdminLayout({ children }: AdminLayoutProps) {
  const user = await requireAuthenticatedUser();
  const branding = await getBrandingSettings();
  const adminLogo = branding.adminLogo ?? "/media/command-center-blue.png";

  return (
    <div className="grid min-h-screen w-full bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 md:grid-cols-[260px_1fr]">
      <aside className="hidden border-r border-slate-800/80 bg-slate-950/80 px-6 py-10 md:flex md:flex-col md:gap-10">
        <div className="space-y-3">
          <Link
            href="/"
            className="inline-flex w-full max-w-[200px] items-center"
          >
            <span className="sr-only">Voltar para a página pública</span>
            <Image
              src={adminLogo}
              alt="Dafiti Command Center"
              width={200}
              height={52}
              className="h-auto w-full"
              priority
            />
          </Link>
          <p className="text-xs text-slate-500">
            Hub de confiabilidade · acesso restrito.
          </p>
        </div>
        <AdminNav />
        <div className="mt-auto space-y-2 rounded-2xl border border-slate-800 bg-slate-900/60 p-4 text-xs text-slate-400">
          <p className="text-sm font-medium text-slate-200">
            {user.name ?? user.email}
          </p>
          <p>{user.email}</p>
          <div className="pt-2">
            <SignOutButton />
          </div>
        </div>
      </aside>
      <div className="flex min-h-screen flex-col">
        <header className="flex items-center justify-between border-b border-slate-800/80 bg-slate-950/60 px-6 py-4 md:hidden">
          <Link href="/" className="inline-flex items-center">
            <span className="sr-only">Voltar para a página pública</span>
            <Image
              src={adminLogo}
              alt="Dafiti Command Center"
              width={140}
              height={36}
              className="h-8 w-auto"
            />
          </Link>
          <span className="text-xs text-slate-500">
            {user.name ?? user.email}
          </span>
        </header>
        <div className="flex-1 overflow-y-auto px-6 py-8">{children}</div>
      </div>
    </div>
  );
}
