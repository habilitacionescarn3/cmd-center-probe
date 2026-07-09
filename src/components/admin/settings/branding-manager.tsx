"use client";

import Image from "next/image";
import { useState } from "react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";

export type BrandingState = {
  frontLogo?: string | null;
  adminLogo?: string | null;
  favicon?: string | null;
};

type UploadType = "front" | "admin" | "favicon";

const FALLBACKS: Record<UploadType, string> = {
  front: "/media/command-horizontal.png",
  admin: "/media/command-center-blue.png",
  favicon: "/media/logo-cc-short.png",
};

const LABELS: Record<UploadType, { title: string; helper: string; width: number; height: number }> = {
  front: {
    title: "Logo público",
    helper: "Utilizado no cabeçalho da página pública. Recomendado 600x120 px.",
    width: 320,
    height: 100,
  },
  admin: {
    title: "Logo do admin",
    helper: "Exibido na navegação do painel administrativo. Recomendado 280x80 px.",
    width: 240,
    height: 80,
  },
  favicon: {
    title: "Favicon",
    helper: "Ícone do navegador. Recomendado 128x128 px.",
    width: 96,
    height: 96,
  },
};

type BrandingUploadResponse = {
  message?: string;
  error?: { message?: string };
  path?: string;
};

export function BrandingManager({ initial }: { initial: BrandingState }) {
  const [state, setState] = useState<BrandingState>(initial);
  const { toast } = useToast();
  const [isUploading, setIsUploading] = useState<Record<UploadType, boolean>>({
    front: false,
    admin: false,
    favicon: false,
  });
  const [selectedFiles, setSelectedFiles] = useState<Record<UploadType, File | null>>({
    front: null,
    admin: null,
    favicon: null,
  });

  const handleUpload = async (type: UploadType) => {
    const file = selectedFiles[type];
    if (!file) {
      toast({
        title: "Nenhum arquivo selecionado",
        description: "Escolha um arquivo de imagem para enviar.",
        variant: "destructive",
      });
      return;
    }

    const formData = new FormData();
    formData.append("type", type);
    formData.append("file", file);

    setIsUploading((prev) => ({ ...prev, [type]: true }));
    try {
      const response = await fetch("/api/admin/branding", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as BrandingUploadResponse;
      if (!response.ok) {
        throw new Error(payload?.error?.message ?? "Falha ao enviar arquivo.");
      }

      setState((prev) => {
        if (type === "front") {
          return { ...prev, frontLogo: payload.path };
        }
        if (type === "admin") {
          return { ...prev, adminLogo: payload.path };
        }
        return { ...prev, favicon: payload.path };
      });
      setSelectedFiles((prev) => ({ ...prev, [type]: null }));

      toast({
        title: "Logo atualizado",
        description: "Atualize a página para visualizar a alteração.",
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao atualizar logo.";
      toast({
        title: "Erro no upload",
        description: message,
        variant: "destructive",
      });
    } finally {
      setIsUploading((prev) => ({ ...prev, [type]: false }));
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {(Object.keys(LABELS) as UploadType[]).map((type) => {
        const current =
          type === "front"
            ? state.frontLogo
            : type === "admin"
              ? state.adminLogo
              : state.favicon;
        const fallback = FALLBACKS[type];
        const display = current || fallback;
        const { title, helper, width, height } = LABELS[type];

        return (
          <Card key={type} className="border border-slate-800/70 bg-slate-950/50">
            <CardHeader>
              <CardTitle className="text-base font-semibold text-slate-100">
                {title}
              </CardTitle>
              <p className="text-xs text-slate-500">{helper}</p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 text-center">
                <Image
                  src={display}
                  alt={title}
                  width={width}
                  height={height}
                  className="mx-auto h-auto w-auto max-h-32 object-contain"
                  priority
                />
                {current ? (
                  <p className="mt-2 text-[10px] text-slate-500">
                    {display}
                  </p>
                ) : null}
              </div>
              <div className="space-y-2">
                <Label htmlFor={`${type}-upload`}>Enviar novo arquivo</Label>
                <Input
                  id={`${type}-upload`}
                  type="file"
                  accept="image/png,image/jpeg,image/svg+xml,image/webp"
                  onChange={(event) =>
                    setSelectedFiles((prev) => ({
                      ...prev,
                      [type]: event.target.files?.item(0) ?? null,
                    }))
                  }
                  disabled={isUploading[type]}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  void handleUpload(type);
                }}
                disabled={isUploading[type] || !selectedFiles[type]}
              >
                {isUploading[type] ? "Enviando..." : "Salvar alteração"}
              </Button>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
