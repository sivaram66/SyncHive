import { Router, Request, Response } from "express";

export const healthRouter = Router();

healthRouter.get("/", (_req: Request, res: Response) => {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    service: "api-gateway",
  });
});

// ── Keep-alive ping ────────────────────────────────────────────
// Hit this every 5 minutes from UptimeRobot / BetterUptime / cron-job.org
// to prevent Render free tier from sleeping.
//
// HEAD /health/ping  → no response body (fastest possible, ~1ms)
// GET  /health/ping  → tiny JSON (for browser-based monitors)
//
// Uptime monitor URL: https://your-app.onrender.com/health/ping

healthRouter.head("/ping", (_req: Request, res: Response) => {
  res.status(200).end();
});

healthRouter.get("/ping", (_req: Request, res: Response) => {
  res.status(200).json({ alive: true, ts: Date.now() });
});