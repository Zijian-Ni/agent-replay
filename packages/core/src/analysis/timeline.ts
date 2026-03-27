import type { Trace, Step, TimelineEntry } from "../types.js";

/** Generate a flat timeline from a trace for visualization */
export function generateTimeline(trace: Trace): TimelineEntry[] {
  const entries: TimelineEntry[] = [];
  const traceStart = trace.startedAt.getTime();
  const totalDuration = trace.duration ?? 1;

  const processStep = (step: Step, depth: number): void => {
    const startOffset = step.startedAt.getTime() - traceStart;
    const endOffset = step.endedAt
      ? step.endedAt.getTime() - traceStart
      : startOffset + (step.duration ?? 0);

    entries.push({
      step,
      depth,
      startOffset,
      endOffset,
      percentOfTotal: totalDuration > 0 ? ((step.duration ?? 0) / totalDuration) * 100 : 0,
    });

    step.children.forEach((child) => processStep(child, depth + 1));
  };

  trace.steps.forEach((step) => processStep(step, 0));

  return entries.sort((a, b) => a.startOffset - b.startOffset);
}
