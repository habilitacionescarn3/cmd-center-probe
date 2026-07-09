"use client";

import { useMemo, useState } from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

const DEFAULT_DOMAINS = ["dafiti.com"];

type GoogleIntegrationState = {
  configured: boolean;
  clientId: string;
  allowedDomains: string[];
  hasClientSecret: boolean;
  enabled: boolean;
  updatedAt: string | null;
};

type ApiIntegrationState = {
  configured: boolean;
  apiUrl: string;
  hasToken: boolean;
  enabled: boolean;
  defaultChannel?: string;
  updatedAt: string | null;
};

type MessageIntegrationState = {
  hasKey: boolean;
  lastFour: string | null;
  enabled: boolean;
  updatedAt: string | null;
};

type SecretIntegrationState = {
  hasKey: boolean;
  lastFour: string | null;
  enabled: boolean;
  updatedAt: string | null;
};

type ApiResponseBase = {
  message?: string;
  error?: {
    message?: string;
  };
};

type GoogleIntegrationResponse = ApiResponseBase & {
  config?: {
    clientId?: string;
    allowedDomains?: string[];
    hasClientSecret?: boolean;
    enabled?: boolean;
  };
};

type ApiIntegrationResponse = ApiResponseBase & {
  config?: {
    apiUrl?: string;
    hasToken?: boolean;
    enabled?: boolean;
    defaultChannel?: string;
  };
};

type MessageIntegrationResponse = ApiResponseBase & {
  apiKey?: string;
  config?: {
    hasKey?: boolean;
    lastFour?: string | null;
    enabled?: boolean;
  };
};

type SecretIntegrationResponse = ApiResponseBase & {
  config?: {
    hasKey?: boolean;
    lastFour?: string | null;
    enabled?: boolean;
  };
};

export type IntegrationsOverviewState = {
  google: GoogleIntegrationState;
  grafana: ApiIntegrationState;
  instana: ApiIntegrationState;
  slack: ApiIntegrationState;
  messages: MessageIntegrationState;
  openai: SecretIntegrationState;
};

type IntegrationCardProps = {
  title: string;
  description: string;
  configured: boolean;
  updatedAt?: string | null;
  enabled?: boolean;
  children: React.ReactNode;
};

function IntegrationCard({
  title,
  description,
  configured,
  updatedAt,
  enabled = true,
  children,
}: IntegrationCardProps) {
  return (
    <Card className="border border-slate-800/70 bg-slate-950/50 shadow-xl">
      <CardHeader className="flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base font-semibold text-slate-100">
            {title}
          </CardTitle>
          <p className="mt-1 text-xs text-slate-400">{description}</p>
        </div>
        <div className="space-y-1 text-right">
          <Badge
            variant="outline"
            className={
              configured
                ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                : "border-amber-400/40 bg-amber-400/10 text-amber-200"
            }
          >
            {configured ? "Configurado" : "Pendente"}
          </Badge>
          <div className="text-[10px] uppercase tracking-wide text-slate-500">
            {enabled ? "Ativo" : "Desativado"}
          </div>
          {updatedAt ? (
            <div className="text-[10px] text-slate-600">
              Atualizado em {new Date(updatedAt).toLocaleString("pt-BR")}
            </div>
          ) : null}
        </div>
      </CardHeader>
      <CardContent>{children}</CardContent>
    </Card>
  );
}

export function IntegrationsManager({
  initialData,
}: {
  initialData: IntegrationsOverviewState;
}) {
  const [data, setData] = useState<IntegrationsOverviewState>(initialData);
  const { toast } = useToast();

  const updateState = (partial: Partial<IntegrationsOverviewState>) =>
    setData((prev) => ({ ...prev, ...partial }));

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <GoogleIntegrationCard
        state={data.google}
        onUpdated={(google) => updateState({ google })}
        toast={toast}
      />
      <ApiIntegrationCard
        title="Grafana"
        description="Configure a API do Grafana para buscar dashboards e painéis."
        endpoint="/api/admin/integrations/grafana"
        state={data.grafana}
        onUpdated={(grafana) => updateState({ grafana })}
        toast={toast}
        showChannel={false}
      />
      <ApiIntegrationCard
        title="Instana"
        description="Integração com o Instana para enriquecer incidentes com métricas APM."
        endpoint="/api/admin/integrations/instana"
        state={data.instana}
        onUpdated={(instana) => updateState({ instana })}
        toast={toast}
        showChannel={false}
      />
      <ApiIntegrationCard
        title="Slack"
        description="Conecte o Slack para publicar alertas e coletar insights."
        endpoint="/api/admin/integrations/slack"
        state={data.slack}
        onUpdated={(slack) => updateState({ slack })}
        toast={toast}
        showChannel
        showUrl={false}
      />
      <MessageIntegrationCard
        state={data.messages}
        onUpdated={(messages) => updateState({ messages })}
        toast={toast}
      />
      <SecretIntegrationCard
        title="OpenAI"
        description="Use modelos de IA para gerar relatórios técnicos (MTR) e análises assistidas."
        endpoint="/api/admin/integrations/openai"
        state={data.openai}
        onUpdated={(openai) => updateState({ openai })}
        toast={toast}
      />
    </div>
  );
}

function GoogleIntegrationCard({
  state,
  onUpdated,
  toast,
}: {
  state: GoogleIntegrationState;
  onUpdated: (state: GoogleIntegrationState) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [open, setOpen] = useState(false);
  const [clientId, setClientId] = useState(state.clientId);
  const [clientSecret, setClientSecret] = useState("");
  const [allowedDomains, setAllowedDomains] = useState(state.allowedDomains.join("\n"));
  const [enabled, setEnabled] = useState(state.enabled);
  const [isSaving, setIsSaving] = useState(false);

  const domainPlaceholder = useMemo(
    () => (state.allowedDomains.length > 0 ? state.allowedDomains.join("\n") : ""),
    [state.allowedDomains],
  );

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const domains = allowedDomains
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter(Boolean);

      const response = await fetch("/api/admin/integrations/google", {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          clientId,
          clientSecret,
          allowedDomains: domains,
          enabled,
        }),
      });

      const payload = (await response.json()) as GoogleIntegrationResponse;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Falha ao salvar configuração.");
      }

      onUpdated({
        configured: Boolean(payload.config?.hasClientSecret && payload.config?.clientId),
        clientId: payload.config?.clientId ?? "",
        allowedDomains: payload.config?.allowedDomains ?? [],
        hasClientSecret: payload.config?.hasClientSecret ?? false,
        enabled: payload.config?.enabled ?? true,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: "Google OAuth atualizado",
        description:
          "Configuração salva. Reinicie o servidor para aplicar credenciais de OAuth.",
      });
      setClientSecret("");
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar.";
      toast({
        title: "Erro ao atualizar Google OAuth",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <IntegrationCard
      title="Google OAuth 2.0"
      description="Permite login com contas Google corporativas autorizadas."
      configured={state.configured}
      updatedAt={state.updatedAt}
      enabled={state.enabled}
    >
      <dl className="space-y-2 text-xs text-slate-400">
        <div className="flex justify-between">
          <dt>Client ID</dt>
          <dd className="text-slate-300">
            {state.clientId ? `${state.clientId.slice(0, 12)}…` : "—"}
          </dd>
        </div>
        <div className="flex justify-between">
          <dt>Domínios autorizados</dt>
          <dd className="text-slate-300">
            {state.allowedDomains.length > 0
              ? state.allowedDomains.join(", ")
              : "Padrão"}
          </dd>
        </div>
      </dl>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mt-4 w-full" variant="outline">
            Configurar
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Configuração Google OAuth</DialogTitle>
            <DialogDescription>
              Atualize as credenciais e a lista de domínios permitidos.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="google-client-id">Client ID</Label>
              <Input
                id="google-client-id"
                value={clientId}
                onChange={(event) => setClientId(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-client-secret">Client Secret</Label>
              <Input
                id="google-client-secret"
                type="password"
                placeholder={state.hasClientSecret ? "Mantido" : ""}
                value={clientSecret}
                onChange={(event) => setClientSecret(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                Deixe em branco para manter o segredo atual.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="google-domains">Domínios permitidos</Label>
              <Textarea
                id="google-domains"
                placeholder={domainPlaceholder || "ex: empresa.com"}
                value={allowedDomains}
                onChange={(event) => setAllowedDomains(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                Um domínio por linha. Caso não informe, o padrão será {DEFAULT_DOMAINS.join(", ")}.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Integração ativa</p>
                <p className="text-xs text-slate-500">
                  Desative para impedir novos logins via Google.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
            <p className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
              Após alterar Client ID ou Secret, reinicie a aplicação para aplicar as
              credenciais no provedor do NextAuth.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IntegrationCard>
  );
}

function ApiIntegrationCard({
  title,
  description,
  endpoint,
  state,
  onUpdated,
  toast,
  showChannel,
  showUrl = true,
}: {
  title: string;
  description: string;
  endpoint: string;
  state: ApiIntegrationState;
  onUpdated: (state: ApiIntegrationState) => void;
  toast: ReturnType<typeof useToast>["toast"];
  showChannel: boolean;
  showUrl?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [apiUrl, setApiUrl] = useState(state.apiUrl);
  const [apiToken, setApiToken] = useState("");
  const [defaultChannel, setDefaultChannel] = useState(state.defaultChannel ?? "");
  const [enabled, setEnabled] = useState(state.enabled);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled,
      };
      if (showUrl) {
        payload.apiUrl = apiUrl;
      }
      payload.apiToken = apiToken;
      if (showChannel) {
        payload.defaultChannel = defaultChannel;
      }

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as ApiIntegrationResponse;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Falha ao salvar.");
      }

      onUpdated({
        configured: Boolean(body.config?.hasToken || body.config?.apiUrl),
        apiUrl: body.config?.apiUrl ?? (showUrl ? apiUrl : ""),
        hasToken: body.config?.hasToken ?? Boolean(apiToken),
        enabled: body.config?.enabled ?? true,
        defaultChannel: showChannel
          ? body.config?.defaultChannel ?? defaultChannel
          : undefined,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: `${title} atualizado`,
        description: "Configuração salva com sucesso.",
      });
      setApiToken("");
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar.";
      toast({
        title: `Erro ao configurar ${title}`,
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <IntegrationCard
      title={title}
      description={description}
      configured={state.configured}
      updatedAt={state.updatedAt}
      enabled={state.enabled}
    >
      <dl className="space-y-2 text-xs text-slate-400">
        {showUrl ? (
          <div className="flex justify-between">
            <dt>Endpoint</dt>
            <dd className="text-slate-300">
              {state.apiUrl ? state.apiUrl : "Não informado"}
            </dd>
          </div>
        ) : null}
        <div className="flex justify-between">
          <dt>Token configurado</dt>
          <dd className="text-slate-300">{state.hasToken ? "Sim" : "Não"}</dd>
        </div>
        {showChannel ? (
          <div className="flex justify-between">
            <dt>Canal padrão</dt>
            <dd className="text-slate-300">
              {state.defaultChannel ? state.defaultChannel : "Não definido"}
            </dd>
          </div>
        ) : null}
      </dl>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mt-4 w-full" variant="outline">
            Configurar
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Atualize as credenciais necessárias para a integração.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {showUrl ? (
              <div className="space-y-2">
                <Label htmlFor={`${title}-api-url`}>Endpoint / URL</Label>
                <Input
                  id={`${title}-api-url`}
                  value={apiUrl}
                  onChange={(event) => setApiUrl(event.target.value)}
                />
              </div>
            ) : null}
            <div className="space-y-2">
              <Label htmlFor={`${title}-api-token`}>Token/API Key</Label>
              <Input
                id={`${title}-api-token`}
                type="password"
                placeholder={state.hasToken ? "Mantido" : ""}
                value={apiToken}
                onChange={(event) => setApiToken(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                Deixe em branco para manter o token atual.
              </p>
            </div>
            {showChannel ? (
              <div className="space-y-2">
                <Label htmlFor={`${title}-default-channel`}>Canal padrão</Label>
                <Input
                  id={`${title}-default-channel`}
                  placeholder="#incident-response"
                  value={defaultChannel}
                  onChange={(event) => setDefaultChannel(event.target.value)}
                />
              </div>
            ) : null}
            <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Integração ativa</p>
                <p className="text-xs text-slate-500">
                  Desative para pausar o consumo de dados desta integração.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IntegrationCard>
  );
}

function SecretIntegrationCard({
  title,
  description,
  endpoint,
  state,
  onUpdated,
  toast,
}: {
  title: string;
  description: string;
  endpoint: string;
  state: SecretIntegrationState;
  onUpdated: (state: SecretIntegrationState) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [open, setOpen] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [enabled, setEnabled] = useState(state.enabled);
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async () => {
    setIsSaving(true);
    try {
      const payload: Record<string, unknown> = {
        enabled,
      };
      if (apiKey.trim().length > 0) {
        payload.apiKey = apiKey.trim();
      }

      const response = await fetch(endpoint, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      });

      const body = (await response.json()) as SecretIntegrationResponse;
      if (!response.ok) {
        throw new Error(body?.error?.message ?? "Não foi possível salvar a chave.");
      }

      onUpdated({
        hasKey: body.config?.hasKey ?? (state.hasKey || Boolean(apiKey)),
        lastFour: body.config?.lastFour ?? state.lastFour,
        enabled: body.config?.enabled ?? enabled,
        updatedAt: new Date().toISOString(),
      });

      toast({
        title: `${title} atualizado`,
        description: "Chave aplicada com sucesso.",
      });
      setApiKey("");
      setOpen(false);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao salvar.";
      toast({
        title: `Erro ao configurar ${title}`,
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <IntegrationCard
      title={title}
      description={description}
      configured={state.hasKey}
      updatedAt={state.updatedAt}
      enabled={state.enabled}
    >
      <dl className="space-y-2 text-xs text-slate-400">
        <div className="flex justify-between">
          <dt>Últimos dígitos</dt>
          <dd className="text-slate-200">{state.lastFour ?? "—"}</dd>
        </div>
      </dl>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button className="mt-4 w-full" variant="outline">
            Configurar
          </Button>
        </DialogTrigger>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{title}</DialogTitle>
            <DialogDescription>
              Informe a chave secreta usada para chamadas autenticadas.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor={`${title}-api-key`}>API Key</Label>
              <Input
                id={`${title}-api-key`}
                type="password"
                placeholder={state.hasKey ? "Mantido" : "sk-..."}
                value={apiKey}
                onChange={(event) => setApiKey(event.target.value)}
              />
              <p className="text-xs text-slate-500">
                Deixe em branco para manter a chave atual.
              </p>
            </div>
            <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/50 p-3">
              <div>
                <p className="text-sm font-medium text-slate-100">Integração ativa</p>
                <p className="text-xs text-slate-500">
                  Desative para impedir chamadas até nova liberação.
                </p>
              </div>
              <Switch checked={enabled} onCheckedChange={setEnabled} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSubmit} disabled={isSaving}>
              {isSaving ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </IntegrationCard>
  );
}

function MessageIntegrationCard({
  state,
  onUpdated,
  toast,
}: {
  state: MessageIntegrationState;
  onUpdated: (state: MessageIntegrationState) => void;
  toast: ReturnType<typeof useToast>["toast"];
}) {
  const [latestKey, setLatestKey] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isToggling, setIsToggling] = useState(false);

  const handleGenerate = async () => {
    setIsGenerating(true);
    try {
      const response = await fetch("/api/admin/integrations/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "generate" }),
      });
      const payload = (await response.json()) as MessageIntegrationResponse;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Falha ao gerar chave.");
      }
      if (!payload.apiKey) {
        throw new Error("Resposta inválida do servidor.");
      }
      setLatestKey(payload.apiKey);
      onUpdated({
        hasKey: payload.config?.hasKey ?? true,
        lastFour: payload.config?.lastFour ?? payload.apiKey.slice(-4),
        enabled: payload.config?.enabled ?? true,
        updatedAt: new Date().toISOString(),
      });
      toast({
        title: "Chave atualizada",
        description: "Copie a nova chave. Ela não será exibida novamente.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada.";
      toast({ title: "Erro ao gerar chave", description: message, variant: "destructive" });
    } finally {
      setIsGenerating(false);
    }
  };

  const handleToggle = async (enabled: boolean) => {
    setIsToggling(true);
    try {
      const response = await fetch("/api/admin/integrations/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "toggle", enabled }),
      });
      const payload = (await response.json()) as MessageIntegrationResponse;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Falha ao atualizar status.");
      }
      onUpdated({
        hasKey: state.hasKey,
        lastFour: state.lastFour,
        enabled,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha inesperada.";
      toast({ title: "Erro ao atualizar status", description: message, variant: "destructive" });
    } finally {
      setIsToggling(false);
    }
  };

  return (
    <IntegrationCard
      title="Command Center Messages"
      description="Gere uma API key para enviar insights em tempo real para o dashboard."
      configured={state.hasKey}
      enabled={state.enabled}
      updatedAt={state.updatedAt}
    >
      <dl className="space-y-2 text-xs text-slate-400">
        <div className="flex justify-between">
          <dt>Últimos dígitos</dt>
          <dd className="text-slate-200">{state.lastFour ?? "—"}</dd>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/50 p-3">
          <div>
            <p className="text-sm font-medium text-slate-100">Integração ativa</p>
            <p className="text-xs text-slate-500">
              Desative para bloquear chamadas externas até nova liberação.
            </p>
          </div>
          <Switch checked={state.enabled} onCheckedChange={(value) => handleToggle(value)} disabled={isToggling} />
        </div>
        {latestKey ? (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs text-emerald-100">
            <p className="font-medium">Nova chave gerada:</p>
            <p className="truncate text-sm">{latestKey}</p>
            <p className="mt-1 text-[11px]">Copie e guarde com segurança. Ela não será exibida novamente.</p>
          </div>
        ) : null}
      </dl>
      <Button className="mt-4 w-full" onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? "Gerando..." : state.hasKey ? "Regenerar chave" : "Gerar chave"}
      </Button>
    </IntegrationCard>
  );
}
