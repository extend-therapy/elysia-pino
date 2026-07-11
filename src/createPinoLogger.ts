import pino from "pino";
import type { Logger, LoggerOptions } from "pino";
import { DEFAULT_REDACT_PATHS } from "./redaction";
import type { CreatePinoLoggerConfig } from "./types";

/**
 * Build the pino {@link LoggerOptions} implied by a {@link CreatePinoLoggerConfig}.
 *
 * Split out from {@link createPinoLogger} so the derived options (redaction,
 * base bindings, transport) can be unit-tested without instantiating a logger.
 */
export function buildPinoOptions(config: CreatePinoLoggerConfig = {}): LoggerOptions {
  const isProd = config.isProd ?? config.runEnv === "prod";
  const pretty = config.pretty ?? !isProd;
  const level = config.level ?? "info";

  const redact = config.disableDefaultRedaction
    ? (config.redact ?? [])
    : [...DEFAULT_REDACT_PATHS, ...(config.redact ?? [])];

  const base: Record<string, unknown> = {
    ...(config.service ? { service: config.service } : {}),
    ...(config.runEnv ? { env: config.runEnv } : {}),
    ...(config.version ? { version: config.version } : {}),
    ...config.base,
  };

  const options: LoggerOptions = {
    level,
    // Standard serializer so thrown Errors log as { type, message, stack }.
    serializers: { err: pino.stdSerializers.err },
    // Redact only in prod, matching ext-thx-elysia's original behavior — local
    // logs stay readable.
    ...(isProd && redact.length ? { redact } : {}),
    ...(Object.keys(base).length ? { base } : {}),
    ...(pretty
      ? {
          transport: {
            target: "pino-pretty",
            options: {
              colorize: true,
              translateTime: "SYS:standard",
              ignore: "pid,hostname",
            },
          },
        }
      : {}),
    // Escape hatch wins over everything above.
    ...config.pino,
  };

  return options;
}

/**
 * Create a pino {@link Logger} pre-wired with Extend Therapy's conventions:
 * env-gated redaction of PII/secret fields, pretty output in lower envs, base
 * bindings (service/env/version), and the standard `err` serializer.
 *
 * Use the returned logger directly for module-level logging, and pass it to
 * {@link elysiaPino} to expose a request-scoped `ctx.log`.
 *
 * @example
 * const log = createPinoLogger({ runEnv: process.env.RUN_ENV, service: "ext-thx-elysia" });
 * app.use(elysiaPino(log, { autoLog: false }));
 */
export function createPinoLogger(config: CreatePinoLoggerConfig = {}): Logger {
  return pino(buildPinoOptions(config));
}
