const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const identityLinksController = require('./identityLinks.controller');

const router = Router();

router.post('/links', requireEnterpriseApiKey, identityLinksController.createIdentityLink);

module.exports = {
  identityLinksRouter: router,
};
