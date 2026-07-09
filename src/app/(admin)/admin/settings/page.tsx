import { Role } from "@prisma/client";

import { BrandingManager, BrandingState } from "@/components/admin/settings/branding-manager";
import { getBrandingSettings } from "@/server/settings/branding";
import { requireRole } from "@/server/auth";
import { handleAdminAuthError } from "@/app/(admin)/lib/handle-auth-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminSettingsPage() {
  try {
    await requireRole(Role.ADMIN);
  } catch (error) {
    handleAdminAuthError(error, "/admin/settings");
  }
  const branding = await getBrandingSettings(true);

  const initial: BrandingState = {
    frontLogo: branding.frontLogo ?? null,
    adminLogo: branding.adminLogo ?? null,
    favicon: branding.favicon ?? null,
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-50">Configurações</h1>
        <p className="text-sm text-slate-400">
          Personalize a identidade visual e mantenha atualizadas as principais configurações da plataforma.
        </p>
      </header>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-100">Logotipos e identidade</h2>
        <BrandingManager initial={initial} />
      </section>
    </div>
  );
}
