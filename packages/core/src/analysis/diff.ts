import type { Trace, Step, TraceDiff } from "../types.js";

/** Compare two traces and return their differences */
export function diffTraces(traceA: Trace, traceB: Trace): TraceDiff {
  const stepsA = flattenSteps(traceA.steps);
  const stepsB = flattenSteps(traceB.steps);

  const idsA = new Set(stepsA.map((s) => s.id));
  const idsB = new Set(stepsB.map((s) => s.id));
  const mapA = new Map(stepsA.map((s) => [s.id, s]));
  const mapB = new Map(stepsB.map((s) => [s.id, s]));

  const added = stepsB.filter((s) => !idsA.has(s.id));
  const removed = stepsA.filter((s) => !idsB.has(s.id));

  const modified: TraceDiff["modified"] = [];
  for (const [id, stepA] of mapA) {
    const stepB = mapB.get(id);
    if (!stepB) continue;
    const changes = compareSteps(stepA, stepB);
    if (changes.length > 0) {
      modified.push({ before: stepA, after: stepB, changes });
    }
  }

  const summaryA = traceA.summary;
  const summaryB = traceB.summary;

  return {
    added,
    removed,
    modified,
    summary: {
      tokenDiff: (summaryB?.totalTokens.total ?? 0) - (summaryA?.totalTokens.total ?? 0),
      costDiff: (summaryB?.totalCost ?? 0) - (summaryA?.totalCost ?? 0),
      durationDiff: (summaryB?.totalDuration ?? 0) - (summaryA?.totalDuration ?? 0),
      stepCountDiff: stepsB.length - stepsA.length,
    },
  };
}

function flattenSteps(steps: Step[]): Step[] {
  const result: Step[] = [];
  for (const step of steps) {
    result.push(step);
    result.push(...flattenSteps(step.children));
  }
  return result;
}

function compareSteps(a: Step, b: Step): string[] {
  const changes: string[] = [];
  if (a.type !== b.type) changes.push(`type: ${a.type} -> ${b.type}`);
  if (a.name !== b.name) changes.push(`name: ${a.name} -> ${b.name}`);
  if (a.model !== b.model) changes.push(`model: ${a.model} -> ${b.model}`);
  if (a.duration !== b.duration) changes.push(`duration: ${a.duration}ms -> ${b.duration}ms`);
  if (JSON.stringify(a.input) !== JSON.stringify(b.input)) changes.push("input changed");
  if (JSON.stringify(a.output) !== JSON.stringify(b.output)) changes.push("output changed");
  if (a.tokens?.total !== b.tokens?.total) changes.push(`tokens: ${a.tokens?.total} -> ${b.tokens?.total}`);
  if (a.cost !== b.cost) changes.push(`cost: ${a.cost} -> ${b.cost}`);
  return changes;
}
