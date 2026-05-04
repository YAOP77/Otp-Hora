const { randomBytes } = require('crypto');

const BASE62_ALPHABET =
  '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
const SUFFIX_LENGTH = 5;

// Returns a 2-letter lowercase prefix derived from the user's first name.
// Falls back to "us" if the name has no usable letters (e.g. only accents/digits).
function prefixFromPrenom(prenom) {
  const cleaned = String(prenom || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
  if (cleaned.length >= 2) return cleaned.slice(0, 2);
  if (cleaned.length === 1) return `${cleaned}x`;
  return 'us';
}

// 5-char base62 suffix → 62^5 ≈ 916M combinations per prefix.
function randomSuffix() {
  const bytes = randomBytes(SUFFIX_LENGTH);
  let out = '';
  for (let i = 0; i < SUFFIX_LENGTH; i += 1) {
    out += BASE62_ALPHABET[bytes[i] % 62];
  }
  return out;
}

// Generates a candidate user_key of the form "x-XX-YYYYY" (10 chars).
function buildUserKey(prenom) {
  const prefix = prefixFromPrenom(prenom);
  return `x-${prefix}-${randomSuffix()}`;
}

// Tries up to `maxAttempts` times to produce a unique user_key.
// `isTaken(candidate)` must be an async function returning truthy if the key already exists.
async function generateUniqueUserKey(prenom, isTaken, maxAttempts = 8) {
  for (let i = 0; i < maxAttempts; i += 1) {
    const candidate = buildUserKey(prenom);
    // eslint-disable-next-line no-await-in-loop
    if (!(await isTaken(candidate))) return candidate;
  }
  throw new Error('Failed to generate a unique user_key after multiple attempts');
}

module.exports = { buildUserKey, generateUniqueUserKey, prefixFromPrenom };
