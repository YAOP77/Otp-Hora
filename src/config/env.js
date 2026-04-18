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
  apiKeyCacheTtlMs:
    Number.parseInt(process.env.API_KEY_CACHE_TTL_MS, 10) || 5 * 60 * 1000,
  apiKeyCacheMaxEntries:
    Number.parseInt(process.env.API_KEY_CACHE_MAX_ENTRIES, 10) || 10_000,
  userAccessTokenSecret:
    process.env.USER_ACCESS_TOKEN_SECRET || 'dev_user_access_token_secret_change_me',
  userRefreshTokenSecret:
    process.env.USER_REFRESH_TOKEN_SECRET || 'dev_user_refresh_token_secret_change_me',
  userAccessTokenTtl:
    Number.parseInt(process.env.USER_ACCESS_TOKEN_TTL_SECONDS, 10) || 15 * 60,
  userRefreshTokenTtl:
    Number.parseInt(process.env.USER_REFRESH_TOKEN_TTL_SECONDS, 10) || 7 * 24 * 60 * 60,
  emailVerificationSecret:
    process.env.EMAIL_VERIFICATION_SECRET || 'dev_email_verification_secret_change_me',
  emailVerificationTtl:
    Number.parseInt(process.env.EMAIL_VERIFICATION_TTL_SECONDS, 10) || 24 * 60 * 60,
  pinResetTokenTtlMinutes:
    Number.parseInt(process.env.PIN_RESET_TOKEN_TTL_MINUTES, 10) || 15,
  publicAppUrl: process.env.PUBLIC_APP_URL || 'https://app.otp-hora.example',
  publicHoraUrl: process.env.PUBLIC_HORA_URL || process.env.PUBLIC_APP_URL || 'https://otp-hora.onrender.com',
  // Frontend web Hora (Vercel) — base des consent_url retournées aux entreprises.
  // Fallback sur publicHoraUrl si non défini (les /flow/consent Express prendront le relais).
  publicWebUrl: process.env.PUBLIC_WEB_URL || process.env.PUBLIC_HORA_URL || 'https://otp-hora.onrender.com',
  apiKeyEncryptionKey: process.env.API_KEY_ENCRYPTION_KEY || '',
  flowStateSecret:
    process.env.FLOW_STATE_SECRET || 'dev_flow_state_secret_change_me',
  flowStateTtl:
    Number.parseInt(process.env.FLOW_STATE_TTL_SECONDS, 10) || 15 * 60,
};

module.exports = { env };
