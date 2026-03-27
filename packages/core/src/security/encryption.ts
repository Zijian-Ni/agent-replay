import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const KEY_LENGTH = 32;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const TAG_LENGTH = 16;

/** Encrypt trace data at rest */
export function encrypt(data: string, password: string): Buffer {
  const salt = randomBytes(SALT_LENGTH);
  const key = scryptSync(password, salt, KEY_LENGTH);
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(data, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Format: salt(32) + iv(16) + tag(16) + encrypted data
  return Buffer.concat([salt, iv, tag, encrypted]);
}

/** Decrypt trace data */
export function decrypt(encryptedData: Buffer, password: string): string {
  const salt = encryptedData.subarray(0, SALT_LENGTH);
  const iv = encryptedData.subarray(SALT_LENGTH, SALT_LENGTH + IV_LENGTH);
  const tag = encryptedData.subarray(SALT_LENGTH + IV_LENGTH, SALT_LENGTH + IV_LENGTH + TAG_LENGTH);
  const data = encryptedData.subarray(SALT_LENGTH + IV_LENGTH + TAG_LENGTH);

  const key = scryptSync(password, salt, KEY_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);

  return decipher.update(data) + decipher.final("utf8");
}
