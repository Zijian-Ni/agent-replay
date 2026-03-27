import { describe, it, expect, beforeEach } from "vitest";
import { Redactor } from "../src/security/redactor.js";
import { encrypt, decrypt } from "../src/security/encryption.js";

describe("Redactor", () => {
  let redactor: Redactor;

  beforeEach(() => {
    redactor = new Redactor();
  });

  it("should redact API keys", () => {
    const result = redactor.redact("my key is sk-abc123456789012345678901");
    expect(result).toContain("[REDACTED_API_KEY]");
    expect(result).not.toContain("sk-abc123456789012345678901");
  });

  it("should redact bearer tokens", () => {
    const result = redactor.redact("Authorization: Bearer eyJhbGciOiJSUzI1NiJ9.test");
    expect(result).toContain("[REDACTED]");
  });

  it("should redact email addresses", () => {
    const result = redactor.redact("contact me at user@example.com please");
    expect(result).toContain("[REDACTED_EMAIL]");
    expect(result).not.toContain("user@example.com");
  });

  it("should redact phone numbers", () => {
    const result = redactor.redact("call me at 555-123-4567");
    expect(result).toContain("[REDACTED_PHONE]");
  });

  it("should redact SSNs", () => {
    const result = redactor.redact("SSN: 123-45-6789");
    expect(result).toContain("[REDACTED_SSN]");
  });

  it("should redact credit card numbers", () => {
    const result = redactor.redact("card: 4111-1111-1111-1111");
    expect(result).toContain("[REDACTED_CC]");
  });

  it("should redact sensitive object keys", () => {
    const result = redactor.redact({
      username: "john",
      password: "secret123",
      api_key: "sk-test",
      data: "safe",
    });
    expect(result).toEqual({
      username: "john",
      password: "[REDACTED]",
      api_key: "[REDACTED]",
      data: "safe",
    });
  });

  it("should redact nested objects", () => {
    const result = redactor.redact({
      config: {
        token: "abc123",
        nested: { secret: "hidden" },
      },
    });
    const r = result as any;
    expect(r.config.token).toBe("[REDACTED]");
    expect(r.config.nested.secret).toBe("[REDACTED]");
  });

  it("should redact arrays", () => {
    const result = redactor.redact(["user@test.com", "safe text"]);
    const r = result as string[];
    expect(r[0]).toContain("[REDACTED_EMAIL]");
    expect(r[1]).toBe("safe text");
  });

  it("should handle null and undefined", () => {
    expect(redactor.redact(null)).toBeNull();
    expect(redactor.redact(undefined)).toBeUndefined();
  });

  it("should handle numbers and booleans", () => {
    expect(redactor.redact(42)).toBe(42);
    expect(redactor.redact(true)).toBe(true);
  });

  it("should handle circular references", () => {
    const obj: any = { a: 1 };
    obj.self = obj;
    const result = redactor.redact(obj) as any;
    expect(result.self).toBe("[Circular]");
  });

  it("should support custom patterns", () => {
    const r = new Redactor([/CUSTOM-\w+/g]);
    const result = r.redact("my code is CUSTOM-12345");
    expect(result).toContain("[REDACTED]");
    expect(result).not.toContain("CUSTOM-12345");
  });

  it("should allow adding rules dynamically", () => {
    redactor.addRule({
      name: "custom",
      pattern: /SECRET-\d+/g,
      replacement: "[CUSTOM_REDACTED]",
    });
    const result = redactor.redact("code: SECRET-999");
    expect(result).toContain("[CUSTOM_REDACTED]");
  });

  it("should return all rules", () => {
    const rules = redactor.getRules();
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.some((r) => r.name === "api_key")).toBe(true);
  });
});

describe("Encryption", () => {
  it("should encrypt and decrypt data", () => {
    const data = JSON.stringify({ hello: "world", secret: 42 });
    const password = "test-password-123";
    const encrypted = encrypt(data, password);
    expect(encrypted).toBeInstanceOf(Buffer);
    expect(encrypted.length).toBeGreaterThan(data.length);

    const decrypted = decrypt(encrypted, password);
    expect(decrypted).toBe(data);
  });

  it("should fail to decrypt with wrong password", () => {
    const data = "sensitive data";
    const encrypted = encrypt(data, "correct-password");
    expect(() => decrypt(encrypted, "wrong-password")).toThrow();
  });

  it("should produce different ciphertexts for same input", () => {
    const data = "same data";
    const password = "same-password";
    const enc1 = encrypt(data, password);
    const enc2 = encrypt(data, password);
    expect(enc1.equals(enc2)).toBe(false);
  });

  it("should handle empty string", () => {
    const encrypted = encrypt("", "password");
    const decrypted = decrypt(encrypted, "password");
    expect(decrypted).toBe("");
  });

  it("should handle large data", () => {
    const data = "x".repeat(100000);
    const encrypted = encrypt(data, "password");
    const decrypted = decrypt(encrypted, "password");
    expect(decrypted).toBe(data);
  });

  it("should handle unicode data", () => {
    const data = "Hello 世界 🌍 données";
    const encrypted = encrypt(data, "password");
    const decrypted = decrypt(encrypted, "password");
    expect(decrypted).toBe(data);
  });
});
