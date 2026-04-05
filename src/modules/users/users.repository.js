const { prisma } = require('../../config/prisma');

async function createUser(data) {
  return prisma.users.create({
    data,
    select: {
      user_id: true,
      nom: true,
      prenom: true,
      status: true,
      role: true,
    },
  });
}

async function findUserProfileById(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: {
      user_id: true,
      nom: true,
      prenom: true,
      pin_hash: true,
      status: true,
      role: true,
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
          status: 'active',
        },
        select: {
          link_id: true,
          external_ref: true,
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
      nom: true,
      prenom: true,
      pin_hash: true,
      status: true,
      token_version: true,
      role: true,
    },
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

async function listUserLoginHistory(userId, limit) {
  return prisma.user_login_history.findMany({
    where: { user_id: userId },
    orderBy: { connected_at: 'desc' },
    take: limit,
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
  findUserProfileById,
  findUserById,
  findUserForLoginByPhone,
  updateUserById,
  incrementTokenVersion,
  deleteUserById,
  createUserLoginHistory,
  listUserLoginHistory,
};
