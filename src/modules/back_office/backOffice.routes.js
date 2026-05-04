const { Router } = require('express');
const backOfficeController = require('./backOffice.controller');
const { requireAdminAccessToken } = require('../../common/userTokenAuth');

const router = Router();

router.post('/back-office/login', backOfficeController.loginAdmin);
router.get('/back-office/me', requireAdminAccessToken, backOfficeController.getAdminMe);
router.post('/back-office/admins', requireAdminAccessToken, backOfficeController.createAdmin);
router.get('/back-office/admins', requireAdminAccessToken, backOfficeController.getAdmins);
router.get('/back-office/users', requireAdminAccessToken, backOfficeController.getUsers);
router.get('/back-office/users/:user_id', requireAdminAccessToken, backOfficeController.getUser);
router.patch('/back-office/users/:user_id/status', requireAdminAccessToken, backOfficeController.changeStatus);
router.post('/back-office/users/:user_id/devices/deactivate', requireAdminAccessToken, backOfficeController.deactivateDevices);
router.get('/back-office/enterprises', requireAdminAccessToken, backOfficeController.getEnterprises);

module.exports = {
  backOfficeRouter: router,
};
