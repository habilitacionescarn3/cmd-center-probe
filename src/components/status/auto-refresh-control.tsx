"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type RefreshValue = "off" | "1m" | "5m" | "15m";

const REFRESH_OPTIONS: Array<{ value: RefreshValue; label: string; ms?: number }> = [
  { value: "1m", label: "1m", ms: 60_000 },
  { value: "5m", label: "5m", ms: 5 * 60_000 },
  { value: "15m", label: "15m", ms: 15 * 60_000 },
  { value: "off", label: "off" },
];

const STORAGE_KEY = "status:auto-refresh";

export function AutoRefreshControl() {
  const router = useRouter();
  const [value, setValue] = useState<RefreshValue>("off");

  useEffect(() => {
    const storedValue = window.localStorage.getItem(STORAGE_KEY) as RefreshValue | null;
    if (storedValue && REFRESH_OPTIONS.some((option) => option.value === storedValue)) {
      setValue(storedValue);
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, value);
    const option = REFRESH_OPTIONS.find((item) => item.value === value);
    if (!option?.ms) {
      return;
    }

    const intervalId = window.setInterval(() => {
      router.refresh();
    }, option.ms);

    return () => window.clearInterval(intervalId);
  }, [router, value]);

  return (
    <div className="w-full sm:w-auto">
      <Select
        value={value}
        onValueChange={(next) => setValue(next as RefreshValue)}
        aria-label="Atualização automática"
      >
        <SelectTrigger className="h-9 w-full border-slate-700/70 bg-slate-950/40 px-3 text-slate-100 shadow-none transition-colors hover:border-slate-500 focus:ring-0 sm:w-auto sm:min-w-[5.5rem]">
          <SelectValue placeholder="off" />
        </SelectTrigger>
        <SelectContent className="border-slate-800 bg-slate-900 text-slate-100">
          {REFRESH_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
