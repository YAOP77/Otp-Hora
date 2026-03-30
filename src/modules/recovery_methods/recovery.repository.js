const { prisma } = require('../../config/prisma');

async function findUserById(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true },
  });
}

async function createRecoveryMethod(data) {
  return prisma.recovery_methods.create({
    data,
    select: {
      recovery_id: true,
      user_id: true,
      method_type: true,
      status: true,
    },
  });
}

module.exports = {
  findUserById,
  createRecoveryMethod,
};
