"use client";

import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";

type HistoryItem = {
  id: string;
  summary: string;
  source: string;
  sentiment: string | null;
  createdAt: string;
};

export function InsightsHistoryDialog() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<HistoryItem[]>([]);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      void fetchPage(1, true);
    }
  }, [open]);

  const fetchPage = async (pageToLoad: number, reset = false) => {
    setLoading(true);
    try {
      const response = await fetch(`/api/messages/history?page=${pageToLoad}`, {
        cache: "no-store",
      });
      const payload = (await response.json()) as {
        items: HistoryItem[];
        hasMore: boolean;
        page: number;
      };
      setItems((prev) => (reset ? payload.items : [...prev, ...payload.items]));
      setHasMore(payload.hasMore);
      setPage(payload.page);
    } catch (error) {
      console.error("Failed to load message history", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white">
          Ver histórico
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Histórico de mensagens</DialogTitle>
          <DialogDescription>
            Últimas atualizações enviadas ao Command Center.
          </DialogDescription>
        </DialogHeader>
        <ScrollArea className="mt-4 max-h-[420px] pr-4">
          <div className="space-y-4">
            {items.length === 0 && !loading ? (
              <p className="text-sm text-slate-500">Nenhuma mensagem registrada.</p>
            ) : null}
            {items.map((item) => (
              <div
                key={item.id}
                className="rounded-2xl border border-slate-800/60 bg-slate-900/60 p-4 text-sm text-slate-100"
              >
                <div className="flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
                  <span>{formatSource(item.source)}</span>
                  <time dateTime={item.createdAt}>
                    {new Intl.DateTimeFormat("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      hour: "2-digit",
                      minute: "2-digit",
                    }).format(new Date(item.createdAt))}
                  </time>
                </div>
                <p className="mt-2 text-slate-100">{item.summary}</p>
                {item.sentiment ? (
                  <p className="mt-1 text-xs text-slate-500">Sentimento: {item.sentiment}</p>
                ) : null}
              </div>
            ))}
          </div>
        </ScrollArea>
        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-slate-500">
            Página {page} {hasMore ? "" : "· fim do histórico"}
          </p>
          {hasMore ? (
            <Button variant="outline" size="sm" onClick={() => fetchPage(page + 1)} disabled={loading}>
              {loading ? "Carregando..." : "Carregar mais"}
            </Button>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function formatSource(source: string) {
  const [kind, channel] = source.split(":");
  if (kind?.toUpperCase() === "SLACK" && channel) {
    return `Slack · #${channel}`;
  }
  if (kind?.toUpperCase() === "EXTERNAL") {
    return "Command Center API";
  }
  return source;
}
