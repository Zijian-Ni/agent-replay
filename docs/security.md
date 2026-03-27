# Security

Agent Replay includes built-in mechanisms for handling sensitive data in traces: automatic redaction of PII and secrets, and optional AES-256-GCM encryption for traces at rest.

## Redaction

The `Redactor` class automatically removes sensitive data from trace inputs and outputs before they are stored. Redaction is enabled by default.

### Default Redaction Rules

The following patterns are redacted automatically:

| Rule | Pattern | Replacement |
|------|---------|-------------|
| API keys | `sk-*`, `pk-*`, `api_key-*`, `api-key-*` (20+ chars) | `[REDACTED_API_KEY]` |
| Bearer tokens | `Bearer <token>` | `Bearer [REDACTED]` |
| Authorization headers | `authorization: <value>`, `x-api-key: <value>` | `[REDACTED_AUTH]` |
| Email addresses | Standard email format | `[REDACTED_EMAIL]` |
| Phone numbers | US phone formats | `[REDACTED_PHONE]` |
| SSNs | `XXX-XX-XXXX` | `[REDACTED_SSN]` |
| Credit card numbers | 16-digit card numbers | `[REDACTED_CC]` |

Additionally, any object key containing `password`, `secret`, `token`, `apikey`, or `api_key` (case-insensitive) will have its value replaced with `[REDACTED]`.

### Enabling Redaction

Redaction is enabled by default. To explicitly control it:

```ts
// Redaction on (default)
const recorder = new AgentRecorder({
  name: "my-trace",
  redact: true,
});

// Redaction off
const recorder = new AgentRecorder({
  name: "my-trace",
  redact: false,
});
```

### Custom Redaction Patterns

Add custom patterns via the `redactPatterns` option:

```ts
const recorder = new AgentRecorder({
  name: "my-trace",
  redact: true,
  redactPatterns: [
    /CUST-\d{6}/g,                    // Customer IDs
    /\b[A-Z]{2}\d{6}[A-Z]\b/g,       // Passport numbers
    /\b\d{3}-\d{3}-\d{4}\b/g,        // Custom ID format
  ],
});
```

Custom patterns are matched with a `[REDACTED]` replacement string.

### Using Redactor Directly

You can use the `Redactor` class independently:

```ts
import { Redactor } from "@agent-replay/core";

const redactor = new Redactor();

// Redact a string
redactor.redact("Contact me at user@example.com");
// => "Contact me at [REDACTED_EMAIL]"

// Redact an object (deep traversal)
redactor.redact({
  user: "Alice",
  email: "alice@example.com",
  apiKey: "sk-abc123...",
  nested: {
    password: "secret123",
  },
});
// => { user: "Alice", email: "[REDACTED_EMAIL]", apiKey: "[REDACTED]", nested: { password: "[REDACTED]" } }

// Add a custom rule
redactor.addRule({
  name: "internal_id",
  pattern: /INT-\d{8}/g,
  replacement: "[REDACTED_INTERNAL_ID]",
});

// List active rules
const rules = redactor.getRules();
```

### How Deep Redaction Works

The `Redactor.redact()` method performs a deep traversal:

1. **Strings**: All redaction patterns are applied.
2. **Objects**: Each key is checked against sensitive key names (`password`, `secret`, `token`, `apikey`, `api_key`). If matched, the value is replaced entirely. Otherwise, the value is recursively redacted.
3. **Arrays**: Each element is recursively redacted.
4. **Circular references**: Detected via `WeakSet` and replaced with `"[Circular]"`.
5. **Primitives** (numbers, booleans, null, undefined): Passed through unchanged.

## Encryption

For additional protection, traces can be encrypted at rest using AES-256-GCM.

### Enabling Encryption

```ts
const recorder = new AgentRecorder({
  name: "my-trace",
  storage: "file",
  encrypt: true,
  encryptionKey: process.env.TRACE_ENCRYPTION_KEY!,
});
```

### How It Works

The encryption system uses:

- **Algorithm**: AES-256-GCM (authenticated encryption)
- **Key derivation**: `scrypt` from the provided password with a random 32-byte salt
- **IV**: Random 16-byte initialization vector per encryption
- **Authentication tag**: 16-byte GCM tag for integrity verification

The encrypted output format is:

```
| salt (32 bytes) | iv (16 bytes) | auth tag (16 bytes) | encrypted data |
```

### Using encrypt/decrypt Directly

```ts
import { encrypt, decrypt } from "@agent-replay/core";

const password = "my-secure-password";

// Encrypt
const data = JSON.stringify({ sensitive: "information" });
const encrypted = encrypt(data, password);

// Decrypt
const decrypted = decrypt(encrypted, password);
const parsed = JSON.parse(decrypted);
```

### Key Management

The encryption key is a password string that is stretched using `scrypt` into a 256-bit key. A unique random salt is generated for each encryption operation, so the same password produces different ciphertext each time.

Best practices:

- Store the encryption key in an environment variable, not in code
- Use a strong password (32+ characters recommended)
- Rotate keys periodically by re-encrypting existing traces
- The key is never stored in the trace file itself

## Best Practices

### For Development

- Keep redaction enabled (the default) even in development to build good habits
- Use `MemoryStorage` in tests to avoid writing sensitive data to disk
- Review trace files before committing them to version control

### For Production

- Enable both redaction and encryption for traces containing user data
- Add custom redaction patterns for your application's specific sensitive fields
- Store encryption keys in a secrets manager (e.g., AWS Secrets Manager, HashiCorp Vault)
- Set up appropriate file permissions on the trace output directory
- Consider using SQLite storage with database-level encryption for additional protection

### What to Watch For

- LLM prompts and completions may contain user-submitted PII
- Tool inputs/outputs may include database records, API responses, or file contents
- Error stacks may reveal internal file paths or configuration details
- Model responses may echo back sensitive information from the prompt

### Trace File Hygiene

- Add `traces/` to your `.gitignore`
- Set appropriate retention policies for trace files
- Use the `storage.delete()` method to clean up old traces
- Periodically audit trace files for unexpected sensitive data
