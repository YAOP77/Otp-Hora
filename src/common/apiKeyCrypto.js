const { createCipheriv, createDecipheriv, randomBytes, scryptSync } = require('crypto');
const { env } = require('../config/env');

// AES-256-GCM reversible encryption for enterprise api_keys so they can be
// displayed on the account page. The key is derived from API_KEY_ENCRYPTION_KEY
// (any string). If the env is missing in dev, we derive from a constant — NOT
// safe for production. Always set API_KEY_ENCRYPTION_KEY in prod.

const ALGO = 'aes-256-gcm';
const IV_LEN = 12;   // GCM recommends 96-bit IVs
const KEY_LEN = 32;  // AES-256

function deriveKey() {
  const raw = env.apiKeyEncryptionKey && env.apiKeyEncryptionKey.length >= 16
    ? env.apiKeyEncryptionKey
    : 'dev_api_key_encryption_fallback_change_me';
  // scryptSync is deterministic for the same input, so the same env var
  // always yields the same key.
  return scryptSync(raw, 'otp-hora-api-key-v1', KEY_LEN);
}

function encryptApiKey(plaintext) {
  if (typeof plaintext !== 'string' || plaintext.length === 0) {
    throw new Error('encryptApiKey: plaintext must be a non-empty string');
  }
  const iv = randomBytes(IV_LEN);
  const cipher = createCipheriv(ALGO, deriveKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();
  // Packed format: base64(iv | authTag | ciphertext)
  return Buffer.concat([iv, authTag, ciphertext]).toString('base64');
}

function decryptApiKey(packed) {
  if (typeof packed !== 'string' || packed.length === 0) return null;
  try {
    const buf = Buffer.from(packed, 'base64');
    const iv = buf.subarray(0, IV_LEN);
    const authTag = buf.subarray(IV_LEN, IV_LEN + 16);
    const ciphertext = buf.subarray(IV_LEN + 16);
    const decipher = createDecipheriv(ALGO, deriveKey(), iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

module.exports = { encryptApiKey, decryptApiKey };
