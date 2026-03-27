/** Unique identifier for traces and steps */
export type TraceId = string;
export type StepId = string;

/** Step types in a trace */
export type StepType =
  | "llm_call"
  | "tool_call"
  | "tool_result"
  | "decision"
  | "error"
  | "custom";

/** Token usage for an LLM call */
export interface TokenUsage {
  prompt: number;
  completion: number;
  total: number;
}

/** Error information captured during a step */
export interface StepError {
  message: string;
  stack?: string;
  code?: string;
}

/** Summary statistics for a trace */
export interface TraceSummary {
  totalSteps: number;
  totalTokens: TokenUsage;
  totalCost: number;
  totalDuration: number;
  stepsByType: Record<string, number>;
  models: string[];
  errorCount: number;
}

/** Serialized step for storage (dates as ISO strings) */
export interface SerializedStep {
  id: StepId;
  parentId?: StepId;
  type: StepType;
  name: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  input: unknown;
  output?: unknown;
  tokens?: TokenUsage;
  cost?: number;
  model?: string;
  error?: StepError;
  children: SerializedStep[];
  metadata?: Record<string, unknown>;
}

/** Serialized trace for storage */
export interface SerializedTrace {
  id: TraceId;
  name: string;
  startedAt: string;
  endedAt?: string;
  duration?: number;
  steps: SerializedStep[];
  metadata: Record<string, unknown>;
  summary?: TraceSummary;
}

/** JSONL record types (matching @agent-replay/core JsonlStorage) */
export type JsonlRecordType = "trace_start" | "step" | "trace_end";

export interface JsonlRecord {
  type: JsonlRecordType;
  timestamp: string;
  data: SerializedTrace | SerializedStep | { id: TraceId; summary: TraceSummary };
}

/** Cost breakdown by model */
export interface CostBreakdown {
  byModel: Record<string, { tokens: TokenUsage; cost: number; calls: number }>;
  byStepType: Record<string, { cost: number; count: number }>;
  total: number;
}

/** Step with Date objects (used internally by viewer components) */
export interface Step {
  id: string;
  parentId?: string;
  type: StepType;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  input: unknown;
  output?: unknown;
  tokens?: TokenUsage;
  cost?: number;
  model?: string;
  error?: StepError;
  children: Step[];
  metadata?: Record<string, unknown>;
}

/** A complete trace with Date objects */
export interface Trace {
  id: string;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  steps: Step[];
  metadata: Record<string, unknown>;
  summary?: TraceSummary;
}
