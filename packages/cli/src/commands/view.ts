import chalk from "chalk";
import ora from "ora";
import { computeTraceSummary } from "@agent-replay/core";
import type { Trace, Step } from "@agent-replay/core";
import { loadAllTraces } from "../utils/loader.js";
import {
  printBanner,
  separator,
  formatDuration,
  formatCost,
  formatTokens,
  symbolForStepType,
  colorForStepType,
  padRight,
} from "../utils/format.js";

interface ViewOptions {
  steps?: boolean;
  json?: boolean;
}

export async function viewCommand(path: string, options: ViewOptions): Promise<void> {
  printBanner();

  const spinner = ora({
    text: chalk.dim("Loading traces..."),
    prefixText: " ",
  }).start();

  let traces: Trace[];
  try {
    traces = await loadAllTraces(path);
    spinner.succeed(chalk.green(`Loaded ${traces.length} trace(s)`));
  } catch (err) {
    spinner.fail(chalk.red(`Failed to load traces: ${(err as Error).message}`));
    process.exit(1);
  }

  if (options.json) {
    console.log(JSON.stringify(traces, null, 2));
    return;
  }

  console.log();

  for (const trace of traces) {
    const summary = trace.summary ?? computeTraceSummary(trace);

    // Trace header
    console.log(chalk.bold(`  ${trace.name}`));
    console.log(separator());
    console.log(`  ${chalk.dim("ID:")}       ${chalk.cyan(trace.id)}`);
    console.log(`  ${chalk.dim("Started:")}  ${trace.startedAt.toLocaleString()}`);
    if (trace.endedAt) {
      console.log(`  ${chalk.dim("Ended:")}    ${trace.endedAt.toLocaleString()}`);
    }
    console.log(`  ${chalk.dim("Duration:")} ${formatDuration(trace.duration ?? summary.totalDuration)}`);
    console.log(`  ${chalk.dim("Steps:")}    ${summary.totalSteps}`);
    console.log(`  ${chalk.dim("Tokens:")}   ${formatTokens(summary.totalTokens)}`);
    console.log(`  ${chalk.dim("Cost:")}     ${formatCost(summary.totalCost)}`);
    if (summary.models.length > 0) {
      console.log(`  ${chalk.dim("Models:")}   ${summary.models.join(", ")}`);
    }
    if (summary.errorCount > 0) {
      console.log(`  ${chalk.dim("Errors:")}   ${chalk.red(String(summary.errorCount))}`);
    }

    // Step type breakdown
    console.log();
    console.log(chalk.dim("  Step breakdown:"));
    for (const [type, count] of Object.entries(summary.stepsByType)) {
      if (count > 0) {
        const colorFn = colorForStepType(type as any);
        console.log(`    ${colorFn(type.padEnd(14))} ${chalk.bold(String(count))}`);
      }
    }

    // Steps listing (if --steps flag is set)
    if (options.steps) {
      console.log();
      console.log(chalk.dim("  Steps:"));
      printSteps(trace.steps, 2);
    }

    console.log();
    console.log(separator());
    console.log();
  }
}

function printSteps(steps: Step[], indent: number): void {
  for (const step of steps) {
    const prefix = " ".repeat(indent);
    const symbol = symbolForStepType(step.type);
    const colorFn = colorForStepType(step.type);
    const duration = formatDuration(step.duration);
    const name = colorFn(step.name);

    let meta = chalk.dim(`[${step.type}]`) + " " + duration;
    if (step.model) {
      meta += chalk.dim(` (${step.model})`);
    }
    if (step.tokens) {
      meta += chalk.dim(` ${step.tokens.total}tok`);
    }
    if (step.cost) {
      meta += chalk.dim(` $${step.cost.toFixed(4)}`);
    }

    console.log(`${prefix}${symbol} ${name}  ${meta}`);

    if (step.error) {
      console.log(`${prefix}  ${chalk.red("Error:")} ${chalk.red(step.error.message)}`);
    }

    if (step.children.length > 0) {
      printSteps(step.children, indent + 2);
    }
  }
}
