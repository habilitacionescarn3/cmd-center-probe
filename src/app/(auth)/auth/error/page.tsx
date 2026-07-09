import Link from "next/link";

export default function AuthErrorPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-slate-950 px-6 text-center text-slate-100">
      <div className="max-w-md space-y-4">
        <h1 className="text-2xl font-semibold">Falha na autenticação</h1>
        <p className="text-sm text-slate-400">
          Não foi possível completar o login. Verifique se sua conta está no domínio autorizado ou tente novamente.
        </p>
        <Link
          href="/auth/sign-in"
          className="inline-flex items-center rounded-full border border-slate-700 px-4 py-2 text-sm text-slate-100 transition hover:border-slate-500"
        >
          Tentar novamente
        </Link>
      </div>
    </main>
  );
}
