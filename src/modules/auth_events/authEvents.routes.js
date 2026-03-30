const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const authEventsController = require('./authEvents.controller');

const router = Router();

router.get(
  '/auth/events/:request_id',
  requireEnterpriseApiKey,
  authEventsController.listEventsByRequest,
);

module.exports = {
  authEventsRouter: router,
};
