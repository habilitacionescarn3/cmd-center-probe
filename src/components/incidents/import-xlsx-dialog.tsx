"use client";

import { useState } from "react";

import { useMutation } from "@tanstack/react-query";
import { CloudUpload, Loader2 } from "lucide-react";

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
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";

type ImportSummary = {
  summary: {
    rows_ok: number;
    rows_failed: number;
    p1: number;
    p2: number;
    sla_global_unweighted: number;
    sla_global_weighted: number;
    mttr_p1_p2_min: number;
  };
  errors: Array<{ row: number; error: string }>;
};

type ImportXlsxDialogProps = {
  onImported?: () => void;
};

export function ImportXlsxDialog({ onImported }: ImportXlsxDialogProps) {
  const { toast } = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<ImportSummary | null>(null);

  const mutation = useMutation({
    mutationFn: async () => {
      if (!file) {
        throw new Error("Selecione um arquivo XLSX para importar.");
      }
      const formData = new FormData();
      formData.append("file", file);

      const response = await fetch("/api/import/xlsx", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const payload = (await response.json().catch(
          () => null,
        )) as { error?: { message?: string } } | null;
        throw new Error(payload?.error?.message ?? "Falha ao importar arquivo.");
      }

      return (await response.json()) as ImportSummary;
    },
    onSuccess(data) {
      setResult(data);
      toast({
        title: "Importação concluída",
        description: `${data.summary.rows_ok} linhas importadas com sucesso.`,
      });
      onImported?.();
    },
    onError(error: unknown) {
      if (error instanceof Error) {
        toast({
          title: "Erro ao importar",
          description: error.message,
          variant: "destructive",
        });
      }
    },
  });

  const reset = () => {
    setFile(null);
    setResult(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (!value) {
          reset();
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" className="gap-2">
          <CloudUpload className="h-4 w-4" />
          Importar XLSX
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Importar incidentes</DialogTitle>
          <DialogDescription>
            Arquivo no formato XLSX contendo incidentes encerrados. A planilha
            deve seguir o mapeamento definido na documentação.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Input
            type="file"
            accept=".xlsx"
            disabled={mutation.isPending}
            onChange={(event) => {
              const [uploaded] = Array.from(event.target.files ?? []);
              setFile(uploaded ?? null);
            }}
          />
          {result ? (
            <ScrollArea className="max-h-72 rounded-xl border border-slate-800/60 bg-slate-950/40 p-4">
              <div className="space-y-3 text-sm text-slate-200">
                <div className="grid grid-cols-2 gap-2 text-xs uppercase tracking-wide text-slate-500">
                  <span>Linhas OK</span>
                  <span>{result.summary.rows_ok}</span>
                  <span>Falhas</span>
                  <span>{result.summary.rows_failed}</span>
                  <span>P1</span>
                  <span>{result.summary.p1}</span>
                  <span>P2</span>
                  <span>{result.summary.p2}</span>
                  <span>SLA Global</span>
                  <span>{result.summary.sla_global_unweighted.toFixed(3)}%</span>
                  <span>MTTR P1/P2</span>
                  <span>{result.summary.mttr_p1_p2_min.toFixed(1)} min</span>
                </div>
                {result.errors.length > 0 ? (
                  <div className="rounded-lg border border-red-500/20 bg-red-500/10 p-3 text-xs text-red-200">
                    <h4 className="mb-1 font-medium text-red-200">
                      Linhas rejeitadas
                    </h4>
                    <ul className="space-y-1">
                      {result.errors.map((error) => (
                        <li key={`error-${error.row}`}>
                          Linha {error.row}: {error.error}
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
              </div>
            </ScrollArea>
          ) : null}
        </div>
        <DialogFooter className="flex flex-col gap-2 sm:flex-row sm:justify-between">
          <Button
            variant="ghost"
            onClick={() => {
              reset();
              setOpen(false);
            }}
          >
            Fechar
          </Button>
          <Button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !file}
            className="gap-2"
          >
            {mutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Importando...
              </>
            ) : (
              <>
                <CloudUpload className="h-4 w-4" />
                Importar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
