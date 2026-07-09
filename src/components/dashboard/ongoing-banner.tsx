"use client";

import { useEffect, useMemo, useState } from "react";
import { IncidentStatus, Severity } from "@prisma/client";
import { motion } from "framer-motion";
import Link from "next/link";

import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { StatusBadge } from "@/components/status/status-badge";
import { SeverityBadge } from "@/components/status/severity-badge";
import { cn } from "@/lib/utils";

type OngoingIncident = {
  id: string;
  title: string;
  severity: Severity;
  status: IncidentStatus;
  startedAt: Date;
  applications: Array<{
    name: string;
    slug: string;
  }>;
};

type OngoingBannerProps = {
  incidents: OngoingIncident[];
  className?: string;
};

export function OngoingBanner({ incidents, className }: OngoingBannerProps) {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(interval);
  }, []);

  const durationsById = useMemo(
    () =>
      incidents.reduce<Record<string, string>>((acc, incident) => {
        acc[incident.id] = formatDuration(incident.startedAt, now);
        return acc;
      }, {}),
    [incidents, now],
  );

  if (incidents.length === 0) {
    return null;
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: "easeOut" }}
      className={cn("w-full", className)}
    >
      <Card className="relative overflow-hidden border border-red-500/20 bg-gradient-to-br from-red-500/30 via-slate-950 to-slate-950/70 p-6 shadow-2xl shadow-red-900/30">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(248,113,113,0.35),transparent_60%)]" />
        <div className="relative flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="space-y-3">
            <div className="flex items-center gap-3 text-sm uppercase tracking-wide text-red-200/80">
              <span className="flex h-2 w-2 animate-pulse rounded-full bg-red-300 shadow-[0_0_15px_rgba(248,113,113,.75)]" />
              <span>Incidentes em andamento</span>
            </div>
            <div className="space-y-2">
              {incidents.map((incident) => (
                <div
                  key={incident.id}
                  className="flex flex-wrap items-center gap-3 text-slate-50/90"
                >
                  <SeverityBadge severity={incident.severity} />
                  <StatusBadge status={incident.status} />
                  <span className="font-semibold">{incident.title}</span>
                  <span className="text-xs text-slate-200/70">
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(incident.startedAt)}
                  </span>
                  <span className="text-xs text-amber-100/80">
                    ⏱️ {durationsById[incident.id]}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {incidents.flatMap((incident) =>
                incident.applications.map((app) => (
                  <Badge
                    key={`${incident.id}-${app.slug}`}
                    variant="outline"
                    className="border-red-500/30 text-xs text-red-100"
                  >
                    {app.name}
                  </Badge>
                )),
              )}
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href={`/incident/${incidents[0]?.id ?? ""}`}
              className="inline-flex items-center rounded-full border border-white/40 px-4 py-2 text-sm font-medium text-white transition hover:border-white hover:bg-white/10"
            >
              Ver detalhes
            </Link>
          </div>
        </div>
      </Card>
    </motion.div>
  );
}

function formatDuration(start: Date, now: Date) {
  const diffMs = Math.max(0, now.getTime() - start.getTime());
  const totalMinutes = Math.floor(diffMs / 60000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours <= 0) {
    return `${minutes}min`;
  }
  if (hours < 24) {
    return `${hours}h ${minutes.toString().padStart(2, "0")}min`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return `${days}d ${remainingHours}h`;
}
