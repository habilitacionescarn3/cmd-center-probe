import { Role } from "@prisma/client";

import { IncidentForm } from "@/components/incidents/incident-form";
import { createEmptyIncidentFormValues } from "@/types/incidents";
import { requireRole } from "@/server/auth";
import { handleAdminAuthError } from "@/app/(admin)/lib/handle-auth-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function NewIncidentPage() {
  try {
    await requireRole([Role.ADMIN, Role.USER]);
  } catch (error) {
    handleAdminAuthError(error, "/admin/incidents/new");
  }

  const initialValues = createEmptyIncidentFormValues();

  return (
    <div className="space-y-6">
      <IncidentForm mode="create" initialValues={initialValues} />
    </div>
  );
}
