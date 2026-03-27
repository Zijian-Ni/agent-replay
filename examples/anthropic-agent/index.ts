/**
 * Example: Recording an Anthropic Agent with Tool Use
 *
 * This example demonstrates how to use Agent Replay to record
 * an Anthropic Claude agent that uses tools in a multi-turn loop.
 *
 * Prerequisites:
 *   export ANTHROPIC_API_KEY="sk-ant-..."
 *
 * Run:
 *   pnpm start
 */

import Anthropic from "@anthropic-ai/sdk";
import { AgentRecorder, interceptAnthropic, analyzeCost, detectAnomalies } from "@agent-replay/core";

// Define tools available to the agent
const tools: Anthropic.Tool[] = [
  {
    name: "get_weather",
    description: "Get the current weather for a given city.",
    input_schema: {
      type: "object" as const,
      properties: {
        city: { type: "string", description: "City name" },
      },
      required: ["city"],
    },
  },
  {
    name: "get_time",
    description: "Get the current time in a given timezone.",
    input_schema: {
      type: "object" as const,
      properties: {
        timezone: { type: "string", description: "IANA timezone (e.g. America/New_York)" },
      },
      required: ["timezone"],
    },
  },
];

// Simulated tool implementations
function executeTool(name: string, input: Record<string, unknown>): string {
  switch (name) {
    case "get_weather":
      return JSON.stringify({
        city: input.city,
        temperature: 22,
        unit: "celsius",
        condition: "partly cloudy",
        humidity: 65,
      });
    case "get_time":
      return JSON.stringify({
        timezone: input.timezone,
        time: new Date().toLocaleTimeString("en-US", {
          timeZone: input.timezone as string,
        }),
      });
    default:
      return JSON.stringify({ error: `Unknown tool: ${name}` });
  }
}

async function main() {
  // 1. Create a recorder
  const recorder = new AgentRecorder({
    name: "anthropic-agent-example",
    storage: "file",
    outputDir: "./traces",
    redact: true,
    metadata: {
      example: "anthropic-agent",
      toolCount: tools.length,
    },
  });

  // 2. Wrap the Anthropic client
  const rawClient = new Anthropic();
  const anthropic = interceptAnthropic(rawClient, recorder);

  // 3. Run an agent loop with tool use
  console.log("Starting agent loop...\n");

  const messages: Anthropic.MessageParam[] = [
    {
      role: "user",
      content: "What's the weather in Tokyo and what time is it there?",
    },
  ];

  let continueLoop = true;

  while (continueLoop) {
    // Call the Anthropic API — automatically recorded by the interceptor
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1024,
      tools,
      messages,
    });

    // Check if the model wants to use tools
    if (response.stop_reason === "tool_use") {
      const assistantContent = response.content;
      messages.push({ role: "assistant", content: assistantContent });

      // Process each tool use block
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of assistantContent) {
        if (block.type === "tool_use") {
          console.log(`Tool call: ${block.name}(${JSON.stringify(block.input)})`);

          // Execute the tool and record it as a step
          const toolStepId = recorder.startStep("tool_call", block.name, block.input);
          const result = executeTool(block.name, block.input as Record<string, unknown>);
          recorder.endStep(toolStepId, JSON.parse(result));

          console.log(`Tool result: ${result}\n`);

          toolResults.push({
            type: "tool_result",
            tool_use_id: block.id,
            content: result,
          });
        }
      }

      messages.push({ role: "user", content: toolResults });
    } else {
      // Model produced a final text response
      for (const block of response.content) {
        if (block.type === "text") {
          console.log("Agent response:");
          console.log(block.text);
          console.log();
        }
      }
      continueLoop = false;
    }
  }

  // 4. Stop the recorder
  const trace = await recorder.stop();

  // 5. Print trace summary
  console.log("--- Trace Summary ---");
  console.log(`Trace ID:    ${trace.id}`);
  console.log(`Steps:       ${trace.summary?.totalSteps}`);
  console.log(`Duration:    ${trace.summary?.totalDuration}ms`);
  console.log(`Total tokens: ${trace.summary?.totalTokens.total}`);
  console.log(`Total cost:  $${trace.summary?.totalCost.toFixed(4)}`);
  console.log();

  // 6. Analyze cost breakdown
  const costBreakdown = analyzeCost(trace);
  console.log("--- Cost Breakdown by Model ---");
  for (const [model, info] of Object.entries(costBreakdown.byModel)) {
    console.log(`  ${model}: ${info.calls} calls, ${info.tokens.total} tokens, $${info.cost.toFixed(4)}`);
  }
  console.log();

  console.log("--- Cost Breakdown by Step Type ---");
  for (const [type, info] of Object.entries(costBreakdown.byStepType)) {
    console.log(`  ${type}: ${info.count} steps, $${info.cost.toFixed(4)}`);
  }
  console.log();

  // 7. Detect anomalies
  const anomalies = detectAnomalies(trace);
  if (anomalies.length > 0) {
    console.log("--- Anomalies Detected ---");
    for (const anomaly of anomalies) {
      console.log(`  [${anomaly.severity.toUpperCase()}] ${anomaly.type}: ${anomaly.message}`);
    }
  } else {
    console.log("No anomalies detected.");
  }
  console.log();

  console.log(`Trace saved to: ./traces/${trace.id}.jsonl`);
}

main().catch(console.error);
