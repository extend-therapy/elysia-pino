# Changelog

## 0.1.0

Initial release. Elysia 1.4.x pino logger plugin extracted to replace
`@bogeychan/elysia-logger` with a smaller, org-owned surface.

- `createPinoLogger(config)` — pre-wired pino logger: env-gated PII/secret redaction, pretty
  output in lower envs, `service`/`env`/`version` base bindings, standard `err` serializer.
- `buildPinoOptions(config)` — the derived pino options, without instantiating (for tests).
- `elysiaPino(logger, options)` — plugin decorating a request-scoped `ctx.log`
  (`requestId`/`method`/`path`), with opt-in per-response request logging (`autoLog`).
- `DEFAULT_REDACT_PATHS` — the built-in redaction list.
