const crypto = require('crypto');

/**
 * Cache en mémoire des authentifications API key réussies.
 * Clé : SHA-256 de la clé API (jamais la clé en clair).
 * Réduit les comparaisons bcrypt sur les requêtes répétées (même clé).
 */

const cache = new Map();

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey, 'utf8').digest('hex');
}

function trimCacheIfNeeded(maxEntries) {
  if (cache.size < maxEntries) {
    return;
  }
  const removeCount = Math.max(1, Math.floor(cache.size * 0.2));
  const keys = cache.keys();
  for (let i = 0; i < removeCount; i++) {
    const k = keys.next().value;
    if (k === undefined) {
      break;
    }
    cache.delete(k);
  }
}

function getCachedEnterprise(apiKey) {
  const key = hashApiKey(apiKey);
  const entry = cache.get(key);
  if (!entry) {
    return null;
  }
  if (Date.now() > entry.expiresAt) {
    cache.delete(key);
    return null;
  }
  return entry.enterprise;
}

function setCachedEnterprise(apiKey, enterprise, ttlMs, maxEntries) {
  trimCacheIfNeeded(maxEntries);
  const key = hashApiKey(apiKey);
  cache.set(key, {
    enterprise: {
      company_id: enterprise.company_id,
      nom_entreprise: enterprise.nom_entreprise,
      status: enterprise.status,
    },
    expiresAt: Date.now() + ttlMs,
  });
}

module.exports = {
  getCachedEnterprise,
  setCachedEnterprise,
};
