const { Router } = require('express');

const router = Router();

router.get('/health', (_req, res) => {
  res.type('text/plain').send('API is running');
});

module.exports = { healthRouter: router };
