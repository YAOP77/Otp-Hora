const { randomUUID } = require('crypto');
const { Prisma } = require('@prisma/client');
const identityLinksRepository = require('./identityLinks.repository');
const { createError } = require('../../common/errors');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isUuid(value) {
  return UUID_REGEX.test(value);
}

async function requestIdentityLink(payload) {
  const companyId = payload?.company_id;
  const externalRef =
    typeof payload?.external_ref === 'string' ? payload.external_ref.trim() : '';

  if (!companyId) {
    const error = new Error('company_id introuvable depuis la clé API');
    error.statusCode = 401;
    throw error;
  }

  if (!externalRef) {
    throw createError('Le champ external_ref est obligatoire', 400, 'INVALID_INPUT');
  }

  const existing = await identityLinksRepository.findByCompanyAndExternalRef(
    companyId,
    externalRef,
  );
  if (existing) {
    throw createError(
      'Une demande ou un lien existe déjà pour cette référence externe',
      409,
      'LINK_OR_REQUEST_EXISTS',
    );
  }

  try {
    return await identityLinksRepository.createIdentityLink({
      link_id: randomUUID(),
      company_id: companyId,
      external_ref: externalRef,
      user_id: null,
      status: 'pending',
    });
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError(
        'Une demande ou un lien existe déjà pour cette référence externe',
        409,
        'LINK_OR_REQUEST_EXISTS',
      );
    }
    throw error;
  }
}

async function confirmIdentityLink(payload) {
  const linkId = typeof payload?.link_id === 'string' ? payload.link_id.trim() : '';
  const userId = typeof payload?.user_id === 'string' ? payload.user_id.trim() : '';
  const requesterUserId =
    typeof payload?.requester_user_id === 'string' ? payload.requester_user_id.trim() : '';

  if (!linkId || !isUuid(linkId)) {
    throw createError('Le champ link_id doit être un UUID valide', 400, 'INVALID_UUID');
  }

  if (!userId || !isUuid(userId)) {
    throw createError('Le champ user_id doit être un UUID valide', 400, 'INVALID_UUID');
  }

  if (requesterUserId && requesterUserId !== userId) {
    throw createError('Accès interdit pour confirmer ce lien', 403, 'FORBIDDEN');
  }

  const link = await identityLinksRepository.findByLinkIdFull(linkId);
  if (!link) {
    throw createError('Lien introuvable', 404, 'LINK_NOT_FOUND');
  }

  if (link.status !== 'pending') {
    throw createError(
      'Ce lien ne peut pas être confirmé (pas en attente)',
      409,
      'LINK_NOT_PENDING',
    );
  }

  if (link.user_id) {
    throw createError('Ce lien est déjà associé à un utilisateur', 409, 'LINK_ALREADY_BOUND');
  }

  const user = await identityLinksRepository.findUserById(userId);
  if (!user) {
    throw createError('Utilisateur introuvable', 404, 'USER_NOT_FOUND');
  }

  const existingActive = await identityLinksRepository.findActiveLinkByUserAndCompany(
    userId,
    link.company_id,
  );
  if (existingActive) {
    throw createError(
      'Un lien actif existe déjà pour cet utilisateur et cette entreprise',
      409,
      'LINK_ALREADY_EXISTS',
    );
  }

  try {
    return await identityLinksRepository.updateIdentityLinkConfirm(linkId, userId);
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      throw createError(
        'Un lien actif existe déjà pour cet utilisateur et cette entreprise',
        409,
        'LINK_ALREADY_EXISTS',
      );
    }
    throw error;
  }
}

module.exports = {
  requestIdentityLink,
  confirmIdentityLink,
};
