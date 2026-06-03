import type { ActionErrorCode } from "@/lib/action-result";

export class AppError extends Error {
  constructor(
    public code: ActionErrorCode,
    message: string,
    public fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    super("NOT_FOUND", `${resource}${id ? ` (${id})` : ""} não encontrado`);
    this.name = "NotFoundError";
  }
}

export class ForbiddenError extends AppError {
  constructor(message = "Você não tem permissão para esta ação") {
    super("FORBIDDEN", message);
    this.name = "ForbiddenError";
  }
}

export class ConflictError extends AppError {
  constructor(message: string, fieldErrors?: Record<string, string>) {
    super("CONFLICT", message, fieldErrors);
    this.name = "ConflictError";
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Você precisa estar logado") {
    super("UNAUTHORIZED", message);
    this.name = "UnauthorizedError";
  }
}
