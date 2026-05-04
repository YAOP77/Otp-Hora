const repository = require('./backOffice.repository');
const { createError } = require('../../common/errors');
const bcrypt = require('bcrypt');
const { signUserAccessToken, signUserRefreshToken } = require('../../common/userTokenAuth');

async function listUsers(filters) {
  try {
    const users = await repository.findAllUsers(filters);
    return users.map((u) => ({
      ...u,
      email_verified: Boolean(u.email_verified_at),
      contacts: u.user_contacts ?? [],
      devices: u.user_devices ?? [],
      user_contacts: undefined,
      user_devices: undefined,
    }));
  } catch (error) {
    throw createError('Erreur lors de la récupération des utilisateurs', 500, 'INTERNAL_ERROR');
  }
}

async function getUserDetail(userId) {
  const user = await repository.findUserDetails(userId);
  if (!user) {
    throw createError('Utilisateur non trouvé', 404, 'NOT_FOUND');
  }
  return user;
}

async function changeUserStatus(userId, status) {
  if (!['active', 'suspended', 'blocked'].includes(status)) {
    throw createError('Statut invalide', 400, 'BAD_REQUEST');
  }
  
  const user = await repository.findUserDetails(userId);
  if (!user) {
    throw createError('Utilisateur non trouvé', 404, 'NOT_FOUND');
  }

  await repository.updateUserStatus(userId, status);
  return { message: `Statut mis à jour vers ${status}` };
}

async function forceDeactivateUserDevices(userId) {
  const user = await repository.findUserDetails(userId);
  if (!user) {
    throw createError('Utilisateur non trouvé', 404, 'NOT_FOUND');
  }

  await repository.deactivateAllUserDevices(userId);
  return { message: 'Tous les appareils de cet utilisateur ont été déconnectés.' };
}

async function adminLogin(email, password) {
  if (!email || !password) {
    throw createError('Email et mot de passe requis', 400, 'BAD_REQUEST');
  }

  const user = await repository.findAdminByEmail(email);
  if (!user || user.role !== 'admin' || !user.password_hash) {
    throw createError('Identifiants invalides', 401, 'UNAUTHORIZED');
  }

  if (user.status !== 'active') {
    throw createError('Compte inactif', 403, 'FORBIDDEN');
  }

  const isValid = await bcrypt.compare(password, user.password_hash);
  if (!isValid) {
    throw createError('Identifiants invalides', 401, 'UNAUTHORIZED');
  }

  const access_token = signUserAccessToken(user.user_id, user.token_version);
  const refresh_token = signUserRefreshToken(user.user_id, user.token_version);

  return {
    user_id: user.user_id,
    access_token,
    refresh_token,
  };
}

async function createAdmin(data) {
  const { email, password, nom, prenom } = data;
  
  if (!email || !password || !nom || !prenom) {
    throw createError('Tous les champs sont requis', 400, 'BAD_REQUEST');
  }

  const existing = await repository.findAdminByEmail(email);
  if (existing) {
    throw createError('Cet email est déjà utilisé', 400, 'CONFLICT');
  }

  const password_hash = await bcrypt.hash(password, 10);
  
  const user = await repository.createAdminUser({
    email,
    password_hash,
    nom,
    prenom,
    username: email.split('@')[0], // username par défaut basé sur l'email
  });

  return {
    user_id: user.user_id,
    message: 'Administrateur créé avec succès',
  };
}

async function listEnterprises() {
  try {
    return await repository.findAllEnterprises();
  } catch (error) {
    throw createError('Erreur lors de la récupération des entreprises', 500, 'INTERNAL_ERROR');
  }
}

async function listAdmins() {
  try {
    return await repository.findAllAdmins();
  } catch (error) {
    throw createError('Erreur lors de la récupération des administrateurs', 500, 'INTERNAL_ERROR');
  }
}

module.exports = {
  listUsers,
  getUserDetail,
  changeUserStatus,
  forceDeactivateUserDevices,
  adminLogin,
  createAdmin,
  listEnterprises,
  listAdmins,
};
