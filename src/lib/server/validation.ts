import { NextResponse } from "next/server";
import { z } from "zod";

/**
 * Request-body validation for API routes.
 *
 * Routes currently hand-roll checks like `if (!name || price == null)`, which
 * catches missing fields but not wrong types, and produces inconsistent error
 * shapes. `parseBody` returns a discriminated union so callers stay explicit:
 *
 *   const parsed = await parseBody(req, ProductCreateSchema);
 *   if (!parsed.ok) return parsed.response;
 *   const { name, price } = parsed.data;
 *
 * Error responses keep the existing `{ status: "error", message }` shape the
 * admin SPA and student pages already parse, so this drops into current routes
 * without touching the frontend.
 */
export type ParseResult<T> =
  | { ok: true; data: T }
  | { ok: false; response: NextResponse };

function fieldErrorMessage(error: z.ZodError): string {
  const first = error.issues[0];
  if (!first) return "ข้อมูลไม่ถูกต้อง";
  const path = first.path.join(".");
  return path ? `${path}: ${first.message}` : first.message;
}

export async function parseBody<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): Promise<ParseResult<z.infer<T>>> {
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", message: "รูปแบบ JSON ไม่ถูกต้อง" },
        { status: 400 }
      ),
    };
  }

  const result = schema.safeParse(raw);
  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", message: fieldErrorMessage(result.error) },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}

/** Same contract as `parseBody`, for `?a=1&b=2` query strings. */
export function parseQuery<T extends z.ZodTypeAny>(
  req: Request,
  schema: T
): ParseResult<z.infer<T>> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const result = schema.safeParse(params);

  if (!result.success) {
    return {
      ok: false,
      response: NextResponse.json(
        { status: "error", message: fieldErrorMessage(result.error) },
        { status: 400 }
      ),
    };
  }

  return { ok: true, data: result.data };
}
