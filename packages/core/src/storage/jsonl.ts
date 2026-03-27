import { promises as fs } from "node:fs";
import { join } from "node:path";
import type { TraceStorage, SerializedTrace, TraceId, JsonlRecord } from "../types.js";

/** JSONL file-based trace storage */
export class JsonlStorage implements TraceStorage {
  private dir: string;

  constructor(dir?: string) {
    this.dir = dir ?? join(process.cwd(), "traces");
  }

  async save(trace: SerializedTrace): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
    const filePath = join(this.dir, `${trace.id}.jsonl`);
    const lines: string[] = [];

    const startRecord: JsonlRecord = {
      type: "trace_start",
      timestamp: trace.startedAt,
      data: { ...trace, steps: [] },
    };
    lines.push(JSON.stringify(startRecord));

    for (const step of trace.steps) {
      const stepRecord: JsonlRecord = {
        type: "step",
        timestamp: step.startedAt,
        data: step,
      };
      lines.push(JSON.stringify(stepRecord));
    }

    const endRecord: JsonlRecord = {
      type: "trace_end",
      timestamp: trace.endedAt ?? trace.startedAt,
      data: { id: trace.id, summary: trace.summary! },
    };
    lines.push(JSON.stringify(endRecord));

    await fs.writeFile(filePath, lines.join("\n") + "\n", "utf-8");
  }

  async load(id: TraceId): Promise<SerializedTrace | null> {
    const filePath = join(this.dir, `${id}.jsonl`);
    try {
      const content = await fs.readFile(filePath, "utf-8");
      return this.parseJsonl(content);
    } catch {
      return null;
    }
  }

  async list(): Promise<TraceId[]> {
    try {
      const files = await fs.readdir(this.dir);
      return files
        .filter((f) => f.endsWith(".jsonl"))
        .map((f) => f.replace(".jsonl", ""));
    } catch {
      return [];
    }
  }

  async delete(id: TraceId): Promise<void> {
    const filePath = join(this.dir, `${id}.jsonl`);
    await fs.unlink(filePath).catch(() => {});
  }

  async search(query: string): Promise<SerializedTrace[]> {
    const ids = await this.list();
    const results: SerializedTrace[] = [];
    const lowerQuery = query.toLowerCase();
    for (const id of ids) {
      const trace = await this.load(id);
      if (trace && (trace.name.toLowerCase().includes(lowerQuery) || trace.id.includes(lowerQuery))) {
        results.push(trace);
      }
    }
    return results;
  }

  private parseJsonl(content: string): SerializedTrace | null {
    const lines = content.trim().split("\n").filter(Boolean);
    if (lines.length === 0) return null;

    let trace: SerializedTrace | null = null;

    for (const line of lines) {
      const record = JSON.parse(line) as JsonlRecord;
      if (record.type === "trace_start") {
        trace = record.data as SerializedTrace;
        trace.steps = [];
      } else if (record.type === "step" && trace) {
        trace.steps.push(record.data as any);
      } else if (record.type === "trace_end" && trace) {
        const endData = record.data as { id: TraceId; summary: any };
        trace.summary = endData.summary;
      }
    }

    return trace;
  }
}
