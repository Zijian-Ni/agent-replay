import type { AgentRecorder } from "../recorder.js";
import type { Step } from "../types.js";

/** Plugin lifecycle hooks */
export interface PluginHooks {
  /** Called when the plugin is registered */
  onRegister?(recorder: AgentRecorder): void;
  /** Called before a step is recorded */
  onBeforeStep?(step: Partial<Step>): Partial<Step> | void;
  /** Called after a step is recorded */
  onAfterStep?(step: Step): void;
  /** Called when recording stops */
  onStop?(recorder: AgentRecorder): void;
}

/** Plugin interface for extending Agent Replay */
export interface Plugin {
  /** Unique plugin name */
  name: string;
  /** Plugin version */
  version: string;
  /** Plugin description */
  description?: string;
  /** Lifecycle hooks */
  hooks: PluginHooks;
  /** Custom interceptor factory (wraps an SDK client) */
  createInterceptor?<T extends object>(client: T, recorder: AgentRecorder): T;
}

/** Plugin registry with auto-discovery */
export class PluginRegistry {
  private plugins: Map<string, Plugin> = new Map();
  private recorder: AgentRecorder | null = null;

  /** Register a plugin */
  register(plugin: Plugin): void {
    if (this.plugins.has(plugin.name)) {
      throw new Error(`Plugin "${plugin.name}" is already registered`);
    }
    this.plugins.set(plugin.name, plugin);
    if (this.recorder && plugin.hooks.onRegister) {
      plugin.hooks.onRegister(this.recorder);
    }
  }

  /** Unregister a plugin */
  unregister(name: string): boolean {
    return this.plugins.delete(name);
  }

  /** Get a registered plugin by name */
  get(name: string): Plugin | undefined {
    return this.plugins.get(name);
  }

  /** List all registered plugins */
  list(): Plugin[] {
    return [...this.plugins.values()];
  }

  /** Check if a plugin is registered */
  has(name: string): boolean {
    return this.plugins.has(name);
  }

  /** Attach a recorder to all plugins */
  attach(recorder: AgentRecorder): void {
    this.recorder = recorder;
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onRegister) {
        plugin.hooks.onRegister(recorder);
      }
    }
  }

  /** Invoke onBeforeStep hooks across all plugins */
  invokeBeforeStep(step: Partial<Step>): Partial<Step> {
    let result = step;
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onBeforeStep) {
        const modified = plugin.hooks.onBeforeStep(result);
        if (modified) result = modified;
      }
    }
    return result;
  }

  /** Invoke onAfterStep hooks across all plugins */
  invokeAfterStep(step: Step): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onAfterStep) {
        plugin.hooks.onAfterStep(step);
      }
    }
  }

  /** Invoke onStop hooks across all plugins */
  invokeStop(recorder: AgentRecorder): void {
    for (const plugin of this.plugins.values()) {
      if (plugin.hooks.onStop) {
        plugin.hooks.onStop(recorder);
      }
    }
  }

  /** Create an interceptor using a named plugin */
  createInterceptor<T extends object>(pluginName: string, client: T, recorder: AgentRecorder): T {
    const plugin = this.plugins.get(pluginName);
    if (!plugin) {
      throw new Error(`Plugin "${pluginName}" not found`);
    }
    if (!plugin.createInterceptor) {
      throw new Error(`Plugin "${pluginName}" does not provide an interceptor`);
    }
    return plugin.createInterceptor(client, recorder);
  }

  /** Clear all plugins */
  clear(): void {
    this.plugins.clear();
    this.recorder = null;
  }
}

/** Create a plugin from a simple configuration */
export function createPlugin(config: Plugin): Plugin {
  return config;
}

/** Global plugin registry singleton */
export const globalRegistry = new PluginRegistry();
