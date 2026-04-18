const { prisma } = require('../../config/prisma');

async function createEnterprise(data) {
  return prisma.enterprise_accounts.create({
    data,
    select: {
      company_id: true,
      nom_entreprise: true,
      status: true,
      phone_e164: true,
    },
  });
}

function notDeletedWhere() {
  return { deleted_at: null };
}

async function findEnterpriseByIdForAuth(companyId) {
  return prisma.enterprise_accounts.findFirst({
    where: {
      company_id: companyId,
      ...notDeletedWhere(),
    },
    select: {
      company_id: true,
      nom_entreprise: true,
      api_key: true,
      status: true,
      token_version: true,
      phone_e164: true,
      pin_hash: true,
      email: true,
      email_verified_at: true,
    },
  });
}

async function findEnterpriseForPinRecoveryByPhone(phoneE164) {
  return prisma.enterprise_accounts.findFirst({
    where: {
      phone_e164: phoneE164,
      deleted_at: null,
      pin_hash: { not: null },
      status: { in: ['active', 'valider'] },
    },
    select: {
      company_id: true,
      email: true,
      email_verified_at: true,
      status: true,
    },
  });
}

async function findEnterpriseByEmailExcluding(emailNormalized, excludeCompanyId) {
  return prisma.enterprise_accounts.findFirst({
    where: {
      email: emailNormalized,
      company_id: { not: excludeCompanyId },
      deleted_at: null,
    },
    select: { company_id: true },
  });
}

async function findEnterpriseByPhoneE164(phoneE164) {
  return prisma.enterprise_accounts.findFirst({
    where: {
      phone_e164: phoneE164,
      ...notDeletedWhere(),
    },
    select: {
      company_id: true,
      nom_entreprise: true,
      api_key: true,
      status: true,
      token_version: true,
      phone_e164: true,
      pin_hash: true,
    },
  });
}

async function findAnotherEnterpriseByPhoneE164(phoneE164, excludeCompanyId) {
  return prisma.enterprise_accounts.findFirst({
    where: {
      phone_e164: phoneE164,
      company_id: { not: excludeCompanyId },
      ...notDeletedWhere(),
    },
    select: { company_id: true },
  });
}

async function findActiveEnterprises() {
  return prisma.enterprise_accounts.findMany({
    where: {
      ...notDeletedWhere(),
      status: {
        in: ['active', 'valider'],
      },
    },
    select: {
      company_id: true,
      nom_entreprise: true,
      api_key: true,
      status: true,
    },
  });
}

async function updateEnterpriseTokenVersion(companyId) {
  return prisma.enterprise_accounts.update({
    where: { company_id: companyId },
    data: {
      token_version: {
        increment: 1,
      },
    },
    select: {
      company_id: true,
      token_version: true,
    },
  });
}

async function updateEnterpriseById(companyId, data) {
  return prisma.enterprise_accounts.update({
    where: { company_id: companyId },
    data,
    select: {
      company_id: true,
      nom_entreprise: true,
      status: true,
      phone_e164: true,
      email: true,
      email_verified_at: true,
    },
  });
}

async function updateEnterprisePinAndRotateSession(companyId, pin_hash) {
  return prisma.enterprise_accounts.update({
    where: { company_id: companyId },
    data: {
      pin_hash,
      token_version: { increment: 1 },
    },
    select: {
      company_id: true,
      token_version: true,
    },
  });
}

async function softDeleteEnterprise(companyId) {
  return prisma.$transaction([
    prisma.identity_links.updateMany({
      where: {
        company_id: companyId,
        status: { in: ['pending', 'active'] },
      },
      data: { status: 'revoked' },
    }),
    prisma.enterprise_accounts.update({
      where: { company_id: companyId },
      data: {
        deleted_at: new Date(),
        status: 'deleted',
        token_version: { increment: 1 },
      },
      select: {
        company_id: true,
        status: true,
        deleted_at: true,
      },
    }),
  ]);
}

async function findLinkedUsersForCompany(companyId) {
  return prisma.identity_links.findMany({
    where: {
      company_id: companyId,
      status: 'approved',
    },
    select: {
      link_id: true,
      status: true,
      user_id: true,
      users: {
        select: {
          user_id: true,
          user_key: true,
          nom: true,
          prenom: true,
          status: true,
        },
      },
    },
  });
}

async function listEnterpriseDevices(companyId) {
  return prisma.enterprise_devices.findMany({
    where: { company_id: companyId },
    orderBy: { last_seen_at: 'desc' },
    select: {
      device_id: true,
      device_fingerprint: true,
      trusted: true,
      device_name: true,
      user_agent: true,
      last_seen_at: true,
    },
  });
}

async function upsertEnterpriseDevice(data) {
  const existing = await prisma.enterprise_devices.findFirst({
    where: {
      company_id: data.company_id,
      device_fingerprint: data.device_fingerprint,
    },
    select: { device_id: true },
  });

  if (existing) {
    return prisma.enterprise_devices.update({
      where: { device_id: existing.device_id },
      data: {
        device_name: data.device_name,
        user_agent: data.user_agent,
        last_seen_at: data.last_seen_at,
      },
      select: {
        device_id: true,
        company_id: true,
        device_fingerprint: true,
        trusted: true,
        device_name: true,
        user_agent: true,
        last_seen_at: true,
      },
    });
  }

  return prisma.enterprise_devices.create({
    data,
    select: {
      device_id: true,
      company_id: true,
      device_fingerprint: true,
      trusted: true,
      device_name: true,
      user_agent: true,
      last_seen_at: true,
    },
  });
}

async function createEnterpriseLoginHistory(data) {
  return prisma.enterprise_login_history.create({
    data,
    select: {
      history_id: true,
      device_name: true,
      user_agent: true,
      connected_at: true,
    },
  });
}

async function listEnterpriseLoginHistory(companyId, limit) {
  return prisma.enterprise_login_history.findMany({
    where: { company_id: companyId },
    orderBy: { connected_at: 'desc' },
    take: limit,
    select: {
      history_id: true,
      device_name: true,
      user_agent: true,
      connected_at: true,
    },
  });
}

module.exports = {
  createEnterprise,
  findEnterpriseByIdForAuth,
  findEnterpriseForPinRecoveryByPhone,
  findEnterpriseByEmailExcluding,
  findEnterpriseByPhoneE164,
  findAnotherEnterpriseByPhoneE164,
  findActiveEnterprises,
  updateEnterpriseTokenVersion,
  updateEnterpriseById,
  updateEnterprisePinAndRotateSession,
  softDeleteEnterprise,
  findLinkedUsersForCompany,
  listEnterpriseDevices,
  upsertEnterpriseDevice,
  createEnterpriseLoginHistory,
  listEnterpriseLoginHistory,
};
