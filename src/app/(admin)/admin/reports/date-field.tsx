"use client";

import { useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarDays } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DateFieldProps = {
  label: string;
  name: string;
  defaultValue?: string;
  disabled?: boolean;
  min?: Date;
  max?: Date;
};

function safeParse(value?: string) {
  if (!value) return null;
  try {
    const parsed = parseISO(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  } catch {
    return null;
  }
}

function formatDisplay(value: Date | null) {
  if (!value) return "Selecionar data";
  return format(value, "dd/MM/yyyy", { locale: ptBR });
}

export function DateField({
  label,
  name,
  defaultValue,
  disabled,
  min,
  max,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(() =>
    safeParse(defaultValue),
  );

  const hiddenValue = selectedDate
    ? format(selectedDate, "yyyy-MM-dd")
    : "";

  const disabledDays = useMemo(() => {
    const config: { before?: Date; after?: Date } = {};
    if (min) config.before = min;
    if (max) config.after = max;
    return config;
  }, [min, max]);

  return (
    <div className="flex flex-col">
      <label className="text-xs text-slate-500">{label}</label>
      <input type="hidden" name={name} value={hiddenValue} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={disabled}
            className={cn(
              "mt-1 inline-flex items-center justify-start gap-2 rounded-full border border-slate-800/70 bg-slate-900/60 px-4 py-2 text-sm font-medium text-slate-100 shadow-inner hover:border-cyan-500/40 hover:text-white",
              !selectedDate && "text-slate-500",
            )}
          >
            <CalendarDays className="h-4 w-4 text-cyan-300" />
            {formatDisplay(selectedDate)}
          </Button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          className="w-auto rounded-3xl border border-slate-800/70 bg-slate-950/95 p-4"
        >
          <Calendar
            mode="single"
            locale={ptBR}
            selected={selectedDate ?? undefined}
            onSelect={(day) => {
              setSelectedDate(day ?? null);
              if (day) {
                setOpen(false);
              }
            }}
            disabled={(date) => {
              if (disabledDays.before && date < disabledDays.before) {
                return true;
              }
              if (disabledDays.after && date > disabledDays.after) {
                return true;
              }
              return false;
            }}
            initialFocus
          />
        </PopoverContent>
      </Popover>
    </div>
  );
}
