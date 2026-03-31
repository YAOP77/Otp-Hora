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

async function findActiveLinkByUserAndCompany(userId, companyId) {
  return prisma.identity_links.findFirst({
    where: {
      user_id: userId,
      company_id: companyId,
      status: 'active',
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

async function findByCompanyAndExternalRef(companyId, externalRef) {
  return prisma.identity_links.findFirst({
    where: {
      company_id: companyId,
      external_ref: externalRef,
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

async function findByLinkIdFull(linkId) {
  return prisma.identity_links.findUnique({
    where: { link_id: linkId },
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

async function updateIdentityLinkConfirm(linkId, userId) {
  return prisma.identity_links.update({
    where: { link_id: linkId },
    data: {
      user_id: userId,
      status: 'active',
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

module.exports = {
  findUserById,
  findByUserAndCompany,
  findActiveLinkByUserAndCompany,
  findByCompanyAndExternalRef,
  findByLinkIdFull,
  createIdentityLink,
  updateIdentityLinkConfirm,
};
