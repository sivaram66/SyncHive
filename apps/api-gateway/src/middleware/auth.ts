import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";
import { AppError } from "./error-handler";

export interface AuthPayload {
  userId: string;
  email: string;
}

// Keep JwtPayload as an alias for internal use
type JwtPayload = AuthPayload;

declare global {
  namespace Express {
    interface Request {
      user?: JwtPayload;
    }
  }
}

export function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction
) {
  try {
    // Check Authorization header first
    let token: string | undefined;

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith("Bearer ")) {
      token = authHeader.slice(7);
    }

    // Fall back to query param — needed for SSE (EventSource can't set headers)
    if (!token && req.query.token) {
      token = req.query.token as string;
    }

    if (!token) {
      throw new AppError(401, "UNAUTHORIZED", "No token provided");
    }

    const payload = jwt.verify(token, config.jwtSecret) as JwtPayload;
    req.user = payload;
    next();
  } catch (error) {
    if (error instanceof AppError) {
      next(error);
    } else {
      next(new AppError(401, "UNAUTHORIZED", "Invalid or expired token"));
    }
  }
}