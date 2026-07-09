"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { cn } from "@/lib/utils";

const links = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/incidents", label: "Incidentes" },
  { href: "/admin/integrations", label: "Integrações" },
  { href: "/admin/messages", label: "Mensagens" },
  { href: "/admin/settings", label: "Configurações" },
  { href: "/admin/users", label: "Usuários" },
  { href: "/admin/reports", label: "Relatórios" },
  { href: "/admin/audit", label: "Auditoria" },
];

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-1">
      {links.map((link) => {
        const isActive =
          pathname === link.href || pathname?.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            className={cn(
              "rounded-2xl px-4 py-2 text-sm font-medium transition",
              isActive
                ? "bg-cyan-500/20 text-cyan-200"
                : "text-slate-400 hover:bg-slate-800/50 hover:text-slate-200",
            )}
          >
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
