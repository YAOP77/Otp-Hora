const { Router } = require('express');
const { requireEnterpriseAuth } = require('../../common/apiKeyAuth');
const { requireUserAccessToken } = require('../../common/userTokenAuth');
const authRequestsController = require('./authRequests.controller');

const router = Router();

router.post('/auth/request', requireEnterpriseAuth, authRequestsController.createAuthRequest);
router.post('/auth/status', requireEnterpriseAuth, authRequestsController.getAuthRequestStatus);
router.get('/auth/status/:request_id', requireEnterpriseAuth, authRequestsController.getAuthRequestStatus);
router.post('/auth/approve/:request_id', requireUserAccessToken, authRequestsController.approveRequest);
router.post('/auth/reject/:request_id', requireUserAccessToken, authRequestsController.rejectRequest);

module.exports = {
  authRequestsRouter: router,
};
