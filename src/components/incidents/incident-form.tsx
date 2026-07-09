"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { IncidentStatus, Severity } from "@prisma/client";
import { useRouter } from "next/navigation";
import { useMutation } from "@tanstack/react-query";
import {
  CalendarDays,
  CalendarRange,
  Loader2,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { DateTimePicker } from "@/components/ui/date-time-picker";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import {
  IncidentFormValues,
  createEmptyIncidentFormValues,
} from "@/types/incidents";

function toNumber(value: string): number | undefined {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  const parsed = Number(trimmed);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function splitApplications(raw: string): string[] {
  return raw
    .split(/[\n,;]+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length > 0);
}

const SERVICE_OPTIONS_PRESET = [
  "CrossRoads",
  "Fluxo de Pedidos",
  "Login",
  "TMS",
  "Navegação",
  "Checkout",
  "King",
  "WMS",
  "BOB",
  "SAP",
  "Sellercenter",
  "Banco",
  "Fusion",
  "King/Hosanna",
  "Bob/WMS",
  "Seller Center",
  "AWS",
  "APP",
  "Frete",
];

const SOLUTION_TYPE_PRESET = ["Paliativa", "Definitiva"];

const PRODUTOS_OKR_PRESET = [
  "BOB",
  "Fluxo de Pedidos",
  "Seller Center",
  "Alice",
  "Navegação",
  "Check-Out",
  "Não",
  "Login",
  "King",
  "WMS",
  "Sap",
  "Sim",
  "Freight",
  "Payment",
  "Atualização de Campanhas",
  "Mobile",
];

const SOLVER_PRESET = [
  "Post-Sales",
  "Payment",
  "SRE-Runit",
  "DRE-SWAT",
  "Order e Purchase",
  "Redes",
  "Redes e Telecom",
  "SAP",
  "Parceiro terceirizado Get",
  "DBA",
  "Customer",
  "Infraestrutura",
  "Navigation Services",
  "Login & Cart",
  "Portfolio",
  "App Plataform",
  "SRE",
  "Navigation",
  "GET",
  "App Platform",
  "Navegação",
  "DBRE",
  "Backoffice",
  "Navigation Growth",
  "SAP Basis",
  "Mobile App Plataform",
  "Freight API",
];

const IMPACT_PRESET = ["Operacional", "Vendas", "Cliente", "Parceiro"];

function mergeUniqueOptions(options: string[]): string[] {
  const unique = new Set<string>();
  options.forEach((option) => {
    const trimmed = option.trim();
    if (trimmed.length > 0) {
      unique.add(trimmed);
    }
  });
  return Array.from(unique);
}

type IncidentFormProps = {
  mode: "create" | "edit";
  incidentId?: string;
  initialValues?: IncidentFormValues;
};

type SelectOption<T extends string> = {
  value: T;
  label: string;
  color?: string;
  emoji?: string;
};

const COUNTRY_OPTIONS: SelectOption<string>[] = [
  { value: "BR", label: "Brasil", emoji: "🇧🇷" },
  { value: "CO", label: "Colômbia", emoji: "🇨🇴" },
  { value: "BR+CO", label: "Brasil + Colômbia", emoji: "🇧🇷🇨🇴" },
];

const MONTH_OPTIONS: Array<SelectOption<string>> = [
  { value: "1", label: "Janeiro" },
  { value: "2", label: "Fevereiro" },
  { value: "3", label: "Março" },
  { value: "4", label: "Abril" },
  { value: "5", label: "Maio" },
  { value: "6", label: "Junho" },
  { value: "7", label: "Julho" },
  { value: "8", label: "Agosto" },
  { value: "9", label: "Setembro" },
  { value: "10", label: "Outubro" },
  { value: "11", label: "Novembro" },
  { value: "12", label: "Dezembro" },
];

const SEVERITY_OPTIONS: Array<SelectOption<Severity>> = [
  { value: Severity.P1, label: "P1 · Crítico", color: "bg-fuchsia-500" },
  { value: Severity.P2, label: "P2 · Alto", color: "bg-rose-500" },
  { value: Severity.P3, label: "P3 · Médio", color: "bg-orange-400" },
  { value: Severity.P4, label: "P4 · Baixo", color: "bg-sky-400" },
];

const STATUS_OPTIONS: Array<SelectOption<IncidentStatus>> = [
  { value: IncidentStatus.ATIVO, label: "Ativo", color: "bg-rose-500" },
  { value: IncidentStatus.SUSPEITA, label: "Suspeita", color: "bg-amber-400" },
  { value: IncidentStatus.RECUPERADO, label: "Recuperado", color: "bg-emerald-500" },
  { value: IncidentStatus.ARQUIVADO, label: "Arquivado", color: "bg-slate-500" },
];

function deriveDateFromValues(values: IncidentFormValues): Date {
  const day = Number(values.dayNumber);
  const month = Number(values.monthNumber);
  const year = Number(values.yearNumber);

  if (!Number.isNaN(day) && !Number.isNaN(month) && !Number.isNaN(year)) {
    const parsed = new Date(year, month - 1, day);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  const fallbackCandidates = [values.startedAt, values.resolvedAt].filter(Boolean) as string[];
  for (const candidate of fallbackCandidates) {
    const parsed = new Date(candidate);
    if (!Number.isNaN(parsed.getTime())) {
      return parsed;
    }
  }

  return new Date();
}

export function IncidentForm({ mode, incidentId, initialValues }: IncidentFormProps) {
  const { toast } = useToast();
  const router = useRouter();

  const baseValues = initialValues
    ? {
        ...initialValues,
        country: initialValues.country && initialValues.country.length > 0 ? initialValues.country : "BR",
        links: { ...initialValues.links },
      }
    : createEmptyIncidentFormValues();

  const [values, setValues] = useState<IncidentFormValues>(baseValues);
  const [dateSelection, setDateSelection] = useState<Date>(
    deriveDateFromValues(baseValues),
  );
  const [dayPickerOpen, setDayPickerOpen] = useState(false);
  const [monthPickerOpen, setMonthPickerOpen] = useState(false);
  const isEditMode = mode === "edit" && typeof incidentId === "string";
  const [selectedApplications, setSelectedApplications] = useState<string[]>(() =>
    splitApplications(baseValues.applications),
  );
  const [serviceOptions, setServiceOptions] = useState<string[]>(() =>
    mergeUniqueOptions([
      ...SERVICE_OPTIONS_PRESET,
      ...splitApplications(baseValues.applications),
    ]),
  );
  const [serviceSelectValue, setServiceSelectValue] = useState<string | undefined>(undefined);
  const [solutionOptions, setSolutionOptions] = useState<string[]>(() =>
    mergeUniqueOptions([
      ...SOLUTION_TYPE_PRESET,
      baseValues.solutionType ?? "",
    ]),
  );
  const [okrOptions, setOkrOptions] = useState<string[]>(() =>
    mergeUniqueOptions([
      ...PRODUTOS_OKR_PRESET,
      baseValues.produtosOkr ?? "",
    ]),
  );
  const [solverOptions, setSolverOptions] = useState<string[]>(() =>
    mergeUniqueOptions([...SOLVER_PRESET, baseValues.solver ?? ""]),
  );
  const [impactOptions, setImpactOptions] = useState<string[]>(() =>
    mergeUniqueOptions([...IMPACT_PRESET, baseValues.impact ?? ""]),
  );
  const [serviceDialogOpen, setServiceDialogOpen] = useState(false);
  const [serviceDraft, setServiceDraft] = useState("");
  const [solutionDialogOpen, setSolutionDialogOpen] = useState(false);
  const [solutionDraft, setSolutionDraft] = useState("");
  const [okrDialogOpen, setOkrDialogOpen] = useState(false);
  const [okrDraft, setOkrDraft] = useState("");
  const [solverDialogOpen, setSolverDialogOpen] = useState(false);
  const [solverDraft, setSolverDraft] = useState("");
  const [impactDialogOpen, setImpactDialogOpen] = useState(false);
  const [impactDraft, setImpactDraft] = useState("");

  useEffect(() => {
    if (initialValues) {
      setValues({
        ...initialValues,
        country:
          initialValues.country && initialValues.country.length > 0
            ? initialValues.country
            : "BR",
        links: { ...initialValues.links },
      });
      setDateSelection(deriveDateFromValues(initialValues));
      const nextApplications = splitApplications(initialValues.applications);
      setSelectedApplications(nextApplications);
      setServiceOptions((previous) =>
        mergeUniqueOptions([...previous, ...nextApplications]),
      );
      if (initialValues.solutionType?.trim()) {
        setSolutionOptions((previous) =>
          mergeUniqueOptions([...previous, initialValues.solutionType ?? ""]),
        );
      }
      setSolutionDraft("");
      setSolutionDialogOpen(false);
      if (initialValues.produtosOkr?.trim()) {
        setOkrOptions((previous) =>
          mergeUniqueOptions([...previous, initialValues.produtosOkr ?? ""]),
        );
      }
      setOkrDraft("");
      setOkrDialogOpen(false);
      if (initialValues.solver?.trim()) {
        setSolverOptions((previous) =>
          mergeUniqueOptions([...previous, initialValues.solver ?? ""]),
        );
      }
      setSolverDraft("");
      setSolverDialogOpen(false);
      if (initialValues.impact?.trim()) {
        setImpactOptions((previous) =>
          mergeUniqueOptions([...previous, initialValues.impact ?? ""]),
        );
      }
      setImpactDraft("");
      setImpactDialogOpen(false);
      setServiceDraft("");
      setServiceDialogOpen(false);
      setServiceSelectValue(undefined);
    }
  }, [initialValues]);

  useEffect(() => {
    setValues((previous) => {
      const day = dateSelection.getDate().toString();
      const month = (dateSelection.getMonth() + 1).toString();
      const year = dateSelection.getFullYear().toString();

      if (
        previous.dayNumber === day &&
        previous.monthNumber === month &&
        previous.yearNumber === year
      ) {
        return previous;
      }

      return {
        ...previous,
        dayNumber: day,
        monthNumber: month,
        yearNumber: year,
      };
    });
  }, [dateSelection]);

  useEffect(() => {
    setValues((previous) => {
      const nextApplications = selectedApplications.join(", ");
      if (previous.applications === nextApplications) {
        return previous;
      }
      return {
        ...previous,
        applications: nextApplications,
      };
    });
  }, [selectedApplications]);

  useEffect(() => {
    const clearDuration = () => {
      setValues((previous) => {
        if (
          previous.totalMinutesReported === "" &&
          previous.durationHoursReported === "" &&
          previous.durationMinutesReported === ""
        ) {
          return previous;
        }
        return {
          ...previous,
          totalMinutesReported: "",
          durationHoursReported: "",
          durationMinutesReported: "",
        };
      });
    };

    if (!values.startedAt || !values.resolvedAt) {
      clearDuration();
      return;
    }

    const start = new Date(values.startedAt);
    const end = new Date(values.resolvedAt);

    if (
      Number.isNaN(start.getTime()) ||
      Number.isNaN(end.getTime()) ||
      end <= start
    ) {
      clearDuration();
      return;
    }

    const totalMinutes = Math.max(
      0,
      Math.round((end.getTime() - start.getTime()) / 60000),
    );
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    setValues((previous) => {
      const totalStr = totalMinutes.toString();
      const hoursStr = hours.toString();
      const minutesStr = minutes.toString();

      if (
        previous.totalMinutesReported === totalStr &&
        previous.durationHoursReported === hoursStr &&
        previous.durationMinutesReported === minutesStr
      ) {
        return previous;
      }

      return {
        ...previous,
        totalMinutesReported: totalStr,
        durationHoursReported: hoursStr,
        durationMinutesReported: minutesStr,
      };
    });
  }, [values.startedAt, values.resolvedAt]);

  const requiredApplications = useMemo(
    () => selectedApplications,
    [selectedApplications],
  );

  const mutation = useMutation({
    mutationFn: async () => {
      const title = values.title.trim();
      const description = values.description.trim();
      const startedAt = values.startedAt.trim();

      if (title.length === 0) {
        throw new Error("Informe o título do incidente.");
      }

      if (description.length === 0) {
        throw new Error("Descreva a falha/impacto do incidente.");
      }

      if (startedAt.length === 0) {
        throw new Error("Informe o início da falha.");
      }

      if (requiredApplications.length === 0) {
        throw new Error("Informe ao menos um serviço/ aplicação.");
      }

      const payload: Record<string, unknown> = {
        title,
        description,
        severity: values.severity,
        status: values.status,
        startedAt,
        applications: requiredApplications,
      };

      const resolvedAt = values.resolvedAt.trim();
      if (resolvedAt) {
        payload.resolvedAt = resolvedAt;
      }

      const optionalStrings: Array<[keyof IncidentFormValues, (value: string) => string]> = [
        ["impact", (value) => value],
        ["scope", (value) => value],
        ["owner", (value) => value],
        ["solutionType", (value) => value],
        ["cause", (value) => value],
        ["resolution", (value) => value],
        ["produtosOkr", (value) => value],
        ["coreSystems", (value) => value],
        ["solver", (value) => value],
        ["ordersAffected", (value) => value],
        ["financialImpact", (value) => value],
        ["rca", (value) => value],
      ];

      optionalStrings.forEach(([field, transform]) => {
        const rawValue = values[field];
        if (typeof rawValue === "string" && rawValue.trim().length > 0) {
          payload[field] = transform(rawValue.trim());
        }
      });

      if (values.country.trim()) {
        payload.country = values.country.trim().toUpperCase();
      }

      if (values.sanv2Code.trim()) {
        payload.sanv2Code = values.sanv2Code.trim().toUpperCase();
      }

      const day = toNumber(values.dayNumber);
      if (typeof day === "number") {
        payload.dayNumber = day;
      }
      const month = toNumber(values.monthNumber);
      if (typeof month === "number") {
        payload.monthNumber = month;
      }
      const year = toNumber(values.yearNumber);
      if (typeof year === "number") {
        payload.yearNumber = year;
      }
      const totalMinutes = toNumber(values.totalMinutesReported);
      if (typeof totalMinutes === "number") {
        payload.totalMinutesReported = totalMinutes;
      }
      const durationHours = toNumber(values.durationHoursReported);
      if (typeof durationHours === "number") {
        payload.durationHoursReported = durationHours;
      }
      const durationMinutes = toNumber(values.durationMinutesReported);
      if (typeof durationMinutes === "number") {
        payload.durationMinutesReported = durationMinutes;
      }

      const links: Record<string, string> = {};
      if (values.links.jira.trim()) {
        links.jira = values.links.jira.trim();
      }
      if (values.links.grafana.trim()) {
        links.grafana = values.links.grafana.trim();
      }
      if (values.links.runbook.trim()) {
        links.runbook = values.links.runbook.trim();
      }

      if (Object.keys(links).length > 0) {
        payload.links = links;
      }

      const endpoint =
        mode === "create"
          ? "/api/incidents"
          : `/api/incidents/${incidentId}`;

      const response = await fetch(endpoint, {
        method: mode === "create" ? "POST" : "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const message = errorPayload?.error?.message ?? "Não foi possível salvar o incidente.";
        throw new Error(message);
      }

      return (await response.json()) as { id: string };
    },
    onSuccess: () => {
      toast({
        title: mode === "create" ? "Incidente criado" : "Incidente atualizado",
        description:
          mode === "create"
            ? "O incidente foi registrado com sucesso."
            : "As informações foram atualizadas.",
      });

      router.push("/admin/incidents");
      router.refresh();

      if (mode === "create") {
        setValues(createEmptyIncidentFormValues());
        setSelectedApplications([]);
        setServiceSelectValue("");
      }
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        toast({
          title: "Erro ao salvar incidente",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!isEditMode || !incidentId) {
        throw new Error("Incidente inválido.");
      }

      const response = await fetch(`/api/incidents/${incidentId}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorPayload = (await response.json().catch(() => null)) as {
          error?: { message?: string };
        } | null;
        const message =
          errorPayload?.error?.message ?? "Não foi possível excluir o incidente.";
        throw new Error(message);
      }

      return (await response.json()) as { ok: boolean };
    },
    onSuccess: () => {
      toast({
        title: "Incidente removido",
        description: "O incidente foi excluído definitivamente.",
      });
      router.push("/admin/incidents");
      router.refresh();
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        toast({
          title: "Erro ao excluir incidente",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const updateField = <K extends keyof IncidentFormValues>(field: K, value: IncidentFormValues[K]) => {
    setValues((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const updateLink = (field: keyof IncidentFormValues["links"], value: string) => {
    setValues((previous) => ({
      ...previous,
      links: {
        ...previous.links,
        [field]: value,
      },
    }));
  };

  return (
    <form
      className="space-y-6"
      onSubmit={(event) => {
        event.preventDefault();
        mutation.mutate();
      }}
    >
      <section className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 shadow-xl">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-100">
              {mode === "create" ? "Novo incidente" : "Editar incidente"}
            </h2>
            <p className="text-sm text-slate-500">
              Preencha os campos com os dados do incidente conforme a planilha SANV2.
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            onClick={() => {
              router.push("/admin/incidents");
            }}
          >
            Cancelar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div className="md:col-span-2">
            <Label htmlFor="title">SANV2 / Título</Label>
            <Input
              id="title"
              value={values.title}
              placeholder="SANV2-000000"
              onChange={(event) => updateField("title", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="sanv2Code">Código SANV2</Label>
            <Input
              id="sanv2Code"
              value={values.sanv2Code}
              placeholder="SANV2-000000"
              onChange={(event) => updateField("sanv2Code", event.target.value)}
            />
          </div>
          <div>
            <Label>País</Label>
            <Select
              value={values.country || "BR"}
              onValueChange={(selected) => updateField("country", selected)}
            >
              <SelectTrigger className="bg-slate-900/60 text-slate-100">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                {COUNTRY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span aria-hidden="true">{option.emoji}</span>
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Dia</Label>
            <Popover open={dayPickerOpen} onOpenChange={setDayPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 border-slate-700/70 bg-slate-900/60 text-left font-normal text-slate-100 hover:border-cyan-500/40 hover:text-white"
                >
                  <CalendarDays className="h-4 w-4 text-cyan-300" />
                  {format(dateSelection, "dd 'de' MMMM yyyy", { locale: ptBR })}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="p-0">
                <Calendar
                  mode="single"
                  selected={dateSelection}
                  onSelect={(day) => {
                    if (!day) return;
                    setDateSelection(
                      new Date(
                        day.getFullYear(),
                        day.getMonth(),
                        day.getDate(),
                      ),
                    );
                    setDayPickerOpen(false);
                  }}
                  locale={ptBR}
                  initialFocus
                />
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Mês</Label>
            <Popover open={monthPickerOpen} onOpenChange={setMonthPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full justify-start gap-2 border-slate-700/70 bg-slate-900/60 text-left font-normal text-slate-100 hover:border-cyan-500/40 hover:text-white"
                >
                  <CalendarRange className="h-4 w-4 text-cyan-300" />
                  {MONTH_OPTIONS[dateSelection.getMonth()].label}
                </Button>
              </PopoverTrigger>
              <PopoverContent align="start" className="w-auto space-y-3 p-4">
                <div className="grid grid-cols-3 gap-2">
                  {MONTH_OPTIONS.map((option, index) => {
                    const isActive = dateSelection.getMonth() === index;
                    return (
                      <Button
                        key={option.value}
                        type="button"
                        variant="outline"
                        className={cn(
                          "h-10 rounded-2xl border-slate-700/70 bg-slate-900/60 text-xs text-slate-200 hover:border-cyan-500/40 hover:text-cyan-100",
                          isActive && "border-cyan-500/60 bg-cyan-500/15 text-cyan-100",
                        )}
                        onClick={() => {
                          setDateSelection((previous) => {
                            const year = previous.getFullYear();
                            const daysInMonth = new Date(
                              year,
                              index + 1,
                              0,
                            ).getDate();
                            const safeDay = Math.min(previous.getDate(), daysInMonth);
                            return new Date(year, index, safeDay);
                          });
                          setMonthPickerOpen(false);
                        }}
                      >
                        {option.label}
                      </Button>
                    );
                  })}
                </div>
              </PopoverContent>
            </Popover>
          </div>
          <div>
            <Label>Ano</Label>
            <Select
              value={dateSelection.getFullYear().toString()}
              onValueChange={(selected) => {
                const yearNumber = Number(selected);
                if (!Number.isNaN(yearNumber)) {
                  setDateSelection(
                    new Date(
                      yearNumber,
                      dateSelection.getMonth(),
                      dateSelection.getDate(),
                    ),
                  );
                }
              }}
            >
              <SelectTrigger className="bg-slate-900/60 text-slate-100">
                <SelectValue placeholder="Ano" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                {Array.from({ length: 11 }, (_, index) => {
                  const currentYear = new Date().getFullYear();
                  const year = currentYear - 5 + index;
                  return (
                    <SelectItem key={year} value={year.toString()}>
                      {year}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label>Severidade</Label>
            <Select
              value={values.severity}
              onValueChange={(selected) => updateField("severity", selected as Severity)}
            >
              <SelectTrigger className="bg-slate-900/60 text-slate-100">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                {SEVERITY_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("h-2.5 w-2.5 rounded-full", option.color)}
                      />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Status</Label>
            <Select
              value={values.status}
              onValueChange={(selected) =>
                updateField("status", selected as IncidentStatus)
              }
            >
              <SelectTrigger className="bg-slate-900/60 text-slate-100">
                <SelectValue placeholder="Selecione" />
              </SelectTrigger>
              <SelectContent className="bg-slate-900 text-slate-100">
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <span className="flex items-center gap-2">
                      <span
                        aria-hidden="true"
                        className={cn("h-2.5 w-2.5 rounded-full", option.color)}
                      />
                      {option.label}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="owner">Owner / Squad</Label>
            <Input
              id="owner"
              value={values.owner}
              placeholder="SRE - Checkout"
              onChange={(event) => updateField("owner", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-100">Janela do incidente</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="startedAt">Início da falha</Label>
            <DateTimePicker
              id="startedAt"
              value={values.startedAt}
              onChange={(next) => updateField("startedAt", next)}
              allowClear={false}
            />
          </div>
          <div>
            <Label htmlFor="resolvedAt">Término da falha</Label>
            <DateTimePicker
              id="resolvedAt"
              value={values.resolvedAt}
              onChange={(next) => updateField("resolvedAt", next)}
            />
          </div>
          <div>
            <Label htmlFor="totalMinutesReported">Total minutos (relato)</Label>
            <Input
              id="totalMinutesReported"
              inputMode="numeric"
              pattern="[0-9]*"
              value={values.totalMinutesReported}
              readOnly
            />
          </div>
          <div>
            <Label htmlFor="durationHoursReported">Duração (horas)</Label>
            <Input
              id="durationHoursReported"
              inputMode="numeric"
              pattern="[0-9]*"
              value={values.durationHoursReported}
              readOnly
            />
          </div>
          <div>
            <Label htmlFor="durationMinutesReported">Duração (minutos)</Label>
            <Input
              id="durationMinutesReported"
              inputMode="numeric"
              pattern="[0-9]*"
              value={values.durationMinutesReported}
              readOnly
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-100">Contexto e impacto</h3>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="md:col-span-2 space-y-2">
            <Label>Serviços envolvidos</Label>
            <div className="flex flex-col gap-2 md:flex-row md:items-center">
              <div className="flex flex-1 items-center gap-2">
                <Select
                  value={serviceSelectValue}
                  onValueChange={(value) => {
                    setServiceSelectValue(undefined);
                    if (!value) {
                      return;
                    }
                    setSelectedApplications((previous) =>
                      previous.includes(value) ? previous : [...previous, value],
                    );
                  }}
                >
                  <SelectTrigger className="bg-slate-900/60 text-slate-100">
                    <SelectValue placeholder="Selecionar serviço" />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-900 text-slate-100">
                    {serviceOptions.map((option) => (
                      <SelectItem key={option} value={option}>
                        {option}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="border-slate-700 text-slate-200"
                  onClick={() => {
                    setServiceDraft("");
                    setServiceDialogOpen(true);
                  }}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
              <Dialog
                open={serviceDialogOpen}
                onOpenChange={(open) => {
                  setServiceDialogOpen(open);
                  if (!open) {
                    setServiceDraft("");
                  }
                }}
              >
                <DialogContent className="bg-slate-950/95 border border-slate-800">
                  <DialogHeader>
                    <DialogTitle>Cadastrar novo serviço</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Adicione serviços extras para reutilizar em incidentes e importações.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    autoFocus
                    placeholder="Nome do serviço"
                    value={serviceDraft}
                    onChange={(event) => setServiceDraft(event.target.value)}
                  />
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700 text-slate-200"
                      onClick={() => {
                        setServiceDialogOpen(false);
                        setServiceDraft("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={serviceDraft.trim().length === 0}
                      onClick={() => {
                        const custom = serviceDraft.trim();
                        if (!custom) return;
                        setServiceOptions((previous) =>
                          mergeUniqueOptions([...previous, custom]),
                        );
                        setSelectedApplications((previous) =>
                          previous.includes(custom)
                            ? previous
                            : [...previous, custom],
                        );
                        setServiceDraft("");
                        setServiceDialogOpen(false);
                        setServiceSelectValue(undefined);
                      }}
                    >
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
            <div className="flex flex-wrap gap-2">
              {selectedApplications.length === 0 ? (
                <span className="text-xs text-slate-500">
                  Nenhum serviço selecionado.
                </span>
              ) : null}
              {selectedApplications.map((service) => (
                <span
                  key={service}
                  className="inline-flex items-center gap-1 rounded-full border border-cyan-500/40 bg-cyan-500/15 px-3 py-1 text-xs text-cyan-100"
                >
                  {service}
                  <button
                    type="button"
                    className="text-cyan-200 transition hover:text-white"
                    onClick={() => {
                      setSelectedApplications((previous) =>
                        previous.filter((item) => item !== service),
                      );
                    }}
                    aria-label={`Remover ${service}`}
                  >
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="description">Falha / Impacto (descrição pública)</Label>
            <Textarea
              id="description"
              value={values.description}
              className="min-h-[120px]"
              onChange={(event) => updateField("description", event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label>Impacto</Label>
            <div className="flex items-center gap-2">
              <Select
                value={values.impact || undefined}
                onValueChange={(value) => {
                  if (value === "__clear__") {
                    updateField("impact", "");
                    return;
                  }
                  updateField("impact", value);
                }}
              >
                <SelectTrigger className="bg-slate-900/60 text-slate-100">
                  <SelectValue placeholder="Selecione o impacto" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100">
                  <SelectItem value="__clear__">Não informado</SelectItem>
                  {impactOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-slate-700 text-slate-200"
                onClick={() => {
                  setImpactDraft(values.impact ?? "");
                  setImpactDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Dialog
                open={impactDialogOpen}
                onOpenChange={(open) => {
                  setImpactDialogOpen(open);
                  if (!open) {
                    setImpactDraft("");
                  }
                }}
              >
                <DialogContent className="bg-slate-950/95 border border-slate-800">
                  <DialogHeader>
                    <DialogTitle>Novo impacto</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Descreva o tipo de impacto causado pelo incidente.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    autoFocus
                    placeholder="Impacto (ex.: Operacional, Cliente...)"
                    value={impactDraft}
                    onChange={(event) => setImpactDraft(event.target.value)}
                  />
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700 text-slate-200"
                      onClick={() => {
                        setImpactDialogOpen(false);
                        setImpactDraft("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={impactDraft.trim().length === 0}
                      onClick={() => {
                        const custom = impactDraft.trim();
                        if (!custom) return;
                        setImpactOptions((previous) =>
                          mergeUniqueOptions([...previous, custom]),
                        );
                        updateField("impact", custom);
                        setImpactDraft("");
                        setImpactDialogOpen(false);
                      }}
                    >
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div>
            <Label htmlFor="scope">Escopo</Label>
            <Input
              id="scope"
              value={values.scope}
              placeholder="Brasil, Checkout, Sellers..."
              onChange={(event) => updateField("scope", event.target.value)}
            />
          </div>
          <div>
            <Label>Produtos / OKR</Label>
            <div className="flex items-center gap-2">
              <Select
                value={values.produtosOkr || undefined}
                onValueChange={(value) => {
                  if (value === "__clear__") {
                    updateField("produtosOkr", "");
                    return;
                  }
                  updateField("produtosOkr", value);
                }}
              >
                <SelectTrigger className="bg-slate-900/60 text-slate-100">
                  <SelectValue placeholder="Selecione o produto/OKR" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100">
                  <SelectItem value="__clear__">Não informado</SelectItem>
                  {okrOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-slate-700 text-slate-200"
                onClick={() => {
                  setOkrDraft(values.produtosOkr ?? "");
                  setOkrDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Dialog
                open={okrDialogOpen}
                onOpenChange={(open) => {
                  setOkrDialogOpen(open);
                  if (!open) {
                    setOkrDraft("");
                  }
                }}
              >
                <DialogContent className="bg-slate-950/95 border border-slate-800">
                  <DialogHeader>
                    <DialogTitle>Novo produto / OKR</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Cadastre um produto ou iniciativa adicional.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    autoFocus
                    placeholder="Nome do produto ou OKR"
                    value={okrDraft}
                    onChange={(event) => setOkrDraft(event.target.value)}
                  />
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700 text-slate-200"
                      onClick={() => {
                        setOkrDialogOpen(false);
                        setOkrDraft("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={okrDraft.trim().length === 0}
                      onClick={() => {
                        const custom = okrDraft.trim();
                        if (!custom) return;
                        setOkrOptions((previous) =>
                          mergeUniqueOptions([...previous, custom]),
                        );
                        updateField("produtosOkr", custom);
                        setOkrDraft("");
                        setOkrDialogOpen(false);
                      }}
                    >
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div>
            <Label htmlFor="coreSystems">Core systems</Label>
            <Input
              id="coreSystems"
              value={values.coreSystems}
              onChange={(event) => updateField("coreSystems", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="solver">Solucionador</Label>
            <div className="flex items-center gap-2">
              <Select
                value={values.solver || undefined}
                onValueChange={(value) => {
                  if (value === "__clear__") {
                    updateField("solver", "");
                    return;
                  }
                  updateField("solver", value);
                }}
              >
                <SelectTrigger className="bg-slate-900/60 text-slate-100">
                  <SelectValue placeholder="Selecione o solucionador" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100">
                  <SelectItem value="__clear__">Não informado</SelectItem>
                  {solverOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-slate-700 text-slate-200"
                onClick={() => {
                  setSolverDraft(values.solver ?? "");
                  setSolverDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Dialog
                open={solverDialogOpen}
                onOpenChange={(open) => {
                  setSolverDialogOpen(open);
                  if (!open) {
                    setSolverDraft("");
                  }
                }}
              >
                <DialogContent className="bg-slate-950/95 border border-slate-800">
                  <DialogHeader>
                    <DialogTitle>Cadastrar solucionador</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Informe a squad, equipe ou área responsável pela resolução.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    autoFocus
                    placeholder="Nome do solucionador"
                    value={solverDraft}
                    onChange={(event) => setSolverDraft(event.target.value)}
                  />
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700 text-slate-200"
                      onClick={() => {
                        setSolverDialogOpen(false);
                        setSolverDraft("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={solverDraft.trim().length === 0}
                      onClick={() => {
                        const custom = solverDraft.trim();
                        if (!custom) return;
                        setSolverOptions((previous) =>
                          mergeUniqueOptions([...previous, custom]),
                        );
                        updateField("solver", custom);
                        setSolverDraft("");
                        setSolverDialogOpen(false);
                      }}
                    >
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="cause">Causa</Label>
            <Textarea
              id="cause"
              value={values.cause}
              className="min-h-[80px]"
              onChange={(event) => updateField("cause", event.target.value)}
            />
          </div>
          <div className="md:col-span-2">
            <Label htmlFor="resolution">Resolução</Label>
            <Textarea
              id="resolution"
              value={values.resolution}
              className="min-h-[80px]"
              onChange={(event) => updateField("resolution", event.target.value)}
            />
          </div>
          <div>
            <Label>Tipo de solução</Label>
            <div className="flex items-center gap-2">
              <Select
                value={values.solutionType || undefined}
                onValueChange={(value) => {
                  if (value === "__clear__") {
                    updateField("solutionType", "");
                    return;
                  }
                  updateField("solutionType", value);
                }}
              >
                <SelectTrigger className="bg-slate-900/60 text-slate-100">
                  <SelectValue placeholder="Selecione o tipo de solução" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100">
                  <SelectItem value="__clear__">Não informado</SelectItem>
                  {solutionOptions.map((option) => (
                    <SelectItem key={option} value={option}>
                      {option}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="border-slate-700 text-slate-200"
                onClick={() => {
                  setSolutionDraft(values.solutionType ?? "");
                  setSolutionDialogOpen(true);
                }}
              >
                <Plus className="h-4 w-4" />
              </Button>
              <Dialog
                open={solutionDialogOpen}
                onOpenChange={(open) => {
                  setSolutionDialogOpen(open);
                  if (!open) {
                    setSolutionDraft("");
                  }
                }}
              >
                <DialogContent className="bg-slate-950/95 border border-slate-800">
                  <DialogHeader>
                    <DialogTitle>Adicionar tipo de solução</DialogTitle>
                    <DialogDescription className="text-slate-400">
                      Defina novos formatos de solução para padronizar análises.
                    </DialogDescription>
                  </DialogHeader>
                  <Input
                    autoFocus
                    placeholder="Descrição do tipo de solução"
                    value={solutionDraft}
                    onChange={(event) => setSolutionDraft(event.target.value)}
                  />
                  <DialogFooter className="gap-2 sm:justify-end">
                    <Button
                      type="button"
                      variant="outline"
                      className="border-slate-700 text-slate-200"
                      onClick={() => {
                        setSolutionDialogOpen(false);
                        setSolutionDraft("");
                      }}
                    >
                      Cancelar
                    </Button>
                    <Button
                      type="button"
                      disabled={solutionDraft.trim().length === 0}
                      onClick={() => {
                        const custom = solutionDraft.trim();
                        if (!custom) return;
                        setSolutionOptions((previous) =>
                          mergeUniqueOptions([...previous, custom]),
                        );
                        updateField("solutionType", custom);
                        setSolutionDraft("");
                        setSolutionDialogOpen(false);
                      }}
                    >
                      Adicionar
                    </Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </div>
          <div>
            <Label htmlFor="ordersAffected">Orders afetadas</Label>
            <Input
              id="ordersAffected"
              value={values.ordersAffected}
              onChange={(event) => updateField("ordersAffected", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="financialImpact">Impacto financeiro</Label>
            <Input
              id="financialImpact"
              value={values.financialImpact}
              placeholder="R$ ..."
              onChange={(event) => updateField("financialImpact", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="rca">RCA</Label>
            <Input
              id="rca"
              value={values.rca}
              placeholder="Link ou identificador do RCA"
              onChange={(event) => updateField("rca", event.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="space-y-4 rounded-3xl border border-slate-800/70 bg-slate-950/60 p-6 shadow-xl">
        <h3 className="text-base font-semibold text-slate-100">Links de apoio</h3>
        <div className="grid gap-4 md:grid-cols-3">
          <div>
            <Label htmlFor="jira">Jira</Label>
            <Input
              id="jira"
              value={values.links.jira}
              placeholder="https://jira..."
              onChange={(event) => updateLink("jira", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="grafana">Grafana</Label>
            <Input
              id="grafana"
              value={values.links.grafana}
              placeholder="https://grafana..."
              onChange={(event) => updateLink("grafana", event.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="runbook">Runbook</Label>
            <Input
              id="runbook"
              value={values.links.runbook}
              placeholder="https://runbook..."
              onChange={(event) => updateLink("runbook", event.target.value)}
            />
          </div>
        </div>
      </section>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {isEditMode ? (
          <Button
            type="button"
            variant="destructive"
            className="gap-2 sm:min-w-[180px]"
            disabled={deleteMutation.isPending || mutation.isPending}
            onClick={() => {
              if (deleteMutation.isPending || mutation.isPending) {
                return;
              }
              const confirmed = window.confirm(
                "Tem certeza de que deseja excluir este incidente? Esta ação não pode ser desfeita.",
              );
              if (!confirmed) {
                return;
              }
              deleteMutation.mutate();
            }}
          >
            {deleteMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Excluindo...
              </>
            ) : (
              <>
                <Trash2 className="h-4 w-4" />
                Excluir incidente
              </>
            )}
          </Button>
        ) : (
          <span className="hidden sm:block" />
        )}

        <div className="flex items-center justify-end gap-3">
          <Button
            type="button"
            variant="outline"
            className="border-slate-700 text-slate-200"
            onClick={() => {
              router.push("/admin/incidents");
            }}
            disabled={mutation.isPending || deleteMutation.isPending}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="gap-2"
            disabled={mutation.isPending || deleteMutation.isPending}
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Salvando...
              </>
            ) : (
              <>
                <Save className="h-4 w-4" />
                {mode === "create" ? "Criar incidente" : "Salvar alterações"}
              </>
            )}
          </Button>
        </div>
      </div>
    </form>
  );
}
