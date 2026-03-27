# Changelog

## 0.2.0 (2026-03-27)

### New Features

**Streaming Support**
- Record streaming responses from OpenAI and Anthropic SDKs
- Capture each chunk with precise timing information
- Reconstruct full response from recorded chunks in replay

**Plugin System**
- Plugin interface for custom interceptors with lifecycle hooks
- Built-in LangChain plugin for intercepting `invoke`/`run`/`call` methods
- Built-in CrewAI plugin for intercepting `kickoff`/`execute`/`run` methods
- Plugin registry with register, unregister, and auto-discovery
- Global registry singleton for app-wide plugin management

**Advanced Replay**
- Conditional breakpoints: stop on cost threshold, error, specific tool, model, or custom predicate
- Speed control: 1x, 2x, 5x, or instant (0) playback
- Model substitution: swap gpt-4 for gpt-3.5 in replay for cost comparison
- Checkpoint save/restore: bookmark positions and jump back
- Cumulative cost tracking during replay
- Pause and resume after breakpoint hits

**Trace Compression**
- gzip compression for JSONL files (~80% disk savings)
- Streaming decompression for large traces
- Auto-detect compressed vs uncompressed files
- `CompressedJsonlStorage` backend with transparent compression
- Directory-level batch compression

### Viewer Upgrades
- Flame graph view (like Chrome Performance tab) for timing visualization
- Token usage heatmap showing which steps burn the most tokens
- View tabs: switch between Timeline, Flame Graph, and Heatmap
- Minimap for navigating long traces (like VS Code)
- Export trace as self-contained shareable HTML file
- Toast notifications for user actions
- Keyboard shortcuts help panel (press ?)
- Mobile responsive layout with adaptive sidebar/inspector
- System theme preference detection (prefers-color-scheme)
- Loading skeleton animations
- Smooth transitions between views

### CLI Enhancements
- `agent-replay serve` — serve viewer with live trace API
- `agent-replay compress` — compress trace files with gzip
- `agent-replay validate` — validate trace file schema
- `agent-replay merge` — merge multiple trace files into one

### Repository Configuration
- GitHub Actions CI workflow (Node 20, 22 matrix)
- GitHub Actions publish workflow (npm on tag)
- GitHub Pages deployment for viewer
- CODEOWNERS, PR template, issue templates (bug report, feature request)
- `.editorconfig` and `.prettierrc` configuration

### Testing
- 150+ tests covering all new features
- Streaming interceptor tests
- Plugin system tests (registry, hooks, LangChain, CrewAI)
- Compression tests (buffer, file, directory, storage)
- Advanced replayer tests (breakpoints, checkpoints, speed, model substitution)
- CLI validation and merge pattern tests
- Integration tests (record → store → load → replay pipeline)

### Other
- All packages bumped to 0.2.0
- Updated package.json with proper repository, bugs, homepage, keywords, engines fields
- New type exports: `Breakpoint`, `Checkpoint`, `Plugin`, `PluginHooks`, `StreamChunk`, `StreamAccumulator`

## 0.1.0 (2026-03-27)

### Features
- Core recording engine with OpenAI and Anthropic interceptors
- JSONL and SQLite storage backends
- Automatic PII redaction with customizable patterns
- AES-256-GCM encryption for traces at rest
- Trace replay with step-by-step navigation
- Trace diffing and comparison
- Cost analysis with per-model breakdowns
- Anomaly detection (slow steps, token spikes, error patterns)
- Timeline generation for visualization
- Web-based trace viewer with dark mode
- CLI tool with record, replay, view, diff, stats, export commands
- TypeScript-first with full type definitions
