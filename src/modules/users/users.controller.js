const usersService = require('./users.service');

async function createUser(req, res, next) {
  try {
    const user = await usersService.createUser({
      name: req.body?.name,
    });
    return res.status(201).json({
      data: user,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createUser,
};