import { logger } from "@/lib/logger";
import { isAppError } from "@/lib/errors";

type JsonInit = ResponseInit & {
  status?: number;
};

export function json<T>(data: T, init: JsonInit = {}): Response {
  const headers = new Headers(init.headers);
  headers.set("Content-Type", "application/json; charset=utf-8");

  return new Response(JSON.stringify(data), {
    ...init,
    headers,
  });
}

export function errorResponse(error: unknown): Response {
  if (isAppError(error)) {
    return json(
      {
        error: {
          message: error.message,
          code: error.code,
          details: error.details,
        },
      },
      { status: error.statusCode },
    );
  }

  logger.error(error, "Unhandled API error");

  return json(
    {
      error: {
        message: "Erro interno inesperado.",
        code: "INTERNAL_ERROR",
      },
    },
    { status: 500 },
  );
}

export function withErrorHandling<Args extends unknown[]>(
  handler: (...args: Args) => Promise<Response>,
) {
  return async (...args: Args) => {
    try {
      return await handler(...args);
    } catch (error) {
      return errorResponse(error);
    }
  };
}
