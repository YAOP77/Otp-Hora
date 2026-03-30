const { prisma } = require('../../config/prisma');

async function findUserById(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true },
  });
}

async function findByUserAndCompany(userId, companyId) {
  return prisma.identity_links.findFirst({
    where: {
      user_id: userId,
      company_id: companyId,
    },
    select: {
      link_id: true,
      company_id: true,
      user_id: true,
      external_ref: true,
      status: true,
    },
  });
}

async function createIdentityLink(data) {
  return prisma.identity_links.create({
    data,
    select: {
      link_id: true,
      company_id: true,
      user_id: true,
      external_ref: true,
      status: true,
    },
  });
}

module.exports = {
  findUserById,
  findByUserAndCompany,
  createIdentityLink,
};
