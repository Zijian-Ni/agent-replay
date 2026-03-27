# Security Policy

## Supported Versions

The following versions of agent-replay are currently receiving security updates:

| Version | Supported          |
| ------- | ------------------ |
| 0.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take security vulnerabilities seriously. If you discover a security issue in agent-replay, please report it responsibly.

### How to Report

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, please report security vulnerabilities by opening a **private security advisory** on GitHub:

1. Go to the [Security tab](https://github.com/nicepkg/agent-replay/security) of this repository.
2. Click "Report a vulnerability".
3. Fill out the form with as much detail as possible.

Alternatively, you can open a GitHub issue at:
**https://github.com/nicepkg/agent-replay/issues**

For issues that are clearly not sensitive (e.g., a minor information disclosure), a regular GitHub issue is acceptable. For anything that could lead to privilege escalation, remote code execution, or data exfiltration, please use the private advisory route.

### What to Include

When reporting a vulnerability, please include:

- A clear description of the vulnerability and its potential impact.
- The affected version(s) and component(s).
- Step-by-step instructions to reproduce the issue.
- Any proof-of-concept code or screenshots that demonstrate the vulnerability.
- Suggested remediation, if you have one.

### Response Timeline

- **Acknowledgement**: We aim to acknowledge receipt of your report within **48 hours**.
- **Initial assessment**: We will provide an initial assessment within **7 days**.
- **Resolution**: We will work to resolve confirmed vulnerabilities as quickly as possible. Critical issues will be prioritized and patched within **14 days** where feasible.
- **Disclosure**: We follow a coordinated disclosure model. We ask that you give us a reasonable period (typically 90 days) to address the issue before any public disclosure.

### What Happens After You Report

1. We will confirm receipt of your report.
2. We will investigate and determine whether the report constitutes a valid vulnerability.
3. We will work on a fix and prepare a release.
4. We will notify you when the fix has been deployed.
5. We will publicly disclose the vulnerability (with credit to you, if desired) after the fix is available.

### Scope

This policy applies to the following:

- All packages in the `packages/` directory of this monorepo.
- The CLI tooling in the `packages/cli` directory.
- The viewer application in `packages/viewer` or `examples/`.

Out of scope:
- Vulnerabilities in third-party dependencies (please report these upstream).
- Social engineering attacks.
- Physical attacks against infrastructure.

### Recognition

We believe in recognizing the efforts of security researchers. If you responsibly disclose a valid vulnerability, we will acknowledge your contribution in the release notes (unless you prefer to remain anonymous).

Thank you for helping keep agent-replay and its users safe.
