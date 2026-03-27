import type { TraceStorage } from "../types.js";
import { JsonlStorage } from "./jsonl.js";
import { MemoryStorage } from "./memory.js";
import { SqliteStorage } from "./sqlite.js";
import { CompressedJsonlStorage } from "./compression.js";

export { JsonlStorage } from "./jsonl.js";
export { MemoryStorage } from "./memory.js";
export { SqliteStorage } from "./sqlite.js";
export { CompressedJsonlStorage } from "./compression.js";

/** Create a storage backend */
export function createStorage(type: "file" | "sqlite" | "memory" | "compressed", dir?: string): TraceStorage {
  switch (type) {
    case "file":
      return new JsonlStorage(dir);
    case "compressed":
      return new CompressedJsonlStorage(dir, true);
    case "sqlite":
      return new SqliteStorage(dir);
    case "memory":
      return new MemoryStorage();
    default:
      throw new Error(`Unknown storage type: ${type}`);
  }
}
