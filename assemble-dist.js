import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('[assemble-dist] Assembling mobile and web artifacts into dist...');

const rootDir = __dirname;
const distDir = path.join(rootDir, 'dist');
const mobileDistDir = path.join(rootDir, 'mobile', 'dist');

if (!fs.existsSync(distDir)) {
    fs.mkdirSync(distDir, { recursive: true });
}

if (!fs.existsSync(mobileDistDir)) {
    console.error('[assemble-dist] ERROR: mobile/dist does not exist! Please run "npm run build:mobile" first.');
    process.exit(1);
}

// 1. Copy mobile/dist to dist/mobile
const targetMobileDir = path.join(distDir, 'mobile');
fs.mkdirSync(targetMobileDir, { recursive: true });
fs.cpSync(mobileDistDir, targetMobileDir, { recursive: true });
console.log('✓ Copied mobile/dist -> dist/mobile');

// 2. Copy mobile/dist/_expo to dist/_expo
const mobileExpoDir = path.join(mobileDistDir, '_expo');
if (fs.existsSync(mobileExpoDir)) {
    const targetExpoDir = path.join(distDir, '_expo');
    fs.mkdirSync(targetExpoDir, { recursive: true });
    fs.cpSync(mobileExpoDir, targetExpoDir, { recursive: true });
    console.log('✓ Copied mobile/dist/_expo -> dist/_expo');
}

// 3. Copy mobile/dist/assets to dist/assets (merging with web assets)
const mobileAssetsDir = path.join(mobileDistDir, 'assets');
if (fs.existsSync(mobileAssetsDir)) {
    const targetAssetsDir = path.join(distDir, 'assets');
    fs.mkdirSync(targetAssetsDir, { recursive: true });
    fs.cpSync(mobileAssetsDir, targetAssetsDir, { recursive: true });
    console.log('✓ Copied mobile/dist/assets -> dist/assets');
}

console.log('[assemble-dist] All distribution files assembled cleanly in dist/. Ready for Vercel deployment!');
