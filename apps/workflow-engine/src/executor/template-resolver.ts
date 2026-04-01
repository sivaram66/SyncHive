/**
 * Resolve mustache-style templates in a string against data.
 *
 * Examples:
 *   resolve("Hello {{name}}", { name: "Siva" }) → "Hello Siva"
 *   resolve("Score: {{output.score}}", { output: { score: 8 } }) → "Score: 8"
 */
export function resolveTemplate(
  template: string,
  data: Record<string, unknown>
): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
    const value = getNestedValue(data, path.trim());

    if (value === undefined || value === null) {
      return match; // keep original placeholder if value not found
    }

    return String(value);
  });
}

/**
 * Resolve all string values in a config object recursively.
 */
export function resolveConfig(
  config: Record<string, unknown>,
  data: Record<string, unknown>
): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(config)) {
    if (typeof value === "string") {
      resolved[key] = resolveTemplate(value, data);
    } else if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      resolved[key] = resolveConfig(value as Record<string, unknown>, data);
    } else if (Array.isArray(value)) {
      resolved[key] = value.map((item) => {
        if (typeof item === "string") return resolveTemplate(item, data);
        if (typeof item === "object" && item !== null)
          return resolveConfig(item as Record<string, unknown>, data);
        return item;
      });
    } else {
      resolved[key] = value;
    }
  }

  return resolved;
}

/**
 * Access a nested property using dot notation.
 * getNestedValue({ a: { b: { c: 42 } } }, "a.b.c") → 42
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  const parts = path.split(".");
  let current: unknown = obj;

  for (const part of parts) {
    if (current === null || current === undefined || typeof current !== "object") {
      return undefined;
    }
    current = (current as Record<string, unknown>)[part];
  }

  return current;
}