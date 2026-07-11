# @extend-therapy/elysia-pino

A small, opinionated [pino](https://getpino.io) logger plugin for [Elysia](https://elysiajs.com)
(1.4.x). It bakes in Extend Therapy's conventions so apps don't re-wire the same logger every time:

- **Request-scoped `ctx.log`** — a per-request child logger carrying `requestId`, `method`, `path`.
- **Env-gated redaction** — a built-in PII/secret redaction list, applied only in production.
- **Pretty in lower envs** — `pino-pretty` transport off prod, plain JSON in prod.
- **Base bindings + `err` serializer** — `service` / `env` / `version` on every line; `pino.stdSerializers.err` for thrown errors.
- **Opt-in request logging** — one structured line per response (method, path, status, latency).

It intentionally does **less** than `@bogeychan/elysia-logger`; it covers the surface this org
actually uses, and it's ours to carry forward to Elysia 2.0.

## Install

```sh
bun add @extend-therapy/elysia-pino
# peers:
bun add elysia pino
bun add -d pino-pretty   # only needed for pretty output in lower envs
```

## Usage

```ts
import { Elysia } from "elysia";
import { createPinoLogger, elysiaPino } from "@extend-therapy/elysia-pino";
import type { Logger } from "@extend-therapy/elysia-pino";

// Module-level logger — use it outside requests (startup, error handlers, jobs).
export const log = createPinoLogger({
  runEnv: process.env.RUN_ENV,          // drives redaction + pretty + `env` binding
  service: "ext-thx-elysia",
  version: process.env.APP_VERSION,
  // level defaults to "info"; pass `level` to override.
});

const app = new Elysia()
  .use(elysiaPino(log, { autoLog: true }))  // decorates ctx.log; logs a line per response
  .get("/", ({ log }) => {
    log.info("handling root");              // request-scoped: carries requestId/method/path
    return "ok";
  });
```

`ctx.log` is a normal pino `Logger` (`.info/.debug/.warn/.error/...`).

## API

### `createPinoLogger(config?) => Logger`

Returns a configured pino logger. All fields optional:

| field | default | effect |
|---|---|---|
| `isProd` | `runEnv === "prod"` | gates redaction (on in prod) and pretty (off in prod) |
| `runEnv` | — | `isProd` fallback + the `env` base binding |
| `level` | `"info"` | pino level |
| `service` / `version` | — | base bindings on every line |
| `redact` | — | extra paths appended to the built-in list (still prod-gated) |
| `disableDefaultRedaction` | `false` | drop the built-in redaction list |
| `pretty` | `!isProd` | force pino-pretty on/off (needs `pino-pretty` installed) |
| `base` | — | extra fields merged into pino `base` |
| `pino` | — | raw pino options, spread last (wins) |

Built-in redaction paths are exported as `DEFAULT_REDACT_PATHS`.
`buildPinoOptions(config)` returns the derived pino options without instantiating a logger (useful for tests).

### `elysiaPino(logger, options?) => Elysia`

Elysia plugin. Options:

| option | default | effect |
|---|---|---|
| `requestScoped` | `true` | attach a per-request child logger (else the base logger) |
| `requestIdHeader` | `"x-request-id"` | header read for the correlation id (falls back to a uuid) |
| `autoLog` | `false` | emit one `"request completed"` line per response |
| `autoLogLevel` | `"info"` | level for that line |
| `as` | `"global"` | Elysia hook scope (`"global" | "scoped" | "local"`) |
| `name` / `seed` | plugin defaults | Elysia de-duplication keys |

## Elysia 2.0

This targets Elysia **1.4.x**. Moving to 2.0 is a small internal change (`onAfterResponse` →
`afterResponse`, the `{ as }` object → the bare `'plugin'` string, and `.error(...)` for the
error hook). See `ext-thx-elysia/docs/elysia-2.0-migration.md`.

## License

MIT © Eli Selkin
