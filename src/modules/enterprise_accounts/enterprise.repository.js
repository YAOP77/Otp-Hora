const { prisma } = require('../../config/prisma');

async function createEnterprise(data) {
  return prisma.enterprise_accounts.create({
    data,
    select: {
      company_id: true,
      nom_entreprise: true,
      status: true,
    },
  });
}

async function findActiveEnterprises() {
  return prisma.enterprise_accounts.findMany({
    where: {
      status: 'active',
    },
    select: {
      company_id: true,
      nom_entreprise: true,
      api_key: true,
      status: true,
    },
  });
}

module.exports = {
  createEnterprise,
  findActiveEnterprises,
};
