/**
 * Trace loader — parses JSONL trace files and converts serialized data to runtime types.
 * Supports two formats:
 *   1. JSONL with trace_start / step / trace_end records (matching @agent-replay/core JsonlStorage)
 *   2. One full SerializedTrace JSON object per line
 */

import type {
  SerializedTrace,
  SerializedStep,
  JsonlRecord,
  TraceSummary,
  Trace,
  Step,
  CostBreakdown,
} from "./types.js";
import { getSampleTraces } from "./sample-data.js";

/* ------------------------------------------------------------------ */
/*  JSONL Parsing                                                      */
/* ------------------------------------------------------------------ */

export function parseJsonl(content: string): SerializedTrace[] {
  const lines = content.split("\n").filter((l) => l.trim().length > 0);
  const traces: SerializedTrace[] = [];
  const pendingTraces = new Map<string, SerializedTrace>();
  const pendingSteps = new Map<string, SerializedStep[]>();

  for (const line of lines) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }

    if (isJsonlRecord(parsed)) {
      handleRecord(parsed, pendingTraces, pendingSteps, traces);
    } else if (isSerializedTrace(parsed)) {
      traces.push(parsed);
    }
  }

  // Finalize incomplete traces (missing trace_end)
  for (const [id, trace] of pendingTraces) {
    const steps = pendingSteps.get(id) ?? [];
    trace.steps = buildStepTree(steps);
    trace.summary = computeSummary(trace);
    traces.push(trace);
  }

  return traces;
}

function isJsonlRecord(obj: unknown): obj is JsonlRecord {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r["type"] === "string" &&
    ["trace_start", "step", "trace_end"].includes(r["type"] as string) &&
    typeof r["timestamp"] === "string"
  );
}

function isSerializedTrace(obj: unknown): obj is SerializedTrace {
  if (typeof obj !== "object" || obj === null) return false;
  const r = obj as Record<string, unknown>;
  return (
    typeof r["id"] === "string" &&
    typeof r["name"] === "string" &&
    typeof r["startedAt"] === "string" &&
    Array.isArray(r["steps"])
  );
}

function handleRecord(
  record: JsonlRecord,
  pending: Map<string, SerializedTrace>,
  steps: Map<string, SerializedStep[]>,
  out: SerializedTrace[],
): void {
  switch (record.type) {
    case "trace_start": {
      const d = record.data as SerializedTrace;
      pending.set(d.id, { ...d, steps: [] });
      steps.set(d.id, []);
      break;
    }
    case "step": {
      const s = record.data as SerializedStep;
      // Add to the latest pending trace
      for (const [id] of pending) {
        const arr = steps.get(id);
        if (arr) {
          arr.push(s);
          break;
        }
      }
      break;
    }
    case "trace_end": {
      const d = record.data as { id: string; summary: TraceSummary };
      const t = pending.get(d.id);
      if (t) {
        const s = steps.get(d.id) ?? [];
        t.steps = buildStepTree(s);
        t.summary = d.summary ?? computeSummary(t);
        t.endedAt = record.timestamp;
        if (t.startedAt && t.endedAt) {
          t.duration = new Date(t.endedAt).getTime() - new Date(t.startedAt).getTime();
        }
        out.push(t);
        pending.delete(d.id);
        steps.delete(d.id);
      }
      break;
    }
  }
}

function buildStepTree(flat: SerializedStep[]): SerializedStep[] {
  const map = new Map<string, SerializedStep>();
  const roots: SerializedStep[] = [];
  for (const s of flat) map.set(s.id, { ...s, children: s.children ?? [] });
  for (const s of map.values()) {
    if (s.parentId && map.has(s.parentId)) {
      map.get(s.parentId)!.children.push(s);
    } else {
      roots.push(s);
    }
  }
  return roots;
}

/* ------------------------------------------------------------------ */
/*  Summary computation                                                */
/* ------------------------------------------------------------------ */

export function computeSummary(trace: SerializedTrace): TraceSummary {
  const all = flattenSerializedSteps(trace.steps);
  const byType: Record<string, number> = {};
  const models = new Set<string>();
  const tok = { prompt: 0, completion: 0, total: 0 };
  let cost = 0;
  let errors = 0;

  for (const s of all) {
    byType[s.type] = (byType[s.type] ?? 0) + 1;
    if (s.model) models.add(s.model);
    if (s.tokens) {
      tok.prompt += s.tokens.prompt;
      tok.completion += s.tokens.completion;
      tok.total += s.tokens.total;
    }
    if (s.cost) cost += s.cost;
    if (s.error || s.type === "error") errors++;
  }

  return {
    totalSteps: all.length,
    totalTokens: tok,
    totalCost: cost,
    totalDuration: trace.duration ?? 0,
    stepsByType: byType,
    models: Array.from(models),
    errorCount: errors,
  };
}

function flattenSerializedSteps(steps: SerializedStep[]): SerializedStep[] {
  const r: SerializedStep[] = [];
  for (const s of steps) {
    r.push(s);
    if (s.children?.length) r.push(...flattenSerializedSteps(s.children));
  }
  return r;
}

/* ------------------------------------------------------------------ */
/*  Conversion: SerializedTrace -> Trace (Date objects)                */
/* ------------------------------------------------------------------ */

export function toTrace(s: SerializedTrace): Trace {
  return {
    id: s.id,
    name: s.name,
    startedAt: new Date(s.startedAt),
    endedAt: s.endedAt ? new Date(s.endedAt) : undefined,
    duration: s.duration,
    steps: s.steps.map(toStep),
    metadata: s.metadata,
    summary: s.summary ?? computeSummary(s),
  };
}

function toStep(s: SerializedStep): Step {
  return {
    id: s.id,
    parentId: s.parentId,
    type: s.type,
    name: s.name,
    startedAt: new Date(s.startedAt),
    endedAt: s.endedAt ? new Date(s.endedAt) : undefined,
    duration: s.duration,
    input: s.input,
    output: s.output,
    tokens: s.tokens,
    cost: s.cost,
    model: s.model,
    error: s.error,
    children: (s.children ?? []).map(toStep),
    metadata: s.metadata,
  };
}

/* ------------------------------------------------------------------ */
/*  Cost breakdown                                                     */
/* ------------------------------------------------------------------ */

export function buildCostBreakdown(steps: Step[]): CostBreakdown {
  const byModel: CostBreakdown["byModel"] = {};
  const byStepType: CostBreakdown["byStepType"] = {};
  let total = 0;

  function walk(list: Step[]): void {
    for (const step of list) {
      const c = step.cost ?? 0;
      total += c;

      const st = byStepType[step.type];
      if (st) { st.cost += c; st.count += 1; }
      else { byStepType[step.type] = { cost: c, count: 1 }; }

      if (step.model) {
        const m = byModel[step.model];
        if (m) {
          m.cost += c;
          m.calls += 1;
          if (step.tokens) {
            m.tokens.prompt += step.tokens.prompt;
            m.tokens.completion += step.tokens.completion;
            m.tokens.total += step.tokens.total;
          }
        } else {
          byModel[step.model] = {
            cost: c,
            calls: 1,
            tokens: step.tokens
              ? { ...step.tokens }
              : { prompt: 0, completion: 0, total: 0 },
          };
        }
      }
      if (step.children.length > 0) walk(step.children);
    }
  }

  walk(steps);
  return { byModel, byStepType, total };
}

/* ------------------------------------------------------------------ */
/*  File loading                                                       */
/* ------------------------------------------------------------------ */

export function loadSampleTraces(): Trace[] {
  return getSampleTraces().map(toTrace);
}

export async function loadFileAsTraces(file: File): Promise<Trace[]> {
  const text = await file.text();
  const serialized = parseJsonl(text);
  return serialized.map(toTrace);
}
