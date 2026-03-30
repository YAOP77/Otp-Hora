const { prisma } = require('../../config/prisma');

async function findUserById(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true },
  });
}

async function createContact(data) {
  return prisma.user_contacts.create({
    data,
    select: {
      contact_id: true,
      user_id: true,
      phone_number: true,
      verified_at: true,
    },
  });
}

module.exports = {
  findUserById,
  createContact,
};
