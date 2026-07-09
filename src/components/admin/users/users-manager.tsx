"use client";

import { useMemo, useState } from "react";
import { Role } from "@prisma/client";

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
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

export type UserRow = {
  id: string;
  name: string | null;
  email: string | null;
  role: Role;
  isActive: boolean;
  provider: "local" | "google" | "other";
  createdAt: string;
};

type EditState = {
  id: string;
  name: string;
  role: Role;
  isActive: boolean;
};

type ApiError = {
  error?: {
    message?: string;
  };
  message?: string;
};

type CreateUserResponse = ApiError & {
  user?: {
    id: string;
    email: string;
    name: string | null;
    role: Role;
    isActive: boolean;
    provider?: string;
  };
};

type UpdateUserResponse = ApiError & {
  user?: {
    id: string;
    email: string | null;
    name: string | null;
    role: Role;
    isActive: boolean;
  };
};

type GenericResponse = ApiError;

export function UsersManager({ initialUsers }: { initialUsers: UserRow[] }) {
  const [users, setUsers] = useState<UserRow[]>(initialUsers);
  const [query, setQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<"all" | Role>("all");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");
  const [providerFilter, setProviderFilter] = useState<"all" | "local" | "google" | "other">("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [editState, setEditState] = useState<EditState | null>(null);
  const [resetUserId, setResetUserId] = useState<string | null>(null);
  const { toast } = useToast();

  const localUsersCount = useMemo(
    () => users.filter((user) => user.provider === "local").length,
    [users],
  );

  const googleUsersCount = useMemo(
    () => users.filter((user) => user.provider === "google").length,
    [users],
  );

  const filteredUsers = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return users.filter((user) => {
      const matchesQuery =
        !normalized ||
        (user.name?.toLowerCase().includes(normalized) ?? false) ||
        (user.email?.toLowerCase().includes(normalized) ?? false);

      const matchesRole = roleFilter === "all" || user.role === roleFilter;
      const matchesStatus =
        statusFilter === "all" ||
        (statusFilter === "active" ? user.isActive : !user.isActive);
      const matchesProvider = providerFilter === "all" || user.provider === providerFilter;

      return matchesQuery && matchesRole && matchesStatus && matchesProvider;
    });
  }, [users, query, roleFilter, statusFilter, providerFilter]);

  const handleCreateUser = async (formData: {
    name: string;
    email: string;
    role: Role;
    password: string;
  }) => {
    const response = await fetch("/api/admin/users", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(formData),
    });

    const payload = (await response.json()) as CreateUserResponse;

    if (!response.ok || !payload.user) {
      throw new Error(payload?.error?.message ?? "Falha ao criar usuário.");
    }

    const newUser = payload.user;

    setUsers((prev) => [
      {
        id: newUser.id,
        name: newUser.name ?? null,
        email: newUser.email ?? null,
        role: newUser.role,
        isActive: newUser.isActive,
        provider: "local",
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  };

  const handleUpdateUser = async (userId: string, payload: Partial<EditState>) => {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    const body = (await response.json()) as UpdateUserResponse;
    if (!response.ok || !body.user) {
      throw new Error(body?.error?.message ?? "Falha ao atualizar usuário.");
    }

    const updatedUser = body.user;
    setUsers((prev) =>
      prev.map((user) =>
        user.id === userId
          ? {
              ...user,
              name: updatedUser?.name ?? user.name,
              role: updatedUser?.role ?? user.role,
              isActive: updatedUser?.isActive ?? user.isActive,
            }
          : user,
      ),
    );
  };

  const handleResetPassword = async (userId: string, newPassword: string) => {
    const response = await fetch(`/api/admin/users/${userId}/reset-password`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: newPassword }),
    });

    const payload = (await response.json()) as GenericResponse;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Falha ao resetar senha.");
    }
  };

  const handleDeleteUser = async (userId: string) => {
    const response = await fetch(`/api/admin/users/${userId}`, {
      method: "DELETE",
    });

    const payload = (await response.json()) as GenericResponse;
    if (!response.ok) {
      throw new Error(payload?.error?.message ?? "Falha ao remover usuário.");
    }

    setUsers((prev) => prev.filter((user) => user.id !== userId));
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-800/70 bg-slate-950/50 p-4 md:flex-row md:items-center md:justify-between">
        <div className="space-y-1 text-sm text-slate-400">
          <div>
            {localUsersCount} usuário(s) local(is) · {googleUsersCount} usuário(s) Google
          </div>
          <div className="text-xs text-slate-500">
            {filteredUsers.length} registro(s) exibidos
          </div>
        </div>
        <div className="flex flex-1 flex-col gap-3 md:flex-row md:items-center">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar por nome ou e-mail"
            className="rounded-2xl border border-slate-800/70 bg-slate-900/60 text-slate-100"
          />
          <div className="flex flex-1 flex-col gap-3 md:flex-row">
            <Select value={roleFilter} onValueChange={(value) => setRoleFilter(value as typeof roleFilter)}>
              <SelectTrigger className="rounded-2xl border border-slate-800/70 bg-slate-900/60 text-slate-100">
                <SelectValue placeholder="Papel" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 text-slate-100">
                <SelectItem value="all">Todos os papéis</SelectItem>
                {Object.values(Role).map((role) => (
                  <SelectItem key={role} value={role}>
                    {role}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as typeof statusFilter)}
            >
              <SelectTrigger className="rounded-2xl border border-slate-800/70 bg-slate-900/60 text-slate-100">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 text-slate-100">
                <SelectItem value="all">Status: todos</SelectItem>
                <SelectItem value="active">Ativo</SelectItem>
                <SelectItem value="inactive">Inativo</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={providerFilter}
              onValueChange={(value) => setProviderFilter(value as typeof providerFilter)}
            >
              <SelectTrigger className="rounded-2xl border border-slate-800/70 bg-slate-900/60 text-slate-100">
                <SelectValue placeholder="Origem" />
              </SelectTrigger>
              <SelectContent className="bg-slate-950 text-slate-100">
                <SelectItem value="all">Origem: todas</SelectItem>
                <SelectItem value="google">Google</SelectItem>
                <SelectItem value="local">Local</SelectItem>
                <SelectItem value="other">Externo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>Criar usuário</Button>
          </DialogTrigger>
          <CreateUserDialog
            onSubmit={async (formData) => {
              try {
                await handleCreateUser(formData);
                toast({
                  title: "Usuário criado",
                  description: "O usuário foi cadastrado com sucesso.",
                });
                setCreateOpen(false);
              } catch (error) {
                toast({
                  title: "Erro ao criar usuário",
                  description:
                    error instanceof Error ? error.message : "Falha inesperada.",
                  variant: "destructive",
                });
              }
            }}
            onCancel={() => setCreateOpen(false)}
          />
        </Dialog>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-800/70 bg-slate-950/40">
        <Table>
          <TableHeader className="bg-slate-900/60">
            <TableRow>
              <TableHead className="text-slate-300">Usuário</TableHead>
              <TableHead className="text-slate-300">Papel</TableHead>
              <TableHead className="text-slate-300">Status</TableHead>
              <TableHead className="text-slate-300">Origem</TableHead>
              <TableHead className="text-right text-slate-300">Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredUsers.map((user) => (
              <TableRow key={user.id} className="border-slate-800/50">
                <TableCell>
                  <div className="text-sm font-medium text-slate-100">
                    {user.name ?? "Sem nome"}
                  </div>
                  <div className="text-xs text-slate-500">{user.email ?? "—"}</div>
                </TableCell>
                <TableCell className="text-sm text-slate-200">{user.role}</TableCell>
                <TableCell>
                  <Badge
                    variant="outline"
                    className={
                      user.isActive
                        ? "border-emerald-500/40 bg-emerald-500/20 text-emerald-200"
                        : "border-slate-600/40 bg-slate-800/40 text-slate-200"
                    }
                  >
                    {user.isActive ? "Ativo" : "Inativo"}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline" className="border-cyan-500/30 text-xs text-cyan-200">
                    {user.provider === "google"
                      ? "Google"
                      : user.provider === "other"
                        ? "Externo"
                        : "Local"}
                  </Badge>
                </TableCell>
                <TableCell className="text-right text-sm">
                  <div className="flex flex-wrap justify-end gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() =>
                        setEditState({
                          id: user.id,
                          name: user.name ?? "",
                          role: user.role,
                          isActive: user.isActive,
                        })
                      }
                    >
                      Editar
                    </Button>
                    {user.provider === "local" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setResetUserId(user.id)}
                      >
                        Resetar senha
                      </Button>
                    ) : null}
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={async () => {
                        const confirmed = window.confirm(
                          `Remover ${user.email ?? "usuário"}? Essa ação é irreversível.`,
                        );
                        if (!confirmed) return;
                        try {
                          await handleDeleteUser(user.id);
                          toast({
                            title: "Usuário removido",
                            description: "Registro excluído com sucesso.",
                          });
                        } catch (error) {
                          toast({
                            title: "Erro ao remover usuário",
                            description:
                              error instanceof Error ? error.message : "Falha inesperada.",
                            variant: "destructive",
                          });
                        }
                      }}
                    >
                      Remover
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <EditUserDialog
        state={editState}
        onClose={() => setEditState(null)}
        onSubmit={async (input) => {
          if (!editState) return;
          try {
            await handleUpdateUser(editState.id, input);
            toast({
              title: "Usuário atualizado",
              description: "Alterações aplicadas com sucesso.",
            });
            setEditState(null);
          } catch (error) {
            toast({
              title: "Erro ao atualizar usuário",
              description: error instanceof Error ? error.message : "Falha inesperada.",
              variant: "destructive",
            });
          }
        }}
      />

      <ResetPasswordDialog
        userId={resetUserId}
        onClose={() => setResetUserId(null)}
        onSubmit={async (password) => {
          if (!resetUserId) return;
          try {
            await handleResetPassword(resetUserId, password);
            toast({
              title: "Senha redefinida",
              description: "A nova senha foi aplicada.",
            });
            setResetUserId(null);
          } catch (error) {
            toast({
              title: "Erro ao resetar senha",
              description: error instanceof Error ? error.message : "Falha inesperada.",
              variant: "destructive",
            });
          }
        }}
      />
    </div>
  );
}

function CreateUserDialog({
  onSubmit,
  onCancel,
}: {
  onSubmit: (input: { name: string; email: string; role: Role; password: string }) => Promise<void>;
  onCancel: () => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(Role.USER);
  const [password, setPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  return (
    <DialogContent className="sm:max-w-lg">
      <DialogHeader>
        <DialogTitle>Novo usuário</DialogTitle>
        <DialogDescription>
          Cadastre um usuário com autenticação local. A senha pode ser resetada posteriormente.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4 py-2">
        <div className="space-y-2">
          <Label htmlFor="user-name">Nome</Label>
          <Input
            id="user-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-email">E-mail</Label>
          <Input
            id="user-email"
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label>Papel</Label>
          <Select value={role} onValueChange={(value) => setRole(value as Role)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={Role.ADMIN}>Admin</SelectItem>
              <SelectItem value={Role.USER}>User</SelectItem>
              <SelectItem value={Role.GUEST}>Guest</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <Label htmlFor="user-password">Senha</Label>
          <Input
            id="user-password"
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            placeholder="Mínimo 8 caracteres"
          />
        </div>
      </div>
      <DialogFooter>
        <Button variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button
          onClick={async () => {
            setIsSaving(true);
            try {
              await onSubmit({ name, email, role, password });
            } finally {
              setIsSaving(false);
            }
          }}
          disabled={isSaving}
        >
          {isSaving ? "Salvando..." : "Criar"}
        </Button>
      </DialogFooter>
    </DialogContent>
  );
}

function EditUserDialog({
  state,
  onClose,
  onSubmit,
}: {
  state: EditState | null;
  onClose: () => void;
  onSubmit: (input: Partial<EditState>) => Promise<void>;
}) {
  const [name, setName] = useState(state?.name ?? "");
  const [role, setRole] = useState<Role>(state?.role ?? Role.USER);
  const [isActive, setIsActive] = useState<boolean>(state?.isActive ?? true);
  const [isSaving, setIsSaving] = useState(false);

  if (!state) {
    return null;
  }

  return (
    <Dialog open={Boolean(state)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Editar usuário</DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="edit-user-name">Nome</Label>
            <Input
              id="edit-user-name"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label>Papel</Label>
            <Select value={role} onValueChange={(value) => setRole(value as Role)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={Role.ADMIN}>Admin</SelectItem>
                <SelectItem value={Role.USER}>User</SelectItem>
                <SelectItem value={Role.GUEST}>Guest</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center justify-between rounded-xl border border-slate-800/60 bg-slate-900/50 p-3">
            <div>
              <p className="text-sm font-medium text-slate-100">Usuário ativo</p>
              <p className="text-xs text-slate-500">
                Usuários inativos não podem acessar o sistema.
              </p>
            </div>
            <Switch checked={isActive} onCheckedChange={setIsActive} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            onClick={async () => {
              setIsSaving(true);
              try {
                await onSubmit({ name, role, isActive });
              } finally {
                setIsSaving(false);
              }
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

function ResetPasswordDialog({
  userId,
  onClose,
  onSubmit,
}: {
  userId: string | null;
  onClose: () => void;
  onSubmit: (password: string) => Promise<void>;
}) {
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const open = Boolean(userId);

  if (!open) {
    return null;
  }

  const canSubmit = password.length >= 8 && password === confirmPassword;

  return (
    <Dialog open={open} onOpenChange={(value) => !value && onClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resetar senha</DialogTitle>
          <DialogDescription>
            Informe a nova senha. O usuário deverá utilizá-la no próximo acesso.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="reset-password">Nova senha</Label>
            <Input
              id="reset-password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reset-password-confirm">Confirmar senha</Label>
            <Input
              id="reset-password-confirm"
              type="password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
            />
          </div>
          <p className="text-xs text-slate-500">
            A senha deve conter pelo menos 8 caracteres.
          </p>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            Cancelar
          </Button>
          <Button
            disabled={!canSubmit || isSaving}
            onClick={async () => {
              if (!userId) return;
              setIsSaving(true);
              try {
                await onSubmit(password);
              } finally {
                setIsSaving(false);
                setPassword("");
                setConfirmPassword("");
              }
            }}
          >
            {isSaving ? "Salvando..." : "Resetar senha"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
