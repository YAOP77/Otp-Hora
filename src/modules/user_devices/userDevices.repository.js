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
      device_name: true,
      user_agent: true,
      last_seen_at: true,
    },
  });
}

async function upsertUserDevice(data) {
  const existing = await prisma.user_devices.findFirst({
    where: {
      user_id: data.user_id,
      device_fingerprint: data.device_fingerprint,
    },
    select: { device_id: true },
  });

  if (existing) {
    return prisma.user_devices.update({
      where: { device_id: existing.device_id },
      data: {
        device_name: data.device_name,
        user_agent: data.user_agent,
        last_seen_at: data.last_seen_at,
      },
      select: {
        device_id: true,
        user_id: true,
        device_fingerprint: true,
        trusted: true,
        device_name: true,
        user_agent: true,
        last_seen_at: true,
      },
    });
  }

  return createDevice(data);
}

module.exports = {
  findUserById,
  createDevice,
  upsertUserDevice,
};
