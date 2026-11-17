import { ZodError } from "zod";

export type ErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "VALIDATION"
  | "CONFLICT"
  | "USER_NOT_FOUND"
  | "CANNOT_SHARE_WITH_OWNER"
  | "UNSUPPORTED_FILE"
  | "FILE_TOO_LARGE"
  | "EMPTY_FILE"
  | "INTERNAL";

export class AppError extends Error {
  constructor(
    public code: ErrorCode,
    public status: number,
    message: string,
    public details?: unknown,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export const unauthorized = () => new AppError("UNAUTHORIZED", 401, "Please sign in.");
export const forbidden = (msg = "You don't have permission to do that.") =>
  new AppError("FORBIDDEN", 403, msg);
export const notFound = (msg = "Not found.") => new AppError("NOT_FOUND", 404, msg);

export function errorResponse(err: unknown): Response {
  if (err instanceof AppError) {
    return Response.json(
      { error: { code: err.code, message: err.message, details: err.details } },
      { status: err.status },
    );
  }
  if (err instanceof ZodError) {
    const first = err.issues[0];
    return Response.json(
      {
        error: {
          code: "VALIDATION",
          message: first?.message ?? "Invalid input.",
          details: err.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      { status: 400 },
    );
  }
  if (err instanceof SyntaxError) {
    return Response.json(
      { error: { code: "VALIDATION", message: "Request body must be valid JSON." } },
      { status: 400 },
    );
  }
  console.error("[api] unhandled error", err);
  return Response.json(
    { error: { code: "INTERNAL", message: "Something went wrong. Please try again." } },
    { status: 500 },
  );
}

/** Wraps a route handler so thrown AppError/ZodError become consistent JSON errors. */
export function handler<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C): Promise<Response> => {
    try {
      return await fn(req, ctx);
    } catch (err) {
      return errorResponse(err);
    }
  };
}
