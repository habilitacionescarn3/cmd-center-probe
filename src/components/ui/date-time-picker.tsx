"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarClock } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

function parseDateTime(value: string | null | undefined): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;

  const candidates = [trimmed];
  if (!trimmed.endsWith("Z") && !/[+-]\d\d:\d\d$/.test(trimmed)) {
    candidates.push(`${trimmed}:00`);
    candidates.push(`${trimmed}:00Z`);
  }

  for (const candidate of candidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return null;
}

function formatDisplay(value: Date | null) {
  if (!value) {
    return "Selecionar data e hora";
  }
  return format(value, "dd 'de' MMMM yyyy · HH:mm", { locale: ptBR });
}

function clampMinutes(value: number) {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 59) return 59;
  return Math.round(value);
}

type DateTimePickerProps = {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  minuteStep?: number;
  disabled?: boolean;
  allowClear?: boolean;
};

export function DateTimePicker({
  id,
  value,
  onChange,
  className,
  minuteStep = 5,
  disabled,
  allowClear = true,
}: DateTimePickerProps) {
  const parsedValue = useMemo(() => parseDateTime(value), [value]);
  const [open, setOpen] = useState(false);
  const [internalDate, setInternalDate] = useState<Date | null>(parsedValue);

  useEffect(() => {
    setInternalDate(parsedValue);
  }, [parsedValue]);

  const updateValue = (next: Date | null) => {
    setInternalDate(next);
    if (!next) {
      onChange("");
      return;
    }
    onChange(format(next, "yyyy-MM-dd'T'HH:mm"));
  };

  const handleSelectDay = (day: Date | undefined) => {
    if (!day) {
      updateValue(null);
      return;
    }

    const base = internalDate ?? new Date();
    const next = new Date(
      day.getFullYear(),
      day.getMonth(),
      day.getDate(),
      base.getHours(),
      base.getMinutes(),
    );
    updateValue(next);
  };

  const handleHourChange = (hourString: string) => {
    const hour = Number(hourString);
    if (Number.isNaN(hour)) return;

    const base = internalDate ?? new Date();
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      hour,
      base.getMinutes(),
    );
    updateValue(next);
  };

  const handleMinuteChange = (minuteString: string) => {
    const minute = Number(minuteString);
    if (Number.isNaN(minute)) return;

    const base = internalDate ?? new Date();
    const next = new Date(
      base.getFullYear(),
      base.getMonth(),
      base.getDate(),
      base.getHours(),
      clampMinutes(minute),
    );
    updateValue(next);
  };

  const hourValue = internalDate ? internalDate.getHours().toString().padStart(2, "0") : "";
  const minuteValue = internalDate
    ? internalDate.getMinutes().toString().padStart(2, "0")
    : "";

  const [hourInput, setHourInput] = useState(hourValue);
  const [minuteInput, setMinuteInput] = useState(minuteValue);

  useEffect(() => {
    setHourInput(hourValue);
    setMinuteInput(minuteValue);
  }, [hourValue, minuteValue]);

  const handleHourInputChange = (value: string) => {
    setHourInput(value);
    if (value === "") return;
    const hour = Number(value);
    if (!Number.isNaN(hour) && hour >= 0 && hour <= 23) {
      handleHourChange(hour.toString());
    }
  };

  const handleMinuteInputChange = (value: string) => {
    setMinuteInput(value);
    if (value === "") return;
    const minute = Number(value);
    if (!Number.isNaN(minute) && minute >= 0 && minute <= 59) {
      handleMinuteChange(minute.toString());
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          id={id}
          type="button"
          variant="outline"
          disabled={disabled}
          className={cn(
            "w-full justify-start gap-2 rounded-full border border-slate-800/70 bg-slate-900/60 text-left font-normal text-slate-100 shadow-inner hover:border-cyan-500/40 hover:text-white",
            !internalDate && "text-slate-500",
            className,
          )}
        >
          <CalendarClock className="h-4 w-4 shrink-0 text-cyan-300" />
          {formatDisplay(internalDate)}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl rounded-3xl border border-slate-800/80 bg-slate-950 text-slate-100">
        <DialogHeader>
          <DialogTitle>Selecionar data e horário</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-6 lg:flex-row">
          <Calendar
            mode="single"
            selected={internalDate ?? undefined}
            onSelect={(day) => {
              handleSelectDay(day);
            }}
            locale={ptBR}
            initialFocus
            className="rounded-3xl border border-slate-900/60 bg-slate-950"
          />
          <div className="flex-1 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Hora
                </span>
                <Input
                  type="number"
                  min={0}
                  max={23}
                  value={hourInput}
                  onChange={(event) => handleHourInputChange(event.target.value)}
                  placeholder="HH"
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/60 text-slate-100"
                />
              </div>
              <div className="space-y-1">
                <span className="text-xs uppercase tracking-wide text-slate-500">
                  Minutos
                </span>
                <Input
                  type="number"
                  min={0}
                  max={59}
                  step={minuteStep}
                  value={minuteInput}
                  onChange={(event) => handleMinuteInputChange(event.target.value)}
                  placeholder="MM"
                  className="rounded-2xl border border-slate-800/70 bg-slate-900/60 text-slate-100"
                />
              </div>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-400">
              <Button
                type="button"
                variant="ghost"
                className="text-cyan-300 hover:text-cyan-100"
                onClick={() => updateValue(new Date())}
                disabled={disabled}
              >
                Agora
              </Button>
              {allowClear ? (
                <Button
                  type="button"
                  variant="ghost"
                  className="text-slate-400 hover:text-white"
                  onClick={() => updateValue(null)}
                  disabled={disabled}
                >
                  Limpar
                </Button>
              ) : null}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Concluir
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
