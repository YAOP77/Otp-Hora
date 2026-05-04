const { prisma } = require('../../config/prisma');

async function createPinResetToken(data) {
  return prisma.pin_reset_tokens.create({
    data,
    select: { reset_id: true, expires_at: true },
  });
}

async function findValidPinResetByTokenHash(tokenHash) {
  return prisma.pin_reset_tokens.findFirst({
    where: {
      token_hash: tokenHash,
      used_at: null,
      expires_at: { gt: new Date() },
    },
    select: {
      reset_id: true,
      user_id: true,
      expires_at: true,
    },
  });
}

async function markPinResetTokenUsed(resetId) {
  return prisma.pin_reset_tokens.update({
    where: { reset_id: resetId },
    data: { used_at: new Date() },
    select: { reset_id: true },
  });
}

async function deleteUnusedTokensForUser(userId) {
  return prisma.pin_reset_tokens.deleteMany({
    where: {
      user_id: userId,
      used_at: null,
    },
  });
}

module.exports = {
  createPinResetToken,
  findValidPinResetByTokenHash,
  markPinResetTokenUsed,
  deleteUnusedTokensForUser,
};
