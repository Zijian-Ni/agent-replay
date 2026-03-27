import type { RedactionRule } from "../types.js";

const DEFAULT_RULES: RedactionRule[] = [
  {
    name: "api_key",
    pattern: /(?:sk|pk|api[_-]?key)[_-][\w-]{20,}/gi,
    replacement: "[REDACTED_API_KEY]",
  },
  {
    name: "bearer_token",
    pattern: /Bearer\s+[\w\-.~+/]+=*/gi,
    replacement: "Bearer [REDACTED]",
  },
  {
    name: "authorization_header",
    pattern: /(?:authorization|x-api-key|api-key)["']?\s*[:=]\s*["']?[\w\-.~+/]+=*["']?/gi,
    replacement: "[REDACTED_AUTH]",
  },
  {
    name: "email",
    pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
    replacement: "[REDACTED_EMAIL]",
  },
  {
    name: "credit_card",
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    replacement: "[REDACTED_CC]",
  },
  {
    name: "ssn",
    pattern: /\b\d{3}-\d{2}-\d{4}\b/g,
    replacement: "[REDACTED_SSN]",
  },
  {
    name: "phone",
    pattern: /(?:\+?1[-.\s]?)?(?:\(?\d{3}\)?[-.\s]?)?\d{3}[-.\s]?\d{4}/g,
    replacement: "[REDACTED_PHONE]",
  },
];

/** Redacts sensitive data from trace inputs/outputs */
export class Redactor {
  private rules: RedactionRule[];

  constructor(customPatterns?: RegExp[]) {
    this.rules = [...DEFAULT_RULES];
    if (customPatterns) {
      for (let i = 0; i < customPatterns.length; i++) {
        this.rules.push({
          name: `custom_${i}`,
          pattern: customPatterns[i]!,
          replacement: "[REDACTED]",
        });
      }
    }
  }

  /** Redact sensitive data from a value (deep clone + redact strings) */
  redact(value: unknown): unknown {
    return this.redactValue(value, new WeakSet());
  }

  /** Add a custom redaction rule */
  addRule(rule: RedactionRule): void {
    this.rules.push(rule);
  }

  /** Get all active rules */
  getRules(): ReadonlyArray<RedactionRule> {
    return this.rules;
  }

  private redactValue(value: unknown, seen: WeakSet<object>): unknown {
    if (value === null || value === undefined) return value;

    if (typeof value === "string") {
      return this.redactString(value);
    }

    if (typeof value !== "object") return value;

    if (seen.has(value as object)) return "[Circular]";
    seen.add(value as object);

    if (Array.isArray(value)) {
      return value.map((item) => this.redactValue(item, seen));
    }

    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      const lowerKey = key.toLowerCase();
      if (
        lowerKey.includes("password") ||
        lowerKey.includes("secret") ||
        lowerKey.includes("token") ||
        lowerKey.includes("apikey") ||
        lowerKey.includes("api_key")
      ) {
        result[key] = "[REDACTED]";
      } else {
        result[key] = this.redactValue(val, seen);
      }
    }
    return result;
  }

  private redactString(value: string): string {
    let result = value;
    for (const rule of this.rules) {
      result = result.replace(rule.pattern, rule.replacement);
    }
    return result;
  }
}
