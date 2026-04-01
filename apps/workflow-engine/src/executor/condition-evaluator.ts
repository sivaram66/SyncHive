import { createLogger } from "@synchive/logger";

const logger = createLogger({ service: "workflow-engine" });

/**
 * Safely evaluate a condition expression against step output data.
 *
 * Supports simple expressions like:
 * - "output.score >= 7"
 * - "output.status === 'success'"
 * - "output.amount > 1000 && output.currency === 'USD'"
 *
 * Returns true if no condition is set (unconditional edge).
 */
export function evaluateCondition(
  expression: string | null,
  data: Record<string, unknown>
): boolean {
  // No condition = always pass
  if (!expression || expression.trim() === "") {
    return true;
  }

  try {
    // Create a safe evaluation context with only the data available
    const func = new Function(
      ...Object.keys(data),
      `"use strict"; try { return Boolean(${expression}); } catch(e) { return false; }`
    );

    const result = func(...Object.values(data));

    logger.debug(
      { expression, result, dataKeys: Object.keys(data) },
      "Condition evaluated"
    );

    return Boolean(result);
  } catch (error) {
    logger.warn(
      { expression, error: (error as Error).message },
      "Condition evaluation failed, treating as false"
    );
    return false;
  }
}