import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import {
  deserializeTrace,
  type Trace,
  type SerializedTrace,
  type SerializedStep,
  type JsonlRecord,
  type TraceId,
} from "@agent-replay/core";

/** Load a single trace from a JSONL file */
export async function loadTrace(filePath: string): Promise<Trace> {
  const absPath = resolve(filePath);
  const content = await fs.readFile(absPath, "utf-8");
  const serialized = parseJsonl(content);
  if (!serialized) {
    throw new Error(`Failed to parse trace from ${absPath}`);
  }
  return deserializeTrace(serialized);
}

/** Load all traces from a directory containing JSONL files */
export async function loadAllTraces(dirPath: string): Promise<Trace[]> {
  const absDir = resolve(dirPath);
  const stat = await fs.stat(absDir);

  if (!stat.isDirectory()) {
    // If it's a file, load it as a single trace
    return [await loadTrace(absDir)];
  }

  const files = await fs.readdir(absDir);
  const jsonlFiles = files.filter((f) => f.endsWith(".jsonl"));

  if (jsonlFiles.length === 0) {
    throw new Error(`No .jsonl trace files found in ${absDir}`);
  }

  const traces: Trace[] = [];
  for (const file of jsonlFiles) {
    try {
      const trace = await loadTrace(join(absDir, file));
      traces.push(trace);
    } catch {
      // Skip files that can't be parsed
    }
  }

  return traces;
}

/** List trace file names in a directory */
export async function listTraceFiles(dirPath: string): Promise<string[]> {
  const absDir = resolve(dirPath);
  const files = await fs.readdir(absDir);
  return files.filter((f) => f.endsWith(".jsonl")).map((f) => join(absDir, f));
}

/** Parse JSONL content into a SerializedTrace */
function parseJsonl(content: string): SerializedTrace | null {
  const lines = content.trim().split("\n").filter(Boolean);
  if (lines.length === 0) return null;

  let trace: SerializedTrace | null = null;

  for (const line of lines) {
    const record = JSON.parse(line) as JsonlRecord;
    if (record.type === "trace_start") {
      trace = record.data as SerializedTrace;
      trace.steps = [];
    } else if (record.type === "step" && trace) {
      trace.steps.push(record.data as SerializedStep);
    } else if (record.type === "trace_end" && trace) {
      const endData = record.data as { id: TraceId; summary: SerializedTrace["summary"] };
      trace.summary = endData.summary;
    }
  }

  return trace;
}
