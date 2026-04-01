import pino, { Logger, LoggerOptions } from "pino";

interface CreateLoggerOptions {
  service: string; // which microservice is logging
  environment?: string;
}

export function createLogger(options: CreateLoggerOptions): Logger {
  const isDev = (options.environment || process.env.NODE_ENV) !== "production";

  const loggerOptions: LoggerOptions = {
    level: process.env.LOG_LEVEL || (isDev ? "debug" : "info"),

    // Base fields attached to EVERY log line from this service
    base: {
      service: options.service,
      env: options.environment || process.env.NODE_ENV || "development",
    },

    // Standardize timestamp format
    timestamp: pino.stdTimeFunctions.isoTime,

    // Pretty print in development, JSON in production
    ...(isDev && {
      transport: {
        target: "pino-pretty",
        options: {
          colorize: true,
          translateTime: "HH:MM:ss",
          ignore: "pid,hostname",
          singleLine: false,
        },
      },
    }),
  };

  return pino(loggerOptions);
}