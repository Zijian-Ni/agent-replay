/**
 * Example: Recording OpenAI Chat Completions
 *
 * This example demonstrates how to use Agent Replay to record
 * OpenAI chat completion calls and save traces to disk.
 *
 * Prerequisites:
 *   export OPENAI_API_KEY="sk-..."
 *
 * Run:
 *   pnpm start
 */

import OpenAI from "openai";
import { AgentRecorder, interceptOpenAI, analyzeCost } from "@agent-replay/core";

async function main() {
  // 1. Create a recorder that saves traces as JSONL files
  const recorder = new AgentRecorder({
    name: "openai-chat-example",
    storage: "file",
    outputDir: "./traces",
    redact: true, // Auto-redact sensitive data (API keys, emails, etc.)
    metadata: {
      example: "openai-chat",
      environment: "development",
    },
  });

  // 2. Create the OpenAI client and wrap it with the interceptor
  const rawClient = new OpenAI();
  const openai = interceptOpenAI(rawClient, recorder);

  // 3. Make a chat completion call — it will be automatically recorded
  console.log("Sending chat completion request...\n");

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant that answers concisely." },
      { role: "user", content: "What are the three laws of thermodynamics? One sentence each." },
    ],
    temperature: 0.7,
    max_tokens: 256,
  });

  console.log("Assistant response:");
  console.log(response.choices[0]?.message?.content);
  console.log();

  // 4. Make a second call to show multi-step recording
  const followUp = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      { role: "system", content: "You are a helpful assistant that answers concisely." },
      { role: "user", content: "What are the three laws of thermodynamics? One sentence each." },
      { role: "assistant", content: response.choices[0]?.message?.content ?? "" },
      { role: "user", content: "Which one is most relevant to everyday life?" },
    ],
    temperature: 0.7,
    max_tokens: 256,
  });

  console.log("Follow-up response:");
  console.log(followUp.choices[0]?.message?.content);
  console.log();

  // 5. Stop the recorder and get the finalized trace
  const trace = await recorder.stop();

  // 6. Print a summary
  console.log("--- Trace Summary ---");
  console.log(`Trace ID:    ${trace.id}`);
  console.log(`Name:        ${trace.name}`);
  console.log(`Steps:       ${trace.summary?.totalSteps}`);
  console.log(`Duration:    ${trace.summary?.totalDuration}ms`);
  console.log(`Total tokens: ${trace.summary?.totalTokens.total}`);
  console.log(`Total cost:  $${trace.summary?.totalCost.toFixed(4)}`);
  console.log();

  // 7. Analyze cost breakdown
  const costBreakdown = analyzeCost(trace);
  console.log("--- Cost Breakdown ---");
  for (const [model, info] of Object.entries(costBreakdown.byModel)) {
    console.log(`${model}: ${info.calls} calls, ${info.tokens.total} tokens, $${info.cost.toFixed(4)}`);
  }
  console.log();
  console.log(`Trace saved to: ./traces/${trace.id}.jsonl`);
}

main().catch(console.error);
