export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  readonly details?: unknown;

  constructor({
    message,
    statusCode,
    code,
    details,
  }: {
    message: string;
    statusCode: number;
    code: string;
    details?: unknown;
  }) {
    super(message);
    this.name = "AppError";
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Você precisa estar autenticado para prosseguir.") {
    super({
      message,
      statusCode: 401,
      code: "UNAUTHORIZED",
    });
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para realizar esta operação.") {
    super({
      message,
      statusCode: 403,
      code: "FORBIDDEN",
    });
  }
}

export class NotFoundError extends AppError {
  constructor(message = "O recurso solicitado não foi encontrado.") {
    super({
      message,
      statusCode: 404,
      code: "NOT_FOUND",
    });
  }
}

export class ValidationError extends AppError {
  constructor(details: unknown, message = "Os dados enviados são inválidos.") {
    super({
      message,
      statusCode: 422,
      code: "VALIDATION_ERROR",
      details,
    });
  }
}

export class ConflictError extends AppError {
  constructor(message = "Conflito ao processar requisição.") {
    super({
      message,
      statusCode: 409,
      code: "CONFLICT",
    });
  }
}

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
