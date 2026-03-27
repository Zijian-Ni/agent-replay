import { Command } from "commander";
import chalk from "chalk";
import { AgentReplayer, type Step } from "@agent-replay/core";
import { loadTrace, colorForStepType, iconForStepType, formatDuration, errorAndExit } from "../utils.js";
import { createInterface } from "node:readline";

export const replayCommand = new Command("replay")
  .description("Replay an agent trace step-by-step")
  .argument("<trace-file>", "Path to the trace file (.json or .jsonl)")
  .option("-s, --speed <multiplier>", "Playback speed multiplier (e.g., 2 for 2x speed)", "1")
  .option("--step", "Step-through mode (press Enter to advance)")
  .action(async (traceFile: string, options) => {
    const speed = parseFloat(options.speed);
    const stepMode = options.step as boolean;

    let trace;
    try {
      trace = await loadTrace(traceFile);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      errorAndExit(`Failed to load trace: ${msg}`);
    }

    console.log(chalk.bold("\n  Agent Replay - Playback\n"));
    console.log(`  ${chalk.dim("Trace:")}    ${trace.name} ${chalk.dim(`(${trace.id})`)}`);
    console.log(`  ${chalk.dim("Started:")}  ${trace.startedAt.toISOString()}`);
    if (trace.summary) {
      console.log(`  ${chalk.dim("Steps:")}    ${trace.summary.totalSteps}`);
      console.log(`  ${chalk.dim("Duration:")} ${formatDuration(trace.summary.totalDuration)}`);
    }
    console.log(`  ${chalk.dim("Speed:")}    ${speed}x${stepMode ? " (step mode)" : ""}`);
    console.log();
    console.log(chalk.dim("  " + "-".repeat(60)));
    console.log();

    let rl: ReturnType<typeof createInterface> | null = null;
    if (stepMode) {
      rl = createInterface({ input: process.stdin, output: process.stdout });
    }

    const replayer = new AgentReplayer(trace, {
      speed: stepMode ? undefined : speed,
      onStep: async (step: Step, index: number) => {
        printStep(step, index, replayer.totalSteps);

        if (stepMode && rl) {
          await new Promise<void>((resolve) => {
            rl!.question(chalk.dim("  Press Enter to continue..."), () => {
              resolve();
            });
          });
        }
      },
    });

    try {
      await replayer.replayAll();

      console.log();
      console.log(chalk.dim("  " + "-".repeat(60)));
      console.log();
      console.log(chalk.green.bold("  Replay complete!"));
      console.log();
    } finally {
      if (rl) rl.close();
    }
  });

function printStep(step: Step, index: number, total: number): void {
  const color = colorForStepType(step.type);
  const icon = iconForStepType(step.type);
  const counter = chalk.dim(`[${index + 1}/${total}]`);
  const tag = color(`[${icon}]`);
  const name = chalk.bold(step.name);

  console.log(`  ${counter} ${tag} ${name}`);

  if (step.model) {
    console.log(`         ${chalk.dim("Model:")} ${step.model}`);
  }

  if (step.duration != null) {
    console.log(`         ${chalk.dim("Duration:")} ${formatDuration(step.duration)}`);
  }

  if (step.tokens) {
    console.log(
      `         ${chalk.dim("Tokens:")} ${step.tokens.prompt} prompt + ${step.tokens.completion} completion = ${step.tokens.total} total`
    );
  }

  if (step.cost != null) {
    console.log(`         ${chalk.dim("Cost:")} $${step.cost.toFixed(4)}`);
  }

  if (step.error) {
    console.log(`         ${chalk.red("Error:")} ${step.error.message}`);
  }

  // Show a brief preview of input/output
  if (step.input != null) {
    const inputStr = truncate(JSON.stringify(step.input), 100);
    console.log(`         ${chalk.dim("Input:")} ${chalk.dim(inputStr)}`);
  }

  if (step.output != null) {
    const outputStr = truncate(JSON.stringify(step.output), 100);
    console.log(`         ${chalk.dim("Output:")} ${chalk.dim(outputStr)}`);
  }

  console.log();
}

function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen - 3) + "...";
}
