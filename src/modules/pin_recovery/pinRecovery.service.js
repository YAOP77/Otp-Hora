const { randomBytes, randomUUID } = require('crypto');
const { createHash } = require('crypto');
const bcrypt = require('bcrypt');
const pinRecoveryRepository = require('./pinRecovery.repository');
const usersRepository = require('../users/users.repository');
const { createError } = require('../../common/errors');
const { normalizeToE164 } = require('../../common/phone');
const { normalizePinInput } = require('../../common/pinInput');
const { env } = require('../../config/env');
const {
  sendPinResetEmail,
  buildPinResetUrl,
} = require('../../common/emailService');

const PIN_REGEX = /^\d{4,6}$/;

function hashPinResetRawToken(rawToken) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function validatePin(pin) {
  if (typeof pin !== 'string' || !PIN_REGEX.test(pin.trim())) {
    throw createError('Le PIN doit contenir 4 à 6 chiffres', 400, 'INVALID_PIN_FORMAT');
  }
}

/**
 * Demande de récupération : uniquement si email vérifié en base (anti-fraude : pas de reset sans email prouvé).
 */
async function requestPinReset(payload) {
  const contact =
    typeof payload?.contact === 'string'
      ? payload.contact.trim()
      : typeof payload?.phone === 'string'
        ? payload.phone.trim()
        : typeof payload?.phone_number === 'string'
          ? payload.phone_number.trim()
          : '';

  if (!contact) {
    throw createError('Le champ contact (téléphone) est obligatoire', 400, 'INVALID_INPUT');
  }

  const phoneE164 = normalizeToE164(contact);
  const user = await usersRepository.findUserForPinRecoveryByPhone(phoneE164);

  if (!user || user.status !== 'active') {
    throw createError(
      'Aucun compte actif ne correspond à ce numéro, ou la récupération est indisponible.',
      404,
      'RECOVERY_NOT_AVAILABLE',
    );
  }

  if (!user.email || !user.email_verified_at) {
    throw createError(
      'La réinitialisation du code PIN nécessite un email vérifié sur votre compte. Connectez-vous pour ajouter et confirmer votre email.',
      403,
      'RECOVERY_EMAIL_REQUIRED',
    );
  }

  await pinRecoveryRepository.deleteUnusedTokensForUser(user.user_id);

  const rawToken = randomBytes(32).toString('hex');
  const token_hash = hashPinResetRawToken(rawToken);
  const expiresAt = new Date(Date.now() + env.pinResetTokenTtlMinutes * 60 * 1000);

  await pinRecoveryRepository.createPinResetToken({
    reset_id: randomUUID(),
    user_id: user.user_id,
    token_hash,
    expires_at: expiresAt,
  });

  const resetUrl = buildPinResetUrl(rawToken);
  await sendPinResetEmail({ to: user.email, resetUrl });

  return {
    message:
      'Si un compte éligible existe, un email de réinitialisation a été envoyé. Vérifiez votre boîte mail.',
    expires_in_minutes: env.pinResetTokenTtlMinutes,
  };
}

async function confirmPinReset(payload) {
  const rawToken =
    typeof payload?.token === 'string' ? payload.token.trim() : '';
  const pin = normalizePinInput(payload?.pin);

  if (!rawToken) {
    throw createError('Le champ token est obligatoire', 400, 'INVALID_INPUT');
  }
  validatePin(pin);

  const token_hash = hashPinResetRawToken(rawToken);
  const record = await pinRecoveryRepository.findValidPinResetByTokenHash(token_hash);

  if (!record) {
    throw createError('Lien de réinitialisation invalide ou expiré', 400, 'INVALID_OR_EXPIRED_RESET_TOKEN');
  }

  const pin_hash = await bcrypt.hash(pin, 12);

  await usersRepository.updateUserPinAndRotateSession(record.user_id, pin_hash);
  await pinRecoveryRepository.markPinResetTokenUsed(record.reset_id);
  await pinRecoveryRepository.deleteUnusedTokensForUser(record.user_id);

  return {
    message: 'Votre code PIN a été réinitialisé. Vous pouvez vous connecter avec le nouveau code.',
  };
}

module.exports = {
  requestPinReset,
  confirmPinReset,
};
