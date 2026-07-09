import { redirect } from "next/navigation";

import { ForbiddenError, UnauthorizedError } from "@/lib/errors";

export function handleAdminAuthError(error: unknown, callbackUrl: string) {
  if (error instanceof UnauthorizedError) {
    redirect(`/auth/sign-in?callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  if (error instanceof ForbiddenError) {
    redirect("/");
  }
  throw error;
}
