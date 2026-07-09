"use client";

import { useMemo, useState } from "react";

import { KpiCards, KpiItem } from "@/components/dashboard/kpi-cards";
import { YearToggle } from "@/components/dashboard/year-toggle";
import { cn } from "@/lib/utils";

type YearlyKpiCardsProps = {
  years: number[];
  itemsByYear: Record<number, KpiItem[]>;
  defaultYear: number;
  className?: string;
};

export function YearlyKpiCards({
  years,
  itemsByYear,
  defaultYear,
  className,
}: YearlyKpiCardsProps) {
  const fallbackYear = years[0];
  const initialYear = years.includes(defaultYear) ? defaultYear : fallbackYear;
  const [selectedYear, setSelectedYear] = useState(initialYear);

  const items = useMemo(() => {
    return (
      itemsByYear[selectedYear] ??
      itemsByYear[fallbackYear] ??
      []
    );
  }, [fallbackYear, itemsByYear, selectedYear]);

  if (!years || years.length === 0) {
    return null;
  }

  return (
    <div className={cn("space-y-4", className)}>
      <KpiCards items={items} />
      <div className="flex flex-wrap items-center justify-center gap-3 text-xs text-slate-400">
        <span>Comparar ciclo:</span>
        <YearToggle years={years} value={selectedYear} onChange={setSelectedYear} />
      </div>
    </div>
  );
}

