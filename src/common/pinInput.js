/**
 * Normalise le code PIN depuis le corps JSON. Les clients (mobile, générateurs)
 * envoient souvent un nombre (`"pin": 1234`) au lieu d'une chaîne (`"1234"`),
 * ce qui faisait échouer la validation côté serveur (PIN traité comme vide).
 *
 * @param {unknown} raw
 * @returns {string}
 */
function normalizePinInput(raw) {
  if (raw === null || raw === undefined) return '';
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    const n = Math.trunc(Math.abs(raw));
    if (!Number.isSafeInteger(n)) return '';
    return String(n);
  }
  if (typeof raw === 'string') return raw.trim();
  return '';
}

/**
 * Lit le PIN depuis le corps JSON (alias alignés utilisateur / entreprise / mobile).
 * @param {object|undefined|null} body
 */
function pinFromBody(body) {
  if (!body || typeof body !== 'object') return undefined;
  return body.pin ?? body.PIN ?? body.code_pin;
}

module.exports = {
  normalizePinInput,
  pinFromBody,
};
