import { ReactNode } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type KpiItem = {
  title: string;
  value: ReactNode;
  caption?: ReactNode;
};

type KpiCardsProps = {
  items: KpiItem[];
  className?: string;
};

export function KpiCards({ items, className }: KpiCardsProps) {
  return (
    <div
      className={cn(
        "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5",
        className,
      )}
    >
      {items.map((item) => (
        <Card
          key={String(item.title)}
          className="relative overflow-hidden border border-slate-800 bg-gradient-to-br from-white/5 via-slate-900/40 to-slate-900/80 shadow-xl shadow-black/40 backdrop-blur"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(56,189,248,0.35),transparent_55%)]" />
          <CardHeader className="relative">
            <CardTitle className="text-sm font-medium text-slate-400">
              {item.title}
            </CardTitle>
          </CardHeader>
          <CardContent className="relative flex flex-col gap-1">
            <span className="text-3xl font-semibold tracking-tight text-slate-100">
              {item.value}
            </span>
            {item.caption ? (
              <span className="text-xs text-slate-400">{item.caption}</span>
            ) : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
