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

/** A single step in an agent trace */
export interface Step {
  id: StepId;
  parentId?: StepId;
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

/** Summary statistics for a trace */
export interface TraceSummary {
  totalSteps: number;
  totalTokens: TokenUsage;
  totalCost: number;
  totalDuration: number;
  stepsByType: Record<StepType, number>;
  models: string[];
  errorCount: number;
}

/** A complete agent execution trace */
export interface Trace {
  id: TraceId;
  name: string;
  startedAt: Date;
  endedAt?: Date;
  duration?: number;
  steps: Step[];
  metadata: Record<string, unknown>;
  summary?: TraceSummary;
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

/** Configuration for the recorder */
export interface RecorderOptions {
  /** Name for this trace */
  name: string;
  /** Storage backend: "file" or "sqlite" */
  storage?: "file" | "sqlite" | "memory";
  /** Directory for file storage */
  outputDir?: string;
  /** Whether to auto-redact sensitive data */
  redact?: boolean;
  /** Custom redaction patterns */
  redactPatterns?: RegExp[];
  /** Whether to encrypt traces at rest */
  encrypt?: boolean;
  /** Encryption key (required if encrypt is true) */
  encryptionKey?: string;
  /** Additional metadata to attach to the trace */
  metadata?: Record<string, unknown>;
}

/** Configuration for the replayer */
export interface ReplayerOptions {
  /** Whether to make real API calls or use recorded responses */
  mock?: boolean;
  /** Playback speed multiplier */
  speed?: number;
  /** Step callback */
  onStep?: (step: Step, index: number) => void | Promise<void>;
}

/** Storage backend interface */
export interface TraceStorage {
  /** Save a trace */
  save(trace: SerializedTrace): Promise<void>;
  /** Load a trace by ID */
  load(id: TraceId): Promise<SerializedTrace | null>;
  /** List all trace IDs */
  list(): Promise<TraceId[]>;
  /** Delete a trace */
  delete(id: TraceId): Promise<void>;
  /** Search traces by name or metadata */
  search(query: string): Promise<SerializedTrace[]>;
}

/** Redaction rule configuration */
export interface RedactionRule {
  name: string;
  pattern: RegExp;
  replacement: string;
}

/** Diff result between two traces */
export interface TraceDiff {
  added: Step[];
  removed: Step[];
  modified: Array<{
    before: Step;
    after: Step;
    changes: string[];
  }>;
  summary: {
    tokenDiff: number;
    costDiff: number;
    durationDiff: number;
    stepCountDiff: number;
  };
}

/** Timeline entry for visualization */
export interface TimelineEntry {
  step: Step;
  depth: number;
  startOffset: number;
  endOffset: number;
  percentOfTotal: number;
}

/** Cost breakdown by model */
export interface CostBreakdown {
  byModel: Record<string, { tokens: TokenUsage; cost: number; calls: number }>;
  byStepType: Record<string, { cost: number; count: number }>;
  total: number;
}

/** Anomaly detected in a trace */
export interface Anomaly {
  type: "slow_step" | "high_cost" | "error_rate" | "token_spike" | "repeated_error";
  severity: "low" | "medium" | "high";
  message: string;
  stepId?: StepId;
  details: Record<string, unknown>;
}

/** JSONL record types */
export type JsonlRecordType = "trace_start" | "step" | "trace_end";

export interface JsonlRecord {
  type: JsonlRecordType;
  timestamp: string;
  data: SerializedTrace | SerializedStep | { id: TraceId; summary: TraceSummary };
}

/** Interceptor interface for SDK proxying */
export interface Interceptor<T> {
  wrap(target: T): T;
  unwrap(): T;
}
