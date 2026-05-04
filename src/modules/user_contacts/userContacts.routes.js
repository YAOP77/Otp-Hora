const { Router } = require('express');
const userContactsController = require('./userContacts.controller');

const router = Router();

router.post('/contacts', userContactsController.createContact);

module.exports = {
  userContactsRouter: router,
};
