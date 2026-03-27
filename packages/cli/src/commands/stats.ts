import chalk from "chalk";
import ora from "ora";
import { analyzeCost, detectAnomalies, computeTraceSummary } from "@agent-replay/core";
import type { Trace, CostBreakdown, Anomaly } from "@agent-replay/core";
import { loadAllTraces } from "../utils/loader.js";
import {
  printBanner,
  separator,
  formatDuration,
  formatCost,
  formatTokens,
  colorForStepType,
} from "../utils/format.js";

interface StatsOptions {
  anomalies?: boolean;
}

export async function statsCommand(path: string, options: StatsOptions): Promise<void> {
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

  // Ensure all traces have summaries
  for (const trace of traces) {
    if (!trace.summary) {
      trace.summary = computeTraceSummary(trace);
    }
  }

  console.log();
  console.log(chalk.bold("  Trace Statistics"));
  console.log(separator());

  // Overview
  const totalSteps = traces.reduce((sum, t) => sum + (t.summary?.totalSteps ?? 0), 0);
  const totalTokens = traces.reduce(
    (acc, t) => ({
      prompt: acc.prompt + (t.summary?.totalTokens.prompt ?? 0),
      completion: acc.completion + (t.summary?.totalTokens.completion ?? 0),
      total: acc.total + (t.summary?.totalTokens.total ?? 0),
    }),
    { prompt: 0, completion: 0, total: 0 }
  );
  const totalCost = traces.reduce((sum, t) => sum + (t.summary?.totalCost ?? 0), 0);
  const totalDuration = traces.reduce((sum, t) => sum + (t.summary?.totalDuration ?? 0), 0);
  const totalErrors = traces.reduce((sum, t) => sum + (t.summary?.errorCount ?? 0), 0);

  console.log(`  ${chalk.dim("Traces:")}   ${chalk.bold(String(traces.length))}`);
  console.log(`  ${chalk.dim("Steps:")}    ${chalk.bold(String(totalSteps))}`);
  console.log(`  ${chalk.dim("Tokens:")}   ${formatTokens(totalTokens)}`);
  console.log(`  ${chalk.dim("Cost:")}     ${formatCost(totalCost)}`);
  console.log(`  ${chalk.dim("Duration:")} ${formatDuration(totalDuration)}`);
  if (totalErrors > 0) {
    console.log(`  ${chalk.dim("Errors:")}   ${chalk.red(String(totalErrors))}`);
  }

  // Per-trace table
  console.log();
  console.log(chalk.bold("  Per-Trace Breakdown"));
  console.log(separator());

  const nameWidth = 30;
  const colWidth = 12;
  const header =
    "  " +
    chalk.dim("Name".padEnd(nameWidth)) +
    chalk.dim("Steps".padStart(colWidth)) +
    chalk.dim("Tokens".padStart(colWidth)) +
    chalk.dim("Cost".padStart(colWidth)) +
    chalk.dim("Duration".padStart(colWidth)) +
    chalk.dim("Errors".padStart(colWidth));
  console.log(header);
  console.log(chalk.dim("  " + "─".repeat(nameWidth + colWidth * 5)));

  for (const trace of traces) {
    const s = trace.summary!;
    const name = trace.name.length > nameWidth - 1
      ? trace.name.slice(0, nameWidth - 4) + "..."
      : trace.name;

    const row =
      "  " +
      chalk.white(name.padEnd(nameWidth)) +
      String(s.totalSteps).padStart(colWidth) +
      String(s.totalTokens.total.toLocaleString()).padStart(colWidth) +
      formatCost(s.totalCost).padStart(colWidth) +
      formatDuration(s.totalDuration).padStart(colWidth) +
      (s.errorCount > 0
        ? chalk.red(String(s.errorCount).padStart(colWidth))
        : chalk.dim("0".padStart(colWidth)));
    console.log(row);
  }

  // Cost breakdown (aggregate across all traces)
  if (traces.length > 0) {
    console.log();
    console.log(chalk.bold("  Cost Breakdown by Model"));
    console.log(separator());

    const aggregateCost: CostBreakdown = {
      byModel: {},
      byStepType: {},
      total: 0,
    };

    for (const trace of traces) {
      const cost = analyzeCost(trace);
      aggregateCost.total += cost.total;

      for (const [model, data] of Object.entries(cost.byModel)) {
        if (!aggregateCost.byModel[model]) {
          aggregateCost.byModel[model] = { tokens: { prompt: 0, completion: 0, total: 0 }, cost: 0, calls: 0 };
        }
        const entry = aggregateCost.byModel[model]!;
        entry.tokens.prompt += data.tokens.prompt;
        entry.tokens.completion += data.tokens.completion;
        entry.tokens.total += data.tokens.total;
        entry.cost += data.cost;
        entry.calls += data.calls;
      }

      for (const [type, data] of Object.entries(cost.byStepType)) {
        if (!aggregateCost.byStepType[type]) {
          aggregateCost.byStepType[type] = { cost: 0, count: 0 };
        }
        aggregateCost.byStepType[type]!.cost += data.cost;
        aggregateCost.byStepType[type]!.count += data.count;
      }
    }

    if (Object.keys(aggregateCost.byModel).length > 0) {
      for (const [model, data] of Object.entries(aggregateCost.byModel)) {
        console.log(
          `  ${chalk.cyan(model.padEnd(25))} ` +
          `${chalk.dim("calls:")} ${String(data.calls).padStart(4)}  ` +
          `${chalk.dim("tokens:")} ${String(data.tokens.total.toLocaleString()).padStart(8)}  ` +
          `${chalk.dim("cost:")} ${formatCost(data.cost)}`
        );
      }
    } else {
      console.log(chalk.dim("  No model cost data available."));
    }

    // Step type breakdown
    console.log();
    console.log(chalk.bold("  Step Type Breakdown"));
    console.log(separator());

    if (Object.keys(aggregateCost.byStepType).length > 0) {
      for (const [type, data] of Object.entries(aggregateCost.byStepType)) {
        const colorFn = colorForStepType(type as any);
        console.log(
          `  ${colorFn(type.padEnd(15))} ` +
          `${chalk.dim("count:")} ${String(data.count).padStart(4)}  ` +
          `${chalk.dim("cost:")} ${formatCost(data.cost)}`
        );
      }
    } else {
      console.log(chalk.dim("  No step type data available."));
    }
  }

  // Anomaly detection
  if (options.anomalies !== false) {
    console.log();
    console.log(chalk.bold("  Anomaly Detection"));
    console.log(separator());

    let totalAnomalies = 0;
    for (const trace of traces) {
      const anomalies = detectAnomalies(trace);
      if (anomalies.length > 0) {
        console.log(`  ${chalk.dim("Trace:")} ${chalk.white(trace.name)}`);
        for (const anomaly of anomalies) {
          const severityColor =
            anomaly.severity === "high" ? chalk.red
            : anomaly.severity === "medium" ? chalk.yellow
            : chalk.dim;
          const severityLabel = severityColor(`[${anomaly.severity.toUpperCase()}]`);
          console.log(`    ${severityLabel} ${anomaly.message}`);
          totalAnomalies++;
        }
        console.log();
      }
    }

    if (totalAnomalies === 0) {
      console.log(chalk.green("  No anomalies detected."));
    }
  }

  console.log();
  console.log(separator());
  console.log();
}
