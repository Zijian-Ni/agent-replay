import type { TraceStorage, SerializedTrace, TraceId } from "../types.js";

/** In-memory trace storage (useful for testing) */
export class MemoryStorage implements TraceStorage {
  private traces: Map<TraceId, SerializedTrace> = new Map();

  async save(trace: SerializedTrace): Promise<void> {
    this.traces.set(trace.id, structuredClone(trace));
  }

  async load(id: TraceId): Promise<SerializedTrace | null> {
    const trace = this.traces.get(id);
    return trace ? structuredClone(trace) : null;
  }

  async list(): Promise<TraceId[]> {
    return [...this.traces.keys()];
  }

  async delete(id: TraceId): Promise<void> {
    this.traces.delete(id);
  }

  async search(query: string): Promise<SerializedTrace[]> {
    const results: SerializedTrace[] = [];
    const lowerQuery = query.toLowerCase();
    for (const trace of this.traces.values()) {
      if (trace.name.toLowerCase().includes(lowerQuery) || trace.id.includes(lowerQuery)) {
        results.push(structuredClone(trace));
      }
    }
    return results;
  }

  /** Clear all stored traces */
  clear(): void {
    this.traces.clear();
  }

  /** Get the count of stored traces */
  get size(): number {
    return this.traces.size;
  }
}
