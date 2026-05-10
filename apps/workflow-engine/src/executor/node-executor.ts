import { SnapshotNode } from "@synchive/shared-types";
import { resolveConfig } from "./template-resolver";
import { createLogger } from "@synchive/logger";
import { sendEmail } from "./integrations/resend";
import { postSlackMessage } from "./integrations/slack";

const logger = createLogger({ service: "workflow-engine" });

export interface NodeExecutionResult {
  success: boolean;
  output: Record<string, unknown>;
  error?: string;
}

/**
 * Execute a single node with its resolved input data.
 * This is the integration dispatch layer — routes to the correct
 * handler based on node type.
 */
export async function executeNode(
  node: SnapshotNode,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  // Resolve templates in node config against input data
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

    default:
      return {
        success: false,
        output: {},
        error: `Unknown node type: ${node.type}`,
      };
  }
}

// ==================== NODE TYPE HANDLERS ====================

async function executeTrigger(
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  return { success: true, output: input };
}

async function executeAction(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const integration = config.integration as string;
  logger.info({ integration }, "Executing action node");

  switch (integration) {
    case "http":
      return executeHTTP(config);

    case "resend":
    case "email": {
      try {
        const result = await sendEmail({
          from: config.from as string | undefined,
          to: config.to as string | string[],
          subject: config.subject as string,
          html: config.html as string | undefined,
          text: config.text as string | undefined,
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
          webhookUrl: config.webhookUrl as string | undefined,
          text: config.text as string,
          blocks: config.blocks as unknown[] | undefined,
          username: config.username as string | undefined,
          iconEmoji: config.iconEmoji as string | undefined,
        });
        logger.info({ channel: result.channel }, "Message posted to Slack");
        return { success: true, output: result as unknown as Record<string, unknown> };
      } catch (err) {
        const error = err instanceof Error ? err.message : String(err);
        logger.error({ error }, "Slack message failed");
        return { success: false, output: {}, error };
      }
    }

    default:
      return {
        success: true,
        output: {
          integration,
          executed: true,
          input,
          executedAt: new Date().toISOString(),
        },
      };
  }
}

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
      statusCode: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
      body: responseBody,
      durationMs,
      url,
      method,
      requestedAt: new Date().toISOString(),
    };

    if (response.ok) {
      logger.info({ statusCode: response.status, durationMs, url }, "HTTP request succeeded");
      return { success: true, output };
    } else {
      logger.warn({ statusCode: response.status, durationMs, url }, "HTTP request returned non-2xx status");
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

async function executeCondition(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const expression = config.expression as string;
  const { evaluateCondition } = await import("./condition-evaluator");
  const result = evaluateCondition(expression, input);
  return {
    success: true,
    output: { ...input, conditionResult: result, evaluatedExpression: expression },
  };
}

async function executeAI(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const model = config.model as string;
  const prompt = config.prompt as string;
  logger.info({ model, promptLength: prompt?.length }, "Executing AI node");
  return {
    success: true,
    output: {
      model,
      response: `Simulated AI response for prompt: "${prompt?.substring(0, 50)}..."`,
      tokensUsed: 150,
      completedAt: new Date().toISOString(),
    },
  };
}

async function executeTransformer(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const transformType = config.transformType as string;
  switch (transformType) {
    case "pick": {
      const fields = config.fields as string[];
      const picked: Record<string, unknown> = {};
      for (const field of fields || []) {
        if (field in input) picked[field] = input[field];
      }
      return { success: true, output: picked };
    }
    case "merge": {
      const mergeData = config.mergeData as Record<string, unknown>;
      return { success: true, output: { ...input, ...mergeData } };
    }
    case "rename": {
      const mappings = config.mappings as Record<string, string>;
      const renamed: Record<string, unknown> = { ...input };
      for (const [from, to] of Object.entries(mappings || {})) {
        if (from in renamed) { renamed[to] = renamed[from]; delete renamed[from]; }
      }
      return { success: true, output: renamed };
    }
    default:
      return { success: true, output: input };
  }
}

async function executeLoop(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const iterateOver = config.iterateOver as string;
  const items = input[iterateOver];
  if (!Array.isArray(items)) {
    return { success: false, output: {}, error: `Expected array at '${iterateOver}', got ${typeof items}` };
  }
  return { success: true, output: { items, itemCount: items.length, iteratedOver: iterateOver } };
}