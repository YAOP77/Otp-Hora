const { Router } = require('express');
const { requireEnterpriseApiKey } = require('../../common/apiKeyAuth');
const userContactsController = require('./userContacts.controller');

const router = Router();

router.post('/contacts', requireEnterpriseApiKey, userContactsController.createContact);

module.exports = {
  userContactsRouter: router,
};
