import { SnapshotNode } from "@synchive/shared-types";
import { resolveConfig } from "./template-resolver";
import { createLogger } from "@synchive/logger";
import { sendEmail } from "./integrations/resend";
import { postSlackMessage } from "./integrations/slack";
import { postDiscordMessage } from "./integrations/discord";
import { callAI } from "./integrations/openai";

const logger = createLogger({ service: "workflow-engine" });

export interface NodeExecutionResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
}

/**
 * Execute a single node with its resolved input data.
 * Routes to the correct handler based on node type.
 */
export async function executeNode(
  node: SnapshotNode,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const resolvedConfig = resolveConfig(
    node.config as Record<string, unknown>,
    input
  );

  logger.debug(
    { nodeId: node.id, nodeType: node.type, nodeName: node.name },
    "Executing node"
  );

  switch (node.type) {
    case "trigger":
    case "webhook":
      return executeTrigger(input);

    case "action":
      return executeAction(resolvedConfig, input);

    case "condition":
      return executeCondition(resolvedConfig, input);

    case "ai":
      return executeAI(resolvedConfig, input);

    case "transformer":
      return executeTransformer(resolvedConfig, input);

    case "loop":
      return executeLoop(resolvedConfig, input);

    case "delay":
      return executeDelay(resolvedConfig);

    default:
      return {
        success: false,
        output: {},
        error: `Unknown node type: ${node.type}`,
      };
  }
}

// ─── TRIGGER ────────────────────────────────────────────────────

async function executeTrigger(
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  return { success: true, output: input };
}

// ─── ACTION ─────────────────────────────────────────────────────

async function executeAction(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const integration = (config.integration as string) ?? "http";
  logger.info({ integration }, "Executing action node");

  switch (integration) {
    case "http":
      return executeHTTP(config);

    case "resend":
    case "email": {
      try {
        const result = await sendEmail({
          from:    config.from    as string | undefined,
          to:      config.to      as string | string[],
          subject: config.subject as string,
          html:    config.html    as string | undefined,
          text:    (config.body ?? config.text) as string | undefined,
        });
        logger.info({ emailId: result.emailId, to: result.to }, "Email sent via Resend");
        return { success: true, output: result as unknown as Record<string, unknown> };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error({ error }, "Resend email failed");
        return { success: false, output: {}, error };
      }
    }

    case "slack": {
      try {
        const result = await postSlackMessage({
          webhookUrl: (config.webhookUrl ?? process.env.SLACK_WEBHOOK_URL) as string | undefined,
          text:       (config.message ?? config.text) as string,
          blocks:     config.blocks   as unknown[] | undefined,
          username:   config.username as string | undefined,
          iconEmoji:  config.iconEmoji as string | undefined,
        });
        logger.info({ channel: result.channel }, "Message posted to Slack");
        return { success: true, output: result as unknown as Record<string, unknown> };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error({ error }, "Slack message failed");
        return { success: false, output: {}, error };
      }
    }

    case "discord": {
      try {
        const result = await postDiscordMessage({
          webhookUrl: config.webhookUrl as string,
          message:    config.message   as string,
          username:   config.username  as string | undefined,
          avatarUrl:  config.avatarUrl as string | undefined,
        });
        logger.info({ messageId: result.messageId }, "Message posted to Discord");
        return { success: true, output: result as unknown as Record<string, unknown> };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error({ error }, "Discord message failed");
        return { success: false, output: {}, error };
      }
    }

    default:
      // Generic — log and return input so downstream nodes can continue
      logger.warn({ integration }, "Unknown integration, passing through input");
      return {
        success: true,
        output: { integration, executed: true, input, executedAt: new Date().toISOString() },
      };
  }
}

// ─── HTTP ────────────────────────────────────────────────────────

async function executeHTTP(
  config: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const method = ((config.method as string) || "GET").toUpperCase();
  const url = config.url as string;

  if (!url) {
    return { success: false, output: {}, error: "HTTP action requires a 'url' in config" };
  }

  const headers: Record<string, string> = {
    "User-Agent": "SyncHive/1.0",
    ...(config.headers as Record<string, string> || {}),
  };

  const hasBody = ["POST", "PUT", "PATCH"].includes(method);
  if (hasBody && !headers["Content-Type"] && !headers["content-type"]) {
    headers["Content-Type"] = "application/json";
  }

  const requestBody = hasBody && config.body ? JSON.stringify(config.body) : undefined;
  logger.info({ method, url, hasBody: !!requestBody }, "Making HTTP request");

  const startTime = Date.now();

  try {
    const response = await fetch(url, { method, headers, body: requestBody });
    const durationMs = Date.now() - startTime;
    const contentType = response.headers.get("content-type") || "";

    let responseBody: unknown;
    if ((config.responseType as string) === "text" || !contentType.includes("application/json")) {
      responseBody = await response.text();
    } else {
      try { responseBody = await response.json(); }
      catch { responseBody = await response.text(); }
    }

    const output: Record<string, unknown> = {
      statusCode:  response.status,
      statusText:  response.statusText,
      headers:     Object.fromEntries(response.headers.entries()),
      body:        responseBody,
      durationMs,
      url,
      method,
      requestedAt: new Date().toISOString(),
    };

    if (response.ok) {
      logger.info({ statusCode: response.status, durationMs, url }, "HTTP request succeeded");
      return { success: true, output };
    } else {
      logger.warn({ statusCode: response.status, durationMs, url }, "HTTP request returned non-2xx");
      return { success: false, output, error: `HTTP ${response.status} ${response.statusText}` };
    }
  } catch (error) {
    const durationMs = Date.now() - startTime;
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error({ error: errorMsg, url, method, durationMs }, "HTTP request failed");
    return {
      success: false,
      output: { url, method, durationMs, requestedAt: new Date().toISOString() },
      error: `HTTP request failed: ${errorMsg}`,
    };
  }
}

// ─── CONDITION ───────────────────────────────────────────────────

async function executeCondition(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const expression = config.expression as string;
  const { evaluateCondition } = await import("./condition-evaluator");
  const result = evaluateCondition(expression, input);
  return {
    success: true,
    output: {
      ...input,
      conditionResult:      result,
      evaluatedExpression:  expression,
      branch:               result ? (config.trueLabel ?? "true") : (config.falseLabel ?? "false"),
    },
  };
}

// ─── AI (OpenAI) ─────────────────────────────────────────────────

async function executeAI(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const model = (config.model as string) ?? "llama-3.3-70b-versatile";
  const prompt = config.prompt as string;

  logger.info({ model, promptLength: prompt?.length }, "Executing AI node");

  try {
    const result = await callAI({
      model,
      systemPrompt: config.systemPrompt as string | undefined,
      prompt,
      temperature:  config.temperature as number | undefined,
      maxTokens:    config.maxTokens   as number | undefined,
    });

    logger.info(
      { model: result.model, totalTokens: result.usage.totalTokens, finishReason: result.finishReason },
      "AI node completed"
    );

    return {
      success: true,
      output: {
        ...result,
        input,   // pass through so downstream nodes can reference original data too
      },
    };
  } catch (err) {
    const error = err instanceof Error ? err.message : String(err);
    logger.error({ error, model }, "AI node failed");
    return { success: false, output: { model, input }, error };
  }
}

// ─── TRANSFORMER ─────────────────────────────────────────────────

async function executeTransformer(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const operation = (config.operation ?? config.transformType) as string;

  switch (operation) {
    case "pick": {
      const fields = (config.fields ?? Object.keys(config.mapping ?? {})) as string[];
      const picked: Record<string, unknown> = {};
      for (const field of fields) {
        if (field in input) picked[field] = input[field];
      }
      return { success: true, output: picked };
    }

    case "rename": {
      // mapping: { newKey: "{{oldKey}}" } or { oldKey: "newKey" } (config.mappings)
      const mapping = (config.mapping ?? config.mappings) as Record<string, string>;
      const renamed: Record<string, unknown> = { ...input };
      for (const [from, to] of Object.entries(mapping ?? {})) {
        if (from in renamed) {
          renamed[to] = renamed[from];
          delete renamed[from];
        }
      }
      return { success: true, output: renamed };
    }

    case "merge": {
      const mergeData = (config.mergeData ?? config.mapping) as Record<string, unknown>;
      return { success: true, output: { ...input, ...(mergeData ?? {}) } };
    }

    case "filter": {
      // Filters an array in input
      const arrayKey = config.arrayKey as string | undefined ?? Object.keys(input).find(k => Array.isArray(input[k]));
      if (!arrayKey || !Array.isArray(input[arrayKey])) {
        return { success: false, output: {}, error: `Transformer(filter): no array found at key "${arrayKey}"` };
      }
      const expression = config.expression as string;
      if (!expression) {
        return { success: false, output: {}, error: "Transformer(filter): requires an 'expression' to filter by" };
      }
      const { evaluateCondition } = await import("./condition-evaluator");
      const arr = input[arrayKey] as unknown[];
      const filtered = arr.filter((item) => {
        return evaluateCondition(expression, { item, index: arr.indexOf(item), ...input });
      });
      return { success: true, output: { ...input, [arrayKey]: filtered, filteredCount: filtered.length } };
    }

    case "map": {
      const arrayKey = config.arrayKey as string | undefined ?? Object.keys(input).find(k => Array.isArray(input[k]));
      if (!arrayKey || !Array.isArray(input[arrayKey])) {
        return { success: false, output: {}, error: `Transformer(map): no array found at key "${arrayKey}"` };
      }
      const mapping = config.mapping as Record<string, string>;
      if (!mapping) {
        return { success: false, output: {}, error: "Transformer(map): requires a 'mapping' object" };
      }
      const arr = input[arrayKey] as Record<string, unknown>[];
      const mapped = arr.map((item) => {
        const result: Record<string, unknown> = {};
        for (const [newKey, template] of Object.entries(mapping)) {
          result[newKey] = template.replace(/\{\{(\w+)\}\}/g, (_, k) => String(item[k] ?? ""));
        }
        return result;
      });
      return { success: true, output: { ...input, [arrayKey]: mapped } };
    }

    case "custom": {
      // Evaluate a custom JS expression — expression receives `input` and must return an object
      const expression = config.expression as string;
      if (!expression) {
        return { success: false, output: {}, error: "Transformer(custom): requires an 'expression'" };
      }
      try {
        const fn = new Function("input", `"use strict"; return (${expression})`);
        const result = fn(input) as Record<string, unknown>;
        return { success: true, output: result ?? input };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        return { success: false, output: input, error: `Transformer(custom) error: ${error}` };
      }
    }

    default:
      // No-op — pass input through
      logger.warn({ operation }, "Unknown transformer operation, passing through input");
      return { success: true, output: input };
  }
}

// ─── LOOP ────────────────────────────────────────────────────────

async function executeLoop(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  // arrayPath supports both direct key names and {{variable}} template syntax
  const arrayPath = (config.arrayPath ?? config.iterateOver) as string;
  const itemVar   = (config.itemVar   ?? "item")             as string;
  const maxIter   = Math.min(Number(config.maxIterations ?? 100), 1000);

  if (!arrayPath) {
    return { success: false, output: {}, error: "Loop: 'arrayPath' is required in config" };
  }

  // Resolve the array from input — strip {{ }} if present
  const resolvedKey = arrayPath.replace(/^\{\{|\}\}$/g, "").trim();
  const items = input[resolvedKey];

  if (!Array.isArray(items)) {
    return {
      success: false,
      output: {},
      error: `Loop: expected array at '${resolvedKey}', got ${typeof items}`,
    };
  }

  const limited = items.slice(0, maxIter);

  // Emit per-item context — downstream nodes see each item via {{item}} template
  // Full loop sub-node execution is handled by the DAG engine (future enhancement)
  const results = limited.map((item, index) => ({
    [itemVar]: item,
    index,
    ...input,
  }));

  return {
    success: true,
    output: {
      items:          limited,
      itemCount:      limited.length,
      totalCount:     items.length,
      truncated:      items.length > maxIter,
      iteratedOver:   resolvedKey,
      [itemVar]:      limited[0] ?? null,    // convenience: first item for downstream
      loopResults:    results,
    },
  };
}

// ─── DELAY ──────────────────────────────────────────────────────

async function executeDelay(config: Record<string, unknown>): Promise<NodeResult> {
  const unit   = String(config.unit   ?? "seconds");
  const amount = Number(config.amount ?? 5);

  const multiplier: Record<string, number> = {
    ms:      1,
    seconds: 1_000,
    minutes: 60_000,
    hours:   3_600_000,
  };

  const delayMs = amount * (multiplier[unit] ?? 1_000);

  // Cap at 5 minutes in the worker to avoid blocking; for longer delays
  // the job should be re-queued via BullMQ delay option (future feature).
  const actualMs = Math.min(delayMs, 5 * 60_000);

  const resumedAt = new Date(Date.now() + actualMs).toISOString();
  await new Promise<void>((resolve) => setTimeout(resolve, actualMs));

  return {
    success: true,
    output: {
      delayedMs:  actualMs,
      requestedMs: delayMs,
      resumedAt,
    },
  };
}