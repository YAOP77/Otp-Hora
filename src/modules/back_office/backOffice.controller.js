const service = require('./backOffice.service');

async function getUsers(req, res, next) {
  try {
    const filters = { search: req.query.search };
    const users = await service.listUsers(filters);
    return res.json({ data: users });
  } catch (error) {
    return next(error);
  }
}

async function getUser(req, res, next) {
  try {
    const { user_id } = req.params;
    const user = await service.getUserDetail(user_id);
    return res.json({ data: user });
  } catch (error) {
    return next(error);
  }
}

async function changeStatus(req, res, next) {
  try {
    const { user_id } = req.params;
    const { status } = req.body;
    const result = await service.changeUserStatus(user_id, status);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function deactivateDevices(req, res, next) {
  try {
    const { user_id } = req.params;
    const result = await service.forceDeactivateUserDevices(user_id);
    return res.json(result);
  } catch (error) {
    return next(error);
  }
}

async function loginAdmin(req, res, next) {
  try {
    const { email, password } = req.body;
    const result = await service.adminLogin(email, password);
    return res.json({ data: result });
  } catch (error) {
    return next(error);
  }
}

async function getAdminMe(req, res, next) {
  try {
    const { prisma } = require('../../config/prisma');
    const { createError } = require('../../common/errors');
    const user = await prisma.users.findUnique({
      where: { user_id: req.userAuth.user_id },
      select: { user_id: true, nom: true, prenom: true, email: true, role: true, status: true },
    });
    if (!user) return next(createError('Introuvable', 404, 'NOT_FOUND'));
    return res.json({ data: user });
  } catch (error) {
    return next(error);
  }
}

async function createAdmin(req, res, next) {
  try {
    const result = await service.createAdmin(req.body);
    return res.status(201).json(result);
  } catch (error) {
    return next(error);
  }
}

async function getEnterprises(req, res, next) {
  try {
    const enterprises = await service.listEnterprises();
    return res.json({ data: enterprises });
  } catch (error) {
    return next(error);
  }
}

async function getAdmins(req, res, next) {
  try {
    const admins = await service.listAdmins();
    return res.json({ data: admins });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getUsers,
  getUser,
  changeStatus,
  deactivateDevices,
  loginAdmin,
  getAdminMe,
  createAdmin,
  getEnterprises,
  getAdmins,
};
