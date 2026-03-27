import { promises as fs } from "node:fs";
import chalk from "chalk";
import {
  deserializeTrace,
  type Trace,
  type Step,
  type StepType,
  type SerializedTrace,
  type JsonlRecord,
} from "@agent-replay/core";

/**
 * Load and deserialize a trace from a .jsonl or .json file.
 */
export async function loadTrace(filePath: string): Promise<Trace> {
  const content = await fs.readFile(filePath, "utf-8");

  if (filePath.endsWith(".jsonl")) {
    const serialized = parseJsonl(content);
    if (!serialized) {
      throw new Error(`Failed to parse JSONL trace file: ${filePath}`);
    }
    return deserializeTrace(serialized);
  }

  // Try plain JSON
  const data = JSON.parse(content) as SerializedTrace;
  return deserializeTrace(data);
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
      trace.steps.push(record.data as SerializedTrace["steps"][number]);
    } else if (record.type === "trace_end" && trace) {
      const endData = record.data as { id: string; summary: SerializedTrace["summary"] };
      trace.summary = endData.summary;
    }
  }

  return trace;
}

/**
 * Return a chalk color function for a given step type.
 */
export function colorForStepType(type: StepType): chalk.ChalkInstance {
  switch (type) {
    case "llm_call":
      return chalk.cyan;
    case "tool_call":
      return chalk.magenta;
    case "tool_result":
      return chalk.blue;
    case "decision":
      return chalk.yellow;
    case "error":
      return chalk.red;
    case "custom":
      return chalk.gray;
    default:
      return chalk.white;
  }
}

/**
 * Icon for each step type.
 */
export function iconForStepType(type: StepType): string {
  switch (type) {
    case "llm_call":
      return "LLM";
    case "tool_call":
      return "TOOL";
    case "tool_result":
      return "RESULT";
    case "decision":
      return "DECIDE";
    case "error":
      return "ERROR";
    case "custom":
      return "CUSTOM";
    default:
      return "STEP";
  }
}

/**
 * Print a step tree with indentation.
 */
export function printStepTree(steps: Step[], indent: number = 0): void {
  for (const step of steps) {
    const prefix = "  ".repeat(indent);
    const color = colorForStepType(step.type);
    const icon = iconForStepType(step.type);
    const tag = color(`[${icon}]`);
    const name = chalk.bold(step.name);
    const duration = step.duration != null ? chalk.dim(` (${formatDuration(step.duration)})`) : "";
    const tokens = step.tokens ? chalk.dim(` ${step.tokens.total} tok`) : "";
    const cost = step.cost != null ? chalk.dim(` $${step.cost.toFixed(4)}`) : "";
    const model = step.model ? chalk.dim(` (${step.model})`) : "";
    const errorMark = step.error ? chalk.red(" [FAILED]") : "";

    console.log(`${prefix}${tag} ${name}${model}${duration}${tokens}${cost}${errorMark}`);

    if (step.children.length > 0) {
      printStepTree(step.children, indent + 1);
    }
  }
}

/**
 * Format a duration in milliseconds to a human-readable string.
 */
export function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  const minutes = Math.floor(ms / 60000);
  const seconds = ((ms % 60000) / 1000).toFixed(0);
  return `${minutes}m ${seconds}s`;
}

/**
 * Format a simple table for terminal output.
 * Each row is an array of strings. The first row is treated as a header.
 */
export function formatTable(rows: string[][]): string {
  if (rows.length === 0) return "";

  const colWidths: number[] = [];
  for (const row of rows) {
    for (let i = 0; i < row.length; i++) {
      const len = stripAnsi(row[i] ?? "").length;
      colWidths[i] = Math.max(colWidths[i] ?? 0, len);
    }
  }

  const lines: string[] = [];
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r]!;
    const cells = row.map((cell, i) => {
      const padLen = (colWidths[i] ?? 0) - stripAnsi(cell).length;
      return cell + " ".repeat(Math.max(0, padLen));
    });
    lines.push("  " + cells.join("  "));
    if (r === 0) {
      const separator = colWidths.map((w) => "-".repeat(w));
      lines.push("  " + separator.join("  "));
    }
  }

  return lines.join("\n");
}

/**
 * Strip ANSI escape codes from a string.
 */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\u001B\[[0-9;]*m/g, "");
}

/**
 * Print an error message and exit with code 1.
 */
export function errorAndExit(message: string): never {
  console.error(chalk.red(`Error: ${message}`));
  process.exit(1);
}

/**
 * Format a number with sign prefix.
 */
export function formatDiff(value: number, unit: string = ""): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value}${unit}`;
}
