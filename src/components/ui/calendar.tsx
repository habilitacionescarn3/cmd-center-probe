"use client";

import * as React from "react";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
} from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 text-slate-100", className)}
      classNames={{
        caption:
          "flex justify-center pt-1 pb-4 font-medium text-slate-200 uppercase tracking-wide text-xs",
        caption_label: "flex items-center gap-2 text-sm",
        nav: "space-x-1 flex items-center",
        nav_button:
          "h-7 w-7 rounded-full border border-slate-700/80 bg-slate-900/80 text-slate-200 hover:bg-slate-800 hover:text-white",
        nav_button_previous: "absolute left-3 top-3",
        nav_button_next: "absolute right-3 top-3",
        table: "w-full border-collapse space-y-1",
        head_row: "flex",
        head_cell:
          "text-slate-500 rounded-md font-medium text-[0.65rem] uppercase",
        row: "flex w-full mt-2",
        cell:
          "relative h-9 w-9 text-center text-sm focus-within:relative focus-within:z-20",
        day: cn(
          "inline-flex h-9 w-9 items-center justify-center rounded-full text-sm font-medium transition-all",
          "hover:bg-cyan-500/20 hover:text-cyan-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-950",
        ),
        day_selected:
          "bg-cyan-500 text-cyan-50 hover:bg-cyan-500 hover:text-white",
        day_today:
          "border border-cyan-500/60 bg-cyan-500/15 text-cyan-100",
        day_outside: "text-slate-600/70 opacity-50",
        day_disabled: "text-slate-600 opacity-40",
        day_range_middle:
          "bg-cyan-500/10 text-cyan-100 hover:bg-cyan-500/20",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation = "right", className, size = 16 }) => {
          const Icon =
            orientation === "left"
              ? ChevronLeft
              : orientation === "up"
                ? ChevronUp
                : orientation === "down"
                  ? ChevronDown
                  : ChevronRight;
          return (
            <Icon
              aria-hidden="true"
              className={cn("text-cyan-200", className)}
              style={{ width: size, height: size }}
            />
          );
        },
      }}
      {...props}
    />
  );
}
