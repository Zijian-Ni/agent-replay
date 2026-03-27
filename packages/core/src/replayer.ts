import type { Trace, Step, ReplayerOptions, SerializedTrace, Breakpoint, Checkpoint } from "./types.js";
import { deserializeTrace } from "./trace.js";

/** Replays recorded agent traces step-by-step */
export class AgentReplayer {
  private trace: Trace;
  private currentIndex = 0;
  private flatSteps: Step[];
  private checkpoints: Map<string, Checkpoint> = new Map();
  private cumulativeCost = 0;
  private paused = false;

  constructor(
    traceOrSerialized: Trace | SerializedTrace,
    private options: ReplayerOptions = {}
  ) {
    this.trace = "startedAt" in traceOrSerialized && traceOrSerialized.startedAt instanceof Date
      ? traceOrSerialized as Trace
      : deserializeTrace(traceOrSerialized as SerializedTrace);
    this.flatSteps = this.flattenSteps(this.trace.steps);

    // Apply model substitutions if specified
    if (options.modelSubstitutions) {
      this.applyModelSubstitutions(options.modelSubstitutions);
    }
  }

  /** Get the total number of steps */
  get totalSteps(): number {
    return this.flatSteps.length;
  }

  /** Get the current step index */
  get currentStepIndex(): number {
    return this.currentIndex;
  }

  /** Whether the replayer is paused (breakpoint hit) */
  get isPaused(): boolean {
    return this.paused;
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

  /** Get cumulative cost up to current position */
  getCumulativeCost(): number {
    return this.cumulativeCost;
  }

  /** Advance to the next step */
  async next(): Promise<Step | null> {
    if (this.currentIndex >= this.flatSteps.length) return null;
    this.paused = false;

    const step = this.flatSteps[this.currentIndex]!;

    // Check breakpoints
    const hitBreakpoint = this.checkBreakpoints(step, this.currentIndex);
    if (hitBreakpoint) {
      this.paused = true;
      if (this.options.onBreakpoint) {
        await this.options.onBreakpoint(hitBreakpoint, step, this.currentIndex);
      }
      return null;
    }

    if (this.options.onStep) {
      await this.options.onStep(step, this.currentIndex);
    }

    // Speed control: 0 = instant, undefined = no delay
    if (this.options.speed && this.options.speed > 0 && step.duration) {
      await this.delay(step.duration / this.options.speed);
    }

    // Track cumulative cost
    if (step.cost) {
      this.cumulativeCost += step.cost;
    }

    this.currentIndex++;
    return step;
  }

  /** Resume after a breakpoint pause */
  async resume(): Promise<Step | null> {
    if (!this.paused) return this.next();
    this.paused = false;
    // Skip the breakpoint check by directly processing the step
    const step = this.flatSteps[this.currentIndex]!;

    if (this.options.onStep) {
      await this.options.onStep(step, this.currentIndex);
    }

    if (this.options.speed && this.options.speed > 0 && step.duration) {
      await this.delay(step.duration / this.options.speed);
    }

    if (step.cost) {
      this.cumulativeCost += step.cost;
    }

    this.currentIndex++;
    return step;
  }

  /** Set playback speed */
  setSpeed(speed: number): void {
    this.options.speed = speed;
  }

  /** Get current playback speed */
  getSpeed(): number {
    return this.options.speed ?? 1;
  }

  /** Add a breakpoint */
  addBreakpoint(breakpoint: Breakpoint): void {
    if (!this.options.breakpoints) {
      this.options.breakpoints = [];
    }
    this.options.breakpoints.push(breakpoint);
  }

  /** Remove all breakpoints */
  clearBreakpoints(): void {
    this.options.breakpoints = [];
  }

  /** Save a checkpoint at the current position */
  saveCheckpoint(label?: string): Checkpoint {
    const key = label ?? `checkpoint-${this.checkpoints.size}`;
    const checkpoint: Checkpoint = {
      index: this.currentIndex,
      timestamp: Date.now(),
      label: key,
    };
    this.checkpoints.set(key, checkpoint);
    return checkpoint;
  }

  /** Restore a saved checkpoint */
  restoreCheckpoint(label: string): boolean {
    const checkpoint = this.checkpoints.get(label);
    if (!checkpoint) return false;
    this.currentIndex = checkpoint.index;
    // Recalculate cumulative cost up to checkpoint
    this.cumulativeCost = 0;
    for (let i = 0; i < checkpoint.index; i++) {
      const step = this.flatSteps[i];
      if (step?.cost) this.cumulativeCost += step.cost;
    }
    this.paused = false;
    return true;
  }

  /** List all checkpoints */
  listCheckpoints(): Checkpoint[] {
    return [...this.checkpoints.values()];
  }

  /** Go to a specific step index */
  seek(index: number): Step | undefined {
    if (index < 0 || index >= this.flatSteps.length) return undefined;
    this.currentIndex = index;
    // Recalculate cumulative cost
    this.cumulativeCost = 0;
    for (let i = 0; i < index; i++) {
      const step = this.flatSteps[i];
      if (step?.cost) this.cumulativeCost += step.cost;
    }
    this.paused = false;
    return this.flatSteps[index];
  }

  /** Reset to the beginning */
  reset(): void {
    this.currentIndex = 0;
    this.cumulativeCost = 0;
    this.paused = false;
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
      else if (this.paused) break; // Stop if breakpoint hit
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

  private checkBreakpoints(step: Step, index: number): Breakpoint | null {
    if (!this.options.breakpoints) return null;

    for (const bp of this.options.breakpoints) {
      switch (bp.type) {
        case "cost":
          if (bp.costThreshold !== undefined && this.cumulativeCost + (step.cost ?? 0) > bp.costThreshold) {
            return bp;
          }
          break;
        case "error":
          if (step.error) return bp;
          break;
        case "tool":
          if (bp.toolName && step.name.includes(bp.toolName)) return bp;
          break;
        case "model":
          if (bp.modelName && step.model === bp.modelName) return bp;
          break;
        case "custom":
          if (bp.predicate && bp.predicate(step, index)) return bp;
          break;
      }
    }

    return null;
  }

  private applyModelSubstitutions(substitutions: Record<string, string>): void {
    for (const step of this.flatSteps) {
      if (step.model && substitutions[step.model]) {
        step.metadata = {
          ...step.metadata,
          originalModel: step.model,
        };
        step.model = substitutions[step.model];
      }
    }
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
