import Image from "next/image";
import { redirect } from "next/navigation";
import { Suspense } from "react";

import { authOptions } from "@/lib/auth/options";
import { getServerSession } from "next-auth";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { serverEnv } from "@/env/server";
import { getGoogleOAuthConfig } from "@/server/integrations/service";
import SignInForm from "./sign-in-form";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/");
  }

  const googleConfig = await getGoogleOAuthConfig();
  const googleEnabledFromDb =
    Boolean(googleConfig?.enabled) &&
    Boolean(googleConfig?.clientId) &&
    Boolean(googleConfig?.clientSecret);
  const googleEnabledFromEnv =
    Boolean(serverEnv.GOOGLE_CLIENT_ID) &&
    Boolean(serverEnv.GOOGLE_CLIENT_SECRET);
  const googleEnabled = googleEnabledFromDb || googleEnabledFromEnv;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-br from-slate-950 via-slate-950 to-slate-900 px-6">
      <div className="w-full max-w-md rounded-3xl border border-slate-800/80 bg-slate-950/70 p-10 text-center shadow-2xl shadow-cyan-900/40">
        <div className="mb-4 flex justify-center">
          <Image
            src="/media/command-center-blue.png"
            alt="Dafiti Command Center"
            width={164}
            height={48}
            priority
          />
        </div>
        <h1 className="text-2xl font-semibold text-slate-100">
          Dafiti Command Center
        </h1>
        <p className="mt-2 text-sm text-slate-400">
          Acesse com o seu e-mail Google corporativo.
        </p>
        {googleEnabled ? (
          <div className="mt-6">
            <GoogleSignInButton />
          </div>
        ) : null}
        <Suspense fallback={null}>
          <SignInForm />
        </Suspense>
      </div>
    </main>
  );
}
