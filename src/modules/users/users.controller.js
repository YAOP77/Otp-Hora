const usersService = require('./users.service');

async function createUser(req, res, next) {
  try {
    const user = await usersService.createUser({
      nom: req.body?.nom,
      prenom: req.body?.prenom,
      pin: req.body?.pin,
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