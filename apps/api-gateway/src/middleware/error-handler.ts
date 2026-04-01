import { Request, Response, NextFunction } from "express";
import { ZodError } from "zod";
import { createLogger } from "@synchive/logger";
import { ApiResponse } from "@synchive/shared-types";

const logger = createLogger({ service: "api-gateway" });

export class AppError extends Error {
  constructor(
    public statusCode: number,
    public code: string,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function errorHandler(
  err: Error,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  // Zod validation errors
  if (err instanceof ZodError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: "Request validation failed",
        details: {
          issues: err.issues.map((issue) => ({
            path: issue.path.join("."),
            message: issue.message,
          })),
        },
      },
    };
    res.status(400).json(response);
    return;
  }

  // Known application errors
  if (err instanceof AppError) {
    const response: ApiResponse = {
      success: false,
      error: {
        code: err.code,
        message: err.message,
        details: err.details,
      },
    };
    res.status(err.statusCode).json(response);
    return;
  }

  // Unknown errors — log full stack, return generic message
  logger.error(
    { error: err.message, stack: err.stack },
    "Unhandled error"
  );

  const response: ApiResponse = {
    success: false,
    error: {
      code: "INTERNAL_ERROR",
      message: "An unexpected error occurred",
    },
  };
  res.status(500).json(response);
}