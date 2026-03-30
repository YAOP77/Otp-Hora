const { healthRouter } = require('./health/health.routes');
const { usersRouter } = require('./users/users.routes');
const { enterpriseRouter } = require('./enterprise_accounts/enterprise.routes');
const { identityLinksRouter } = require('./identity_links/identityLinks.routes');
const { authRequestsRouter } = require('./auth_requests/authRequests.routes');
const { authEventsRouter } = require('./auth_events/authEvents.routes');
const { recoveryRouter } = require('./recovery_methods/recovery.routes');
const { userContactsRouter } = require('./user_contacts/userContacts.routes');
const { userDevicesRouter } = require('./user_devices/userDevices.routes');

function registerRoutes(app) {
  app.use('/api', healthRouter);
  app.use('/api', usersRouter);
  app.use('/api', enterpriseRouter);
  app.use('/api', identityLinksRouter);
  app.use('/api', authRequestsRouter);
  app.use('/api', authEventsRouter);
  app.use('/api', recoveryRouter);
  app.use('/api', userContactsRouter);
  app.use('/api', userDevicesRouter);
}

module.exports = { registerRoutes };
