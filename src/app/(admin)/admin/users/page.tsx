import { Role } from "@prisma/client";

import { UsersManager, UserRow } from "@/components/admin/users/users-manager";
import { listUsers } from "@/server/users/service";
import { requireRole } from "@/server/auth";
import { handleAdminAuthError } from "@/app/(admin)/lib/handle-auth-error";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function AdminUsersPage() {
  try {
    await requireRole(Role.ADMIN);
  } catch (error) {
    handleAdminAuthError(error, "/admin/users");
  }
  const users = await listUsers();

  const initialUsers: UserRow[] = users.map((user) => ({
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    isActive: user.isActive,
    provider: user.provider,
    createdAt: user.createdAt.toISOString(),
  }));

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h1 className="text-3xl font-semibold text-slate-50">Usuários e acesso</h1>
        <p className="text-sm text-slate-400">
          Gerencie contas locais e acessos via Google, definindo papéis e reativando usuários quando necessário.
        </p>
      </header>
      <UsersManager initialUsers={initialUsers} />
    </div>
  );
}
