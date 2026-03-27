import { Command } from "commander";
import { recordCommand } from "./commands/record.js";
import { viewCommand } from "./commands/view.js";
import { diffCommand } from "./commands/diff.js";
import { statsCommand } from "./commands/stats.js";
import { exportCommand } from "./commands/export.js";

const program = new Command();

program
  .name("agent-replay")
  .description("Record, replay, and analyze AI agent traces")
  .version("0.1.0");

program
  .command("record")
  .description("Spawn a child process and record its trace")
  .option("-o, --output <dir>", "output directory for trace files", "./traces")
  .option("-n, --name <name>", "name for the trace")
  .argument("<args...>", "command and arguments to run (use -- before the command)")
  .action(async (args: string[], options: { output?: string; name?: string }) => {
    await recordCommand(args, options);
  });

program
  .command("view")
  .description("View trace files with a formatted summary")
  .argument("<path>", "path to a trace file or directory of traces")
  .option("-s, --steps", "show individual steps", false)
  .option("--json", "output as JSON", false)
  .action(async (path: string, options: { steps?: boolean; json?: boolean }) => {
    await viewCommand(path, options);
  });

program
  .command("diff")
  .description("Diff two trace files")
  .argument("<fileA>", "first trace file (JSONL)")
  .argument("<fileB>", "second trace file (JSONL)")
  .action(async (fileA: string, fileB: string) => {
    await diffCommand(fileA, fileB);
  });

program
  .command("stats")
  .description("Show statistics for traces")
  .argument("<path>", "path to a trace file or directory of traces")
  .option("--no-anomalies", "skip anomaly detection")
  .action(async (path: string, options: { anomalies?: boolean }) => {
    await statsCommand(path, options);
  });

program
  .command("export")
  .description("Export a trace to HTML")
  .argument("<file>", "trace file (JSONL)")
  .option("-f, --format <format>", "export format", "html")
  .option("-o, --output <file>", "output file path")
  .action(async (file: string, options: { format?: string; output?: string }) => {
    await exportCommand(file, options);
  });

program.parse();
