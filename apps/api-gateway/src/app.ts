import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { config } from "./config";
import { errorHandler } from "./middleware/error-handler";
import { authRouter } from "./routes/auth.routes";
import { workflowRouter } from "./routes/workflow.routes";
import { webhookRouter } from "./routes/webhook.routes";
import { healthRouter } from "./routes/health.routes";

export const app = express();

// --------------- Security middleware ---------------
app.use(helmet());
app.use(
  cors({
    origin: config.corsOrigin,
    credentials: true, // allow cookies
  })
);

// --------------- Parsing middleware ---------------
app.use(express.json({ limit: "10mb" })); // webhook payloads can be large
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// --------------- Request logging ---------------
app.use(
  morgan("short", {
    skip: (req) => req.url === "/health", // don't log health checks
  })
);

// --------------- Routes ---------------
app.use("/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/workflows", workflowRouter);
app.use("/hooks", webhookRouter);

// --------------- Error handling ---------------
app.use(errorHandler);