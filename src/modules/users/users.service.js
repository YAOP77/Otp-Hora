const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const usersRepository = require('./users.repository');
const { createError } = require('../../common/errors');
const {
  signUserAccessToken,
  signUserRefreshToken,
  verifyUserRefreshToken,
} = require('../../common/userTokenAuth');

const PIN_REGEX = /^\d{4,6}$/;
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function validatePin(pin) {
  if (typeof pin !== 'string' || !PIN_REGEX.test(pin.trim())) {
    const error = new Error('Le PIN doit contenir 4 à 6 chiffres');
    error.statusCode = 400;
    throw error;
  }
}

async function createUser(payload) {
  const nom = typeof payload?.nom === 'string' ? payload.nom.trim() : '';
  const prenom = typeof payload?.prenom === 'string' ? payload.prenom.trim() : '';
  const pin = typeof payload?.pin === 'string' ? payload.pin.trim() : '';

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
  });

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
  const phoneNumber =
    typeof payload?.phone_number === 'string' ? payload.phone_number.trim() : '';
  const pin = typeof payload?.pin === 'string' ? payload.pin.trim() : '';

  if (!phoneNumber) {
    throw createError('Le champ phone_number est obligatoire', 400, 'INVALID_INPUT');
  }

  validatePin(pin);

  const user = await usersRepository.findUserForLoginByPhone(phoneNumber);
  if (!user || user.status !== 'active') {
    throw createError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');
  }

  const isValidPin = await bcrypt.compare(pin, user.pin_hash);
  if (!isValidPin) {
    throw createError('Identifiants invalides', 401, 'INVALID_CREDENTIALS');
  }

  return {
    user: {
      user_id: user.user_id,
      nom: user.nom,
      prenom: user.prenom,
      status: user.status,
    },
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
    contacts: user.user_contacts,
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
  const pin = typeof payload?.pin === 'string' ? payload.pin.trim() : '';

  if (!userId || !UUID_REGEX.test(userId)) {
    throw createError('Le parametre user_id doit etre un UUID valide', 400, 'INVALID_UUID');
  }

  if (!requesterUserId || requesterUserId !== userId) {
    throw createError('Accès interdit à cette ressource', 403, 'FORBIDDEN');
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

module.exports = {
  createUser,
  loginUser,
  getUserProfile,
  refreshUserToken,
  logoutUser,
  updateUser,
  deleteUser,
};
