const { prisma } = require('../../config/prisma');

async function createEnterprisePinResetToken(data) {
  return prisma.enterprise_pin_reset_tokens.create({
    data,
    select: { reset_id: true, expires_at: true },
  });
}

async function findValidEnterprisePinResetByTokenHash(tokenHash) {
  return prisma.enterprise_pin_reset_tokens.findFirst({
    where: {
      token_hash: tokenHash,
      used_at: null,
      expires_at: { gt: new Date() },
    },
    select: {
      reset_id: true,
      company_id: true,
      expires_at: true,
    },
  });
}

async function markEnterprisePinResetTokenUsed(resetId) {
  return prisma.enterprise_pin_reset_tokens.update({
    where: { reset_id: resetId },
    data: { used_at: new Date() },
    select: { reset_id: true },
  });
}

async function deleteUnusedEnterpriseTokensForCompany(companyId) {
  return prisma.enterprise_pin_reset_tokens.deleteMany({
    where: {
      company_id: companyId,
      used_at: null,
    },
  });
}

module.exports = {
  createEnterprisePinResetToken,
  findValidEnterprisePinResetByTokenHash,
  markEnterprisePinResetTokenUsed,
  deleteUnusedEnterpriseTokensForCompany,
};
