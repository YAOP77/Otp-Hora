const { randomUUID } = require('crypto');
const { Prisma } = require('@prisma/client');
const identityLinksRepository = require('./identityLinks.repository');
const { createError } = require('../../common/errors');

async function createIdentityLink(payload) {
  const companyId = payload?.company_id;
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const externalRef =
    typeof payload?.external_ref === 'string' ? payload.external_ref.trim() : '';

  if (!companyId) {
    const error = new Error('company_id introuvable depuis la clé API');
    error.statusCode = 401;
    throw error;
  }

  if (!userId) {
    const error = new Error('Le champ user_id est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  if (!externalRef) {
    const error = new Error('Le champ external_ref est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  const user = await identityLinksRepository.findUserById(userId);
  if (!user) {
    const error = new Error('Utilisateur introuvable');
    error.statusCode = 404;
    throw error;
  }

  const existingLink = await identityLinksRepository.findByUserAndCompany(userId, companyId);
  if (existingLink) {
    throw createError(
      'Link already exists for this user and enterprise',
      409,
      'LINK_ALREADY_EXISTS',
    );
  }

  try {
    return await identityLinksRepository.createIdentityLink({
      link_id: randomUUID(),
      company_id: companyId,
      user_id: userId,
      external_ref: externalRef,
      status: 'active',
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError(
        'Link already exists for this user and enterprise',
        409,
        'LINK_ALREADY_EXISTS',
      );
    }
    throw error;
  }
}

module.exports = {
  createIdentityLink,
};
