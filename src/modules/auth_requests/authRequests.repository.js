const { prisma } = require('../../config/prisma');

async function findLinkById(linkId) {
  return prisma.identity_links.findUnique({
    where: { link_id: linkId },
    select: {
      link_id: true,
      company_id: true,
      user_id: true,
      status: true,
    },
  });
}

async function createAuthRequest(data) {
  return prisma.auth_requests.create({
    data,
    select: {
      request_id: true,
      status: true,
      expires_at: true,
    },
  });
}

async function createAuthRequestWithEvent(data) {
  return prisma.$transaction(async (tx) => {
    const authEventsService = require('../auth_events/authEvents.service');

    const created = await tx.auth_requests.create({
      data,
      select: {
        request_id: true,
        status: true,
        expires_at: true,
      },
    });

    await authEventsService.createEvent(created.request_id, 'created', tx);

    return created;
  });
}

async function findAuthRequestById(requestId) {
  return prisma.auth_requests.findUnique({
    where: { request_id: requestId },
    select: {
      request_id: true,
      link_id: true,
      status: true,
      expires_at: true,
    },
  });
}

async function resolveAuthRequestIfPending(requestId, status, action, now) {
  return prisma.$transaction(async (tx) => {
    const authEventsService = require('../auth_events/authEvents.service');

    const updateResult = await tx.auth_requests.updateMany({
      where: {
        request_id: requestId,
        status: 'pending',
        expires_at: {
          gt: now,
        },
      },
      data: { status },
    });

    if (updateResult.count === 0) {
      const current = await tx.auth_requests.findUnique({
        where: { request_id: requestId },
        select: {
          request_id: true,
          status: true,
          expires_at: true,
        },
      });
      return {
        updated: false,
        current,
      };
    }

    await authEventsService.createEvent(requestId, action, tx);

    const updatedRequest = await tx.auth_requests.findUnique({
      where: { request_id: requestId },
      select: {
        request_id: true,
        status: true,
        expires_at: true,
      },
    });

    return {
      updated: true,
      current: updatedRequest,
    };
  });
}

async function countRecentAuthRequestsByCompany(companyId, since) {
  return prisma.auth_events.count({
    where: {
      created_at: {
        gte: since,
      },
      action: 'created',
      auth_requests: {
        identity_links: {
          company_id: companyId,
        },
      },
    },
  });
}

async function countRecentResolveEventsByCompany(companyId, since) {
  return prisma.auth_events.count({
    where: {
      created_at: {
        gte: since,
      },
      action: {
        in: ['approved', 'rejected'],
      },
      auth_requests: {
        identity_links: {
          company_id: companyId,
        },
      },
    },
  });
}

async function countRecentResolveEventsByUser(userId, since) {
  return prisma.auth_events.count({
    where: {
      created_at: {
        gte: since,
      },
      action: {
        in: ['approved', 'rejected'],
      },
      auth_requests: {
        identity_links: {
          user_id: userId,
        },
      },
    },
  });
}

module.exports = {
  findLinkById,
  createAuthRequest,
  createAuthRequestWithEvent,
  findAuthRequestById,
  resolveAuthRequestIfPending,
  countRecentAuthRequestsByCompany,
  countRecentResolveEventsByCompany,
  countRecentResolveEventsByUser,
};
