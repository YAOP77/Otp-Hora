const { prisma } = require('../../config/prisma');

async function createUser(data) {
  return prisma.users.create({
    data,
    select: {
      user_id: true,
      nom: true,
      prenom: true,
      status: true,
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
      user_contacts: {
        select: {
          contact_id: true,
          phone_number: true,
          verified_at: true,
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

module.exports = {
  createUser,
  findUserProfileById,
  findUserById,
  findUserForLoginByPhone,
  updateUserById,
  incrementTokenVersion,
  deleteUserById,
};
