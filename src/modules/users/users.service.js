const { randomUUID } = require('crypto');
const bcrypt = require('bcrypt');
const usersRepository = require('./users.repository');

const PIN_REGEX = /^\d{4,6}$/;

function validatePin(pin) {
  if (typeof pin !== 'string' || !PIN_REGEX.test(pin.trim())) {
    const error = new Error('Le PIN doit contenir 4 à 6 chiffres');
    error.statusCode = 400;
    throw error;
  }
}

async function createUser(payload) {
  const nom = typeof payload?.nom === 'string' ? payload.nom.trim() : '';
  const prenom = typeof payload?.prenom === 'string' ? payload.prenom.trim() : '';
  const pin = typeof payload?.pin === 'string' ? payload.pin.trim() : '';

  if (!nom) {
    const error = new Error('Le champ nom est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  if (!prenom) {
    const error = new Error('Le champ prenom est obligatoire');
    error.statusCode = 400;
    throw error;
  }

  validatePin(pin);

  const pin_hash = await bcrypt.hash(pin, 12);

  return usersRepository.createUser({
    user_id: randomUUID(),
    nom,
    prenom,
    pin_hash,
    status: 'active',
  });
}

module.exports = {
  createUser,
};
