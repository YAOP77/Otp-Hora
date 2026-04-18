const { Router } = require('express');
const { requireEnterpriseAuth } = require('../../common/apiKeyAuth');
const { requireUserAccessToken } = require('../../common/userTokenAuth');
const identityLinksController = require('./identityLinks.controller');

const router = Router();

// Enterprise side (x-api-key or Bearer company)
router.post('/links', requireEnterpriseAuth, identityLinksController.requestLink);
router.get('/links/:link_id', requireEnterpriseAuth, identityLinksController.getLinkStatus);

// User side (Bearer user)
router.get('/me/links', requireUserAccessToken, identityLinksController.listMyLinks);
router.post('/me/links/:link_id/approve', requireUserAccessToken, identityLinksController.approveLink);
router.post('/me/links/:link_id/reject', requireUserAccessToken, identityLinksController.rejectLink);
router.delete('/me/links/:link_id', requireUserAccessToken, identityLinksController.deleteMyLink);

module.exports = {
  identityLinksRouter: router,
};
