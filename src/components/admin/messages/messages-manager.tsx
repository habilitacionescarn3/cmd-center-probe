"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type MessageRow = {
  id: string;
  summary: string;
  source: string;
  sentiment: string | null;
  createdAt: string;
};

type MessagesManagerProps = {
  initialMessages: MessageRow[];
  initialHasMore: boolean;
};

export function MessagesManager({ initialMessages, initialHasMore }: MessagesManagerProps) {
  const [messages, setMessages] = useState(initialMessages);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(initialHasMore);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<MessageRow | null>(null);
  const { toast } = useToast();

  const handleLoadMore = async () => {
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/messages?page=${page + 1}`);
      const payload = (await response.json()) as {
        items: MessageRow[];
        hasMore: boolean;
        page: number;
      };
      if (!response.ok) {
        throw new Error("Falha ao carregar mensagens.");
      }
      setMessages((prev) => [...prev, ...payload.items]);
      setHasMore(payload.hasMore);
      setPage(payload.page);
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Remover mensagem permanentemente?")) return;
    try {
      const response = await fetch(`/api/admin/messages/${id}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        throw new Error("Não foi possível remover a mensagem.");
      }
      setMessages((prev) => prev.filter((message) => message.id !== id));
      toast({ title: "Mensagem removida" });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    }
  };

  const handleSave = async (data: { summary: string; source: string; sentiment: string | null }) => {
    if (!editing) return;
    try {
      const response = await fetch(`/api/admin/messages/${editing.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const payload = (await response.json()) as MessageRow;
      if (!response.ok) {
        throw new Error("Não foi possível atualizar a mensagem.");
      }
      setMessages((prev) => prev.map((message) => (message.id === payload.id ? payload : message)));
      setEditing(null);
      toast({ title: "Mensagem atualizada" });
    } catch (error) {
      toast({
        title: "Erro",
        description: error instanceof Error ? error.message : "Falha inesperada.",
        variant: "destructive",
      });
    }
  };

  return (
    <div className="space-y-4">
      {messages.length === 0 ? (
        <Card className="border border-slate-800/60 bg-slate-950/50 p-6 text-sm text-slate-400">
          Nenhuma mensagem registrada.
        </Card>
      ) : (
        <div className="space-y-4">
          {messages.map((message) => (
            <Card key={message.id} className="border border-slate-800/70 bg-slate-900/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-medium text-slate-100 whitespace-pre-wrap break-words">
                    {message.summary}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                    <Badge variant="outline" className="border-slate-700 text-slate-300">
                      {message.source}
                    </Badge>
                    <span>{message.sentiment ?? "Neutro"}</span>
                    <time dateTime={message.createdAt}>
                      {new Intl.DateTimeFormat("pt-BR", {
                        day: "2-digit",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      }).format(new Date(message.createdAt))}
                    </time>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setEditing(message)}>
                    Editar
                  </Button>
                  <Button variant="destructive" size="sm" onClick={() => handleDelete(message.id)}>
                    Remover
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
      {hasMore ? (
        <Button variant="outline" onClick={handleLoadMore} disabled={loading}>
          {loading ? "Carregando..." : "Carregar mais"}
        </Button>
      ) : null}

      <EditMessageDialog
        message={editing}
        onClose={() => setEditing(null)}
        onSave={(values) => handleSave(values)}
      />
    </div>
  );
}

function EditMessageDialog({
  message,
  onClose,
  onSave,
}: {
  message: MessageRow | null;
  onClose: () => void;
  onSave: (values: { summary: string; source: string; sentiment: string | null }) => void;
}) {
  const [summary, setSummary] = useState(message?.summary ?? "");
  const [source, setSource] = useState(message?.source ?? "");
  const [sentiment, setSentiment] = useState(message?.sentiment ?? "");
  const [isSaving, setIsSaving] = useState(false);

  if (!message) return null;

  return (
    <Dialog open={Boolean(message)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar mensagem</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="summary">Mensagem</Label>
            <Textarea
              id="summary"
              value={summary}
              onChange={(event) => setSummary(event.target.value)}
              rows={4}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="source">Origem</Label>
            <Input id="source" value={source} onChange={(event) => setSource(event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sentiment">Sentimento</Label>
            <Input
              id="sentiment"
              value={sentiment ?? ""}
              onChange={(event) => setSentiment(event.target.value)}
              placeholder="positivo, negativo, neutro..."
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              setIsSaving(true);
              await onSave({ summary, source, sentiment: sentiment || null });
              setIsSaving(false);
            }}
            disabled={isSaving}
          >
            {isSaving ? "Salvando..." : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
