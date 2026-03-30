const enterpriseService = require('./enterprise.service');

async function createEnterprise(req, res, next) {
  try {
    const enterprise = await enterpriseService.createEnterprise({
      nom_entreprise: req.body?.nom_entreprise,
    });

    return res.status(201).json({
      data: enterprise,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createEnterprise,
};
