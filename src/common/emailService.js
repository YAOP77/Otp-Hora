const logger = require('./logger');
const { env } = require('../config/env');

/**
 * Mock / adaptateur email : en production, brancher SendGrid, SES, etc.
 * Les liens utilisent PUBLIC_APP_URL pour les deep links app / web.
 */
function sendEmailVerification({ to, verifyUrl }) {
  logger.info({
    module: 'email',
    action: 'send_email_verification',
    to,
    verify_url: verifyUrl,
    message: 'Mock: aucun email réel envoyé (configurer un fournisseur en production)',
  });
  return Promise.resolve({ sent: true, mock: true });
}

function sendPinResetEmail({ to, resetUrl }) {
  logger.info({
    module: 'email',
    action: 'send_pin_reset',
    to,
    reset_url: resetUrl,
    message: 'Mock: aucun email réel envoyé (configurer un fournisseur en production)',
  });
  return Promise.resolve({ sent: true, mock: true });
}

function buildVerifyEmailUrl(token) {
  const base = env.publicAppUrl.replace(/\/$/, '');
  return `${base}/verify-email?token=${encodeURIComponent(token)}`;
}

function buildPinResetUrl(rawToken) {
  const base = env.publicAppUrl.replace(/\/$/, '');
  return `${base}/reset-pin?token=${encodeURIComponent(rawToken)}`;
}

function buildEnterpriseVerifyEmailUrl(token) {
  const base = env.publicAppUrl.replace(/\/$/, '');
  return `${base}/verify-enterprise-email?token=${encodeURIComponent(token)}`;
}

function buildEnterprisePinResetUrl(rawToken) {
  const base = env.publicAppUrl.replace(/\/$/, '');
  return `${base}/reset-enterprise-pin?token=${encodeURIComponent(rawToken)}`;
}

module.exports = {
  sendEmailVerification,
  sendPinResetEmail,
  buildVerifyEmailUrl,
  buildPinResetUrl,
  buildEnterpriseVerifyEmailUrl,
  buildEnterprisePinResetUrl,
};
