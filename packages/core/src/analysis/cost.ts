import type { Trace, Step, CostBreakdown } from "../types.js";

/** Generate a cost breakdown for a trace */
export function analyzeCost(trace: Trace): CostBreakdown {
  const byModel: CostBreakdown["byModel"] = {};
  const byStepType: CostBreakdown["byStepType"] = {};
  let total = 0;

  const processStep = (step: Step): void => {
    if (step.model) {
      if (!byModel[step.model]) {
        byModel[step.model] = {
          tokens: { prompt: 0, completion: 0, total: 0 },
          cost: 0,
          calls: 0,
        };
      }
      const entry = byModel[step.model]!;
      entry.calls++;
      if (step.tokens) {
        entry.tokens.prompt += step.tokens.prompt;
        entry.tokens.completion += step.tokens.completion;
        entry.tokens.total += step.tokens.total;
      }
      if (step.cost) entry.cost += step.cost;
    }

    if (!byStepType[step.type]) {
      byStepType[step.type] = { cost: 0, count: 0 };
    }
    byStepType[step.type]!.count++;
    if (step.cost) {
      byStepType[step.type]!.cost += step.cost;
      total += step.cost;
    }

    step.children.forEach(processStep);
  };

  trace.steps.forEach(processStep);

  return { byModel, byStepType, total };
}
