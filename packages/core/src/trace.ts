import type {
  Trace,
  Step,
  SerializedTrace,
  SerializedStep,
  TraceSummary,
  StepType,
} from "./types.js";

/** Serialize a Step to a plain object for storage */
export function serializeStep(step: Step): SerializedStep {
  return {
    id: step.id,
    parentId: step.parentId,
    type: step.type,
    name: step.name,
    startedAt: step.startedAt.toISOString(),
    endedAt: step.endedAt?.toISOString(),
    duration: step.duration,
    input: step.input,
    output: step.output,
    tokens: step.tokens,
    cost: step.cost,
    model: step.model,
    error: step.error,
    children: step.children.map(serializeStep),
    metadata: step.metadata,
  };
}

/** Deserialize a Step from storage */
export function deserializeStep(data: SerializedStep): Step {
  return {
    id: data.id,
    parentId: data.parentId,
    type: data.type,
    name: data.name,
    startedAt: new Date(data.startedAt),
    endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    duration: data.duration,
    input: data.input,
    output: data.output,
    tokens: data.tokens,
    cost: data.cost,
    model: data.model,
    error: data.error,
    children: (data.children ?? []).map(deserializeStep),
    metadata: data.metadata,
  };
}

/** Serialize a complete Trace */
export function serializeTrace(trace: Trace): SerializedTrace {
  return {
    id: trace.id,
    name: trace.name,
    startedAt: trace.startedAt.toISOString(),
    endedAt: trace.endedAt?.toISOString(),
    duration: trace.duration,
    steps: trace.steps.map(serializeStep),
    metadata: trace.metadata,
    summary: trace.summary,
  };
}

/** Deserialize a complete Trace */
export function deserializeTrace(data: SerializedTrace): Trace {
  return {
    id: data.id,
    name: data.name,
    startedAt: new Date(data.startedAt),
    endedAt: data.endedAt ? new Date(data.endedAt) : undefined,
    duration: data.duration,
    steps: data.steps.map(deserializeStep),
    metadata: data.metadata,
    summary: data.summary,
  };
}

/** Compute a summary from a trace */
export function computeTraceSummary(trace: Trace): TraceSummary {
  const summary: TraceSummary = {
    totalSteps: 0,
    totalTokens: { prompt: 0, completion: 0, total: 0 },
    totalCost: 0,
    totalDuration: trace.duration ?? 0,
    stepsByType: {} as Record<StepType, number>,
    models: [],
    errorCount: 0,
  };

  const models = new Set<string>();

  const processStep = (step: Step): void => {
    summary.totalSteps++;
    summary.stepsByType[step.type] = (summary.stepsByType[step.type] ?? 0) + 1;
    if (step.tokens) {
      summary.totalTokens.prompt += step.tokens.prompt;
      summary.totalTokens.completion += step.tokens.completion;
      summary.totalTokens.total += step.tokens.total;
    }
    if (step.cost) summary.totalCost += step.cost;
    if (step.model) models.add(step.model);
    if (step.error) summary.errorCount++;
    step.children.forEach(processStep);
  };

  trace.steps.forEach(processStep);
  summary.models = [...models];

  return summary;
}
