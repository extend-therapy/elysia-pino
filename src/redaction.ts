/**
 * Default redaction paths for the Extend Therapy API.
 *
 * These mirror the fields that carried PII / secrets through request bodies and
 * response envelopes in `ext-thx-elysia`. They are applied by
 * {@link createPinoLogger} only when `isProd` is true (see there), so local logs
 * stay readable. Pass extra paths via `config.redact`, or opt out entirely with
 * `config.disableDefaultRedaction`.
 *
 * Paths use pino's redaction syntax (dot-notation into the logged object).
 */
export const DEFAULT_REDACT_PATHS: readonly string[] = [
  "body.password",
  "body.confirmPassword",
  "body.code",
  "body.familyName",
  "body.businessAddress",
  "result.data.questionnaire",
  "result.data.questionnaires",
];
