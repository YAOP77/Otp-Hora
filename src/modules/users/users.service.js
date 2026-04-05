const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const usersRepository = require('./users.repository');
const { createError } = require('../../common/errors');
const { normalizeToE164, ROLES } = require('../../common/phone');
const { normalizePinInput } = require('../../common/pinInput');
const { formatLoginHistoryLabel } = require('../../common/loginHistoryFormat');
const {
  signUserAccessToken,
  signUserRefreshToken,
  verifyUserRefreshToken,
} = require('../../common/userTokenAuth');
const {
  signEmailVerificationToken,
  verifyEmailVerificationToken,
} = require('../../common/emailTokenAuth');
const {
  sendEmailVerification,
  buildVerifyEmailUrl,
} = require('../../common/emailService');

const PIN_REGEX = /^\d{4,6}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const LOGIN_HISTORY_LIMIT = 5;

function validatePin(rawPin) {
  const pin = normalizePinInput(rawPin);
  if (!PIN_REGEX.test(pin)) {
    const error = new Error('Le PIN doit contenir 4 à 6 chiffres');
    error.statusCode = 400;
    error.code = 'INVALID_PIN_FORMAT';
    throw error;
  }
}

function normalizeEmail(raw) {
  if (typeof raw !== 'string') return '';
  return raw.trim().toLowerCase();
}

async function recordUserLogin(userId, deviceMeta) {
  await usersRepository.createUserLoginHistory({
    history_id: randomUUID(),
    user_id: userId,
    device_name: deviceMeta.device_name || null,
    user_agent: deviceMeta.user_agent || null,
  });
}

async function createUser(payload) {
  const nom = typeof payload?.nom === 'string' ? payload.nom.trim() : '';
  const prenom = typeof payload?.prenom === 'string' ? payload.prenom.trim() : '';
  const pin = normalizePinInput(payload?.pin);

  if (!nom) {
    const error = new Error('Le champ nom est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  if (!prenom) {
    const error = new Error('Le champ prenom est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  validatePin(pin);

  const pin_hash = await bcrypt.hash(pin, 12);

  const createdUser = await usersRepository.createUser({
    user_id: randomUUID(),
    nom,
    prenom,
    pin_hash,
    token_version: 0,
    status: 'active',
    role: ROLES.USER,
  });

  await recordUserLogin(createdUser.user_id, payload.device_meta || {});

  return {
    user: createdUser,
    auth: {
      access_token: signUserAccessToken(createdUser.user_id, 0),
      refresh_token: signUserRefreshToken(createdUser.user_id, 0),
      token_type: 'Bearer',
    },
  };
}

async function loginUser(payload) {
  const phoneRaw =
    typeof payload?.phone_number === 'string'
      ? payload.phone_number
      : payload?.phone ?? payload?.contact;
  const pin = normalizePinInput(payload?.pin);

  if (!phoneRaw || typeof phoneRaw !== 'string') {
    throw createError('Le champ phone_number est obligatoire', 400, 'INVALID_INPUT');
  }

  validatePin(pin);

  const phoneNumber = normalizeToE164(phoneRaw.trim());
  const user = await usersRepository.findUserForLoginByPhone(phoneNumber);
  if (!user || user.status !== 'active') {
    throw createError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');
  }

  const isValidPin = await bcrypt.compare(pin, user.pin_hash);
  if (!isValidPin) {
    throw createError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');
  }

  await recordUserLogin(user.user_id, payload.device_meta || {});

  return {
    user: {
      user_id: user.user_id,
      nom: user.nom,
      prenom: user.prenom,
      status: user.status,
      role: user.role || ROLES.USER,
    },
    auth: {
      access_token: signUserAccessToken(user.user_id, user.token_version),
      refresh_token: signUserRefreshToken(user.user_id, user.token_version),
      token_type: 'Bearer',
    },
  };
}

async function unlockUserSession(payload) {
  const pin = normalizePinInput(payload?.pin);
  const refreshToken =
    typeof payload?.refresh_token === 'string' ? payload.refresh_token.trim() : '';

  if (!refreshToken) {
    throw createError('Le champ refresh_token est obligatoire', 400, 'INVALID_INPUT');
  }
  validatePin(pin);

  const tokenPayload = verifyUserRefreshToken(refreshToken);
  const user = await usersRepository.findUserById(tokenPayload.sub);
  if (!user || user.status !== 'active') {
    throw createError('Session invalide', 401, 'INVALID_SESSION');
  }

  if (user.token_version !== tokenPayload.tv) {
    throw createError('Refresh token invalide ou expiré', 401, 'INVALID_REFRESH_TOKEN');
  }

  const profile = await usersRepository.findUserProfileById(user.user_id);
  if (!profile) {
    throw createError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
  }

  const isValidPin = await bcrypt.compare(pin, profile.pin_hash);
  if (!isValidPin) {
    throw createError('PIN incorrect', 401, 'INVALID_PIN');
  }

  await recordUserLogin(user.user_id, payload.device_meta || {});

  return {
    auth: {
      access_token: signUserAccessToken(user.user_id, user.token_version),
      refresh_token: signUserRefreshToken(user.user_id, user.token_version),
      token_type: 'Bearer',
    },
  };
}

async function getUserProfile(payload) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const includePinHash = payload?.include_pin_hash === true;

  if (!userId) {
    throw createError('Le parametre user_id est obligatoire', 400, 'INVALID_INPUT');
  }

  if (!UUID_REGEX.test(userId)) {
    throw createError('Le parametre user_id doit etre un UUID valide', 400, 'INVALID_UUID');
  }

  if (payload?.requester_user_id && payload.requester_user_id !== userId) {
    throw createError('Accès interdit à ce profil', 403, 'FORBIDDEN');
  }

  const user = await usersRepository.findUserProfileById(userId);
  if (!user) {
    throw createError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
  }

  const linkedAccounts = user.identity_links.map((link) => ({
    link_id: link.link_id,
    company_id: link.company_id,
    nom_entreprise: link.enterprise_accounts?.nom_entreprise || null,
    external_ref: link.external_ref,
    status: link.status,
  }));

  return {
    user_id: user.user_id,
    nom: user.nom,
    prenom: user.prenom,
    status: user.status,
    role: user.role || ROLES.USER,
    email: user.email,
    email_verified: Boolean(user.email_verified_at),
    contacts: user.user_contacts,
    devices: user.user_devices,
    linked_accounts_count: linkedAccounts.length,
    linked_accounts: linkedAccounts,
    pin_hash: includePinHash ? user.pin_hash : undefined,
  };
}

async function refreshUserToken(payload) {
  const refreshToken =
    typeof payload?.refresh_token === 'string' ? payload.refresh_token.trim() : '';

  if (!refreshToken) {
    throw createError('Le champ refresh_token est obligatoire', 400, 'INVALID_INPUT');
  }

  const tokenPayload = verifyUserRefreshToken(refreshToken);
  const user = await usersRepository.findUserById(tokenPayload.sub);
  if (!user || user.status !== 'active') {
    throw createError('Utilisateur introuvable ou inactif', 401, 'UNAUTHORIZED');
  }

  if (user.token_version !== tokenPayload.tv) {
    throw createError('Refresh token invalide ou expiré', 401, 'INVALID_REFRESH_TOKEN');
  }

  return {
    access_token: signUserAccessToken(user.user_id, user.token_version),
    refresh_token: signUserRefreshToken(user.user_id, user.token_version),
    token_type: 'Bearer',
  };
}

async function logoutUser(payload) {
  const requesterUserId =
    typeof payload?.requester_user_id === 'string' ? payload.requester_user_id.trim() : '';

  if (!requesterUserId || !UUID_REGEX.test(requesterUserId)) {
    throw createError('Token utilisateur invalide', 401, 'INVALID_TOKEN');
  }

  await usersRepository.incrementTokenVersion(requesterUserId);
  return {
    message: 'Déconnexion réussie',
  };
}

async function updateUser(payload) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const requesterUserId =
    typeof payload?.requester_user_id === 'string' ? payload.requester_user_id.trim() : '';
  const nom = typeof payload?.nom === 'string' ? payload.nom.trim() : '';
  const pin = normalizePinInput(payload?.pin);

  if (!userId || !UUID_REGEX.test(userId)) {
    throw createError('Le parametre user_id doit etre un UUID valide', 400, 'INVALID_UUID');
  }

  if (!requesterUserId || requesterUserId !== userId) {
    throw createError('Accès interdit à cette ressource', 403, 'FORBIDDEN');
  }

  if (payload?.email !== undefined || payload?.recovery_email !== undefined) {
    throw createError(
      "L'email doit être géré via PUT /users/me/recovery-email",
      400,
      'USE_RECOVERY_EMAIL_ENDPOINT',
    );
  }

  const data = {};

  if (nom) {
    data.nom = nom;
  }

  if (pin) {
    validatePin(pin);
    data.pin_hash = await bcrypt.hash(pin, 12);
  }

  if (Object.keys(data).length === 0) {
    throw createError('Aucune modification demandée', 400, 'INVALID_INPUT');
  }

  try {
    const updated = await usersRepository.updateUserById(userId, data);
    return updated;
  } catch {
    throw createError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
  }
}

async function deleteUser(payload) {
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const requesterUserId =
    typeof payload?.requester_user_id === 'string' ? payload.requester_user_id.trim() : '';

  if (!userId || !UUID_REGEX.test(userId)) {
    throw createError('Le parametre user_id doit etre un UUID valide', 400, 'INVALID_UUID');
  }

  if (!requesterUserId || requesterUserId !== userId) {
    throw createError('Accès interdit à cette ressource', 403, 'FORBIDDEN');
  }

  try {
    await usersRepository.deleteUserById(userId);
    return {
      deleted: true,
      user_id: userId,
    };
  } catch {
    throw createError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
  }
}

async function listUserLoginHistory(userId) {
  if (!userId || !UUID_REGEX.test(userId)) {
    throw createError('Le parametre user_id doit etre un UUID valide', 400, 'INVALID_UUID');
  }

  const rows = await usersRepository.listUserLoginHistory(userId, LOGIN_HISTORY_LIMIT);
  return rows.map((h) => ({
    history_id: h.history_id,
    label: formatLoginHistoryLabel(h.device_name, h.connected_at),
    device_name: h.device_name,
    connected_at: h.connected_at,
  }));
}

async function setRecoveryEmail(payload) {
  const requesterUserId =
    typeof payload?.requester_user_id === 'string' ? payload.requester_user_id.trim() : '';
  const emailRaw = typeof payload?.email === 'string' ? payload.email : '';

  if (!requesterUserId || !UUID_REGEX.test(requesterUserId)) {
    throw createError('Non authentifié', 401, 'UNAUTHORIZED');
  }

  const email = normalizeEmail(emailRaw);
  if (!email) {
    throw createError('Email invalide', 400, 'INVALID_EMAIL');
  }

  const other = await usersRepository.findUserByEmailForUniqueness(email);
  if (other && other.user_id !== requesterUserId) {
    throw createError('Cet email est déjà utilisé', 409, 'EMAIL_ALREADY_REGISTERED');
  }

  await usersRepository.updateUserById(requesterUserId, {
    email,
    email_verified_at: null,
  });

  const token = signEmailVerificationToken(requesterUserId, email);
  const verifyUrl = buildVerifyEmailUrl(token);
  await sendEmailVerification({ to: email, verifyUrl });

  return {
    message:
      'Un email de vérification a été envoyé (simulation en développement : voir les logs serveur).',
    email,
    email_verified: false,
  };
}

async function verifyRecoveryEmail(payload) {
  const token =
    typeof payload?.token === 'string' ? payload.token.trim() : '';

  if (!token) {
    throw createError('Le champ token est obligatoire', 400, 'INVALID_INPUT');
  }

  const decoded = verifyEmailVerificationToken(token);
  const user = await usersRepository.findUserById(decoded.sub);
  if (!user || user.status !== 'active') {
    throw createError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
  }

  const tokenEmail = normalizeEmail(decoded.email);
  if (!user.email || normalizeEmail(user.email) !== tokenEmail) {
    throw createError('Token incompatible avec le compte', 400, 'EMAIL_TOKEN_MISMATCH');
  }

  if (user.email_verified_at) {
    return {
      message: 'Cet email est déjà vérifié.',
      email: user.email,
      email_verified: true,
    };
  }

  await usersRepository.updateUserById(user.user_id, {
    email_verified_at: new Date(),
  });

  return {
    message: 'Email vérifié. Vous pouvez utiliser la réinitialisation du PIN si besoin.',
    email: user.email,
    email_verified: true,
  };
}

module.exports = {
  createUser,
  loginUser,
  unlockUserSession,
  getUserProfile,
  refreshUserToken,
  logoutUser,
  updateUser,
  deleteUser,
  listUserLoginHistory,
  setRecoveryEmail,
  verifyRecoveryEmail,
};
