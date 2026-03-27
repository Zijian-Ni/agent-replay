import type { Trace, Step, ReplayerOptions, SerializedTrace } from "./types.js";
import { deserializeTrace } from "./trace.js";

/** Replays recorded agent traces step-by-step */
export class AgentReplayer {
  private trace: Trace;
  private currentIndex = 0;
  private flatSteps: Step[];

  constructor(
    traceOrSerialized: Trace | SerializedTrace,
    private options: ReplayerOptions = {}
  ) {
    this.trace = "startedAt" in traceOrSerialized && traceOrSerialized.startedAt instanceof Date
      ? traceOrSerialized as Trace
      : deserializeTrace(traceOrSerialized as SerializedTrace);
    this.flatSteps = this.flattenSteps(this.trace.steps);
  }

  /** Get the total number of steps */
  get totalSteps(): number {
    return this.flatSteps.length;
  }

  /** Get the current step index */
  get currentStepIndex(): number {
    return this.currentIndex;
  }

  /** Get the full trace */
  getTrace(): Trace {
    return this.trace;
  }

  /** Get step at a specific index */
  getStep(index: number): Step | undefined {
    return this.flatSteps[index];
  }

  /** Get the current step */
  getCurrentStep(): Step | undefined {
    return this.flatSteps[this.currentIndex];
  }

  /** Advance to the next step */
  async next(): Promise<Step | null> {
    if (this.currentIndex >= this.flatSteps.length) return null;
    const step = this.flatSteps[this.currentIndex]!;
    if (this.options.onStep) {
      await this.options.onStep(step, this.currentIndex);
    }
    if (this.options.speed && step.duration) {
      await this.delay(step.duration / this.options.speed);
    }
    this.currentIndex++;
    return step;
  }

  /** Go to a specific step index */
  seek(index: number): Step | undefined {
    if (index < 0 || index >= this.flatSteps.length) return undefined;
    this.currentIndex = index;
    return this.flatSteps[index];
  }

  /** Reset to the beginning */
  reset(): void {
    this.currentIndex = 0;
  }

  /** Check if there are more steps */
  hasNext(): boolean {
    return this.currentIndex < this.flatSteps.length;
  }

  /** Replay all remaining steps */
  async replayAll(): Promise<Step[]> {
    const steps: Step[] = [];
    while (this.hasNext()) {
      const step = await this.next();
      if (step) steps.push(step);
    }
    return steps;
  }

  /** Fork the trace from the current position, allowing modifications */
  fork(modifications?: { steps?: Partial<Step>[] }): AgentReplayer {
    const forkedTrace: Trace = {
      ...this.trace,
      id: `${this.trace.id}-fork-${Date.now()}`,
      steps: this.flatSteps.slice(0, this.currentIndex).map((s) => ({ ...s, children: [...s.children] })),
    };
    if (modifications?.steps) {
      for (const mod of modifications.steps) {
        const idx = forkedTrace.steps.findIndex((s) => s.id === mod.id);
        if (idx !== -1) {
          forkedTrace.steps[idx] = { ...forkedTrace.steps[idx]!, ...mod };
        }
      }
    }
    return new AgentReplayer(forkedTrace, this.options);
  }

  private flattenSteps(steps: Step[]): Step[] {
    const result: Step[] = [];
    for (const step of steps) {
      result.push(step);
      if (step.children.length > 0) {
        result.push(...this.flattenSteps(step.children));
      }
    }
    return result;
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
