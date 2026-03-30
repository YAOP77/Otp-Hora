const { randomBytes, randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const enterpriseRepository = require('./enterprise.repository');

function generateApiKey() {
  return randomBytes(32).toString('hex');
}

async function createEnterprise(payload) {
  const nomEntreprise =
    typeof payload?.nom_entreprise === 'string' ? payload.nom_entreprise.trim() : '';

  if (!nomEntreprise) {
    const error = new Error('Le champ nom_entreprise est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  const rawApiKey = generateApiKey();
  const hashedApiKey = await bcrypt.hash(rawApiKey, 12);

  const enterprise = await enterpriseRepository.createEnterprise({
    company_id: randomUUID(),
    nom_entreprise: nomEntreprise,
    api_key: hashedApiKey,
    status: 'valider',
  });

  return {
    ...enterprise,
    api_key: rawApiKey,
  };
}

module.exports = {
  createEnterprise,
};
