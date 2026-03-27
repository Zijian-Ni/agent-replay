/**
 * Example: Custom Agent with Manual Recording
 *
 * This example demonstrates advanced Agent Replay features:
 * - Manual step recording with startStep/endStep
 * - interceptFunction for wrapping custom tools
 * - Nested steps (parent/child relationships)
 * - Error handling
 * - Comparing two trace runs with diffTraces
 * - Anomaly detection
 *
 * Run:
 *   pnpm start
 */

import {
  AgentRecorder,
  interceptFunction,
  diffTraces,
  detectAnomalies,
  analyzeCost,
  generateTimeline,
} from "@agent-replay/core";

// --- Simulated tools ---

async function searchDatabase(query: string): Promise<{ results: string[]; count: number }> {
  // Simulate a database search with variable latency
  await sleep(Math.random() * 200 + 50);
  const allItems = [
    "Introduction to Machine Learning",
    "Deep Learning Fundamentals",
    "Natural Language Processing",
    "Computer Vision Techniques",
    "Reinforcement Learning",
  ];
  const results = allItems.filter((item) =>
    item.toLowerCase().includes(query.toLowerCase())
  );
  return { results, count: results.length };
}

async function summarizeText(text: string): Promise<string> {
  await sleep(100);
  // Simulate an LLM summarization call
  return `Summary of "${text.substring(0, 50)}...": This covers key concepts and techniques.`;
}

async function riskyOperation(): Promise<string> {
  await sleep(50);
  // This tool sometimes fails
  if (Math.random() > 0.5) {
    throw new Error("Connection timeout: service unavailable");
  }
  return "Operation completed successfully";
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- Run a single agent session ---

async function runAgentSession(sessionName: string): Promise<ReturnType<AgentRecorder["stop"]>> {
  const recorder = new AgentRecorder({
    name: sessionName,
    storage: "file",
    outputDir: "./traces",
    metadata: {
      example: "custom-agent",
      version: "1.0.0",
    },
  });

  // Wrap tools with interceptFunction for automatic recording
  const search = interceptFunction(searchDatabase, recorder, {
    name: "searchDatabase",
    type: "tool_call",
  });
  const summarize = interceptFunction(summarizeText, recorder, {
    name: "summarizeText",
    type: "tool_call",
  });

  // --- Step 1: Planning (manual step with nested children) ---
  const planStepId = recorder.startStep("decision", "plan-research", {
    goal: "Research machine learning topics",
    strategy: "search-then-summarize",
  });

  // Nested step: analyze the query
  const analyzeStepId = recorder.startStep("custom", "analyze-query", {
    query: "machine learning",
  }, planStepId);

  await sleep(30);

  recorder.endStep(analyzeStepId, {
    keywords: ["machine", "learning"],
    expectedResults: "3-5 articles",
  });

  recorder.endStep(planStepId, {
    plan: ["search for articles", "summarize top results", "compile report"],
    estimatedSteps: 5,
  });

  // --- Step 2: Search (automatically recorded via interceptFunction) ---
  console.log(`[${sessionName}] Searching...`);
  const searchResults = await search("learning");
  console.log(`[${sessionName}] Found ${searchResults.count} results`);

  // --- Step 3: Summarize each result (nested under a parent step) ---
  const summarizeAllId = recorder.startStep("custom", "summarize-all", {
    resultCount: searchResults.count,
  });

  const summaries: string[] = [];
  for (const result of searchResults.results) {
    // Each summarize call is automatically recorded via interceptFunction
    const summary = await summarize(result);
    summaries.push(summary);
  }

  recorder.endStep(summarizeAllId, {
    summaries,
    totalSummarized: summaries.length,
  });

  // --- Step 4: Risky operation with error handling ---
  console.log(`[${sessionName}] Attempting risky operation...`);
  const riskyStepId = recorder.startStep("tool_call", "risky-operation", {
    attempt: 1,
  });

  try {
    const result = await riskyOperation();
    recorder.endStep(riskyStepId, { result });
    console.log(`[${sessionName}] Risky operation succeeded`);
  } catch (err) {
    const error = err as Error;
    recorder.endStep(riskyStepId, null, {
      error: { message: error.message, stack: error.stack },
    });
    console.log(`[${sessionName}] Risky operation failed: ${error.message}`);

    // Retry once
    const retryStepId = recorder.startStep("tool_call", "risky-operation-retry", {
      attempt: 2,
    });
    try {
      const result = await riskyOperation();
      recorder.endStep(retryStepId, { result });
      console.log(`[${sessionName}] Retry succeeded`);
    } catch (retryErr) {
      const retryError = retryErr as Error;
      recorder.endStep(retryStepId, null, {
        error: { message: retryError.message, stack: retryError.stack },
      });
      console.log(`[${sessionName}] Retry also failed: ${retryError.message}`);
    }
  }

  // --- Step 5: Final compilation ---
  recorder.addStep("custom", "compile-report", {
    summaryCount: summaries.length,
  }, {
    report: `Compiled ${summaries.length} summaries on machine learning topics.`,
    completedAt: new Date().toISOString(),
  }, {
    duration: 10,
    metadata: { format: "text" },
  });

  // Stop and return the trace
  const trace = await recorder.stop();
  return trace;
}

// --- Main: run two sessions and compare them ---

async function main() {
  console.log("=== Running Session A ===\n");
  const traceA = await runAgentSession("session-A");
  console.log();

  console.log("=== Running Session B ===\n");
  const traceB = await runAgentSession("session-B");
  console.log();

  // --- Diff the two traces ---
  console.log("=== Trace Diff ===\n");
  const diff = diffTraces(traceA, traceB);
  console.log(`Steps added in B:    ${diff.added.length}`);
  console.log(`Steps removed in B:  ${diff.removed.length}`);
  console.log(`Steps modified:      ${diff.modified.length}`);
  console.log(`Token diff:          ${diff.summary.tokenDiff}`);
  console.log(`Cost diff:           $${diff.summary.costDiff.toFixed(4)}`);
  console.log(`Duration diff:       ${diff.summary.durationDiff}ms`);
  console.log(`Step count diff:     ${diff.summary.stepCountDiff}`);
  console.log();

  // --- Anomaly detection on Session A ---
  console.log("=== Anomalies (Session A) ===\n");
  const anomalies = detectAnomalies(traceA, {
    slowStepMs: 100,    // Flag steps slower than 100ms
    highCostUsd: 0.01,  // Flag steps costing more than $0.01
  });
  if (anomalies.length > 0) {
    for (const anomaly of anomalies) {
      console.log(`  [${anomaly.severity.toUpperCase()}] ${anomaly.type}: ${anomaly.message}`);
    }
  } else {
    console.log("  No anomalies detected.");
  }
  console.log();

  // --- Cost analysis ---
  console.log("=== Cost Analysis (Session A) ===\n");
  const cost = analyzeCost(traceA);
  console.log(`  Total cost: $${cost.total.toFixed(4)}`);
  for (const [type, info] of Object.entries(cost.byStepType)) {
    console.log(`  ${type}: ${info.count} steps, $${info.cost.toFixed(4)}`);
  }
  console.log();

  // --- Timeline ---
  console.log("=== Timeline (Session A) ===\n");
  const timeline = generateTimeline(traceA);
  for (const entry of timeline) {
    const indent = "  ".repeat(entry.depth + 1);
    const bar = "#".repeat(Math.max(1, Math.round(entry.percentOfTotal / 2)));
    console.log(`${indent}${entry.step.name} [${bar}] ${entry.step.duration ?? 0}ms`);
  }
  console.log();

  console.log(`Traces saved to ./traces/`);
  console.log(`  Session A: ${traceA.id}`);
  console.log(`  Session B: ${traceB.id}`);
}

main().catch(console.error);
