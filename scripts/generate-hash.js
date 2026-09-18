#!/usr/bin/env node

/**
 * ANTES DA ESCOLA™ - Utilitário Seguro de Geração de Hash de Senha
 *
 * USO:
 *   npm run generate-hash
 *   ou: node scripts/generate-hash.js
 *
 * Este script gera um hash bcrypt com cost 12 para ser configurado
 * com segurança na variável ADMIN_PASSWORD_HASH no seu ambiente de produção.
 */

const readline = require('readline');
const bcrypt = require('bcryptjs');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

console.log('====================================================');
console.log('  ANTES DA ESCOLA™ - Gerador Seguro de Hash Admin   ');
console.log('====================================================\n');

rl.question('Digite a senha administrativa desejada: ', (password) => {
  if (!password || password.trim().length < 6) {
    console.error('\n❌ Erro: A senha deve ter no mínimo 6 caracteres.');
    rl.close();
    process.exit(1);
  }

  const saltRounds = 12;
  const hash = bcrypt.hashSync(password.trim(), saltRounds);

  console.log('\n✅ Hash gerado com sucesso (bcrypt cost 12):\n');
  console.log('----------------------------------------------------');
  console.log(`ADMIN_PASSWORD_HASH=${hash}`);
  console.log('----------------------------------------------------');
  console.log('\nCopie a linha acima e cole no seu arquivo .env.local no servidor.');
  console.log('NUNCA compartilhe ou comite esse valor no repositório Git.\n');

  rl.close();
});
