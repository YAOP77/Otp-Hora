const identityLinksService = require('./identityLinks.service');

async function createIdentityLink(req, res, next) {
  try {
    const link = await identityLinksService.createIdentityLink({
      company_id: req.enterprise?.company_id,
      user_id: req.body?.user_id,
      external_ref: req.body?.external_ref,
    });

    return res.status(201).json({
      data: link,
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createIdentityLink,
};
