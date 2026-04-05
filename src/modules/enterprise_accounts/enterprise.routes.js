const { Router } = require('express');
const enterpriseController = require('./enterprise.controller');
const { requireCompanyAccessToken } = require('../../common/userTokenAuth');

const router = Router();

router.post('/enterprises/register', enterpriseController.registerEnterprise);
router.post('/enterprises/login', enterpriseController.loginEnterprise);
router.post('/enterprises/refresh-token', enterpriseController.refreshEnterpriseToken);
router.post('/enterprises/session/unlock', enterpriseController.unlockEnterpriseSession);

router.get('/enterprises/me', requireCompanyAccessToken, enterpriseController.getEnterpriseMe);
router.patch('/enterprises/me', requireCompanyAccessToken, enterpriseController.patchEnterpriseMe);
router.post('/enterprises/logout', requireCompanyAccessToken, enterpriseController.logoutEnterprise);

router.get(
  '/enterprises/me/devices',
  requireCompanyAccessToken,
  enterpriseController.listEnterpriseDevices,
);
router.post(
  '/enterprises/me/devices',
  requireCompanyAccessToken,
  enterpriseController.registerEnterpriseDevice,
);
router.get(
  '/enterprises/me/linked-users',
  requireCompanyAccessToken,
  enterpriseController.listEnterpriseLinkedUsers,
);
router.get(
  '/enterprises/me/login-history',
  requireCompanyAccessToken,
  enterpriseController.listEnterpriseLoginHistory,
);

router.post('/enterprises', enterpriseController.createEnterprise);

module.exports = {
  enterpriseRouter: router,
};
