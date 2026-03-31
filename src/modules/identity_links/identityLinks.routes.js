const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const identityLinksController = require('./identityLinks.controller');

const router = Router();

router.post('/links', requireEnterpriseApiKey, identityLinksController.requestIdentityLink);
router.post('/links/confirm', identityLinksController.confirmIdentityLink);

module.exports = {
  identityLinksRouter: router,
};
