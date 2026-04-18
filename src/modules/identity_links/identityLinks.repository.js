const { prisma } = require('../../config/prisma');

const LINK_SELECT = {
  link_id: true,
  company_id: true,
  user_id: true,
  status: true,
};

const LINK_WITH_COMPANY_SELECT = {
  ...LINK_SELECT,
  enterprise_accounts: {
    select: {
      nom_entreprise: true,
      deleted_at: true,
      status: true,
    },
  },
};

async function findLinkByUserAndCompany(userId, companyId) {
  return prisma.identity_links.findFirst({
    where: { user_id: userId, company_id: companyId },
    select: LINK_SELECT,
  });
}

async function findLinkById(linkId) {
  return prisma.identity_links.findUnique({
    where: { link_id: linkId },
    select: LINK_SELECT,
  });
}

async function findLinkByIdAndCompany(linkId, companyId) {
  return prisma.identity_links.findFirst({
    where: { link_id: linkId, company_id: companyId },
    select: LINK_SELECT,
  });
}

async function findLinkByIdAndUser(linkId, userId) {
  return prisma.identity_links.findFirst({
    where: { link_id: linkId, user_id: userId },
    select: LINK_SELECT,
  });
}

async function listLinksByUser(userId, statusFilter) {
  return prisma.identity_links.findMany({
    where: {
      user_id: userId,
      ...(statusFilter ? { status: statusFilter } : {}),
      enterprise_accounts: { deleted_at: null },
    },
    select: LINK_WITH_COMPANY_SELECT,
    orderBy: { link_id: 'desc' },
  });
}

async function createLink(data) {
  return prisma.identity_links.create({
    data,
    select: LINK_SELECT,
  });
}

async function updateLinkStatus(linkId, status) {
  return prisma.identity_links.update({
    where: { link_id: linkId },
    data: { status },
    select: LINK_SELECT,
  });
}

async function deleteLinkById(linkId) {
  return prisma.identity_links.delete({
    where: { link_id: linkId },
    select: { link_id: true },
  });
}

module.exports = {
  findLinkByUserAndCompany,
  findLinkById,
  findLinkByIdAndCompany,
  findLinkByIdAndUser,
  listLinksByUser,
  createLink,
  updateLinkStatus,
  deleteLinkById,
};
