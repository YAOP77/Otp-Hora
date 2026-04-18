const { randomBytes } = require('crypto');

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

// Generates a candidate user_key of the form "x-XX-YYYYYY" (11 chars).
// The 6-hex suffix gives 16.7M combinations per prefix (collision-safe in practice).
function buildUserKey(prenom) {
  const prefix = prefixFromPrenom(prenom);
  const suffix = randomBytes(3).toString('hex');
  return `x-${prefix}-${suffix}`;
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
