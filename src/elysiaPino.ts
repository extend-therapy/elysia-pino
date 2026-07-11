import Elysia from "elysia";
import type { Logger } from "pino";
import type { ElysiaPinoOptions } from "./types";

/**
 * The plugin type after `.as("global")` — isolates the "global" overload's
 * return (which preserves `derive: { log }`) so both scope branches can share
 * one stable type and consumers get a typed `ctx.log`.
 */
type WithGlobalLog<T> = T extends { as(scope: "global"): infer R } ? R : never;

/**
 * Elysia plugin that attaches a pino logger to the request context as `ctx.log`.
 *
 * A focused drop-in for `@bogeychan/elysia-logger`'s `.into()`, keeping only the
 * parts this codebase uses: a request-scoped child logger and (optionally) a
 * single structured line per response. Targets **Elysia 1.4.x** — see
 * `ext-thx-elysia/docs/elysia-2.0-migration.md` for the hook renames needed when
 * moving to Elysia 2.0 (`onAfterResponse` → `afterResponse`, `{ as }` object →
 * bare `'plugin'` string).
 *
 * @param logger The base logger (typically from {@link createPinoLogger}).
 * @param options See {@link ElysiaPinoOptions}.
 *
 * @example
 * const log = createPinoLogger({ runEnv: process.env.RUN_ENV, service: "ext-thx-elysia" });
 * const app = new Elysia().use(elysiaPino(log, { autoLog: true }));
 * app.get("/", ({ log }) => { log.info("hello"); return "ok"; });
 */
export function elysiaPino(logger: Logger, options: ElysiaPinoOptions = {}) {
  const {
    requestScoped = true,
    requestIdHeader = "x-request-id",
    autoLog = false,
    autoLogLevel = "info",
    as = "global",
    name = "@extend-therapy/elysia-pino",
    seed,
  } = options;

  // Per-request start times for the auto-log latency field. Keyed by the Request
  // so it stays off the context type and self-cleans once the request is GC'd.
  const started = new WeakMap<Request, number>();

  // Both hooks are registered unconditionally (behaviour gated by `autoLog`
  // inside them) so `app` has one concrete type — no union from conditional
  // construction, which would otherwise strip `ctx.log` from consumers. They're
  // registered locally then propagated with a trailing `.as(scope)`, the pattern
  // the other plugins in this org use.
  const app = new Elysia({ name, seed: seed ?? options })
    .derive((ctx) => {
      if (autoLog) started.set(ctx.request, performance.now());
      if (!requestScoped) return { log: logger };

      const requestId = ctx.request.headers.get(requestIdHeader) ?? crypto.randomUUID();
      return {
        log: logger.child({
          requestId,
          method: ctx.request.method,
          path: new URL(ctx.request.url).pathname,
        }),
      };
    })
    .onAfterResponse((ctx) => {
      if (!autoLog) return;
      const start = started.get(ctx.request);
      started.delete(ctx.request);
      const log = (ctx as { log?: Logger }).log ?? logger;

      log[autoLogLevel](
        {
          method: ctx.request.method,
          path: new URL(ctx.request.url).pathname,
          status: ctx.set.status,
          ...(start !== undefined
            ? { latencyMs: Math.round((performance.now() - start) * 100) / 100 }
            : {}),
        },
        "request completed",
      );
    });

  // `.as()` is overloaded per literal; branch on the literal and normalise the
  // rarely-used "scoped" path to the same stable type so `ctx.log` stays typed.
  if (as === "scoped") return app.as("scoped") as unknown as WithGlobalLog<typeof app>;
  return app.as("global");
}
