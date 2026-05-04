const { Router } = require('express');
const pinRecoveryController = require('./pinRecovery.controller');

const router = Router();

router.post('/users/pin-recovery/request', pinRecoveryController.requestPinReset);
router.post('/users/pin-recovery/confirm', pinRecoveryController.confirmPinReset);

router.post(
  '/enterprises/pin-recovery/request',
  pinRecoveryController.requestEnterprisePinReset,
);
router.post(
  '/enterprises/pin-recovery/confirm',
  pinRecoveryController.confirmEnterprisePinReset,
);

module.exports = {
  pinRecoveryRouter: router,
};
