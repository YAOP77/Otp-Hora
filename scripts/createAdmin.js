require('dotenv').config();
const { prisma } = require('../src/config/prisma');
const bcrypt = require('bcrypt');
const crypto = require('crypto');

async function main() {
  const email = 'admin@otphora.com';
  const plainPassword = 'admin'; // Mot de passe par défaut
  
  console.log(`Création de l'administrateur avec l'email: ${email}...`);

  // Vérifier si un admin existe déjà
  const existingAdmin = await prisma.users.findUnique({
    where: { email }
  });

  if (existingAdmin) {
    console.log('Un administrateur avec cet email existe déjà !');
    return;
  }

  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash(plainPassword, salt);
  
  // pin_hash est obligatoire dans le schéma, on génère un pin aléatoire factice
  const dummyPin = '000000';
  const pinHash = await bcrypt.hash(dummyPin, salt);
  
  // user_key est obligatoire et unique
  const userKey = 'adm-' + crypto.randomBytes(8).toString('hex');

  const admin = await prisma.users.create({
    data: {
      nom: 'Super',
      prenom: 'Admin',
      username: 'superadmin',
      email: email,
      password_hash: passwordHash,
      role: 'admin',
      status: 'active',
      user_key: userKey,
      pin_hash: pinHash,
    }
  });

  console.log('✅ Administrateur créé avec succès !');
  console.log('--------------------------------------------------');
  console.log(`Email : ${email}`);
  console.log(`Mot de passe : ${plainPassword}`);
  console.log('⚠️ Changez ce mot de passe dès que possible !');
  console.log('--------------------------------------------------');
}

main()
  .catch((e) => {
    console.error('❌ Erreur lors de la création :', e.message);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
