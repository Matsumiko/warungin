interface LogContext {
  [key: string]: unknown;
}

type LogLevel = "debug" | "info" | "warn" | "error";

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

const MIN_LEVEL: LogLevel = process.env.NODE_ENV === "production" ? "info" : "debug";

function shouldLog(level: LogLevel): boolean {
  return LOG_LEVELS[level] >= LOG_LEVELS[MIN_LEVEL];
}

function formatMessage(level: LogLevel, msg: string, context?: LogContext): string {
  if (process.env.NODE_ENV === "production") {
    return JSON.stringify({
      level,
      msg,
      timestamp: new Date().toISOString(),
      ...context,
    });
  }

  const timestamp = new Date().toISOString().slice(11, 23);
  const ctx = context ? " " + JSON.stringify(context) : "";
  return `[${timestamp}] ${level.toUpperCase().padEnd(5)} ${msg}${ctx}`;
}

export function createLogger(context?: LogContext) {
  return {
    debug(msg: string, ctx?: LogContext): void {
      if (!shouldLog("debug")) return;
      console.debug(formatMessage("debug", msg, { ...context, ...ctx }));
    },
    info(msg: string, ctx?: LogContext): void {
      if (!shouldLog("info")) return;
      console.info(formatMessage("info", msg, { ...context, ...ctx }));
    },
    warn(msg: string, ctx?: LogContext): void {
      if (!shouldLog("warn")) return;
      console.warn(formatMessage("warn", msg, { ...context, ...ctx }));
    },
    error(msg: string, ctx?: LogContext): void {
      if (!shouldLog("error")) return;
      console.error(formatMessage("error", msg, { ...context, ...ctx }));
    },
  };
}

export const logger = createLogger();
