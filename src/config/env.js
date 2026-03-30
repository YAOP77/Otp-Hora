const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number.parseInt(process.env.PORT, 10) || 3000,
  rateLimitWindowMs:
    Number.parseInt(process.env.RATE_LIMIT_WINDOW_MS, 10) || 60 * 1000,
  rateLimitCreatePerWindow:
    Number.parseInt(process.env.RATE_LIMIT_CREATE_PER_WINDOW, 10) || 30,
  rateLimitResolvePerWindow:
    Number.parseInt(process.env.RATE_LIMIT_RESOLVE_PER_WINDOW, 10) || 60,
  apiKeyCacheTtlMs:
    Number.parseInt(process.env.API_KEY_CACHE_TTL_MS, 10) || 5 * 60 * 1000,
  apiKeyCacheMaxEntries:
    Number.parseInt(process.env.API_KEY_CACHE_MAX_ENTRIES, 10) || 10_000,
};

module.exports = { env };
