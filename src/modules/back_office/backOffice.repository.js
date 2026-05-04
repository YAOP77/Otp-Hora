const { prisma } = require('../../config/prisma');

async function findAllUsers(filters = {}) {
  const where = {};
  if (filters.search) {
    where.OR = [
      { username: { contains: filters.search, mode: 'insensitive' } },
      { nom: { contains: filters.search, mode: 'insensitive' } },
      { prenom: { contains: filters.search, mode: 'insensitive' } },
    ];
    // If the search looks like a phone number, we can search in contacts too
    if (/^\+?\d+$/.test(filters.search)) {
      where.OR.push({
        user_contacts: {
          some: { phone_number: { contains: filters.search } }
        }
      });
    }
  }

  return prisma.users.findMany({
    where,
    orderBy: { user_id: 'desc' },
    select: {
      user_id: true,
      username: true,
      nom: true,
      prenom: true,
      email: true,
      email_verified_at: true,
      status: true,
      role: true,
      user_contacts: {
        select: { phone_number: true }
      },
      user_devices: {
        where: { is_active: true },
        select: { device_id: true, device_name: true, user_agent: true, last_seen_at: true }
      }
    }
  });
}

async function findUserDetails(userId) {
  return prisma.users.findUnique({
    where: { user_id: userId },
    include: {
      user_contacts: true,
      user_devices: {
        orderBy: { last_seen_at: 'desc' }
      },
      user_login_history: {
        orderBy: { connected_at: 'desc' },
        take: 50
      }
    }
  });
}

async function updateUserStatus(userId, status) {
  return prisma.users.update({
    where: { user_id: userId },
    data: { status }
  });
}

async function deactivateAllUserDevices(userId) {
  return prisma.user_devices.updateMany({
    where: { user_id: userId, is_active: true },
    data: { is_active: false, deactivated_at: new Date() }
  });
}

async function findAdminByEmail(email) {
  return prisma.users.findUnique({
    where: { email }
  });
}

async function createAdminUser(data) {
  return prisma.users.create({
    data: {
      ...data,
      role: 'admin',
      status: 'active',
      email_verified_at: new Date(),
    }
  });
}

async function findAllEnterprises() {
  return prisma.enterprise_accounts.findMany({
    orderBy: { company_id: 'desc' },
    select: {
      company_id: true,
      nom_entreprise: true,
      username: true,
      email: true,
      email_verified_at: true,
      status: true,
      phone_e164: true,
      deleted_at: true,
    },
  });
}

async function findAllAdmins() {
  return prisma.users.findMany({
    where: { role: 'admin' },
    orderBy: { user_id: 'desc' },
    select: {
      user_id: true,
      nom: true,
      prenom: true,
      email: true,
      status: true,
      role: true,
    }
  });
}

module.exports = {
  findAllUsers,
  findUserDetails,
  updateUserStatus,
  deactivateAllUserDevices,
  findAdminByEmail,
  createAdminUser,
  findAllEnterprises,
  findAllAdmins,
};
