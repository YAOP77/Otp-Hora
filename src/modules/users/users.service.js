const { randomUUID } = require('crypto');
const usersRepository = require('./users.repository');

async function createUser(payload) {
  const name = typeof payload?.name === 'string' ? payload.name.trim() : '';

  if (!name) {
    const error = new Error('Le champ name est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  return usersRepository.createUser({
    user_id: randomUUID(),
    name,
    status: 'active',
  });
}

module.exports = {
  createUser,
};
