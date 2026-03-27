import chalk from "chalk";
import ora from "ora";
import { diffTraces, computeTraceSummary } from "@agent-replay/core";
import type { TraceDiff, Step } from "@agent-replay/core";
import { loadTrace } from "../utils/loader.js";
import {
  printBanner,
  separator,
  formatDuration,
  formatCost,
  formatDelta,
  colorForStepType,
  symbolForStepType,
} from "../utils/format.js";

export async function diffCommand(fileA: string, fileB: string): Promise<void> {
  printBanner();

  const spinner = ora({
    text: chalk.dim("Loading traces..."),
    prefixText: " ",
  }).start();

  let traceA, traceB;
  try {
    traceA = await loadTrace(fileA);
    traceB = await loadTrace(fileB);

    // Ensure summaries exist
    if (!traceA.summary) {
      traceA.summary = computeTraceSummary(traceA);
    }
    if (!traceB.summary) {
      traceB.summary = computeTraceSummary(traceB);
    }

    spinner.succeed(chalk.green("Traces loaded"));
  } catch (err) {
    spinner.fail(chalk.red(`Failed to load traces: ${(err as Error).message}`));
    process.exit(1);
  }

  const diff = diffTraces(traceA, traceB);

  console.log();
  console.log(chalk.bold("  Trace Diff"));
  console.log(separator());
  console.log(`  ${chalk.dim("A:")} ${chalk.red(traceA.name)} ${chalk.dim(`(${traceA.id.slice(0, 8)}...)`)}`);
  console.log(`  ${chalk.dim("B:")} ${chalk.green(traceB.name)} ${chalk.dim(`(${traceB.id.slice(0, 8)}...)`)}`);
  console.log(separator());

  // Summary
  console.log();
  console.log(chalk.bold("  Summary"));
  console.log(`  ${chalk.dim("Steps:")}    ${formatDelta(diff.summary.stepCountDiff)}`);
  console.log(`  ${chalk.dim("Tokens:")}   ${formatDelta(diff.summary.tokenDiff)}`);
  console.log(`  ${chalk.dim("Cost:")}     ${formatDelta(diff.summary.costDiff, "")}`);
  console.log(`  ${chalk.dim("Duration:")} ${formatDelta(diff.summary.durationDiff, "ms")}`);

  // Added steps
  if (diff.added.length > 0) {
    console.log();
    console.log(chalk.bold.green(`  + Added Steps (${diff.added.length})`));
    for (const step of diff.added) {
      printDiffStep(step, "+");
    }
  }

  // Removed steps
  if (diff.removed.length > 0) {
    console.log();
    console.log(chalk.bold.red(`  - Removed Steps (${diff.removed.length})`));
    for (const step of diff.removed) {
      printDiffStep(step, "-");
    }
  }

  // Modified steps
  if (diff.modified.length > 0) {
    console.log();
    console.log(chalk.bold.yellow(`  ~ Modified Steps (${diff.modified.length})`));
    for (const mod of diff.modified) {
      const colorFn = colorForStepType(mod.before.type);
      const symbol = symbolForStepType(mod.before.type);
      console.log(`    ${symbol} ${colorFn(mod.before.name)}`);
      for (const change of mod.changes) {
        console.log(`      ${chalk.yellow("~")} ${chalk.dim(change)}`);
      }
    }
  }

  // No differences
  if (diff.added.length === 0 && diff.removed.length === 0 && diff.modified.length === 0) {
    console.log();
    console.log(chalk.dim("  No structural differences found."));
  }

  console.log();
  console.log(separator());
  console.log();
}

function printDiffStep(step: Step, prefix: string): void {
  const colorFn = prefix === "+" ? chalk.green : chalk.red;
  const symbol = symbolForStepType(step.type);
  const duration = step.duration ? chalk.dim(` ${formatDuration(step.duration)}`) : "";
  console.log(`    ${colorFn(prefix)} ${symbol} ${colorFn(step.name)}${duration}`);
}
