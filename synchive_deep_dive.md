# SyncHive — Complete Codebase Deep Dive

## Repository Layout

```
Synchive/
├── apps/
│   ├── api-gateway        (Node.js + Express, port 4000)
│   ├── workflow-engine    (Node.js + BullMQ worker, no HTTP port)
│   └── web                (React + Vite, port 3000)
│
└── packages/
    ├── db                 (@synchive/db)
    ├── queue              (@synchive/queue)
    ├── logger             (@synchive/logger)
    ├── shared-types       (@synchive/shared-types)
    └── telemetry          (@synchive/telemetry)
```

Managed by **Turborepo**. Both backend apps import from shared packages — one schema definition, used everywhere.

---

## packages/db — The Foundation

### ORM: Drizzle ORM over PostgreSQL (Neon)

`src/schema/` has 4 files that define every table in the system.

### `enums.ts` — All Postgres native enums

```
workflowStatusEnum:   draft | active | paused | archived
nodeTypeEnum:         trigger | action | condition | loop | ai | transformer | webhook
executionStatusEnum:  pending | queued | running | completed | failed | cancelled | timed_out
stepStatusEnum:       pending | running | completed | failed | skipped | retrying | timed_out
triggerTypeEnum:      manual | webhook | cron | event
```

These are **native Postgres enums** (not varchar). The DB enforces them — no invalid string can slip through.

### `users.ts` — Simple user table

```
id (uuid, PK)
email (varchar 255, UNIQUE)
name (varchar 255)
passwordHash (varchar 255)   ← bcrypt, never plaintext
isActive (boolean)
createdAt / updatedAt
```

### `workflows.ts` — 4 tables for workflow storage

**`workflows`** — the header record
```
id, name, description
status (workflowStatusEnum, default: 'draft')
createdBy → users.id
currentVersion (integer, tracks active version number)
```
Indexed on `createdBy` and `status`.

**`workflowVersions`** — the immutability guarantee
```
id, workflowId → workflows (cascade delete)
version (integer)
snapshot (JSONB)     ← full frozen graph lives here
changelog (text)
createdAt
```
This is how a workflow can be edited without breaking a running execution. When you hit Activate, the entire graph is serialized into this JSONB blob. Running executions read ONLY from this frozen snapshot, never from the live node/edge tables.

**`workflowNodes`** — live editable nodes
```
id, workflowId → workflows (cascade)
type (nodeTypeEnum)
name
config (JSONB, default: {})         ← integration-specific settings
position (JSONB, default: {x:0,y:0}) ← React Flow canvas position
retryPolicy (JSONB, default: {maxRetries:0, backoffMs:1000, backoffMultiplier:2})
timeoutMs (integer, default: 30000)
```
Indexed on `workflowId` and `type`.

**`workflowEdges`** — connections between nodes
```
id, workflowId → workflows (cascade)
sourceNodeId → workflowNodes (cascade)
targetNodeId → workflowNodes (cascade)
conditionExpression (text, nullable)   ← for conditional branches
```
Indexed on workflow, source, and target for fast graph lookups. Cascade delete means removing a node auto-removes all its edges.

### `executions.ts` — What happens when a workflow runs

**`workflowExecutions`** — one row per run
```
id, workflowId → workflows (cascade)
versionId → workflowVersions   ← pinned to the snapshot used
status (executionStatusEnum, default: 'pending')
triggerData (JSONB)   ← what started this (webhook body, manual input)
result (JSONB)
error (text)
startedAt / completedAt / createdAt
```

**`stepExecutions`** — one row per node per attempt (append-only)
```
id, executionId → workflowExecutions (cascade)
nodeId → workflowNodes
status (stepStatusEnum, default: 'pending')
input / output (JSONB)
error (text)
attempt (integer, default: 1)   ← KEY: new row for every retry
startedAt / completedAt / createdAt
```

The append-only design for `stepExecutions` is intentional. Failed rows are **never updated**. If a node retries 3 times, there are 3 rows. You get a complete audit trail: `attempt 1 → failed`, `attempt 2 → failed`, `attempt 3 → completed`.

---

## packages/queue — The Nervous System

### Redis connection (`connection.ts`)

Uses **ioredis** (TCP), not the Upstash REST client. BullMQ requires a proper TCP connection — REST silently fails.

```typescript
new IORedis(redisUrl, {
  maxRetriesPerRequest: null,  // required by BullMQ
  enableReadyCheck: false,
  tls: {},                     // for rediss:// (TLS-encrypted TCP to Upstash)
  retryStrategy: (times) => times > 10 ? null : Math.min(times * 200, 5000)
})
```

The connection is a **singleton** — lazy-initialized on first use, reused after that.

### Three queues (`queues.ts`)

```
workflow-execution  — "run this workflow"
step-execution      — "run this individual node"  
dead-letter         — "this job failed all retries, park it forever"
```

Completed jobs are auto-removed after 24 hours (1000 max). Failed jobs are kept 7 days (5000 max). Dead-letter jobs are **never** auto-removed.

BullMQ retry is set to `attempts: 1` — because **the engine handles its own retry logic** with exponential backoff. BullMQ retrying would double-count.

### Job producers (`producers.ts`)

Two exported functions:

```typescript
enqueueExecution(data) → jobId: `exec-${executionId}`
enqueueStep(data)      → jobId: `step-${executionId}-${nodeId}-${attempt}`
```

Deterministic job IDs are critical. If GitHub fires the same webhook twice, BullMQ sees `exec-<same-id>` already exists and **silently drops the duplicate**. No double execution.

Both producers call `injectContext()` from `@synchive/telemetry` before pushing — this serializes the active OTel trace context into the job payload so the engine can continue the same distributed trace.

### pub/sub (`pubsub.ts`)

Redis doubles as a real-time message bus using its native pub/sub.

Channel naming: `synchive:execution:{executionId}`

```typescript
publishExecutionEvent(event)           // engine → Redis
subscribeToExecution(executionId, cb)  // gateway → listens → SSE → browser
```

**Critical detail**: a Redis connection in subscribe mode cannot run other commands. So `createSubscriber()` always opens a **fresh connection**, separate from the shared BullMQ connection. The caller is responsible for calling `subscriber.disconnect()` when done.

### Event types published
```
execution:started | execution:completed | execution:failed
step:started | step:completed | step:failed | step:retrying | step:timed_out
```

---

## packages/logger — Structured Logging

Uses **Pino** — the fastest structured logger for Node.js.

```typescript
createLogger({ service: 'api-gateway' })
```

Every log line gets `service` and `env` as base fields automatically.

- **Development**: pretty-printed with color via `pino-pretty`
- **Production**: raw JSON for log aggregation tools

`createExecutionLogger()` creates a **child logger** pre-bound with `executionId`, `workflowId`, `nodeId`, and `attempt`. Every log from inside an execution automatically includes these fields — no manual passing required.

---

## packages/shared-types — Single Source of Truth for Types

One file: `src/index.ts`. Exported to both backend apps and the frontend.

Key types:
- `WorkflowSnapshot` — the frozen graph: `{ nodes: SnapshotNode[], edges: SnapshotEdge[] }`
- `SnapshotNode` — `{ id, type, name, config, retryPolicy, timeoutMs }`
- `SnapshotEdge` — `{ id, sourceNodeId, targetNodeId, conditionExpression }`
- `ApiResponse<T>` — unified envelope: `{ success, data?, error?, meta? }`
- All status enums as TypeScript union types

---

## packages/telemetry — Distributed Tracing

Uses **OpenTelemetry** SDK, exporting traces to Honeycomb (or any OTLP backend).

### `tracer.ts`

```typescript
getTracer('workflow-engine')  // named per service
```
Each service uses a different scope name — Jaeger/Honeycomb shows which service produced which span.

### `propagation.ts` — The Hard Part

The problem: BullMQ is a queue, not HTTP. There are no headers to carry the W3C TraceContext between the API gateway and the engine. Without intervention, the engine starts a brand-new trace when it picks up a job — the end-to-end trace is broken.

The solution:
```typescript
// In API gateway, before pushing to BullMQ:
injectContext()  → serializes active context into Record<string,string>
                 → stored as `traceContext` in job data

// In worker, before starting spans:
extractContext(job.data.traceContext) → reconstructs Context object
context.with(parentCtx, ...)         → all child spans are under the gateway's span
```

Result: one unbroken trace from HTTP request → queue → execution → each node.

### `span-attributes.ts` — Named constants

```
SpanAttributes.EXECUTION_ID, WORKFLOW_ID, VERSION_ID
SpanAttributes.NODE_ID, NODE_TYPE, NODE_NAME, STEP_ATTEMPT, STEP_STATUS
SpanAttributes.JOB_ID, JOB_QUEUE, EXECUTION_TRIGGER
```
Prevents typos in attribute names across services.

---

## apps/api-gateway — The Public Face

### Startup (`index.ts` → `app.ts`)

1. Imports `./telemetry` first — OTel must initialize before any app code
2. Creates Express app
3. Mounts middleware: `helmet` (security headers), `cors`, `express.json(10mb)`, `cookieParser`, `morgan` (skips `/health` logs)
4. Mounts routes: `/health`, `/api/auth`, `/api/workflows`, `/hooks`, `/api/executions`
5. Mounts error handler last

Config (`config.ts`) uses `requireEnv()` — throws at startup if `DATABASE_URL` or `REDIS_URL` are missing, rather than failing mysteriously at runtime.

### Auth (`routes/auth.routes.ts` + `services/auth.service.ts`)

**Signup flow:**
1. Check if email already exists → 409 if yes
2. `bcrypt.hash(password, 10)` → store hash
3. `jwt.sign({ userId, email }, secret, { expiresIn: '7d' })`
4. Return user + token

**Login flow:**
1. Find user by email → 401 if not found (same error message as wrong password — no user enumeration)
2. Check `isActive` → 403 if disabled
3. `bcrypt.compare(plain, hash)` → 401 if wrong
4. Issue JWT

**Auth middleware (`middleware/auth.ts`):**
- Checks `Authorization: Bearer <token>` header first
- Falls back to `?token=` query param — required because `EventSource` (SSE) cannot set custom headers natively
- On valid token: attaches `req.user = { userId, email }` and calls `next()`
- On invalid: throws `AppError(401)`

### Ownership enforcement pattern

Every single DB query for protected resources uses:
```typescript
where(and(eq(table.id, id), eq(table.createdBy, req.user!.userId)))
```
Even if someone crafts a JWT for user A and tries to access user B's workflow, the `AND createdBy = userId` condition returns nothing. The check is at the query level, not just a middleware check.

### `POST /api/workflows/:id/activate` — The Critical Endpoint

This is where a workflow becomes executable:

1. Load workflow, verify ownership
2. Load all nodes and edges
3. Validate: must have at least one trigger/webhook node
4. Validate: if more than 1 node, must have at least one edge
5. Snapshot: `newVersion = currentVersion + 1`
6. Build `WorkflowSnapshot` object from live nodes/edges
7. `INSERT INTO workflow_versions` with the snapshot as JSONB
8. `UPDATE workflows SET status='active', currentVersion=newVersion`

> Note: steps 7 and 8 are not in a DB transaction currently — if step 8 fails after step 7, you'd have an orphaned version. This is a known limitation.

### `POST /hooks/:webhookPath` — The Webhook Receiver

No auth required — external services (GitHub, Stripe) call this.

1. Extract path → `fullPath = /hooks/${webhookPath}`
2. Load ALL webhook-type nodes, find one where `config.path === fullPath`
3. Verify workflow is `active`
4. Load current version
5. Build `triggerData = { webhookPath, headers, body, receivedAt }`
6. INSERT `workflowExecutions` with `status: 'queued'`
7. `enqueueExecution(...)` → pushes to BullMQ
8. Return `202 Accepted` immediately

Total time: ~30-50ms. GitHub never times out waiting.

### `GET /api/executions/:id/stream` — SSE

The real-time bridge between Redis pub/sub and the browser:

**If execution already finished:**
- Load step rows from DB
- Write them as SSE events (historical replay)
- Write the terminal execution event
- Close the connection

**If execution is still running:**
- Set SSE response headers: `Content-Type: text/event-stream`, `Cache-Control: no-cache`, `Connection: keep-alive`
- Send `{ type: "connected", executionId }` immediately
- `subscribeToExecution(executionId, cb)` — opens a fresh Redis subscriber connection
- Every published event → `res.write('data: ...\n\n')`
- On `execution:completed` or `execution:failed` → `setTimeout(500ms)` then close
- On client disconnect (`req.on('close')`) → `subscriber.disconnect()`
- Safety: 5-minute timeout closes zombie connections

---

## apps/workflow-engine — The Brain

### Startup (`index.ts`)

1. Imports `./env` first (loads `.env`)
2. Imports `./telemetry` (OTel init)
3. Calls `startWorkers()` → creates BullMQ workers

No HTTP server. This process only listens to Redis.

### Worker (`workers/index.ts`)

```typescript
new Worker<ExecutionJobData>('workflow-execution', processExecutionJob, {
  connection: getRedisConnection(),
  concurrency: 5,   // up to 5 workflows running simultaneously
})
```

`processExecutionJob`:
1. Extract `traceContext` from job data
2. `extractContext(traceContext)` → reconstruct OTel context
3. `context.with(parentCtx, ...)` → run inside the gateway's trace
4. Start `workflow-engine.process-job` span (kind: CONSUMER)
5. Call `executeWorkflow(...)`
6. On error: record exception on span, re-throw → BullMQ marks job failed

### DAG Building (`executor/dag.ts`)

**`buildDAG(snapshot)`:**
- Iterates snapshot nodes → creates `DAGNode` with `incomingEdges[]`, `outgoingEdges[]`, `inDegree: 0`
- Iterates snapshot edges → populates the edge lists and increments `inDegree` for each target
- Finds entry nodes (inDegree === 0)
- Returns `{ nodes: Map<id, DAGNode>, entryNodes: string[] }`

**`topologicalSort(dag)` — Kahn's Algorithm:**
```
1. Init queue with all nodes where inDegree === 0
2. While queue has items:
   a. snapshot current queue as currentLevel[]
   b. push currentLevel to levels[]
   c. for each nodeId in currentLevel:
      - reduce inDegree of all downstream nodes
      - if downstream inDegree reaches 0: add to queue
3. If processedCount !== total nodes: CYCLE DETECTED → throw
4. Return levels[][]
```

Result is a 2D array: `[[A], [B, C], [D]]`. Each inner array is a "level" — nodes that can execute in parallel.

**`getNextNodes(dag, completedNodeId, completedSet)`:**
Used for conditional/dynamic routing. After a node completes, checks all its outgoing edges — returns downstream nodes whose ALL incoming dependencies are now satisfied.

### Workflow Executor (`executor/workflow-executor.ts`)

`executeWorkflow({ executionId, workflowId, versionId, triggeredBy, triggerData })`:

1. Update execution → `status: 'running'`, `startedAt: now`
2. Load frozen snapshot from `workflowVersions`
3. `buildDAG(snapshot)` + `topologicalSort(dag)` → get execution levels
4. Init `nodeOutputs = {}`. If `triggerData` present: `nodeOutputs['__trigger__'] = triggerData`
5. For each level:
   ```typescript
   await Promise.allSettled(level.map(nodeId => executeNodeWithSpan(...)))
   ```
   `Promise.allSettled` — not `Promise.all`. Critical: `.all` would abort all parallel branches if one fails. `.allSettled` lets every branch complete regardless.
6. If any settled result has `status: 'rejected'` → set `executionFailed = true`
7. After all levels: update execution to `completed` or `failed`

**`executeNodeWithSpan`:**
The retry loop lives here:
```
for attempt = 1 to maxRetries+1:
  1. Insert stepExecutions row (status: 'running')
  2. Call executeNode(node, nodeOutputs, snapshot)
  3. On success:
     - nodeOutputs[nodeId] = result.output  (downstream nodes can now reference this)
     - Circular-reference-safe JSON serialization
     - Update stepExecutions → 'completed'
     - End span OK
     - return  ← exits retry loop
  4. On failure:
     - If last attempt: update → 'failed', end span ERROR, throw
     - Else: update → 'retrying', compute backoffMs = backoffMs * multiplier^(attempt-1)
             sleep(backoffMs), continue loop
```

### Node Executor (`executor/node-executor.ts`)

`executeNode(node, input, snapshot)`:

1. `resolveConfig(node.config, input)` — resolve `{{templates}}` in config strings
2. Switch on `node.type`:
   - `trigger` / `webhook` → pass-through, output = input
   - `action` → sub-switch on `config.integration`: `http`, `resend`, `slack`, or generic stub
   - `condition` → run the condition evaluator, attach result to output
   - `ai` → currently simulated (returns mock response)
   - `transformer` → pick / merge / rename operations
   - `loop` → validates array, returns item count

### Template Resolver (`executor/template-resolver.ts`)

**`resolveTemplate(template, data)`:**
```
regex: /\{\{([^}]+)\}\}/g
For each match: extract path, call getNestedValue(data, path)
If found: replace with String(value)
If not found: keep original {{placeholder}} intact
```

**`resolveConfig(config, data)`:**
Walks entire config object recursively:
- `string` → run `resolveTemplate`
- `object` → recurse
- `array` → map each element (strings resolved, objects recursed)
- primitive → pass through unchanged

**`getNestedValue(obj, path)`:**
`"sender.login"` → `path.split('.')` → walk object properties → return leaf value or `undefined`.

### Integrations

**Resend (`integrations/resend.ts`):**
- Uses Resend REST API directly with `fetch()` (no SDK dependency)
- Required: `RESEND_API_KEY` env var
- Config: `from`, `to` (string or string[]), `subject`, `html` or `text`
- Validates all required fields before calling API
- Returns `{ emailId, to, subject, sentAt }`
- Throws on non-2xx response with Resend's error body

**Slack (`integrations/slack.ts`):**
- Uses Slack Incoming Webhooks (no OAuth, no bot tokens)
- `webhookUrl` from config, OR falls back to `SLACK_WEBHOOK_URL` env var — allows default channel with per-node overrides
- Supports `text`, `blocks` (Block Kit), `username`, `iconEmoji`
- Extracts channel hint from webhook URL for logging

**HTTP (`node-executor.ts` → `executeHTTP`):**
- Method: GET/POST/PUT/PATCH/DELETE
- Auto-sets `Content-Type: application/json` for body methods
- Tries to parse response as JSON; falls back to text
- Non-2xx → returns `success: false` with error → triggers retry policy
- Output includes `statusCode`, `statusText`, `headers`, `body`, `durationMs`

---

## apps/web — The Visual Interface

### Tech Stack
- **React** + **Vite**
- **React Flow** — the canvas/graph rendering library
- **Zustand** — state management
- **React Router v6** — routing
- **date-fns** — time formatting

### Routing (`App.tsx`)

```
/              → LandingPage   (public)
/login         → LoginPage     (public)
/signup        → SignupPage    (public)

RequireAuth wrapper (checks Zustand token):
  /workflows        → WorkflowsPage
  /workflows/:id    → EditorPage
  /executions       → ExecutionsPage
  /integrations     → PlaceholderPage
  /scheduler        → PlaceholderPage
  /logs             → PlaceholderPage
  /settings         → PlaceholderPage
```

`ThemeSync` component applies `data-theme` attribute to `<html>` on every render based on Zustand theme store.

### `EditorPage.tsx` — The Core UI

The editor page orchestrates everything:

- `useWorkflow(id)` — fetches workflow + nodes + edges
- `useExecutions(id)` — fetches execution history
- `useSSE(activeExecutionId)` — opens EventSource connection to backend

**Activate flow:**
```
handleActivate() → workflowsApi.activate(id) → POST /api/workflows/:id/activate
→ updates workflow status in Zustand store
```

**Execute flow:**
```
handleExecute() → reset() (clears node statuses) 
→ workflowsApi.execute(id) → POST /api/workflows/:id/execute
→ gets executionId back
→ setActiveExecution(executionId) → triggers useSSE to open stream
→ refetchExec() to show new execution in list
```

**Live execution display:**
The panel shows `nodeStatuses` from `useExecutionLiveStore()`. As SSE events come in, Zustand updates. Each node in the canvas reads its own status from the store and animates accordingly.

### `useSSE` hook (`hooks/index.ts`)

```typescript
const url = `/api/executions/${executionId}/stream?token=${token}`
const es = new EventSource(url)
```

`EventSource` can't set custom headers. JWT is passed as `?token=` query param. The auth middleware in the gateway is specifically coded to fall back to `req.query.token` for this reason.

Each incoming `message` event is parsed and dispatched to `applySSEEvent(event)` in the execution live store. That store updates `nodeStatuses` keyed by `nodeId`.

### `WorkflowCanvas.tsx`

Wraps React Flow. Nodes are rendered using `WorkflowNode.tsx`, a custom node component that reads live execution status from the store and applies visual state (running, completed, failed).

---

## The Complete Request Flow (Webhook trigger)

```
1. External service POSTs to /hooks/:path

2. API Gateway (webhook.routes.ts):
   - Find matching webhook node by config.path
   - Verify workflow is active
   - Load current version snapshot
   - INSERT workflowExecutions (status: queued)
   - enqueueExecution() → BullMQ job `exec-{executionId}`
   - Return 202

3. Workflow Engine (workers/index.ts):
   - Worker picks up job from `workflow-execution` queue
   - Extract OTel trace context from job.data.traceContext
   - context.with(parentCtx) → run inside gateway's trace
   - Start `workflow-engine.process-job` span
   - Call executeWorkflow()

4. executeWorkflow (workflow-executor.ts):
   - UPDATE execution → running
   - Load snapshot from workflowVersions
   - buildDAG(snapshot) → adjacency map with inDegrees
   - topologicalSort() → [[triggerNode], [A, B], [C]]
   - nodeOutputs['__trigger__'] = triggerData

5. Level 1 — trigger node:
   - executeNodeWithSpan(triggerNode)
   - INSERT stepExecutions (attempt:1, status:running)
   - executeNode() → type 'webhook' → pass-through → output = triggerData
   - UPDATE stepExecutions → completed, output saved
   - nodeOutputs[triggerNodeId] = triggerData

6. Level 2 — parallel nodes A and B:
   - Promise.allSettled([executeNodeWithSpan(A), executeNodeWithSpan(B)])
   - Each: INSERT stepExecution → executeNode → resolveConfig (templates applied) → integration call → UPDATE stepExecution
   - nodeOutputs[A.id] = A's output
   - nodeOutputs[B.id] = B's output

7. Level 3 — node C:
   - Depends on A and B — only runs after both complete
   - executeNode(C, nodeOutputs) → C can reference {{A.id.someField}} and {{B.id.someField}}

8. After all levels:
   - UPDATE workflowExecutions → completed

9. Throughout: publishExecutionEvent() at each step transition
   → Redis pub/sub → channel: synchive:execution:{id}
   → API gateway subscriber receives events
   → Writes to SSE response stream
   → Browser EventSource receives events
   → Zustand store updates nodeStatuses
   → Canvas nodes animate in real-time
```

---

## Key Design Decisions Summarized

| Decision | What | Why |
|---|---|---|
| Split API + Engine | Two separate processes | API must respond in ms; Engine can run for minutes |
| Redis pub/sub | Engine → Gateway communication | Decoupled; Engine doesn't know Gateway exists |
| Frozen snapshots | WorkflowVersions table | Editing a workflow can't break a running execution |
| Append-only step rows | New row per retry attempt | Complete audit trail, never lose failure history |
| Deterministic job IDs | `exec-{executionId}` | Duplicate webhooks are idempotently dropped |
| `Promise.allSettled` | Parallel node execution | One branch failing doesn't abort sibling branches |
| Token in query param | SSE auth | `EventSource` API doesn't support custom headers |
| Dedicated subscriber connection | Redis pub/sub | A subscribed connection can't run other Redis commands |
| `maxRetriesPerRequest: null` | ioredis config | Required by BullMQ, otherwise it throws on long-running jobs |
| OTel context injection | Trace propagation | BullMQ has no headers; context must be serialized into job data |
| Ownership in every query | `AND createdBy = userId` | Auth bypass at middleware level still can't access other users' data |
