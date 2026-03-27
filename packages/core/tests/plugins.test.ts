import { describe, it, expect, vi, beforeEach } from "vitest";
import { AgentRecorder } from "../src/recorder.js";
import {
  PluginRegistry,
  createPlugin,
  globalRegistry,
} from "../src/plugins/index.js";
import type { Plugin } from "../src/plugins/index.js";
import { langchainPlugin } from "../src/plugins/langchain.js";
import { crewaiPlugin } from "../src/plugins/crewai.js";

describe("PluginRegistry", () => {
  let registry: PluginRegistry;

  beforeEach(() => {
    registry = new PluginRegistry();
  });

  it("should register a plugin", () => {
    const plugin = createPlugin({
      name: "test-plugin",
      version: "1.0.0",
      hooks: {},
    });
    registry.register(plugin);
    expect(registry.has("test-plugin")).toBe(true);
  });

  it("should throw when registering duplicate plugin", () => {
    const plugin = createPlugin({ name: "dup", version: "1.0.0", hooks: {} });
    registry.register(plugin);
    expect(() => registry.register(plugin)).toThrow("already registered");
  });

  it("should unregister a plugin", () => {
    const plugin = createPlugin({ name: "removable", version: "1.0.0", hooks: {} });
    registry.register(plugin);
    expect(registry.unregister("removable")).toBe(true);
    expect(registry.has("removable")).toBe(false);
  });

  it("should return false when unregistering nonexistent plugin", () => {
    expect(registry.unregister("nonexistent")).toBe(false);
  });

  it("should get a plugin by name", () => {
    const plugin = createPlugin({ name: "getter", version: "1.0.0", hooks: {} });
    registry.register(plugin);
    expect(registry.get("getter")?.name).toBe("getter");
  });

  it("should return undefined for nonexistent plugin", () => {
    expect(registry.get("nope")).toBeUndefined();
  });

  it("should list all plugins", () => {
    registry.register(createPlugin({ name: "a", version: "1.0.0", hooks: {} }));
    registry.register(createPlugin({ name: "b", version: "1.0.0", hooks: {} }));
    const list = registry.list();
    expect(list).toHaveLength(2);
    expect(list.map((p) => p.name)).toContain("a");
    expect(list.map((p) => p.name)).toContain("b");
  });

  it("should call onRegister when attaching recorder", () => {
    const onRegister = vi.fn();
    const plugin = createPlugin({
      name: "hook-test",
      version: "1.0.0",
      hooks: { onRegister },
    });
    registry.register(plugin);

    const recorder = new AgentRecorder({ name: "test" });
    registry.attach(recorder);

    expect(onRegister).toHaveBeenCalledWith(recorder);
  });

  it("should invoke onBeforeStep hooks", () => {
    const onBeforeStep = vi.fn((step) => ({ ...step, name: "modified" }));
    registry.register(createPlugin({
      name: "before-hook",
      version: "1.0.0",
      hooks: { onBeforeStep },
    }));

    const result = registry.invokeBeforeStep({ name: "original" });
    expect(result.name).toBe("modified");
    expect(onBeforeStep).toHaveBeenCalled();
  });

  it("should invoke onAfterStep hooks", () => {
    const onAfterStep = vi.fn();
    registry.register(createPlugin({
      name: "after-hook",
      version: "1.0.0",
      hooks: { onAfterStep },
    }));

    const mockStep = {
      id: "1",
      type: "llm_call" as const,
      name: "test",
      startedAt: new Date(),
      input: {},
      children: [],
    };
    registry.invokeAfterStep(mockStep);
    expect(onAfterStep).toHaveBeenCalledWith(mockStep);
  });

  it("should invoke onStop hooks", () => {
    const onStop = vi.fn();
    registry.register(createPlugin({
      name: "stop-hook",
      version: "1.0.0",
      hooks: { onStop },
    }));

    const recorder = new AgentRecorder({ name: "test" });
    registry.invokeStop(recorder);
    expect(onStop).toHaveBeenCalledWith(recorder);
  });

  it("should create interceptor from plugin", () => {
    const interceptor = vi.fn((client: any) => ({ ...client, intercepted: true }));
    registry.register(createPlugin({
      name: "interceptor-plugin",
      version: "1.0.0",
      hooks: {},
      createInterceptor: interceptor,
    }));

    const recorder = new AgentRecorder({ name: "test" });
    const result = registry.createInterceptor("interceptor-plugin", { foo: "bar" }, recorder);
    expect(interceptor).toHaveBeenCalled();
  });

  it("should throw when creating interceptor from nonexistent plugin", () => {
    const recorder = new AgentRecorder({ name: "test" });
    expect(() => registry.createInterceptor("nope", {}, recorder)).toThrow("not found");
  });

  it("should throw when plugin has no interceptor", () => {
    registry.register(createPlugin({ name: "no-interceptor", version: "1.0.0", hooks: {} }));
    const recorder = new AgentRecorder({ name: "test" });
    expect(() => registry.createInterceptor("no-interceptor", {}, recorder)).toThrow("does not provide");
  });

  it("should clear all plugins", () => {
    registry.register(createPlugin({ name: "a", version: "1.0.0", hooks: {} }));
    registry.register(createPlugin({ name: "b", version: "1.0.0", hooks: {} }));
    registry.clear();
    expect(registry.list()).toHaveLength(0);
  });
});

describe("createPlugin", () => {
  it("should create a plugin object", () => {
    const plugin = createPlugin({
      name: "my-plugin",
      version: "0.1.0",
      description: "A test plugin",
      hooks: {},
    });
    expect(plugin.name).toBe("my-plugin");
    expect(plugin.version).toBe("0.1.0");
  });
});

describe("LangChain Plugin", () => {
  it("should have correct name and version", () => {
    expect(langchainPlugin.name).toBe("langchain");
    expect(langchainPlugin.version).toBe("0.2.0");
  });

  it("should intercept invoke method", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const mockChain = {
      async invoke(input: string) {
        return `result: ${input}`;
      },
    };

    const proxied = langchainPlugin.createInterceptor!(mockChain, recorder);
    const result = await proxied.invoke("hello");
    expect(result).toBe("result: hello");

    const trace = recorder.getTrace();
    expect(trace.steps.length).toBeGreaterThanOrEqual(1);
  });

  it("should intercept run method", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const mockChain = {
      async run(input: string) {
        return `ran: ${input}`;
      },
    };

    const proxied = langchainPlugin.createInterceptor!(mockChain, recorder);
    const result = await proxied.run("test");
    expect(result).toBe("ran: test");
  });

  it("should record errors from LangChain calls", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const mockChain = {
      async invoke() {
        throw new Error("LangChain error");
      },
    };

    const proxied = langchainPlugin.createInterceptor!(mockChain, recorder);
    await expect(proxied.invoke("fail")).rejects.toThrow("LangChain error");

    const trace = recorder.getTrace();
    expect(trace.steps[0]!.error?.message).toBe("LangChain error");
  });
});

describe("CrewAI Plugin", () => {
  it("should have correct name and version", () => {
    expect(crewaiPlugin.name).toBe("crewai");
    expect(crewaiPlugin.version).toBe("0.2.0");
  });

  it("should intercept kickoff method", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const mockCrew = {
      async kickoff(input: any) {
        return { output: "done", input };
      },
    };

    const proxied = crewaiPlugin.createInterceptor!(mockCrew, recorder);
    const result = await proxied.kickoff({ task: "analyze" });
    expect(result.output).toBe("done");
  });

  it("should intercept execute method", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const mockCrew = {
      async execute(task: string) {
        return `executed: ${task}`;
      },
    };

    const proxied = crewaiPlugin.createInterceptor!(mockCrew, recorder);
    const result = await proxied.execute("test-task");
    expect(result).toBe("executed: test-task");
  });

  it("should record errors from CrewAI calls", async () => {
    const recorder = new AgentRecorder({ name: "test", redact: false });
    const mockCrew = {
      async kickoff() {
        throw new Error("CrewAI error");
      },
    };

    const proxied = crewaiPlugin.createInterceptor!(mockCrew, recorder);
    await expect(proxied.kickoff({})).rejects.toThrow("CrewAI error");
  });
});

describe("globalRegistry", () => {
  it("should be a PluginRegistry instance", () => {
    expect(globalRegistry).toBeInstanceOf(PluginRegistry);
  });
});
