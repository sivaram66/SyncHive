# SyncHive — Workflow Automation Engine

<p align="center">
  <img src="https://img.shields.io/badge/TypeScript-5.x-3178C6?style=flat-square&logo=typescript" />
  <img src="https://img.shields.io/badge/React-18-61DAFB?style=flat-square&logo=react" />
  <img src="https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=nodedotjs" />
  <img src="https://img.shields.io/badge/PostgreSQL-Neon-4169E1?style=flat-square&logo=postgresql" />
  <img src="https://img.shields.io/badge/Redis-BullMQ-DC382D?style=flat-square&logo=redis" />
</p>

<p align="center">
  Build, deploy, and monitor complex workflow automations with a visual DAG editor.
  Trigger on webhooks, schedules, or manual clicks — chain AI, HTTP, Slack, and email actions together.
</p>

---

## What is SyncHive?

SyncHive is a self-hosted workflow automation platform similar to Zapier or n8n, built from scratch with a production-grade architecture. It lets you:

- **Build** multi-step automations visually on a canvas
- **Trigger** workflows via webhooks (GitHub, Stripe, any service), cron schedules, or manually
- **Execute** AI inference (Llama 3.3 via Groq), HTTP requests, Slack messages, emails
- **Monitor** every execution and step in real-time with SSE streaming

---

## Architecture

```
┌─────────────────┐    REST/WebSocket    ┌──────────────────────┐
│   Web (React)   │ ◄──────────────────► │   API Gateway        │
│   Vite · port 3000                     │   Express · port 4000│
└─────────────────┘    SSE stream        └──────────┬───────────┘
                                                     │ BullMQ job
                                          ┌──────────▼───────────┐
                                          │  Workflow Engine      │
                                          │  BullMQ worker        │
                                          └──────────┬───────────┘
                                                     │ Redis pub/sub
                                          ┌──────────▼───────────┐
                                          │     Scheduler         │
                                          │  Cron job manager     │
                                          └──────────────────────┘
                                                     │
                                    ┌────────────────┴────────────────┐
                                    │         Shared Packages         │
                                    │  db · queue · logger · types    │
                                    └─────────────────────────────────┘
```

### Apps

| App | Purpose | Port |
|-----|---------|------|
| `apps/web` | React + Vite frontend — visual workflow editor | 3000 |
| `apps/api-gateway` | Express REST API + webhook receiver | 4000 |
| `apps/workflow-engine` | BullMQ worker — executes workflow DAGs | — |
| `apps/Scheduler` | Cron job manager — fires scheduled workflows | — |

### Packages

| Package | Purpose |
|---------|---------|
| `packages/db` | Drizzle ORM schema + Neon PostgreSQL client |
| `packages/queue` | BullMQ job producers, Redis pub/sub |
| `packages/logger` | Pino structured logging |
| `packages/shared-types` | TypeScript interfaces shared across all apps |
| `packages/telemetry` | OpenTelemetry distributed tracing |

---

## Node Types

| Type | Description |
|------|-------------|
| **Trigger** | Entry point — webhook, schedule (cron), or manual |
| **Action** | HTTP request, Email (Resend), Slack, Discord |
| **AI** | LLM inference via Groq (Llama 3.3, Gemma 2, Mixtral) — free |
| **Condition** | JavaScript expression evaluator for branching |
| **Transformer** | Pick, rename, merge, filter, map data between steps |
| **Loop** | Iterate over an array of items |

---

## Getting Started

### Prerequisites

- Node.js 20+
- A [Neon](https://neon.tech) PostgreSQL database (free tier)
- An [Upstash](https://upstash.com) Redis instance (free tier)
- A [Groq](https://console.groq.com) API key (free)

### 1. Clone and install

```bash
git clone https://github.com/sivaram66/SyncHive.git
cd SyncHive
npm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env` with your credentials:

```env
DATABASE_URL=postgresql://...
REDIS_URL=rediss://...
JWT_SECRET=your-secret-key

GROQ_API_KEY=gsk_...
RESEND_API_KEY=re_...
SLACK_WEBHOOK_URL=https://hooks.slack.com/...  # optional
```

### 3. Push database schema

```bash
npx drizzle-kit push
```

This creates all the tables in your Neon PostgreSQL database. Only needed once on first setup.

### 4. Run all services

```bash
npm run dev
```

This starts all 4 apps simultaneously via Turborepo:
- Web → http://localhost:3000
- API Gateway → http://localhost:4000

---

## Real-World Example: GitHub Star → Email Notification

1. Create a new workflow in SyncHive
2. Add a **Trigger** node → type: Webhook → path: `/hooks/github-star`
3. Add an **AI** node → prompt: `Write a celebratory message: {{triggerData.body.sender.login}} starred {{triggerData.body.repository.name}}`
4. Add an **Email** node → To: your email, Body: `{{nodes.AI_NODE.output.content}}`
5. Connect: Trigger → AI → Email
6. Click **Activate**
7. Use [ngrok](https://ngrok.com) to expose your local port: `ngrok http 4000`
8. Register the ngrok URL on GitHub: Repo Settings → Webhooks → `https://xxx.ngrok.io/hooks/github-star`
9. Star the repo — email arrives in seconds ⭐

---

## Tech Stack

| Category | Technology |
|----------|-----------|
| Frontend | React 18, Vite, React Flow, Zustand, CSS Modules |
| Backend | Node.js, Express, Drizzle ORM, JWT, bcrypt |
| Queue | BullMQ on Redis (Upstash) |
| Database | PostgreSQL (Neon serverless) |
| AI | Groq API — Llama 3.3 70B, Gemma 2, Mixtral |
| Email | Resend API |
| Tracing | OpenTelemetry → Honeycomb |
| Monorepo | Turborepo |

---

## Key Design Decisions

- **Frozen version snapshots** — Activating a workflow creates an immutable JSON snapshot. Edits never break running executions.
- **Append-only step records** — Each retry attempt creates a new DB row. Full audit trail always preserved.
- **Deterministic job IDs** — `exec-{executionId}` prevents duplicate webhook triggers from running twice.
- **`Promise.allSettled`** — Parallel node branches don't abort each other on failure.
- **Redis pub/sub for SSE** — Engine publishes events, gateway streams them to browser. Fully decoupled.
- **JWT in query param for SSE** — `EventSource` API can't set custom headers; token goes in `?token=`.

---


