const recoveryService = require('./recovery.service');

async function createRecoveryMethod(req, res, next) {
  try {
    const recovery = await recoveryService.createRecoveryMethod({
      user_id: req.body?.user_id,
      method_type: req.body?.method_type,
    });

    return res.status(201).json({
      data: recovery,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createRecoveryMethod,
};
