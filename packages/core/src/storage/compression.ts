import { createGzip, createGunzip } from "node:zlib";
import { createReadStream, createWriteStream } from "node:fs";
import { promises as fs } from "node:fs";
import { pipeline } from "node:stream/promises";
import { join } from "node:path";
import type { SerializedTrace, TraceId, TraceStorage, JsonlRecord } from "../types.js";

/** Check if a file is gzip-compressed by reading magic bytes */
export async function isCompressed(filePath: string): Promise<boolean> {
  try {
    const fd = await fs.open(filePath, "r");
    const buf = Buffer.alloc(2);
    await fd.read(buf, 0, 2, 0);
    await fd.close();
    return buf[0] === 0x1f && buf[1] === 0x8b;
  } catch {
    return false;
  }
}

/** Compress a file using gzip */
export async function compressFile(inputPath: string, outputPath?: string): Promise<string> {
  const outPath = outputPath ?? `${inputPath}.gz`;
  const source = createReadStream(inputPath);
  const destination = createWriteStream(outPath);
  const gzip = createGzip({ level: 6 });
  await pipeline(source, gzip, destination);
  return outPath;
}

/** Decompress a gzip file */
export async function decompressFile(inputPath: string, outputPath?: string): Promise<string> {
  const outPath = outputPath ?? inputPath.replace(/\.gz$/, "");
  const source = createReadStream(inputPath);
  const destination = createWriteStream(outPath);
  const gunzip = createGunzip();
  await pipeline(source, gunzip, destination);
  return outPath;
}

/** Compress a string to a gzip Buffer */
export async function compressBuffer(data: string): Promise<Buffer> {
  const { gzip } = await import("node:zlib");
  return new Promise((resolve, reject) => {
    gzip(Buffer.from(data, "utf-8"), (err, result) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}

/** Decompress a gzip Buffer to a string */
export async function decompressBuffer(data: Buffer): Promise<string> {
  const { gunzip } = await import("node:zlib");
  return new Promise((resolve, reject) => {
    gunzip(data, (err, result) => {
      if (err) reject(err);
      else resolve(result.toString("utf-8"));
    });
  });
}

/** Read a file with auto-detection of compression */
export async function readAutoDetect(filePath: string): Promise<string> {
  if (await isCompressed(filePath)) {
    const compressed = await fs.readFile(filePath);
    return decompressBuffer(compressed);
  }
  return fs.readFile(filePath, "utf-8");
}

/** Compress all .jsonl files in a directory */
export async function compressDirectory(dir: string): Promise<{ compressed: string[]; skipped: string[]; savedBytes: number }> {
  const files = await fs.readdir(dir);
  const compressed: string[] = [];
  const skipped: string[] = [];
  let savedBytes = 0;

  for (const file of files) {
    if (!file.endsWith(".jsonl")) {
      skipped.push(file);
      continue;
    }

    const filePath = join(dir, file);
    if (await isCompressed(filePath)) {
      skipped.push(file);
      continue;
    }

    const originalStat = await fs.stat(filePath);
    const outPath = `${filePath}.gz`;
    await compressFile(filePath, outPath);
    const compressedStat = await fs.stat(outPath);

    savedBytes += originalStat.size - compressedStat.size;
    compressed.push(file);

    // Remove original after successful compression
    await fs.unlink(filePath);
  }

  return { compressed, skipped, savedBytes };
}

/** JSONL storage with transparent gzip compression support */
export class CompressedJsonlStorage implements TraceStorage {
  private dir: string;
  private compress: boolean;

  constructor(dir?: string, compress = true) {
    this.dir = dir ?? join(process.cwd(), "traces");
    this.compress = compress;
  }

  async save(trace: SerializedTrace): Promise<void> {
    await fs.mkdir(this.dir, { recursive: true });
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

    const content = lines.join("\n") + "\n";

    if (this.compress) {
      const compressed = await compressBuffer(content);
      await fs.writeFile(join(this.dir, `${trace.id}.jsonl.gz`), compressed);
    } else {
      await fs.writeFile(join(this.dir, `${trace.id}.jsonl`), content, "utf-8");
    }
  }

  async load(id: TraceId): Promise<SerializedTrace | null> {
    // Try compressed first, then uncompressed
    const gzPath = join(this.dir, `${id}.jsonl.gz`);
    const plainPath = join(this.dir, `${id}.jsonl`);

    try {
      let content: string;
      try {
        content = await readAutoDetect(gzPath);
      } catch {
        content = await fs.readFile(plainPath, "utf-8");
      }
      return this.parseJsonl(content);
    } catch {
      return null;
    }
  }

  async list(): Promise<TraceId[]> {
    try {
      const files = await fs.readdir(this.dir);
      return files
        .filter((f) => f.endsWith(".jsonl") || f.endsWith(".jsonl.gz"))
        .map((f) => f.replace(/\.jsonl(\.gz)?$/, ""));
    } catch {
      return [];
    }
  }

  async delete(id: TraceId): Promise<void> {
    const gzPath = join(this.dir, `${id}.jsonl.gz`);
    const plainPath = join(this.dir, `${id}.jsonl`);
    await fs.unlink(gzPath).catch(() => {});
    await fs.unlink(plainPath).catch(() => {});
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
        trace.steps.push(record.data as SerializedTrace["steps"][0]);
      } else if (record.type === "trace_end" && trace) {
        const endData = record.data as { id: TraceId; summary: SerializedTrace["summary"] };
        trace.summary = endData.summary;
      }
    }

    return trace;
  }
}
