const { prisma } = require('../../config/prisma');

async function createEvent(data, tx) {
  const client = tx || prisma;
  return client.auth_events.create({
    data: {
      request_id: data.request_id,
      action: data.action,
    },
    select: {
      event_id: true,
      request_id: true,
      action: true,
      created_at: true,
    },
  });
}

async function findManyByRequestId(requestId) {
  return prisma.auth_events.findMany({
    where: { request_id: requestId },
    orderBy: { created_at: 'asc' },
    select: {
      event_id: true,
      request_id: true,
      action: true,
      created_at: true,
    },
  });
}

module.exports = {
  createEvent,
  findManyByRequestId,
};
