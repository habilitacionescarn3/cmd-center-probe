"use client";

import { MessageInsight } from "@prisma/client";
import { motion } from "framer-motion";

import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Card } from "@/components/ui/card";
import { InsightsHistoryDialog } from "@/components/dashboard/insights-history-dialog";

type SlackInsightsDockProps = {
  insights: MessageInsight[];
};

export function SlackInsightsDock({ insights }: SlackInsightsDockProps) {
  if (insights.length === 0) {
    return (
      <Card className="border border-slate-800 bg-slate-900/40 p-6 text-sm text-slate-400">
        <div className="mb-3 flex items-center justify-between text-xs uppercase tracking-wide text-slate-500">
          <span>Atualizações do Command Center · saiba o que está rolando nas investigações em análise.</span>
          <InsightsHistoryDialog />
        </div>
        Nenhum insight recente do Command Center.
      </Card>
    );
  }

  return (
    <div className="space-y-2 rounded-3xl border border-slate-800 bg-slate-900/60 p-3 shadow-lg shadow-black/30">
        <div className="flex items-center justify-between px-1 text-xs uppercase tracking-wide text-slate-500">
          <span>Atualizações do Command Center · saiba o que está rolando nas investigações em análise.</span>
          <InsightsHistoryDialog />
        </div>
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-3">
          {insights.map((insight, index) => (
            <motion.div
              key={insight.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05, duration: 0.3 }}
              className="min-w-[240px] flex-1 rounded-2xl border border-slate-800/80 bg-gradient-to-br from-slate-800/70 via-slate-900 to-slate-900/80 p-4"
            >
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">
                {formatSource(insight.source)}
              </div>
              <p className="whitespace-pre-wrap break-words text-sm text-slate-100">
                🔍 {insight.summary}
              </p>
              <div className="mt-3 flex items-center justify-between text-xs text-slate-500">
                <span>{insight.sentiment ?? "Neutro"}</span>
                <time dateTime={insight.createdAt.toISOString()}>
                  {new Intl.DateTimeFormat("pt-BR", {
                    hour: "2-digit",
                    minute: "2-digit",
                  }).format(insight.createdAt)}
                </time>
              </div>
            </motion.div>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>
    </div>
  );
}

function formatSource(source: string) {
  const [kind, channel] = source.split(":");
  if (kind?.toUpperCase() === "SLACK" && channel) {
    return `Slack · #${channel}`;
  }
  if (kind?.toUpperCase() === "EXTERNAL") {
    return "Command Center";
  }
  return source;
}
