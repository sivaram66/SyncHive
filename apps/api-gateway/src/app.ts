import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import rateLimit from "express-rate-limit";
import { config } from "./config";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { workflowRouter } from "./routes/workflow.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { healthRouter } from "./routes/health.routes";
import { executionRouter } from "./routes/execution.routes";

export const app = express();

// --------------- Security middleware ---------------
app.use(helmet());
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

// --------------- Routes ---------------
app.use("/health", healthRouter);
app.use("/api/auth", authLimiter, authRouter);
app.use("/api/workflows", apiLimiter, workflowRouter);
app.use("/api/executions", apiLimiter, executionRouter);
app.use("/hooks", webhookLimiter, webhookRouter);

// --------------- Error handling ---------------
app.use(errorHandler);