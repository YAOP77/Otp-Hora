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
    },
  });
}

module.exports = {
  createUser,
  findUserProfileById,
  findUserById,
};
