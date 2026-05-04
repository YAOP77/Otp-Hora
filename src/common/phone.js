const { parsePhoneNumberFromString } = require('libphonenumber-js');
const { createError } = require('./errors');

const ROLES = {
  USER: 'user',
  COMPANY: 'company',
};

/**
 * Validates and returns E.164 (e.g. +2250700000000). Throws createError on invalid input.
 */
function normalizeToE164(raw, defaultCountry) {
  const input = typeof raw === 'string' ? raw.trim() : '';
  if (!input) {
    throw createError('Le numéro de téléphone est obligatoire', 400, 'INVALID_PHONE');
  }

  const parsed = parsePhoneNumberFromString(input, defaultCountry);
  if (!parsed || !parsed.isValid()) {
    throw createError(
      'Numéro de téléphone invalide (indicatif pays requis, ex. +2250700000000)',
      400,
      'INVALID_PHONE',
    );
  }

  return parsed.format('E.164');
}

/**
 * Best-effort label from user-agent (short device hint).
 */
function guessDeviceNameFromUserAgent(userAgent) {
  const ua = typeof userAgent === 'string' ? userAgent : '';
  if (!ua) return null;
  if (/iPhone/i.test(ua)) return 'iPhone';
  if (/iPad/i.test(ua)) return 'iPad';
  if (/Android/i.test(ua)) {
    const m = ua.match(/Android [\d.]+;\s*([^;)]+)/i);
    return m && m[1] ? m[1].trim().slice(0, 80) : 'Android';
  }
  if (/Macintosh|Mac OS X/i.test(ua)) return 'Mac';
  if (/Windows NT/i.test(ua)) return 'PC Windows';
  if (/Linux/i.test(ua)) return 'Linux';
  return null;
}

module.exports = {
  normalizeToE164,
  guessDeviceNameFromUserAgent,
  ROLES,
};
