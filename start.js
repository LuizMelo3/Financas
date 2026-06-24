const { execSync } = require('child_process');
const { existsSync } = require('fs');
const path = require('path');

const root = __dirname;
const serverDir = path.join(root, 'server');
const clientDir = path.join(root, 'client');

if (!existsSync(path.join(serverDir, 'node_modules'))) {
  console.log('\n📦 Instalando dependências do servidor...');
  execSync('npm install', { cwd: serverDir, stdio: 'inherit' });
}

const isProduction = process.env.NODE_ENV === 'production';
const distExists   = existsSync(path.join(clientDir, 'dist'));

if (isProduction || !distExists) {
  if (!existsSync(path.join(clientDir, 'node_modules'))) {
    console.log('\n📦 Instalando dependências do cliente...');
    execSync('npm install', { cwd: clientDir, stdio: 'inherit' });
  }
  console.log('\n🔨 Construindo frontend...');
  execSync('npm run build', { cwd: clientDir, stdio: 'inherit' });
}

console.log('\n✅ Iniciando FinanceiroApp em http://localhost:3000\n');
require('./server/index.js');
