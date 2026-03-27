import { promises as fs } from "node:fs";
import { resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import chalk from "chalk";
import ora from "ora";
import {
  deserializeTrace,
  serializeTrace,
  computeTraceSummary,
} from "@agent-replay/core";
import type { Trace, JsonlRecord, SerializedTrace, SerializedStep, TraceId } from "@agent-replay/core";
import { printBanner, separator, formatDuration } from "../utils/format.js";

interface MergeOptions {
  output?: string;
  name?: string;
}

export async function mergeCommand(files: string[], options: MergeOptions): Promise<void> {
  printBanner();

  console.log(chalk.bold("  Merging Trace Files"));
  console.log(separator());

  if (files.length < 2) {
    console.error(chalk.red("  Error: Need at least 2 trace files to merge"));
    process.exit(1);
  }

  const spinner = ora({
    text: chalk.dim("Loading trace files..."),
    prefixText: " ",
  }).start();

  const traces: Trace[] = [];
  for (const file of files) {
    const absPath = resolve(file);
    try {
      const content = await fs.readFile(absPath, "utf-8");
      const serialized = parseJsonl(content);
      if (serialized) {
        traces.push(deserializeTrace(serialized));
      }
    } catch (err) {
      spinner.fail(chalk.red(`Failed to load ${file}: ${(err as Error).message}`));
      process.exit(1);
    }
  }

  spinner.text = chalk.dim("Merging traces...");

  // Merge all steps from all traces, sorted by startedAt
  const allSteps = traces.flatMap((t) => t.steps).sort(
    (a, b) => a.startedAt.getTime() - b.startedAt.getTime(),
  );

  const mergedTrace: Trace = {
    id: randomUUID(),
    name: options.name ?? `merged-${traces.map((t) => t.name).join("+")}`,
    startedAt: new Date(Math.min(...traces.map((t) => t.startedAt.getTime()))),
    endedAt: new Date(Math.max(...traces.map((t) => (t.endedAt ?? t.startedAt).getTime()))),
    steps: allSteps,
    metadata: {
      mergedFrom: traces.map((t) => ({ id: t.id, name: t.name })),
      mergedAt: new Date().toISOString(),
    },
  };

  mergedTrace.duration = mergedTrace.endedAt!.getTime() - mergedTrace.startedAt.getTime();
  mergedTrace.summary = computeTraceSummary(mergedTrace);

  // Serialize and write
  const serialized = serializeTrace(mergedTrace);
  const outputFile = resolve(options.output ?? `./merged-${Date.now()}.jsonl`);

  const lines: string[] = [];

  const startRecord: JsonlRecord = {
    type: "trace_start",
    timestamp: serialized.startedAt,
    data: { ...serialized, steps: [] },
  };
  lines.push(JSON.stringify(startRecord));

  for (const step of serialized.steps) {
    const stepRecord: JsonlRecord = {
      type: "step",
      timestamp: step.startedAt,
      data: step,
    };
    lines.push(JSON.stringify(stepRecord));
  }

  const endRecord: JsonlRecord = {
    type: "trace_end",
    timestamp: serialized.endedAt ?? serialized.startedAt,
    data: { id: serialized.id, summary: serialized.summary! },
  };
  lines.push(JSON.stringify(endRecord));

  await fs.writeFile(outputFile, lines.join("\n") + "\n", "utf-8");

  spinner.succeed(chalk.green("Traces merged successfully"));
  console.log();
  console.log(`  ${chalk.dim("Sources:")}  ${traces.length} trace files`);
  console.log(`  ${chalk.dim("Steps:")}    ${mergedTrace.summary!.totalSteps}`);
  console.log(`  ${chalk.dim("Duration:")} ${formatDuration(mergedTrace.duration)}`);
  console.log(`  ${chalk.dim("Output:")}   ${chalk.cyan(outputFile)}`);
  console.log();
  console.log(separator());
  console.log();
}

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
