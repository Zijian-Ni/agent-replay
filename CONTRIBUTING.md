# Contributing to agent-replay

Thank you for your interest in contributing to agent-replay! This document outlines the process and guidelines for contributing to the project.

## Table of Contents

- [Code of Conduct](#code-of-conduct)
- [Getting Started](#getting-started)
- [Development Setup](#development-setup)
- [Project Structure](#project-structure)
- [Making Changes](#making-changes)
- [Testing](#testing)
- [Code Style](#code-style)
- [Submitting a Pull Request](#submitting-a-pull-request)
- [Commit Message Guidelines](#commit-message-guidelines)
- [Reporting Bugs](#reporting-bugs)
- [Requesting Features](#requesting-features)

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md). Please read it before contributing.

## Getting Started

1. **Fork** the repository on GitHub.
2. **Clone** your fork locally:
   ```bash
   git clone https://github.com/<your-username>/agent-replay.git
   cd agent-replay
   ```
3. **Add the upstream remote**:
   ```bash
   git remote add upstream https://github.com/nicepkg/agent-replay.git
   ```

## Development Setup

### Prerequisites

- **Node.js** >= 20 (we recommend using [nvm](https://github.com/nvm-sh/nvm) or [fnm](https://github.com/Schniz/fnm))
- **pnpm** >= 9

  ```bash
  corepack enable
  corepack prepare pnpm@latest --activate
  ```

### Install Dependencies

```bash
pnpm install
```

This installs all workspace dependencies across all packages.

### Build All Packages

```bash
pnpm build
```

Turborepo handles the build order based on inter-package dependencies automatically.

### Run Tests

```bash
# Run all tests once
pnpm test

# Run tests in watch mode (in a specific package)
cd packages/core
pnpm test:watch
```

### Run the Linter

```bash
pnpm lint

# Auto-fix lint issues
pnpm lint:fix
```

### Format Code

```bash
pnpm format

# Check formatting without modifying files
pnpm format:check
```

### Type Checking

```bash
pnpm typecheck
```

### Clean Build Artifacts

```bash
pnpm clean
```

## Project Structure

```
agent-replay/
├── packages/           # Core library packages (published to npm)
│   ├── core/           # Core recording/replay engine
│   ├── sdk/            # SDK for integrating with AI frameworks
│   ├── cli/            # Command-line interface
│   ├── viewer/         # Replay viewer UI
│   ├── storage/        # Storage adapters
│   └── types/          # Shared TypeScript types
├── examples/           # Example projects demonstrating usage
├── .github/            # GitHub Actions workflows and templates
├── turbo.json          # Turborepo pipeline configuration
├── pnpm-workspace.yaml # pnpm workspace configuration
└── tsconfig.base.json  # Base TypeScript configuration
```

## Making Changes

1. **Create a new branch** from `main`:
   ```bash
   git checkout -b feat/my-new-feature
   # or
   git checkout -b fix/issue-123
   ```

2. **Make your changes** in the relevant package(s).

3. **Add or update tests** to cover your changes.

4. **Ensure all tests pass**:
   ```bash
   pnpm test
   ```

5. **Ensure the build succeeds**:
   ```bash
   pnpm build
   ```

6. **Ensure linting passes**:
   ```bash
   pnpm lint
   ```

### Adding a New Package

If you are adding a new package to the monorepo:

1. Create the package directory under `packages/` or `examples/`.
2. Add a `package.json` with the appropriate `name` (`@agent-replay/<name>`), `version`, and scripts.
3. Extend `tsconfig.base.json` in the new package's `tsconfig.json`.
4. Add a `tsup.config.ts` for building if it is a library package.
5. Update `tsconfig.base.json` at the root to add the new package's path alias.

## Testing

- All new features **must** be accompanied by tests.
- Bug fixes **should** include a regression test.
- Tests are written using [Vitest](https://vitest.dev/).
- Test files are co-located with source files as `*.test.ts` or placed in a `test/` directory within the package.

```bash
# Run tests for a specific package
cd packages/core
pnpm test

# Run all tests with coverage
pnpm test -- --coverage
```

## Code Style

This project uses:

- **TypeScript** with strict mode enabled — no `any` types without explicit justification.
- **ESLint** for linting — run `pnpm lint` to check.
- **Prettier** for formatting — run `pnpm format` to format, or configure your editor to format on save.

Key style guidelines:

- Prefer `const` over `let`; avoid `var`.
- Use explicit return types on exported functions.
- Use `type` imports (`import type { Foo } from './foo'`) when only importing types.
- Keep functions small and focused — prefer pure functions where possible.
- Document public APIs with JSDoc comments.

## Submitting a Pull Request

1. Push your branch to your fork:
   ```bash
   git push origin feat/my-new-feature
   ```

2. Open a Pull Request against the `main` branch of `nicepkg/agent-replay`.

3. Fill out the PR template completely:
   - Describe the changes and motivation.
   - Link any related issues (`Closes #123`).
   - Confirm that tests pass and the checklist is complete.

4. A maintainer will review your PR. Be responsive to feedback — PRs with no activity for 30 days may be closed.

### PR Guidelines

- Keep PRs focused and small — one feature or bug fix per PR.
- Do not include unrelated refactors in a feature PR.
- Ensure the PR title clearly describes the change (used in the changelog).
- Add a changeset if the change affects a published package (run `pnpm changeset`).

## Commit Message Guidelines

We follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

```
<type>(<scope>): <short summary>

[optional body]

[optional footer(s)]
```

**Types:**

| Type       | Description                                     |
| ---------- | ----------------------------------------------- |
| `feat`     | A new feature                                   |
| `fix`      | A bug fix                                       |
| `docs`     | Documentation changes only                     |
| `style`    | Formatting, missing semicolons, etc.           |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `perf`     | Performance improvement                         |
| `test`     | Adding or correcting tests                      |
| `build`    | Changes to the build system or dependencies     |
| `ci`       | Changes to CI configuration                     |
| `chore`    | Other changes that don't modify src or test files |

**Examples:**

```
feat(core): add support for streaming replay
fix(cli): handle missing config file gracefully
docs: update README with installation instructions
```

## Reporting Bugs

Please use the [bug report template](https://github.com/nicepkg/agent-replay/issues/new?template=bug_report.md) when opening a bug report. Include:

- A clear description of the bug.
- Steps to reproduce.
- Expected vs. actual behavior.
- Your environment (OS, Node.js version, package version).

## Requesting Features

Please use the [feature request template](https://github.com/nicepkg/agent-replay/issues/new?template=feature_request.md) when requesting a new feature. Include:

- A description of the problem you are trying to solve.
- Your proposed solution.
- Any alternatives you have considered.

---

Thank you for contributing to agent-replay!
