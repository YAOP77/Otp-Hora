const { prisma } = require('../../config/prisma');

async function createUser(data) {
  return prisma.users.create({
    data,
    select: {
      user_id: true,
      name: true,
      status: true,
    },
  });
}

module.exports = {
  createUser,
};
