const { randomUUID } = require('crypto');
const { URL } = require('url');
const { Prisma } = require('@prisma/client');
const identityLinksRepository = require('./identityLinks.repository');
const usersRepository = require('../users/users.repository');
const { createError } = require('../../common/errors');
const { env } = require('../../config/env');

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const USER_KEY_REGEX = /^x-[a-z]{2}-[0-9a-zA-Z]{5}$/;

function isUuid(value) {
  return typeof value === 'string' && UUID_REGEX.test(value);
}

function buildConsentUrl(linkId) {
  const base = new URL('/enterprise', env.publicWebUrl);
  base.searchParams.set('link_id', linkId);
  return base.toString();
}

function serializeLink(link, { includeConsentUrl = false } = {}) {
  const payload = {
    link_id: link.link_id,
    company_id: link.company_id,
    user_id: link.user_id,
    status: link.status,
    created_at: link.created_at,
    updated_at: link.updated_at,
  };
  if (includeConsentUrl && link.status === 'pending') {
    payload.consent_url = buildConsentUrl(link.link_id);
  }
  return payload;
}

// ─── ENTERPRISE SIDE ──────────────────────────────────────────────────

// POST /api/links : idempotent link request.
// - Looks up user by user_key.
// - Returns existing link (pending / approved / rejected) if one exists for (user, company).
// - Otherwise creates a new pending link and returns it with a consent_url.
async function requestLinkByUserKey(payload) {
  const companyId = payload?.company_id;
  const userKey = typeof payload?.user_key === 'string' ? payload.user_key.trim() : '';

  if (!companyId) {
    throw createError('company_id introuvable depuis la clé API', 401, 'UNAUTHORIZED');
  }
  if (!userKey) {
    throw createError('Le champ user_key est obligatoire', 400, 'INVALID_INPUT');
  }
  if (!USER_KEY_REGEX.test(userKey)) {
    throw createError('Le champ user_key est invalide', 400, 'INVALID_USER_KEY');
  }

  const user = await usersRepository.findUserByUserKey(userKey);
  if (!user) {
    throw createError('Utilisateur Hora introuvable', 404, 'USER_NOT_FOUND');
  }
  if (user.status !== 'active') {
    throw createError('Utilisateur Hora inactif', 409, 'USER_INACTIVE');
  }

  const existing = await identityLinksRepository.findLinkByUserAndCompany(
    user.user_id,
    companyId,
  );
  if (existing) {
    return serializeLink(existing, { includeConsentUrl: true });
  }

  try {
    const created = await identityLinksRepository.createLink({
      link_id: randomUUID(),
      company_id: companyId,
      user_id: user.user_id,
      status: 'pending',
    });
    return serializeLink(created, { includeConsentUrl: true });
  } catch (error) {
    // Race condition on unique (user_id, company_id) — retry read
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      const raced = await identityLinksRepository.findLinkByUserAndCompany(
        user.user_id,
        companyId,
      );
      if (raced) return serializeLink(raced, { includeConsentUrl: true });
    }
    throw error;
  }
}

// GET /api/flow/links/:link_id : public endpoint used by the consent web page
// (Vercel) to display enterprise name + status. No auth required — link_id
// is shared in the URL anyway, and the response contains no sensitive data.
async function getPublicLinkInfo(payload) {
  const linkId = typeof payload?.link_id === 'string' ? payload.link_id.trim() : '';
  if (!isUuid(linkId)) {
    throw createError('Le paramètre link_id doit être un UUID valide', 400, 'INVALID_UUID');
  }

  const link = await identityLinksRepository.findLinkWithCompanyById(linkId);
  if (!link) {
    throw createError('Liaison introuvable', 404, 'LINK_NOT_FOUND');
  }

  return {
    link_id: link.link_id,
    enterprise_name: link.enterprise_accounts?.nom_entreprise || null,
    status: link.status,
    created_at: link.created_at,
  };
}

// GET /api/links/:link_id : enterprise polls status of one of its links.
async function getLinkStatus(payload) {
  const companyId = payload?.company_id;
  const linkId = typeof payload?.link_id === 'string' ? payload.link_id.trim() : '';

  if (!companyId) {
    throw createError('company_id introuvable depuis la clé API', 401, 'UNAUTHORIZED');
  }
  if (!isUuid(linkId)) {
    throw createError('Le paramètre link_id doit être un UUID valide', 400, 'INVALID_UUID');
  }

  const link = await identityLinksRepository.findLinkByIdAndCompany(linkId, companyId);
  if (!link) {
    throw createError('Liaison introuvable', 404, 'LINK_NOT_FOUND');
  }
  return serializeLink(link, { includeConsentUrl: true });
}

// ─── USER SIDE ────────────────────────────────────────────────────────

// GET /api/me/links : list current user's links (any status, sorted newest first).
async function listMyLinks(payload) {
  const userId = payload?.requester_user_id;
  const statusFilter =
    typeof payload?.status === 'string' && payload.status ? payload.status : null;

  if (!isUuid(userId)) {
    throw createError('Non authentifié', 401, 'UNAUTHORIZED');
  }

  const links = await identityLinksRepository.listLinksByUser(userId, statusFilter);
  return links.map((link) => ({
    link_id: link.link_id,
    company_id: link.company_id,
    nom_entreprise: link.enterprise_accounts?.nom_entreprise || null,
    status: link.status,
    created_at: link.created_at,
    updated_at: link.updated_at,
  }));
}

// GET /api/enterprises/me/links : list all links belonging to the enterprise.
async function listCompanyLinks(payload) {
  const companyId = payload?.company_id;
  const statusFilter =
    typeof payload?.status === 'string' && payload.status ? payload.status : null;

  if (!companyId) {
    throw createError('company_id introuvable depuis la clé API', 401, 'UNAUTHORIZED');
  }

  const links = await identityLinksRepository.listLinksByCompany(companyId, statusFilter);
  return links.map((link) => ({
    link_id: link.link_id,
    user_id: link.user_id,
    user: link.users
      ? {
          user_id: link.users.user_id,
          user_key: link.users.user_key,
          nom: link.users.nom,
          prenom: link.users.prenom,
        }
      : null,
    status: link.status,
    created_at: link.created_at,
    updated_at: link.updated_at,
  }));
}

async function resolveLink(payload, targetStatus) {
  const userId = payload?.requester_user_id;
  const linkId = typeof payload?.link_id === 'string' ? payload.link_id.trim() : '';

  if (!isUuid(userId)) {
    throw createError('Non authentifié', 401, 'UNAUTHORIZED');
  }
  if (!isUuid(linkId)) {
    throw createError('Le paramètre link_id doit être un UUID valide', 400, 'INVALID_UUID');
  }

  const link = await identityLinksRepository.findLinkByIdAndUser(linkId, userId);
  if (!link) {
    throw createError('Liaison introuvable', 404, 'LINK_NOT_FOUND');
  }
  if (link.status === targetStatus) {
    return serializeLink(link);
  }
  if (link.status !== 'pending') {
    throw createError(
      `La liaison n'est pas en attente (status=${link.status})`,
      409,
      'LINK_NOT_PENDING',
    );
  }

  const updated = await identityLinksRepository.updateLinkStatus(linkId, targetStatus);
  return serializeLink(updated);
}

// POST /api/me/links/:link_id/approve
async function approveLink(payload) {
  return resolveLink(payload, 'approved');
}

// POST /api/me/links/:link_id/reject
async function rejectLink(payload) {
  return resolveLink(payload, 'rejected');
}

// DELETE /api/me/links/:link_id : user deletes a rejected link to allow the
// enterprise to retry (via a fresh POST /api/links). Only rejected links can
// be deleted — pending/approved links must be rejected first.
async function deleteMyLink(payload) {
  const userId = payload?.requester_user_id;
  const linkId = typeof payload?.link_id === 'string' ? payload.link_id.trim() : '';

  if (!isUuid(userId)) {
    throw createError('Non authentifié', 401, 'UNAUTHORIZED');
  }
  if (!isUuid(linkId)) {
    throw createError('Le paramètre link_id doit être un UUID valide', 400, 'INVALID_UUID');
  }

  const link = await identityLinksRepository.findLinkByIdAndUser(linkId, userId);
  if (!link) {
    throw createError('Liaison introuvable', 404, 'LINK_NOT_FOUND');
  }
  if (link.status !== 'rejected') {
    throw createError(
      'Seules les liaisons rejetées peuvent être supprimées',
      409,
      'LINK_NOT_REJECTED',
    );
  }

  await identityLinksRepository.deleteLinkById(linkId);
  return { deleted: true, link_id: linkId };
}

module.exports = {
  requestLinkByUserKey,
  getLinkStatus,
  getPublicLinkInfo,
  listMyLinks,
  listCompanyLinks,
  approveLink,
  rejectLink,
  deleteMyLink,
  buildConsentUrl,
};
