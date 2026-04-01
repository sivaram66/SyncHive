import { SnapshotNode } from "@synchive/shared-types";
import { resolveConfig } from "./template-resolver";
import { createLogger } from "@synchive/logger";

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

/**
 * Trigger nodes simply pass through the trigger data as output.
 * They're the entry point — their "execution" is just forwarding.
 */
async function executeTrigger(
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  return {
    success: true,
    output: input,
  };
}

/**
 * Action nodes perform side effects — send emails, HTTP calls, etc.
 * For now, simulates the action and returns mock output.
 * The integrations service will handle real execution later.
 */
async function executeAction(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const integration = config.integration as string;

  logger.info({ integration, config }, "Executing action node");

  // Simulated execution — will be replaced by real integration calls
  switch (integration) {
    case "email":
      return {
        success: true,
        output: {
          emailId: `email-${Date.now()}`,
          to: config.to,
          subject: config.subject,
          delivered: true,
          sentAt: new Date().toISOString(),
        },
      };

    case "slack":
      return {
        success: true,
        output: {
          messageId: `slack-${Date.now()}`,
          channel: config.channel,
          sent: true,
          sentAt: new Date().toISOString(),
        },
      };

    case "http":
      return {
        success: true,
        output: {
          statusCode: 200,
          body: { message: "HTTP request simulated" },
          url: config.url,
          respondedAt: new Date().toISOString(),
        },
      };

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

/**
 * Condition nodes evaluate an expression and return the result.
 * Used for if/else branching in workflows.
 */
async function executeCondition(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const expression = config.expression as string;

  // Use the condition evaluator
  const { evaluateCondition } = await import("./condition-evaluator");
  const result = evaluateCondition(expression, input);

  return {
    success: true,
    output: {
      ...input,
      conditionResult: result,
      evaluatedExpression: expression,
    },
  };
}

/**
 * AI nodes call language models. Simulated for now.
 * Will integrate with providers like OpenAI, Anthropic, Groq later.
 */
async function executeAI(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const model = config.model as string;
  const prompt = config.prompt as string;

  logger.info({ model, promptLength: prompt?.length }, "Executing AI node");

  // Simulated AI response — will be replaced by real API calls
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

/**
 * Transformer nodes manipulate data — filter, map, reshape.
 * Executes a transformation expression on the input.
 */
async function executeTransformer(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const transformType = config.transformType as string;

  switch (transformType) {
    case "pick":
      // Pick specific fields from input
      const fields = config.fields as string[];
      const picked: Record<string, unknown> = {};
      for (const field of fields || []) {
        if (field in input) {
          picked[field] = input[field];
        }
      }
      return { success: true, output: picked };

    case "merge":
      // Merge additional data into input
      const mergeData = config.mergeData as Record<string, unknown>;
      return { success: true, output: { ...input, ...mergeData } };

    case "rename":
      // Rename fields
      const mappings = config.mappings as Record<string, string>;
      const renamed: Record<string, unknown> = { ...input };
      for (const [from, to] of Object.entries(mappings || {})) {
        if (from in renamed) {
          renamed[to] = renamed[from];
          delete renamed[from];
        }
      }
      return { success: true, output: renamed };

    default:
      return { success: true, output: input };
  }
}

/**
 * Loop nodes iterate over an array in the input.
 * Simplified version — processes items sequentially.
 */
async function executeLoop(
  config: Record<string, unknown>,
  input: Record<string, unknown>
): Promise<NodeExecutionResult> {
  const iterateOver = config.iterateOver as string;
  const items = input[iterateOver];

  if (!Array.isArray(items)) {
    return {
      success: false,
      output: {},
      error: `Expected array at '${iterateOver}', got ${typeof items}`,
    };
  }

  return {
    success: true,
    output: {
      items,
      itemCount: items.length,
      iteratedOver: iterateOver,
    },
  };
}