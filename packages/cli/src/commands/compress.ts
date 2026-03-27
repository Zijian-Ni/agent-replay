import { resolve } from "node:path";
import chalk from "chalk";
import ora from "ora";
import { compressDirectory, compressFile, isCompressed } from "@agent-replay/core";
import { printBanner, separator } from "../utils/format.js";
import { promises as fs } from "node:fs";

export async function compressCommand(path: string): Promise<void> {
  printBanner();

  console.log(chalk.bold("  Compressing Trace Files"));
  console.log(separator());

  const absPath = resolve(path);
  const stat = await fs.stat(absPath);

  if (stat.isDirectory()) {
    const spinner = ora({
      text: chalk.dim("Compressing trace files..."),
      prefixText: " ",
    }).start();

    try {
      const result = await compressDirectory(absPath);
      spinner.succeed(chalk.green("Compression complete"));

      console.log();
      console.log(`  ${chalk.dim("Compressed:")} ${chalk.bold(String(result.compressed.length))} files`);
      console.log(`  ${chalk.dim("Skipped:")}    ${chalk.dim(String(result.skipped.length))} files`);
      console.log(`  ${chalk.dim("Saved:")}      ${chalk.green(formatBytes(result.savedBytes))}`);

      if (result.compressed.length > 0) {
        console.log();
        console.log(chalk.dim("  Compressed files:"));
        for (const file of result.compressed) {
          console.log(`    ${chalk.cyan(file)} → ${chalk.green(file + ".gz")}`);
        }
      }
    } catch (err) {
      spinner.fail(chalk.red(`Compression failed: ${(err as Error).message}`));
      process.exit(1);
    }
  } else {
    // Single file
    if (await isCompressed(absPath)) {
      console.log(chalk.yellow(`  File is already compressed: ${absPath}`));
      return;
    }

    const spinner = ora({
      text: chalk.dim(`Compressing ${absPath}...`),
      prefixText: " ",
    }).start();

    try {
      const originalStat = await fs.stat(absPath);
      const outPath = await compressFile(absPath);
      const compressedStat = await fs.stat(outPath);
      const saved = originalStat.size - compressedStat.size;
      const ratio = ((1 - compressedStat.size / originalStat.size) * 100).toFixed(1);

      spinner.succeed(chalk.green("Compressed"));
      console.log();
      console.log(`  ${chalk.dim("Original:")}   ${formatBytes(originalStat.size)}`);
      console.log(`  ${chalk.dim("Compressed:")} ${formatBytes(compressedStat.size)}`);
      console.log(`  ${chalk.dim("Saved:")}      ${chalk.green(formatBytes(saved))} (${ratio}%)`);
      console.log(`  ${chalk.dim("Output:")}     ${chalk.cyan(outPath)}`);
    } catch (err) {
      spinner.fail(chalk.red(`Compression failed: ${(err as Error).message}`));
      process.exit(1);
    }
  }

  console.log();
  console.log(separator());
  console.log();
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
