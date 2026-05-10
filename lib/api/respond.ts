import { NextResponse } from "next/server";
import { ZodError } from "zod";

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown };
}

export function ok<T>(data: T, init?: ResponseInit): NextResponse<T> {
  return NextResponse.json(data, init);
}

export function badRequest(code: string, message: string, details?: unknown) {
  return NextResponse.json<ApiErrorBody>(
    { error: { code, message, details } },
    { status: 400 }
  );
}

export function unauthorized(message = "Unauthorized") {
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "UNAUTHORIZED", message } },
    { status: 401 }
  );
}

export function notFound(message = "Not found") {
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "NOT_FOUND", message } },
    { status: 404 }
  );
}

export function tooManyRequests(message = "Rate limit exceeded") {
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "RATE_LIMITED", message } },
    { status: 429 }
  );
}

export function serverError(message = "Internal server error") {
  return NextResponse.json<ApiErrorBody>(
    { error: { code: "SERVER_ERROR", message } },
    { status: 500 }
  );
}

/** Wrap a Zod error into a 400 response with structured details. */
export function fromZod(err: ZodError) {
  return NextResponse.json<ApiErrorBody>(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: "Invalid request body",
        details: err.issues,
      },
    },
    { status: 400 }
  );
}
