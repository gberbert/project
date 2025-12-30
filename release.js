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

// 4.1. Inicializar Git em go2rtc_bin (se existir)
const go2rtcPath = path.join(__dirname, 'go2rtc_bin');
if (fs.existsSync(go2rtcPath)) {
    const gitFolderPath = path.join(go2rtcPath, '.git');
    if (!fs.existsSync(gitFolderPath)) {
        console.log('🔧 Inicializando repositório Git em go2rtc_bin...');
        try {
            execSync('git init', { cwd: go2rtcPath, stdio: 'inherit' });
            console.log('✅ Repositório Git inicializado em go2rtc_bin.');
        } catch (err) {
            console.error('❌ Erro ao inicializar Git em go2rtc_bin:', err.message);
        }
    } else {
        console.log('ℹ️ go2rtc_bin já é um repositório Git.');
    }

    // Garantir que exista pelo menos um commit no submodule para evitar erro no repo pai
    try {
        const readmePath = path.join(go2rtcPath, 'README.md');
        if (!fs.existsSync(readmePath)) {
            fs.writeFileSync(readmePath, '# go2rtc_bin\nAutomated repo\n');
        }
        // Tenta adicionar e commitar (ignora erro se nada para commitar)
        try {
            execSync('git add .', { cwd: go2rtcPath, stdio: 'ignore' });
            execSync('git commit -m "Auto-commit"', { cwd: go2rtcPath, stdio: 'ignore' });
            console.log('✅ Commit automático realizado em go2rtc_bin.');
        } catch (e) {
            // Provavelmente nada para commitar, segue o jogo
        }
    } catch (err) {
        console.warn('⚠️ Aviso ao tentar commitar em go2rtc_bin:', err.message);
    }

} else {
    console.warn('⚠️ Diretório go2rtc_bin não encontrado. Pulando git init.');
}

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