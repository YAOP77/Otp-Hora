const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const { requireUserAccessToken } = require('../../common/userTokenAuth');
const authRequestsController = require('./authRequests.controller');

const router = Router();

router.post('/auth/request', requireEnterpriseApiKey, authRequestsController.createAuthRequest);
router.get(
  '/auth/status/:request_id',
  requireEnterpriseApiKey,
  authRequestsController.getAuthRequestStatus,
);
router.post('/auth/approve/:request_id', requireUserAccessToken, authRequestsController.approveRequest);
router.post('/auth/reject/:request_id', requireUserAccessToken, authRequestsController.rejectRequest);

module.exports = {
  authRequestsRouter: router,
};
