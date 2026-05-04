const { healthRouter } = require('./health/health.routes');
const { usersRouter } = require('./users/users.routes');
const { enterpriseRouter } = require('./enterprise_accounts/enterprise.routes');
const { identityLinksRouter } = require('./identity_links/identityLinks.routes');
const { pinRecoveryRouter } = require('./pin_recovery/pinRecovery.routes');
const { userContactsRouter } = require('./user_contacts/userContacts.routes');
const { userDevicesRouter } = require('./user_devices/userDevices.routes');
const { backOfficeRouter } = require('./back_office/backOffice.routes');

function registerRoutes(app) {
  app.use('/api', healthRouter);
  app.use('/api', usersRouter);
  app.use('/api', enterpriseRouter);
  app.use('/api', identityLinksRouter);
  app.use('/api', pinRecoveryRouter);
  app.use('/api', userContactsRouter);
  app.use('/api', userDevicesRouter);
  app.use('/api', backOfficeRouter);
}

module.exports = { registerRoutes };
