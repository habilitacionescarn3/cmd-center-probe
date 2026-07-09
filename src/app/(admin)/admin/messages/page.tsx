import { Role } from "@prisma/client";

import { MessagesManager, MessageRow } from "@/components/admin/messages/messages-manager";
import { requireRole } from "@/server/auth";
import { handleAdminAuthError } from "@/app/(admin)/lib/handle-auth-error";
import { listAdminMessages } from "@/server/messages/service";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminMessagesPage() {
  try {
    await requireRole(Role.ADMIN);
  } catch (error) {
    handleAdminAuthError(error, "/admin/messages");
  }

  const { items, hasMore } = await listAdminMessages();

  const initialMessages: MessageRow[] = items.map((item) => ({
    id: item.id,
    summary: item.summary,
    source: item.source,
    sentiment: item.sentiment,
    createdAt: item.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-50">Command Center · Mensagens</h1>
        <p className="text-sm text-slate-400">
          Administre os insights enviados via API. Edite correções rápidas ou remova registros indevidos.
        </p>
      </header>
      <MessagesManager initialMessages={initialMessages} initialHasMore={hasMore} />
    </div>
  );
}
