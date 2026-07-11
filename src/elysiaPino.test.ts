import { describe, expect, it } from "bun:test";
import Elysia from "elysia";
import pino from "pino";
import { buildPinoOptions, createPinoLogger } from "./createPinoLogger";
import { elysiaPino } from "./elysiaPino";
import { DEFAULT_REDACT_PATHS } from "./redaction";

/** A pino destination that captures each written line as parsed JSON. */
function captureLogger(level: pino.Level = "info") {
  const lines: Record<string, unknown>[] = [];
  const dest = {
    write(chunk: string) {
      for (const raw of chunk.split("\n")) {
        if (raw.trim()) lines.push(JSON.parse(raw));
      }
    },
  };
  return { logger: pino({ level }, dest), lines };
}

describe("buildPinoOptions", () => {
  it("redacts the default paths in prod", () => {
    const opts = buildPinoOptions({ isProd: true });
    expect(opts.redact).toEqual([...DEFAULT_REDACT_PATHS]);
  });

  it("does not redact in lower envs", () => {
    const opts = buildPinoOptions({ runEnv: "dev" });
    expect(opts.redact).toBeUndefined();
  });

  it("appends extra redact paths but keeps the defaults", () => {
    const opts = buildPinoOptions({ isProd: true, redact: ["body.ssn"] });
    expect(opts.redact).toEqual([...DEFAULT_REDACT_PATHS, "body.ssn"]);
  });

  it("disableDefaultRedaction drops the built-ins", () => {
    const opts = buildPinoOptions({ isProd: true, disableDefaultRedaction: true, redact: ["body.ssn"] });
    expect(opts.redact).toEqual(["body.ssn"]);
  });

  it("sets base bindings from service/env/version", () => {
    const opts = buildPinoOptions({ service: "ext-thx-elysia", runEnv: "prod", version: "1.2.3", pretty: false });
    expect(opts.base).toEqual({ service: "ext-thx-elysia", env: "prod", version: "1.2.3" });
  });

  it("uses pino-pretty transport in lower envs and plain json in prod", () => {
    expect(buildPinoOptions({ runEnv: "dev" }).transport).toMatchObject({ target: "pino-pretty" });
    expect(buildPinoOptions({ isProd: true }).transport).toBeUndefined();
  });
});

describe("createPinoLogger", () => {
  it("returns a working pino logger with a child()", () => {
    const log = createPinoLogger({ isProd: true, service: "svc" });
    expect(typeof log.info).toBe("function");
    expect(typeof log.child).toBe("function");
  });
});

describe("elysiaPino", () => {
  it("decorates ctx.log as a request-scoped child logger", async () => {
    const { logger, lines } = captureLogger();
    const app = new Elysia().use(elysiaPino(logger)).get("/hello", (ctx) => {
      ctx.log.info("in handler");
      return "ok";
    });

    const res = await app.handle(new Request("http://localhost/hello"));
    expect(await res.text()).toBe("ok");

    const handlerLine = lines.find((l) => l.msg === "in handler");
    expect(handlerLine).toBeDefined();
    expect(handlerLine?.method).toBe("GET");
    expect(handlerLine?.path).toBe("/hello");
    expect(typeof handlerLine?.requestId).toBe("string");
  });

  it("reuses an incoming x-request-id header", async () => {
    const { logger, lines } = captureLogger();
    const app = new Elysia().use(elysiaPino(logger)).get("/id", (ctx) => {
      ctx.log.info("tagged");
      return "ok";
    });

    await app.handle(new Request("http://localhost/id", { headers: { "x-request-id": "req-123" } }));
    expect(lines.find((l) => l.msg === "tagged")?.requestId).toBe("req-123");
  });

  it("emits one request-completed line when autoLog is enabled", async () => {
    const { logger, lines } = captureLogger();
    const app = new Elysia().use(elysiaPino(logger, { autoLog: true })).get("/auto", () => "ok");

    await app.handle(new Request("http://localhost/auto"));
    // onAfterResponse runs after handle() resolves — let the queue flush.
    await Bun.sleep(20);

    const summary = lines.find((l) => l.msg === "request completed");
    expect(summary).toBeDefined();
    expect(summary?.method).toBe("GET");
    expect(summary?.path).toBe("/auto");
    expect(typeof summary?.latencyMs).toBe("number");
  });

  it("does not emit a request-completed line when autoLog is off", async () => {
    const { logger, lines } = captureLogger();
    const app = new Elysia().use(elysiaPino(logger)).get("/quiet", () => "ok");

    await app.handle(new Request("http://localhost/quiet"));
    expect(lines.some((l) => l.msg === "request completed")).toBe(false);
  });
});
