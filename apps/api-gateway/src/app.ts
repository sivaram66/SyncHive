import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import path from "path";
import { fileURLToPath } from "url";
import { config } from "./config";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { workflowRouter } from "./routes/workflow.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { healthRouter } from "./routes/health.routes";
import { executionRouter } from "./routes/execution.routes";
import { schedulerRouter } from "./routes/scheduler.routes";

const __filename = fileURLToPath(import.meta.url);
const __dirname  = path.dirname(__filename);

// In production (Docker), public is at apps/api-gateway/public
// __dirname is either .../src or .../dist — both are one level deep
const frontendPublicPath = path.join(__dirname, "..", "public");

export const app = express();

// --------------- Security middleware ---------------
app.use(helmet({
  contentSecurityPolicy: false, // allow Vite assets
}));
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true,
  })
);

// --------------- Rate limiters ---------------
// Auth routes: 20 requests per 15 minutes per IP
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "TOO_MANY_REQUESTS", message: "Too many auth attempts, please try again later" },
});

// Webhook routes: 120 requests per minute per IP
const webhookLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "TOO_MANY_REQUESTS", message: "Webhook rate limit exceeded" },
});

// General API: 300 requests per minute per IP
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, error: "TOO_MANY_REQUESTS", message: "API rate limit exceeded" },
});

// --------------- Parsing middleware ---------------
// Store raw body for HMAC signature verification on webhooks
app.use(
  express.json({
    limit: "10mb",
    verify: (req: any, _res, buf) => {
      req.rawBody = buf;
    },
  })
);
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------- Request logging ---------------
app.use(
  morgan("short", {
    skip: (req) => req.url === "/health",
  })
);

// --------------- API Routes (always matched first) ---------------
app.use("/health",          healthRouter);
app.use("/api/auth",        authLimiter, authRouter);
app.use("/api/workflows",   apiLimiter, workflowRouter);
app.use("/api/executions",  apiLimiter, executionRouter);
app.use("/api/scheduler",   apiLimiter, schedulerRouter);
app.use("/hooks",           webhookLimiter, webhookRouter);

// --------------- Serve built React frontend ---------------
// The Vite build output is placed in apps/api-gateway/public during Docker build
app.use(express.static(frontendPublicPath));

// --------------- SPA Fallback (fixes page refresh) ---------------
// Any route that is NOT an API route returns index.html so React Router handles it
// Note: Express 5 uses {*path} syntax — bare '*' was removed in path-to-regexp v8
app.get("/{*path}", (req, res, next) => {
  if (
    req.path.startsWith("/api") ||
    req.path.startsWith("/hooks") ||
    req.path.startsWith("/health")
  ) {
    return next();
  }

  res.sendFile(path.join(frontendPublicPath, "index.html"), (err) => {
    if (err) {
      // In dev mode the public folder may not exist — that's fine
      res.status(200).send("SyncHive API running. Frontend not bundled in dev mode.");
    }
  });
});

// --------------- Error handling ---------------
app.use(errorHandler);