import type { TraceStorage, SerializedTrace, TraceId } from "../types.js";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
declare const require: any;

/** SQLite-based trace storage (requires better-sqlite3 peer dependency) */
export class SqliteStorage implements TraceStorage {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private db: any;

  constructor(dbPath?: string) {
    try {
      const Database = require("better-sqlite3");
      this.db = new Database(dbPath ?? "traces.db");
      this.db.exec(`
        CREATE TABLE IF NOT EXISTS traces (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          data TEXT NOT NULL,
          created_at TEXT NOT NULL
        )
      `);
      this.db.exec(`
        CREATE INDEX IF NOT EXISTS idx_traces_name ON traces(name)
      `);
    } catch {
      throw new Error(
        "better-sqlite3 is required for SQLite storage. Install it with: pnpm add better-sqlite3"
      );
    }
  }

  async save(trace: SerializedTrace): Promise<void> {
    const stmt = this.db.prepare(
      "INSERT OR REPLACE INTO traces (id, name, data, created_at) VALUES (?, ?, ?, ?)"
    );
    stmt.run(trace.id, trace.name, JSON.stringify(trace), trace.startedAt);
  }

  async load(id: TraceId): Promise<SerializedTrace | null> {
    const row = this.db.prepare("SELECT data FROM traces WHERE id = ?").get(id);
    return row ? JSON.parse(row.data) : null;
  }

  async list(): Promise<TraceId[]> {
    const rows = this.db.prepare("SELECT id FROM traces ORDER BY created_at DESC").all();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => r.id);
  }

  async delete(id: TraceId): Promise<void> {
    this.db.prepare("DELETE FROM traces WHERE id = ?").run(id);
  }

  async search(query: string): Promise<SerializedTrace[]> {
    const rows = this.db
      .prepare("SELECT data FROM traces WHERE name LIKE ? OR id LIKE ?")
      .all(`%${query}%`, `%${query}%`);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return rows.map((r: any) => JSON.parse(r.data));
  }

  /** Close the database connection */
  close(): void {
    this.db?.close();
  }
}
