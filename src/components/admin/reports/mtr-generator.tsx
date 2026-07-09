"use client";

import { useMemo, useState } from "react";
import { format } from "date-fns";
import { Copy, Loader2, RefreshCcw } from "lucide-react";
import {
  Bar,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";

type ReportLanguage = "pt" | "en";

type ReportResponse = {
  report: string;
  chartData: Array<{
    countryCode: "BR" | "CO";
    downtimeMinutes: number;
    totalImpactEUR: number;
    incidentCount: number;
    slaPercent: number;
  }>;
  monthLabel: string;
  language: ReportLanguage;
};

type ChartRow = {
  country: string;
  downtime: number;
  impactKEUR: number;
  incidents: number;
  sla: number;
};

const LANGUAGE_OPTIONS: Array<{ label: string; value: ReportLanguage }> = [
  { label: "Português", value: "pt" },
  { label: "English", value: "en" },
];

export function MonthlyReportGenerator() {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState(format(new Date(), "yyyy-MM"));
  const [language, setLanguage] = useState<ReportLanguage>("pt");
  const [isGenerating, setIsGenerating] = useState(false);
  const [report, setReport] = useState<string>("");
  const [chartData, setChartData] = useState<ReportResponse["chartData"]>([]);
  const [monthLabel, setMonthLabel] = useState<string | null>(null);

  const chartRows = useMemo<ChartRow[]>(() => {
    if (!chartData || chartData.length === 0) {
      return [];
    }
    return chartData.map((item) => ({
      country: item.countryCode === "BR" ? "🇧🇷 BR" : "🇨🇴 CO",
      downtime: Number(item.downtimeMinutes.toFixed(1)),
      impactKEUR: Number((item.totalImpactEUR / 1000).toFixed(2)),
      incidents: item.incidentCount,
      sla: Number(item.slaPercent.toFixed(3)),
    }));
  }, [chartData]);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/admin/reports/mtr", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ month, language }),
      });
      const payload = (await response.json()) as ReportResponse & {
        error?: { message?: string };
      };
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Falha ao gerar relatório.");
      }
      setReport(payload.report);
      setChartData(payload.chartData ?? []);
      setMonthLabel(payload.monthLabel);
      toast({
        title: "Relatório gerado",
        description: `MTR de ${payload.monthLabel}`,
      });
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Erro inesperado ao gerar MTR.";
      toast({
        title: "Falha ao gerar relatório",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCopy = async () => {
    if (!report) return;
    try {
      await navigator.clipboard.writeText(report);
      toast({
        title: "Copiado",
        description: "Conteúdo do relatório copiado para a área de transferência.",
      });
    } catch {
      toast({
        title: "Não foi possível copiar",
        description: "Copie manualmente o texto do relatório.",
        variant: "destructive",
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button className="rounded-full border border-cyan-400/40 bg-slate-950/40 px-5 text-sm font-semibold text-cyan-50 transition hover:bg-cyan-500/10">
          Gerar relatório MTR do mês
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Gerar relatório MTR</DialogTitle>
          <DialogDescription>
            Escolha o mês e o idioma para gerar um resumo assistido por IA dos incidentes P1/P2 com impacto financeiro.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="mtr-month">Mês</Label>
              <Input
                id="mtr-month"
                type="month"
                value={month}
                onChange={(event) => setMonth(event.target.value)}
                className="bg-slate-900/60 text-slate-100"
                max={format(new Date(), "yyyy-MM")}
              />
            </div>
            <div className="space-y-2">
              <Label>Idioma</Label>
              <Select value={language} onValueChange={(value) => setLanguage(value as ReportLanguage)}>
                <SelectTrigger className="bg-slate-900/60 text-slate-100">
                  <SelectValue placeholder="Selecione" />
                </SelectTrigger>
                <SelectContent className="bg-slate-900 text-slate-100">
                  {LANGUAGE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4">
            <div className="flex flex-wrap items-center gap-3">
              <Button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="gap-2"
              >
                {isGenerating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Gerando...
                  </>
                ) : (
                  <>
                    <RefreshCcw className="h-4 w-4" />
                    Gerar relatório
                  </>
                )}
              </Button>
              {monthLabel ? (
                <span className="rounded-full border border-slate-700/70 px-3 py-1 text-xs text-slate-300">
                  Última geração: {monthLabel}
                </span>
              ) : null}
            </div>
            <p className="mt-3 text-xs text-slate-500">
              O relatório considera apenas incidentes P1/P2 com impacto financeiro registrado.
            </p>
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Resumo em texto</Label>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-2 text-xs text-slate-300 hover:text-white"
                onClick={handleCopy}
                disabled={!report}
              >
                <Copy className="h-3.5 w-3.5" />
                Copiar
              </Button>
            </div>
            <Textarea
              value={report}
              readOnly
              placeholder="Gere o relatório para visualizar o texto completo."
              className="min-h-[200px] bg-slate-900/60 text-sm text-slate-100"
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Indicadores visuais do mês</Label>
              <span className="text-xs text-slate-500">
                Downtime (min) × Impacto financeiro (k€) × SLA
              </span>
            </div>
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-3">
              {chartRows.length === 0 ? (
                <div className="flex h-48 items-center justify-center text-sm text-slate-500">
                  Gere o relatório para visualizar o comparativo de países.
                </div>
              ) : (
                <div className="h-64">
                  <ResponsiveContainer>
                    <ComposedChart data={chartRows}>
                      <CartesianGrid stroke="rgba(148,163,184,0.2)" strokeDasharray="3 3" />
                      <XAxis
                        dataKey="country"
                        tick={{ fill: "#94a3b8", fontSize: 12 }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        yAxisId="left"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                        label={{
                          value: "Downtime (min)",
                          angle: -90,
                          position: "insideLeft",
                          fill: "#94a3b8",
                          fontSize: 10,
                          offset: -5,
                        }}
                      />
                      <YAxis
                        yAxisId="right"
                        orientation="right"
                        tick={{ fill: "#94a3b8", fontSize: 11 }}
                        axisLine={false}
                        tickLine={false}
                        width={50}
                        label={{
                          value: "Impacto (k€)",
                          angle: 90,
                          position: "insideRight",
                          fill: "#94a3b8",
                          fontSize: 10,
                          offset: -5,
                        }}
                      />
                      <Tooltip content={<ChartTooltip />} />
                      <Legend />
                      <Bar
                        yAxisId="left"
                        dataKey="downtime"
                        name="Downtime (min)"
                        fill="rgba(14,165,233,0.8)"
                        radius={[6, 6, 0, 0]}
                      />
                      <Line
                        type="monotone"
                        yAxisId="right"
                        dataKey="impactKEUR"
                        name="Impacto (k€)"
                        stroke="#f97316"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>
            Fechar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ChartTooltip({
  active,
  payload,
}: {
  active?: boolean;
  payload?: Array<{ dataKey?: string; value?: number; payload?: ChartRow }>;
}) {
  if (!active || !payload || payload.length === 0) {
    return null;
  }
  const row = payload[0]?.payload;
  if (!row) {
    return null;
  }
  return (
    <div className="rounded-xl border border-slate-800/70 bg-slate-950/90 px-3 py-2 text-xs text-slate-100 shadow-xl">
      <p className="text-[11px] font-medium text-slate-300">{row.country}</p>
      <p className="mt-2 text-[11px] text-slate-400">
        Downtime: <span className="text-slate-100">{row.downtime} min</span>
      </p>
      <p className="text-[11px] text-slate-400">
        Impacto:{" "}
        <span className="text-slate-100">
          €
          {Intl.NumberFormat("pt-BR", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(row.impactKEUR * 1000)}
        </span>
      </p>
      <p className="text-[11px] text-slate-400">
        SLA: <span className="text-slate-100">{row.sla.toFixed(3)}%</span> · Incidentes:{" "}
        <span className="text-slate-100">{row.incidents}</span>
      </p>
    </div>
  );
}
