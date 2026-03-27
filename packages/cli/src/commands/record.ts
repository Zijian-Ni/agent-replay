import { spawn } from "node:child_process";
import { promises as fs } from "node:fs";
import { join, resolve, basename } from "node:path";
import { randomUUID } from "node:crypto";
import chalk from "chalk";
import ora from "ora";
import type { JsonlRecord, SerializedStep, SerializedTrace, TraceSummary, StepType } from "@agent-replay/core";
import { printBanner, separator, formatDuration } from "../utils/format.js";

interface RecordOptions {
  output?: string;
  name?: string;
}

export async function recordCommand(args: string[], options: RecordOptions): Promise<void> {
  printBanner();

  if (args.length === 0) {
    console.error(chalk.red("Error: No command specified."));
    console.log(chalk.dim("Usage: agent-replay record -- <command> [args...]"));
    process.exit(1);
  }

  const command = args[0]!;
  const commandArgs = args.slice(1);
  const traceName = options.name ?? `record-${basename(command)}`;
  const outputDir = resolve(options.output ?? "./traces");
  const traceId = randomUUID();
  const outputFile = join(outputDir, `${traceId}.jsonl`);

  await fs.mkdir(outputDir, { recursive: true });

  console.log(chalk.bold("  Recording trace"));
  console.log(separator());
  console.log(`  ${chalk.dim("Command:")}  ${chalk.white(command)} ${chalk.dim(commandArgs.join(" "))}`);
  console.log(`  ${chalk.dim("Trace ID:")} ${chalk.cyan(traceId)}`);
  console.log(`  ${chalk.dim("Output:")}   ${chalk.dim(outputFile)}`);
  console.log(separator());
  console.log();

  const startTime = new Date();
  const lines: string[] = [];

  // Write trace_start record
  const traceStartData: SerializedTrace = {
    id: traceId,
    name: traceName,
    startedAt: startTime.toISOString(),
    steps: [],
    metadata: {
      command,
      args: commandArgs,
      cwd: process.cwd(),
      recordedAt: startTime.toISOString(),
    },
  };

  const startRecord: JsonlRecord = {
    type: "trace_start",
    timestamp: startTime.toISOString(),
    data: traceStartData,
  };
  lines.push(JSON.stringify(startRecord));

  const spinner = ora({
    text: chalk.dim("Running command..."),
    prefixText: " ",
  }).start();

  const stdoutChunks: string[] = [];
  const stderrChunks: string[] = [];
  let stepIndex = 0;

  return new Promise<void>((resolvePromise) => {
    const child = spawn(command, commandArgs, {
      stdio: ["inherit", "pipe", "pipe"],
      shell: true,
      env: { ...process.env },
    });

    child.stdout?.on("data", (data: Buffer) => {
      const text = data.toString();
      stdoutChunks.push(text);
      spinner.text = chalk.dim(`Running... (stdout: ${stdoutChunks.length} chunks)`);
    });

    child.stderr?.on("data", (data: Buffer) => {
      const text = data.toString();
      stderrChunks.push(text);
    });

    child.on("close", async (code) => {
      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      if (code === 0) {
        spinner.succeed(chalk.green("Command completed successfully"));
      } else {
        spinner.fail(chalk.red(`Command exited with code ${code}`));
      }

      // Create a tool_call step for the process execution
      const execStepId = randomUUID();
      const execStep: SerializedStep = {
        id: execStepId,
        type: "tool_call" as StepType,
        name: `exec: ${command}`,
        startedAt: startTime.toISOString(),
        endedAt: endTime.toISOString(),
        duration,
        input: {
          command,
          args: commandArgs,
          cwd: process.cwd(),
        },
        output: {
          exitCode: code,
          stdout: stdoutChunks.join(""),
          stderr: stderrChunks.join(""),
        },
        error: code !== 0 ? {
          message: `Process exited with code ${code}`,
          code: String(code),
        } : undefined,
        children: [],
      };

      const stepRecord: JsonlRecord = {
        type: "step",
        timestamp: startTime.toISOString(),
        data: execStep,
      };
      lines.push(JSON.stringify(stepRecord));

      // If there's stdout, create additional steps for each meaningful output chunk
      if (stdoutChunks.length > 0) {
        const resultStepId = randomUUID();
        const resultStep: SerializedStep = {
          id: resultStepId,
          parentId: execStepId,
          type: "tool_result" as StepType,
          name: `stdout: ${command}`,
          startedAt: startTime.toISOString(),
          endedAt: endTime.toISOString(),
          duration,
          input: { source: "stdout" },
          output: stdoutChunks.join(""),
          children: [],
        };

        const resultRecord: JsonlRecord = {
          type: "step",
          timestamp: endTime.toISOString(),
          data: resultStep,
        };
        lines.push(JSON.stringify(resultRecord));
        stepIndex++;
      }

      // If there's stderr output, capture it as a step
      if (stderrChunks.length > 0) {
        const stderrStepId = randomUUID();
        const stderrStepType: StepType = code !== 0 ? "error" : "tool_result";
        const stderrStep: SerializedStep = {
          id: stderrStepId,
          parentId: execStepId,
          type: stderrStepType,
          name: `stderr: ${command}`,
          startedAt: startTime.toISOString(),
          endedAt: endTime.toISOString(),
          duration,
          input: { source: "stderr" },
          output: stderrChunks.join(""),
          error: code !== 0 ? {
            message: stderrChunks.join("").trim().slice(0, 200),
          } : undefined,
          children: [],
        };

        const stderrRecord: JsonlRecord = {
          type: "step",
          timestamp: endTime.toISOString(),
          data: stderrStep,
        };
        lines.push(JSON.stringify(stderrRecord));
        stepIndex++;
      }

      // Write trace_end record with summary
      const totalSteps = stepIndex + 1; // +1 for the exec step
      const summary: TraceSummary = {
        totalSteps,
        totalTokens: { prompt: 0, completion: 0, total: 0 },
        totalCost: 0,
        totalDuration: duration,
        stepsByType: {
          tool_call: 1,
          tool_result: stdoutChunks.length > 0 ? 1 : 0,
          error: (code !== 0 && stderrChunks.length > 0) ? 1 : 0,
          llm_call: 0,
          decision: 0,
          custom: 0,
        } as Record<StepType, number>,
        models: [],
        errorCount: code !== 0 ? 1 : 0,
      };

      const endRecord: JsonlRecord = {
        type: "trace_end",
        timestamp: endTime.toISOString(),
        data: { id: traceId, summary },
      };
      lines.push(JSON.stringify(endRecord));

      // Write all lines to the output file
      await fs.writeFile(outputFile, lines.join("\n") + "\n", "utf-8");

      console.log();
      console.log(separator());
      console.log(`  ${chalk.dim("Duration:")} ${formatDuration(duration)}`);
      console.log(`  ${chalk.dim("Steps:")}    ${totalSteps}`);
      console.log(`  ${chalk.dim("Output:")}   ${chalk.cyan(outputFile)}`);
      console.log(separator());
      console.log();

      resolvePromise();
    });

    child.on("error", async (err) => {
      spinner.fail(chalk.red(`Failed to spawn command: ${err.message}`));

      const endTime = new Date();
      const duration = endTime.getTime() - startTime.getTime();

      const errorStep: SerializedStep = {
        id: randomUUID(),
        type: "error" as StepType,
        name: `exec: ${command}`,
        startedAt: startTime.toISOString(),
        endedAt: endTime.toISOString(),
        duration,
        input: { command, args: commandArgs },
        error: {
          message: err.message,
          stack: err.stack,
        },
        children: [],
      };

      const stepRecord: JsonlRecord = {
        type: "step",
        timestamp: startTime.toISOString(),
        data: errorStep,
      };
      lines.push(JSON.stringify(stepRecord));

      const summary: TraceSummary = {
        totalSteps: 1,
        totalTokens: { prompt: 0, completion: 0, total: 0 },
        totalCost: 0,
        totalDuration: duration,
        stepsByType: {
          error: 1,
          tool_call: 0,
          tool_result: 0,
          llm_call: 0,
          decision: 0,
          custom: 0,
        } as Record<StepType, number>,
        models: [],
        errorCount: 1,
      };

      const endRecord: JsonlRecord = {
        type: "trace_end",
        timestamp: endTime.toISOString(),
        data: { id: traceId, summary },
      };
      lines.push(JSON.stringify(endRecord));

      await fs.writeFile(outputFile, lines.join("\n") + "\n", "utf-8");
      process.exit(1);
    });
  });
}
