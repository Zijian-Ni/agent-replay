// Core classes
export { AgentRecorder } from "./recorder.js";
export { AgentReplayer } from "./replayer.js";

// Trace utilities
export { serializeTrace, deserializeTrace, serializeStep, deserializeStep, computeTraceSummary } from "./trace.js";

// Storage
export { createStorage, JsonlStorage, MemoryStorage, SqliteStorage } from "./storage/index.js";

// Interceptors
export { interceptOpenAI } from "./interceptors/openai.js";
export { interceptAnthropic } from "./interceptors/anthropic.js";
export { interceptFunction } from "./interceptors/generic.js";

// Analysis
export { diffTraces } from "./analysis/diff.js";
export { analyzeCost } from "./analysis/cost.js";
export { generateTimeline } from "./analysis/timeline.js";
export { detectAnomalies } from "./analysis/anomaly.js";

// Security
export { Redactor } from "./security/redactor.js";
export { encrypt, decrypt } from "./security/encryption.js";

// Types
export type {
  Trace,
  Step,
  StepType,
  StepId,
  TraceId,
  TokenUsage,
  StepError,
  TraceSummary,
  SerializedTrace,
  SerializedStep,
  RecorderOptions,
  ReplayerOptions,
  TraceStorage,
  RedactionRule,
  TraceDiff,
  TimelineEntry,
  CostBreakdown,
  Anomaly,
  JsonlRecord,
  JsonlRecordType,
  Interceptor,
} from "./types.js";
