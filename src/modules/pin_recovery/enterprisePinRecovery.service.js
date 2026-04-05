const { randomBytes, randomUUID } = require('crypto');
const { createHash } = require('crypto');
const bcrypt = require('bcrypt');
const enterprisePinRecoveryRepository = require('./enterprisePinRecovery.repository');
const enterpriseRepository = require('../enterprise_accounts/enterprise.repository');
const { createError } = require('../../common/errors');
const { normalizeToE164 } = require('../../common/phone');
const { normalizePinInput } = require('../../common/pinInput');
const { env } = require('../../config/env');
const {
  sendPinResetEmail,
  buildEnterprisePinResetUrl,
} = require('../../common/emailService');

const PIN_REGEX = /^\d{4,6}$/;

function hashPinResetRawToken(rawToken) {
  return createHash('sha256').update(rawToken, 'utf8').digest('hex');
}

function validatePin(rawPin) {
  const pin = normalizePinInput(rawPin);
  if (!PIN_REGEX.test(pin)) {
    throw createError('Le PIN doit contenir 4 à 6 chiffres', 400, 'INVALID_PIN_FORMAT');
  }
}

/**
 * Récupération PIN entreprise : même règle que les utilisateurs — email vérifié obligatoire.
 */
async function requestEnterprisePinReset(payload) {
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
  const enterprise = await enterpriseRepository.findEnterpriseForPinRecoveryByPhone(phoneE164);

  if (!enterprise) {
    throw createError(
      'Aucun compte entreprise actif ne correspond à ce numéro, ou la récupération est indisponible.',
      404,
      'RECOVERY_NOT_AVAILABLE',
    );
  }

  if (!enterprise.email || !enterprise.email_verified_at) {
    throw createError(
      'La réinitialisation du code PIN nécessite un email vérifié sur le compte entreprise. Connectez-vous pour ajouter et confirmer votre email (PUT /enterprises/me/recovery-email).',
      403,
      'RECOVERY_EMAIL_REQUIRED',
    );
  }

  await enterprisePinRecoveryRepository.deleteUnusedEnterpriseTokensForCompany(
    enterprise.company_id,
  );

  const rawToken = randomBytes(32).toString('hex');
  const token_hash = hashPinResetRawToken(rawToken);
  const expiresAt = new Date(Date.now() + env.pinResetTokenTtlMinutes * 60 * 1000);

  await enterprisePinRecoveryRepository.createEnterprisePinResetToken({
    reset_id: randomUUID(),
    company_id: enterprise.company_id,
    token_hash,
    expires_at: expiresAt,
  });

  const resetUrl = buildEnterprisePinResetUrl(rawToken);
  await sendPinResetEmail({ to: enterprise.email, resetUrl });

  return {
    message:
      'Si un compte éligible existe, un email de réinitialisation a été envoyé. Vérifiez votre boîte mail.',
    expires_in_minutes: env.pinResetTokenTtlMinutes,
  };
}

async function confirmEnterprisePinReset(payload) {
  const rawToken =
    typeof payload?.token === 'string' ? payload.token.trim() : '';
  const pin = normalizePinInput(payload?.pin);

  if (!rawToken) {
    throw createError('Le champ token est obligatoire', 400, 'INVALID_INPUT');
  }
  validatePin(pin);

  const token_hash = hashPinResetRawToken(rawToken);
  const record =
    await enterprisePinRecoveryRepository.findValidEnterprisePinResetByTokenHash(token_hash);

  if (!record) {
    throw createError('Lien de réinitialisation invalide ou expiré', 400, 'INVALID_OR_EXPIRED_RESET_TOKEN');
  }

  const pin_hash = await bcrypt.hash(pin, 12);

  await enterpriseRepository.updateEnterprisePinAndRotateSession(record.company_id, pin_hash);
  await enterprisePinRecoveryRepository.markEnterprisePinResetTokenUsed(record.reset_id);
  await enterprisePinRecoveryRepository.deleteUnusedEnterpriseTokensForCompany(record.company_id);

  return {
    message:
      'Le code PIN entreprise a été réinitialisé. Vous pouvez vous connecter avec le nouveau code.',
  };
}

module.exports = {
  requestEnterprisePinReset,
  confirmEnterprisePinReset,
};
