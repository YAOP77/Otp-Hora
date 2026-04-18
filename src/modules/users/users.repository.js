const { prisma } = require('../../config/prisma');

async function createUser(data) {
  return prisma.users.create({
    data,
    select: {
      user_id: true,
      nom: true,
      prenom: true,
      user_key: true,
      status: true,
      role: true,
      email: true,
    },
  });
}

async function findUserByUserKey(userKey) {
  return prisma.users.findUnique({
    where: { user_key: userKey },
    select: {
      user_id: true,
      user_key: true,
      status: true,
      nom: true,
      prenom: true,
    },
  });
}

async function findUserByUserKeyFromId(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_key: true },
  });
}

async function findUserProfileById(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      nom: true,
      prenom: true,
      user_key: true,
      pin_hash: true,
      status: true,
      role: true,
      email: true,
      email_verified_at: true,
      user_contacts: {
        select: {
          contact_id: true,
          phone_number: true,
          verified_at: true,
        },
      },
      user_devices: {
        select: {
          device_id: true,
          device_fingerprint: true,
          trusted: true,
          device_name: true,
          user_agent: true,
          last_seen_at: true,
        },
      },
      identity_links: {
        where: {
          status: 'approved',
          enterprise_accounts: {
            deleted_at: null,
            status: { in: ['active', 'valider'] },
          },
        },
        select: {
          link_id: true,
          status: true,
          company_id: true,
          enterprise_accounts: {
            select: {
              nom_entreprise: true,
            },
          },
        },
      },
    },
  });
}

async function findUserById(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      status: true,
      token_version: true,
      role: true,
      email: true,
      email_verified_at: true,
    },
  });
}

async function findUserForLoginByPhone(phoneNumber) {
  return prisma.users.findFirst({
    where: {
      status: 'active',
      user_contacts: {
        some: {
          phone_number: phoneNumber,
        },
      },
    },
    select: {
      user_id: true,
      user_key: true,
      nom: true,
      prenom: true,
      pin_hash: true,
      status: true,
      token_version: true,
      role: true,
    },
  });
}

async function findUserForPinRecoveryByPhone(phoneNumber) {
  return prisma.users.findFirst({
    where: {
      status: 'active',
      user_contacts: {
        some: {
          phone_number: phoneNumber,
        },
      },
    },
    select: {
      user_id: true,
      email: true,
      email_verified_at: true,
      status: true,
    },
  });
}

async function findUserByEmailForUniqueness(emailNormalized) {
  return prisma.users.findFirst({
    where: {
      email: emailNormalized,
    },
    select: { user_id: true },
  });
}

async function updateUserById(userId, data) {
  return prisma.users.update({
    where: { user_id: userId },
    data,
    select: {
      user_id: true,
      nom: true,
      prenom: true,
      status: true,
      role: true,
      email: true,
      email_verified_at: true,
    },
  });
}

async function incrementTokenVersion(userId) {
  return prisma.users.update({
    where: { user_id: userId },
    data: {
      token_version: {
        increment: 1,
      },
    },
    select: {
      user_id: true,
      token_version: true,
    },
  });
}

async function updateUserPinAndRotateSession(userId, pin_hash) {
  return prisma.users.update({
    where: { user_id: userId },
    data: {
      pin_hash,
      token_version: { increment: 1 },
    },
    select: {
      user_id: true,
      token_version: true,
    },
  });
}

async function deleteUserById(userId) {
  return prisma.users.delete({
    where: { user_id: userId },
    select: {
      user_id: true,
    },
  });
}

async function createUserLoginHistory(data) {
  return prisma.user_login_history.create({
    data,
    select: {
      history_id: true,
      device_name: true,
      user_agent: true,
      connected_at: true,
    },
  });
}

async function listUserLoginHistory(userId, limit, offset = 0) {
  return prisma.user_login_history.findMany({
    where: { user_id: userId },
    orderBy: { connected_at: 'desc' },
    take: limit,
    skip: offset,
    select: {
      history_id: true,
      device_name: true,
      user_agent: true,
      connected_at: true,
    },
  });
}

module.exports = {
  createUser,
  findUserByUserKey,
  findUserByUserKeyFromId,
  findUserProfileById,
  findUserById,
  findUserForLoginByPhone,
  findUserForPinRecoveryByPhone,
  findUserByEmailForUniqueness,
  updateUserById,
  incrementTokenVersion,
  updateUserPinAndRotateSession,
  deleteUserById,
  createUserLoginHistory,
  listUserLoginHistory,
};
