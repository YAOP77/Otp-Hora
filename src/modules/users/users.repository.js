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

module.exports = {
  createUser,
};
