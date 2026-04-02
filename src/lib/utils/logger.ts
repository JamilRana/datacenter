// lib/utils/logger.ts

enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

interface LogContext {
  userId?: string;
  requestId?: string;
  [key: string]: unknown;
}

class Logger {
  private level: LogLevel = LogLevel.INFO;
  private isProduction: boolean;

  constructor() {
    this.isProduction = process.env.NODE_ENV === "production";
  }

  private formatMessage(level: string, message: string, context?: LogContext): string {
    const timestamp = new Date().toISOString();
    const contextStr = context ? ` ${JSON.stringify(context)}` : "";
    return `[${timestamp}] [${level}] ${message}${contextStr}`;
  }

  debug(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.DEBUG && !this.isProduction) {
      console.debug(this.formatMessage("DEBUG", message, context));
    }
  }

  info(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.INFO) {
      console.info(this.formatMessage("INFO", message, context));
    }
  }

  warn(message: string, context?: LogContext): void {
    if (this.level <= LogLevel.WARN) {
      console.warn(this.formatMessage("WARN", message, context));
    }
  }

  error(message: string, error?: Error, context?: LogContext): void {
    if (this.level <= LogLevel.ERROR) {
      const errorContext = error
        ? { ...context, error: { message: error.message, stack: error.stack } }
        : context;
      console.error(this.formatMessage("ERROR", message, errorContext));
    }
  }

  setLevel(level: LogLevel): void {
    this.level = level;
  }
}

export const logger = new Logger();
export { LogLevel };
