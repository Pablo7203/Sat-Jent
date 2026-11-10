/**
 * Central server logger redacts credential-like context fields before writing structured messages.
 */

import "server-only";

type LogContext = Record<string, boolean | number | string | null | undefined>;
const blockedKeys = /password|secret|token|authorization|cookie|key/i;

function sanitize(context: LogContext = {}): LogContext {
  return Object.fromEntries(
    Object.entries(context).map(([key, value]) => [
      key,
      blockedKeys.test(key) ? "[REDACTED]" : value,
    ]),
  );
}

export const logger = {
  error(message: string, context?: LogContext) {
    console.error(message, sanitize(context));
  },
  info(message: string, context?: LogContext) {
    console.info(message, sanitize(context));
  },
  warn(message: string, context?: LogContext) {
    console.warn(message, sanitize(context));
  },
};
