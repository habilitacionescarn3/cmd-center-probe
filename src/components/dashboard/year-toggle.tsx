"use client";

import { cn } from "@/lib/utils";

type YearToggleProps = {
  years: number[];
  value: number;
  onChange: (year: number) => void;
  size?: "sm" | "md";
};

export function YearToggle({
  years,
  value,
  onChange,
  size = "md",
}: YearToggleProps) {
  if (!years || years.length === 0) {
    return null;
  }

  return (
    <div
      className={cn(
        "inline-flex rounded-full border border-slate-800/70 bg-slate-950/60 p-1",
        size === "sm" ? "text-xs" : "text-sm",
      )}
    >
      {years.map((year) => {
        const isActive = year === value;
        return (
          <button
            key={year}
            type="button"
            className={cn(
              "rounded-full px-3 py-1 font-medium transition focus:outline-none",
              size === "sm" ? "text-xs" : "text-sm",
              isActive
                ? "bg-cyan-500/20 text-cyan-100 shadow-[0_0_16px_rgba(45,212,191,0.35)]"
                : "text-slate-400 hover:text-slate-100",
            )}
            onClick={() => {
              if (!isActive) {
                onChange(year);
              }
            }}
          >
            {year}
          </button>
        );
      })}
    </div>
  );
}

