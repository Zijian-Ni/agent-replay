import type { Trace, Step, Anomaly } from "../types.js";

/** Detect anomalies in a trace */
export function detectAnomalies(trace: Trace, thresholds?: {
  slowStepMs?: number;
  highCostUsd?: number;
  tokenSpikeMultiplier?: number;
}): Anomaly[] {
  const anomalies: Anomaly[] = [];
  const slowThreshold = thresholds?.slowStepMs ?? 30000;
  const costThreshold = thresholds?.highCostUsd ?? 0.5;
  const tokenMultiplier = thresholds?.tokenSpikeMultiplier ?? 3;

  const allSteps = flattenSteps(trace.steps);
  const avgTokens = allSteps.reduce((sum, s) => sum + (s.tokens?.total ?? 0), 0) / (allSteps.length || 1);
  const errorMessages = new Map<string, number>();

  for (const step of allSteps) {
    // Slow step detection
    if (step.duration && step.duration > slowThreshold) {
      anomalies.push({
        type: "slow_step",
        severity: step.duration > slowThreshold * 3 ? "high" : "medium",
        message: `Step "${step.name}" took ${step.duration}ms (threshold: ${slowThreshold}ms)`,
        stepId: step.id,
        details: { duration: step.duration, threshold: slowThreshold },
      });
    }

    // High cost detection
    if (step.cost && step.cost > costThreshold) {
      anomalies.push({
        type: "high_cost",
        severity: step.cost > costThreshold * 5 ? "high" : "medium",
        message: `Step "${step.name}" cost $${step.cost.toFixed(4)} (threshold: $${costThreshold})`,
        stepId: step.id,
        details: { cost: step.cost, threshold: costThreshold },
      });
    }

    // Token spike detection
    if (step.tokens && avgTokens > 0 && step.tokens.total > avgTokens * tokenMultiplier) {
      anomalies.push({
        type: "token_spike",
        severity: step.tokens.total > avgTokens * tokenMultiplier * 2 ? "high" : "low",
        message: `Step "${step.name}" used ${step.tokens.total} tokens (avg: ${Math.round(avgTokens)})`,
        stepId: step.id,
        details: { tokens: step.tokens.total, average: avgTokens },
      });
    }

    // Error tracking
    if (step.error) {
      const msg = step.error.message;
      errorMessages.set(msg, (errorMessages.get(msg) ?? 0) + 1);
    }
  }

  // Error rate detection
  const errorCount = allSteps.filter((s) => s.error).length;
  if (allSteps.length > 0 && errorCount / allSteps.length > 0.2) {
    anomalies.push({
      type: "error_rate",
      severity: "high",
      message: `High error rate: ${errorCount}/${allSteps.length} steps (${Math.round((errorCount / allSteps.length) * 100)}%)`,
      details: { errorCount, totalSteps: allSteps.length },
    });
  }

  // Repeated error detection
  for (const [msg, count] of errorMessages) {
    if (count >= 3) {
      anomalies.push({
        type: "repeated_error",
        severity: count >= 5 ? "high" : "medium",
        message: `Error "${msg}" occurred ${count} times`,
        details: { errorMessage: msg, count },
      });
    }
  }

  return anomalies;
}

function flattenSteps(steps: Step[]): Step[] {
  const result: Step[] = [];
  for (const step of steps) {
    result.push(step);
    result.push(...flattenSteps(step.children));
  }
  return result;
}
