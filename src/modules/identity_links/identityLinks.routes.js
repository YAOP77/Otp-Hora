const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const { requireUserAccessToken } = require('../../common/userTokenAuth');
const identityLinksController = require('./identityLinks.controller');

const router = Router();

router.post('/links', requireEnterpriseApiKey, identityLinksController.requestIdentityLink);
router.post('/links/confirm', requireUserAccessToken, identityLinksController.confirmIdentityLink);

module.exports = {
  identityLinksRouter: router,
};
