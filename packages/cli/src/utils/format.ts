import chalk from "chalk";
import type { StepType } from "@agent-replay/core";

/** Format a duration in milliseconds to a human-readable string */
export function formatDuration(ms: number | undefined): string {
  if (ms === undefined || ms === null) return chalk.dim("--");
  if (ms < 1000) return `${Math.round(ms)}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)}s`;
  const mins = Math.floor(ms / 60_000);
  const secs = ((ms % 60_000) / 1000).toFixed(0);
  return `${mins}m ${secs}s`;
}

/** Format a cost in USD */
export function formatCost(cost: number | undefined): string {
  if (cost === undefined || cost === null || cost === 0) return chalk.dim("$0.00");
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  return `$${cost.toFixed(2)}`;
}

/** Format token counts */
export function formatTokens(tokens: { prompt: number; completion: number; total: number } | undefined): string {
  if (!tokens || tokens.total === 0) return chalk.dim("0");
  const parts: string[] = [];
  parts.push(chalk.cyan(`${tokens.prompt.toLocaleString()}`) + chalk.dim(" in"));
  parts.push(chalk.magenta(`${tokens.completion.toLocaleString()}`) + chalk.dim(" out"));
  parts.push(chalk.bold(`${tokens.total.toLocaleString()}`) + chalk.dim(" total"));
  return parts.join(chalk.dim(" / "));
}

/** Get a chalk color function for a given step type */
export function colorForStepType(type: StepType): (text: string) => string {
  switch (type) {
    case "llm_call":
      return chalk.blue;
    case "tool_call":
      return chalk.green;
    case "tool_result":
      return chalk.greenBright;
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

/** Get a symbol for a step type */
export function symbolForStepType(type: StepType): string {
  switch (type) {
    case "llm_call":
      return colorForStepType(type)("◆");
    case "tool_call":
      return colorForStepType(type)("▶");
    case "tool_result":
      return colorForStepType(type)("◀");
    case "decision":
      return colorForStepType(type)("◇");
    case "error":
      return colorForStepType(type)("✗");
    case "custom":
      return colorForStepType(type)("○");
    default:
      return "·";
  }
}

/** Print the Agent Replay banner */
export function printBanner(): void {
  console.log();
  console.log(chalk.bold.cyan("  Agent Replay"));
  console.log(chalk.dim("  Record, replay, and analyze AI agent traces"));
  console.log();
}

/** Format a separator line */
export function separator(width: number = 60): string {
  return chalk.dim("─".repeat(width));
}

/** Right-pad a string to a given width */
export function padRight(str: string, width: number): string {
  const stripped = stripAnsi(str);
  if (stripped.length >= width) return str;
  return str + " ".repeat(width - stripped.length);
}

/** Strip ANSI escape codes for length calculation */
function stripAnsi(str: string): string {
  // eslint-disable-next-line no-control-regex
  return str.replace(/\x1b\[[0-9;]*m/g, "");
}

/** Format a number with sign (e.g., +5 or -3) */
export function formatDelta(value: number, unit: string = ""): string {
  const sign = value > 0 ? "+" : "";
  const formatted = `${sign}${value}${unit}`;
  if (value > 0) return chalk.red(formatted);
  if (value < 0) return chalk.green(formatted);
  return chalk.dim(formatted);
}
