const jwt = require('jsonwebtoken');
const { createError } = require('./errors');
const { env } = require('../config/env');

function signEmailVerificationToken(userId, email) {
  return jwt.sign(
    { sub: userId, email, type: 'email_verify' },
    env.emailVerificationSecret,
    { expiresIn: env.emailVerificationTtl },
  );
}

function verifyEmailVerificationToken(token) {
  try {
    const payload = jwt.verify(token, env.emailVerificationSecret);
    if (!payload || payload.type !== 'email_verify' || !payload.sub || !payload.email) {
      throw createError('Token de vérification invalide', 400, 'INVALID_VERIFICATION_TOKEN');
    }
    return payload;
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('Token de vérification invalide ou expiré', 400, 'INVALID_VERIFICATION_TOKEN');
  }
}

function signEnterpriseEmailVerificationToken(companyId, email) {
  return jwt.sign(
    { sub: companyId, email, type: 'enterprise_email_verify' },
    env.emailVerificationSecret,
    { expiresIn: env.emailVerificationTtl },
  );
}

function verifyEnterpriseEmailVerificationToken(token) {
  try {
    const payload = jwt.verify(token, env.emailVerificationSecret);
    if (
      !payload ||
      payload.type !== 'enterprise_email_verify' ||
      !payload.sub ||
      !payload.email
    ) {
      throw createError('Token de vérification invalide', 400, 'INVALID_VERIFICATION_TOKEN');
    }
    return payload;
  } catch (err) {
    if (err.statusCode) throw err;
    throw createError('Token de vérification invalide ou expiré', 400, 'INVALID_VERIFICATION_TOKEN');
  }
}

module.exports = {
  signEmailVerificationToken,
  verifyEmailVerificationToken,
  signEnterpriseEmailVerificationToken,
  verifyEnterpriseEmailVerificationToken,
};
