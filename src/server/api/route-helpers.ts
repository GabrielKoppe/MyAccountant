import type { ZodSchema } from "zod";
import { AppError } from "@/server/api/errors";
import { logger } from "@/server/logger";
import { actionSuccess, actionError } from "@/lib/action-result";

const ERROR_STATUS: Record<string, number> = {
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  VALIDATION: 422,
  TOO_MANY_REQUESTS: 429,
  INTERNAL: 500,
};

type RouteContext = { params: Promise<Record<string, string>> };

type DefineRouteOpts<TInput, TOutput> = {
  schema?: ZodSchema<TInput>;
  handler: (input: TInput, params: Record<string, string>) => Promise<TOutput>;
  module: string;
};

export function defineRoute<TInput, TOutput>(opts: DefineRouteOpts<TInput, TOutput>) {
  return async (req: Request, ctx: RouteContext): Promise<Response> => {
    const params = await ctx.params;
    const log = logger.child({ module: opts.module, params });

    try {
      let input = {} as TInput;

      if (opts.schema) {
        const body = req.method !== "GET" ? await req.json().catch(() => ({})) : {};
        const parsed = opts.schema.safeParse({ ...params, ...body });
        if (!parsed.success) {
          return Response.json(
            actionError(
              "VALIDATION",
              "Dados inválidos",
              Object.fromEntries(
                Object.entries(parsed.error.flatten().fieldErrors).map(([k, msgs]) => [
                  k,
                  Array.isArray(msgs) && msgs.length > 0 ? msgs[0] : "",
                ]),
              ),
            ),
            { status: 422 },
          );
        }
        input = parsed.data;
      }

      const data = await opts.handler(input, params);
      return Response.json(actionSuccess(data));
    } catch (err) {
      if (err instanceof AppError) {
        const status = ERROR_STATUS[err.code] ?? 500;
        log.warn({ code: err.code }, err.message);
        return Response.json(actionError(err.code, err.message, err.fieldErrors), { status });
      }
      log.error({ err }, "Unhandled error in route handler");
      return Response.json(actionError("INTERNAL", "Erro interno"), { status: 500 });
    }
  };
}
