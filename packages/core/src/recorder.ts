import { v4 as uuidv4 } from "uuid";
import type {
  Trace,
  Step,
  StepType,
  StepId,
  RecorderOptions,
  TraceSummary,
  TokenUsage,
  TraceStorage,
} from "./types.js";
import { serializeTrace } from "./trace.js";
import { createStorage } from "./storage/index.js";
import { Redactor } from "./security/redactor.js";

/** Records AI agent execution traces */
export class AgentRecorder {
  private trace: Trace;
  private activeSteps: Map<StepId, Step> = new Map();
  private storage: TraceStorage | null = null;
  private redactor: Redactor | null = null;
  private stopped = false;

  constructor(private options: RecorderOptions) {
    this.trace = {
      id: uuidv4(),
      name: options.name,
      startedAt: new Date(),
      steps: [],
      metadata: options.metadata ?? {},
    };
    if (options.redact !== false) {
      this.redactor = new Redactor(options.redactPatterns);
    }
  }

  /** Get the trace ID */
  get traceId(): string {
    return this.trace.id;
  }

  /** Start a new step */
  startStep(type: StepType, name: string, input: unknown, parentId?: StepId): StepId {
    if (this.stopped) throw new Error("Recorder has been stopped");
    const step: Step = {
      id: uuidv4(),
      parentId,
      type,
      name,
      startedAt: new Date(),
      input: this.redactor ? this.redactor.redact(input) : input,
      children: [],
    };
    this.activeSteps.set(step.id, step);
    if (parentId) {
      const parent = this.findStep(parentId);
      if (parent) parent.children.push(step);
      else this.trace.steps.push(step);
    } else {
      this.trace.steps.push(step);
    }
    return step.id;
  }

  /** End a step with output */
  endStep(
    stepId: StepId,
    output: unknown,
    extra?: {
      tokens?: TokenUsage;
      cost?: number;
      model?: string;
      error?: { message: string; stack?: string };
      metadata?: Record<string, unknown>;
    }
  ): void {
    const step = this.activeSteps.get(stepId);
    if (!step) throw new Error(`Step ${stepId} not found or already ended`);
    step.endedAt = new Date();
    step.duration = step.endedAt.getTime() - step.startedAt.getTime();
    step.output = this.redactor ? this.redactor.redact(output) : output;
    if (extra) {
      if (extra.tokens) step.tokens = extra.tokens;
      if (extra.cost !== undefined) step.cost = extra.cost;
      if (extra.model) step.model = extra.model;
      if (extra.error) step.error = extra.error;
      if (extra.metadata) step.metadata = { ...step.metadata, ...extra.metadata };
    }
    this.activeSteps.delete(stepId);
  }

  /** Record a complete step in one call */
  addStep(
    type: StepType,
    name: string,
    input: unknown,
    output: unknown,
    extra?: {
      parentId?: StepId;
      tokens?: TokenUsage;
      cost?: number;
      model?: string;
      duration?: number;
      error?: { message: string; stack?: string };
      metadata?: Record<string, unknown>;
    }
  ): StepId {
    const stepId = this.startStep(type, name, input, extra?.parentId);
    this.endStep(stepId, output, extra);
    if (extra?.duration !== undefined) {
      const step = this.findStep(stepId);
      if (step) step.duration = extra.duration;
    }
    return stepId;
  }

  /** Create a proxy-based interceptor for an SDK client */
  intercept<T extends object>(client: T): T {
    const recorder = this;
    return new Proxy(client, {
      get(target, prop, receiver) {
        const value = Reflect.get(target, prop, receiver);
        if (typeof value === "function") {
          return new Proxy(value, {
            apply(fn, thisArg, args) {
              const name = String(prop);
              const stepId = recorder.startStep("tool_call", name, args);
              try {
                const result = Reflect.apply(fn, thisArg, args);
                if (result && typeof result === "object" && "then" in result) {
                  return (result as Promise<unknown>).then(
                    (res) => { recorder.endStep(stepId, res); return res; },
                    (err) => {
                      recorder.endStep(stepId, null, {
                        error: { message: (err as Error).message, stack: (err as Error).stack },
                      });
                      throw err;
                    }
                  );
                }
                recorder.endStep(stepId, result);
                return result;
              } catch (err) {
                recorder.endStep(stepId, null, {
                  error: { message: (err as Error).message, stack: (err as Error).stack },
                });
                throw err;
              }
            },
          });
        }
        if (value && typeof value === "object") {
          return recorder.intercept(value as object);
        }
        return value;
      },
    });
  }

  /** Stop recording and return the finalized trace */
  async stop(): Promise<Trace> {
    if (this.stopped) return this.trace;
    this.stopped = true;
    this.trace.endedAt = new Date();
    this.trace.duration = this.trace.endedAt.getTime() - this.trace.startedAt.getTime();
    this.trace.summary = this.computeSummary();

    if (this.options.storage && this.options.storage !== "memory") {
      this.storage = createStorage(this.options.storage, this.options.outputDir);
      const serialized = serializeTrace(this.trace);
      await this.storage.save(serialized);
    }

    return this.trace;
  }

  /** Get the current trace (may be incomplete) */
  getTrace(): Trace {
    return this.trace;
  }

  private findStep(id: StepId): Step | undefined {
    const findInChildren = (steps: Step[]): Step | undefined => {
      for (const step of steps) {
        if (step.id === id) return step;
        const found = findInChildren(step.children);
        if (found) return found;
      }
      return undefined;
    };
    return findInChildren(this.trace.steps);
  }

  private computeSummary(): TraceSummary {
    const summary: TraceSummary = {
      totalSteps: 0,
      totalTokens: { prompt: 0, completion: 0, total: 0 },
      totalCost: 0,
      totalDuration: this.trace.duration ?? 0,
      stepsByType: {} as Record<StepType, number>,
      models: [],
      errorCount: 0,
    };
    const models = new Set<string>();
    const countStep = (step: Step): void => {
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
      step.children.forEach(countStep);
    };
    this.trace.steps.forEach(countStep);
    summary.models = [...models];
    return summary;
  }
}
