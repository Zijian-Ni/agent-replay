import { promises as fs } from "node:fs";
import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import type { JsonlRecord, SerializedTrace, SerializedStep, TraceSummary } from "@agent-replay/core";
import { printBanner, separator } from "../utils/format.js";

interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  stats: {
    lines: number;
    steps: number;
    hasStart: boolean;
    hasEnd: boolean;
  };
}

export async function validateCommand(filePath: string): Promise<void> {
  printBanner();

  console.log(chalk.bold("  Validating Trace File"));
  console.log(separator());

  const absPath = resolve(filePath);

  const spinner = ora({
    text: chalk.dim(`Validating ${absPath}...`),
    prefixText: " ",
  }).start();

  let content: string;
  try {
    content = await fs.readFile(absPath, "utf-8");
  } catch (err) {
    spinner.fail(chalk.red(`Cannot read file: ${(err as Error).message}`));
    process.exit(1);
    return;
  }

  const result = validateJsonl(content);

  if (result.valid) {
    spinner.succeed(chalk.green("Trace file is valid"));
  } else {
    spinner.fail(chalk.red("Trace file has errors"));
  }

  console.log();
  console.log(`  ${chalk.dim("File:")}     ${chalk.cyan(absPath)}`);
  console.log(`  ${chalk.dim("Lines:")}    ${result.stats.lines}`);
  console.log(`  ${chalk.dim("Steps:")}    ${result.stats.steps}`);
  console.log(`  ${chalk.dim("Has start:")} ${result.stats.hasStart ? chalk.green("yes") : chalk.red("no")}`);
  console.log(`  ${chalk.dim("Has end:")}   ${result.stats.hasEnd ? chalk.green("yes") : chalk.red("no")}`);

  if (result.errors.length > 0) {
    console.log();
    console.log(chalk.red("  Errors:"));
    for (const err of result.errors) {
      console.log(`    ${chalk.red("✗")} ${err}`);
    }
  }

  if (result.warnings.length > 0) {
    console.log();
    console.log(chalk.yellow("  Warnings:"));
    for (const warn of result.warnings) {
      console.log(`    ${chalk.yellow("⚠")} ${warn}`);
    }
  }

  console.log();
  console.log(separator());
  console.log();

  if (!result.valid) {
    process.exit(1);
  }
}

function validateJsonl(content: string): ValidationResult {
  const result: ValidationResult = {
    valid: true,
    errors: [],
    warnings: [],
    stats: { lines: 0, steps: 0, hasStart: false, hasEnd: false },
  };

  const lines = content.trim().split("\n").filter(Boolean);
  result.stats.lines = lines.length;

  if (lines.length === 0) {
    result.valid = false;
    result.errors.push("File is empty");
    return result;
  }

  let traceId: string | null = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    let record: JsonlRecord;

    try {
      record = JSON.parse(line) as JsonlRecord;
    } catch {
      result.valid = false;
      result.errors.push(`Line ${i + 1}: Invalid JSON`);
      continue;
    }

    // Validate record structure
    if (!record.type) {
      result.valid = false;
      result.errors.push(`Line ${i + 1}: Missing "type" field`);
      continue;
    }

    if (!record.timestamp) {
      result.warnings.push(`Line ${i + 1}: Missing "timestamp" field`);
    }

    if (!record.data) {
      result.valid = false;
      result.errors.push(`Line ${i + 1}: Missing "data" field`);
      continue;
    }

    const validTypes = ["trace_start", "step", "trace_end"];
    if (!validTypes.includes(record.type)) {
      result.valid = false;
      result.errors.push(`Line ${i + 1}: Invalid record type "${record.type}"`);
      continue;
    }

    if (record.type === "trace_start") {
      if (result.stats.hasStart) {
        result.warnings.push(`Line ${i + 1}: Duplicate trace_start record`);
      }
      result.stats.hasStart = true;
      const data = record.data as SerializedTrace;
      if (!data.id) {
        result.valid = false;
        result.errors.push(`Line ${i + 1}: trace_start missing "id"`);
      } else {
        traceId = data.id;
      }
      if (!data.name) {
        result.warnings.push(`Line ${i + 1}: trace_start missing "name"`);
      }
    }

    if (record.type === "step") {
      result.stats.steps++;
      const data = record.data as SerializedStep;
      if (!data.id) {
        result.valid = false;
        result.errors.push(`Line ${i + 1}: step missing "id"`);
      }
      if (!data.type) {
        result.valid = false;
        result.errors.push(`Line ${i + 1}: step missing "type"`);
      }
      if (!data.name) {
        result.warnings.push(`Line ${i + 1}: step missing "name"`);
      }
    }

    if (record.type === "trace_end") {
      if (result.stats.hasEnd) {
        result.warnings.push(`Line ${i + 1}: Duplicate trace_end record`);
      }
      result.stats.hasEnd = true;
      const data = record.data as { id: string; summary: TraceSummary };
      if (!data.id) {
        result.valid = false;
        result.errors.push(`Line ${i + 1}: trace_end missing "id"`);
      } else if (traceId && data.id !== traceId) {
        result.warnings.push(`Line ${i + 1}: trace_end ID doesn't match trace_start ID`);
      }
    }
  }

  if (!result.stats.hasStart) {
    result.valid = false;
    result.errors.push("Missing trace_start record");
  }

  if (!result.stats.hasEnd) {
    result.warnings.push("Missing trace_end record (trace may be incomplete)");
  }

  return result;
}
