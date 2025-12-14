import fs from 'fs';
import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

// Configuração para ler diretórios em ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const packageJsonPath = path.join(__dirname, 'package.json');
const versionFilePath = path.join(__dirname, 'src', 'version.ts');

// 1. Ler o package.json atual
const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
const currentVersion = packageJson.version;

// 2. Incrementar a versão (Lógica: Patch 0.0.X)
let versionParts = currentVersion.split('.').map(Number);
versionParts[2] += 1; // Incrementa o último número
const newVersion = versionParts.join('.');

// 3. Atualizar o package.json
packageJson.version = newVersion;
fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));

// 4. Criar/Atualizar o arquivo src/version.js para o App ler
const versionFileContent = `export const appVersion = "${newVersion}";\n`;
fs.writeFileSync(versionFilePath, versionFileContent);

console.log(`✅ Versão atualizada: ${currentVersion} -> ${newVersion}`);

// 5. Executar comandos GIT
try {
    console.log('📦 Adicionando arquivos ao Git...');
    execSync('git add .');

    console.log('🔖 Criando commit...');
    execSync(`git commit -m "versão ${newVersion}"`);

    console.log('🚀 Enviando para o repositório (Push)...');
    execSync('git push');

    console.log('🎉 Deploy realizado com sucesso!');
} catch (error) {
    console.error('❌ Erro ao executar comandos do Git:', error.message);
}