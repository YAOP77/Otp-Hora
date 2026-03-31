const { Router } = require('express');
const recoveryController = require('./recovery.controller');

const router = Router();

router.post('/recovery', recoveryController.createRecoveryMethod);

module.exports = {
  recoveryRouter: router,
};
