const { Router } = require('express');
const { requireEnterpriseAuth } = require('../../common/apiKeyAuth');
const authEventsController = require('./authEvents.controller');

const router = Router();

router.get(
  '/auth/events/:request_id',
  requireEnterpriseAuth,
  authEventsController.listEventsByRequest,
);

module.exports = {
  authEventsRouter: router,
};
