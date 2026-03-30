const { prisma } = require('../../config/prisma');

async function findUserById(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    select: { user_id: true },
  });
}

async function createDevice(data) {
  return prisma.user_devices.create({
    data,
    select: {
      device_id: true,
      user_id: true,
      device_fingerprint: true,
      trusted: true,
    },
  });
}

module.exports = {
  findUserById,
  createDevice,
};
