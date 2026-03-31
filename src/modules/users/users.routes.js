const { Router } = require('express');
const usersController = require('./users.controller');

const router = Router();

router.post('/users', usersController.createUser);

module.exports = {
  usersRouter: router,
};
