import type { Level, LevelWithSilent, LoggerOptions } from "pino";

/** Re-exported so consumers can type variables without a direct pino import. */
export type { Logger, Level, LevelWithSilent, LoggerOptions } from "pino";

/**
 * Config for {@link createPinoLogger}. Everything is optional — the defaults
 * encode Extend Therapy's conventions (env-gated redaction, pretty in lower
 * envs, base bindings, `err` serializer).
 */
export interface CreatePinoLoggerConfig {
  /**
   * Whether this is the production environment. Drives redaction (on only in
   * prod) and the default pretty transport (off in prod). If omitted, derived
   * from `runEnv === "prod"`.
   */
  isProd?: boolean;
  /** Runtime env label (e.g. process.env.RUN_ENV). Used for `isProd` fallback and the `env` base binding. */
  runEnv?: string;
  /** pino level. Defaults to `"info"`. */
  level?: LevelWithSilent;
  /** Service name attached to every line via pino `base`. */
  service?: string;
  /** Version string attached to every line via pino `base`. */
  version?: string;
  /** Extra redaction paths appended to {@link DEFAULT_REDACT_PATHS} (still prod-gated). */
  redact?: string[];
  /** Skip the built-in redaction list entirely (only `redact` applies, if given). */
  disableDefaultRedaction?: boolean;
  /** Force the pino-pretty transport on/off. Defaults to `!isProd`. Requires `pino-pretty` installed. */
  pretty?: boolean;
  /** Extra fields merged into pino `base` (alongside service/env/version). */
  base?: Record<string, unknown>;
  /** Escape hatch: raw pino options, spread last (wins over the derived config). */
  pino?: LoggerOptions;
}

/**
 * Elysia hook scope for propagating the plugin's `derive`/`afterResponse` to the
 * host app. `"global"` exposes `ctx.log` app-wide (the useful default);
 * `"scoped"` limits it to the immediate parent. (`"local"` is intentionally not
 * offered — a logger only the plugin instance can see has no use.)
 */
export type HookScope = "global" | "scoped";

/** Options for the {@link elysiaPino} plugin. */
export interface ElysiaPinoOptions {
  /**
   * Attach a per-request child logger (carrying `requestId`, `method`, `path`)
   * as `ctx.log`. When false, the base logger is decorated directly. Default `true`.
   */
  requestScoped?: boolean;
  /** Header to read a correlation id from; falls back to a generated uuid. Default `"x-request-id"`. */
  requestIdHeader?: string;
  /** Emit one structured line per response (method, path, status, latency). Default `false`. */
  autoLog?: boolean;
  /** Level for the auto request line. Default `"info"`. */
  autoLogLevel?: Level;
  /** Hook scope for the plugin's derive/afterResponse. Default `"global"` (app-wide `ctx.log`). */
  as?: HookScope;
  /** Elysia plugin name (for de-duplication). Default `"@extend-therapy/elysia-pino"`. */
  name?: string;
  /** Elysia plugin seed (for de-duplication across differing configs). */
  seed?: unknown;
}
