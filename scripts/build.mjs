import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dist = path.resolve(root, 'dist');
if (dist !== path.join(root, 'dist')) throw new Error('Refusing to write outside the project dist directory.');

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};
  const values = {};
  for (const line of fs.readFileSync(filePath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#')) continue;
    values[match[1]] = match[2].replace(/^(['"])(.*)\1$/, '$2');
  }
  return values;
}

const fileEnv = readEnvFile(path.join(root, '.env.production'));
const supabaseUrl = (process.env.SUPABASE_URL || process.env.SHINIAN_SUPABASE_URL || fileEnv.SUPABASE_URL || fileEnv.SHINIAN_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (process.env.SUPABASE_ANON_KEY || process.env.SHINIAN_SUPABASE_ANON_KEY || fileEnv.SUPABASE_ANON_KEY || fileEnv.SHINIAN_SUPABASE_ANON_KEY || '').trim();
const appBaseVersion = (process.env.APP_BASE_VERSION || fileEnv.APP_BASE_VERSION || '1.0.8').trim();
if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(appBaseVersion)) {
  throw new Error('APP_BASE_VERSION must be a semantic version such as 1.0.8.');
}
const appVersion = `${appBaseVersion}+${Date.now()}`;
const requireConfig = process.argv.includes('--require-config');
if (requireConfig && (!supabaseUrl || !anonKey)) {
  throw new Error('Set SUPABASE_URL and SUPABASE_ANON_KEY (or the SHINIAN_ aliases) in the environment or .env.production before deployment.');
}
if (supabaseUrl) {
  let parsedUrl;
  try { parsedUrl = new URL(supabaseUrl); } catch { throw new Error('SHINIAN_SUPABASE_URL is not a valid URL.'); }
  if (parsedUrl.protocol !== 'https:' || parsedUrl.pathname !== '/' || parsedUrl.search || parsedUrl.hash) {
    throw new Error('SHINIAN_SUPABASE_URL must be an HTTPS project origin without a path.');
  }
}
let tokenRole = '';
const tokenParts = anonKey.split('.');
if (tokenParts.length === 3) {
  try { tokenRole = JSON.parse(Buffer.from(tokenParts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')).role || ''; } catch {}
}
if (/service[_-]?role/i.test(anonKey) || /^sb_secret_/i.test(anonKey) || tokenRole === 'service_role') {
  throw new Error('Never publish a Supabase service_role/secret key. Use the public anon/publishable key.');
}

const files = [
  'index.html', 'app.js', 'style.css', 'manifest.json', 'manifest.webmanifest', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png',
  '_redirects', 'vercel.json'
];
for (const name of files) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error(`Required static file is missing: ${name}`);
}

let vercelProjectLink = null;
const vercelProjectLinkPath = path.join(dist, '.vercel', 'project.json');
try { vercelProjectLink = fs.readFileSync(vercelProjectLinkPath, 'utf8'); } catch {}
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const name of files) fs.copyFileSync(path.join(root, name), path.join(dist, name));
if (vercelProjectLink) {
  const linkDir = path.join(dist, '.vercel');
  fs.mkdirSync(linkDir, { recursive: true });
  fs.writeFileSync(path.join(linkDir, 'project.json'), vercelProjectLink, 'utf8');
}

const htmlPath = path.join(dist, 'index.html');
let html = fs.readFileSync(htmlPath, 'utf8');
if (html.includes('{{APP_VERSION}}')) {
  html = html.replaceAll('{{APP_VERSION}}', appVersion);
} else if (/window\.BASE_APP_VERSION\s*=\s*["'][^"']*["']\s*;?/.test(html)) {
  html = html.replace(/window\.BASE_APP_VERSION\s*=\s*["'][^"']*["']\s*;?/, `window.BASE_APP_VERSION = ${JSON.stringify(appVersion)};`);
} else {
  const charset = html.match(/<meta\s+charset=["'][^"']+["']\s*>/i);
  const declaration = `<script>window.BASE_APP_VERSION = ${JSON.stringify(appVersion)};</script>`;
  if (!charset) throw new Error('Could not inject APP_VERSION: index.html has no charset meta tag.');
  html = html.replace(charset[0], `${charset[0]}\n  ${declaration}`);
}
fs.writeFileSync(htmlPath, html, 'utf8');

const swPath = path.join(dist, 'sw.js');
let sw = fs.readFileSync(swPath, 'utf8');
if (sw.includes('{{APP_VERSION}}')) {
  sw = sw.replaceAll('{{APP_VERSION}}', appVersion);
} else if (/const\s+APP_VERSION\s*=\s*["'][^"']*["']\s*;?/.test(sw)) {
  sw = sw.replace(/const\s+APP_VERSION\s*=\s*["'][^"']*["']\s*;?/, `const APP_VERSION = ${JSON.stringify(appVersion)};`);
} else {
  sw = `const APP_VERSION = ${JSON.stringify(appVersion)};\n${sw}`;
}
if (sw.includes('{{APP_VERSION}}')) throw new Error('APP_VERSION placeholder remains in dist/sw.js.');
sw = sw.replace(/const\s+CACHE_NAME\s*=\s*["']([^"']+)["']\s*;?/, (_match, cacheName) => {
  const versionedCacheName = cacheName.includes('{{APP_VERSION}}')
    ? cacheName.replaceAll('{{APP_VERSION}}', appVersion)
    : `shinian-app-shell-${appVersion}`;
  return `const CACHE_NAME = ${JSON.stringify(versionedCacheName)};`;
});
fs.writeFileSync(swPath, sw, 'utf8');

fs.writeFileSync(path.join(dist, '_headers'), `/sw.js\n  Cache-Control: no-cache\n\n/manifest.webmanifest\n  Content-Type: application/manifest+json\n  Access-Control-Allow-Origin: *\n  Cache-Control: no-cache\n\n/manifest.json\n  Content-Type: application/manifest+json\n  Access-Control-Allow-Origin: *\n  Cache-Control: no-cache\n`, 'utf8');
fs.writeFileSync(path.join(dist, '_redirects'), `/manifest.webmanifest    /manifest.webmanifest\n/manifest.json    /manifest.json\n/sw.js    /sw.js\n/*    /index.html   200\n`, 'utf8');

const publicConfig = `// Public browser configuration. Use only the Supabase anon/publishable key.\nwindow.SHINIAN_PUBLIC_SUPABASE = ${JSON.stringify({ url: supabaseUrl, anonKey })};\n`;
fs.writeFileSync(path.join(dist, 'supabase-public-config.js'), publicConfig, 'utf8');

if (!supabaseUrl || !anonKey) console.warn('Built without public Supabase config. Login can still use browser settings; public share previews need this config.');
const builtHtml = fs.readFileSync(htmlPath, 'utf8');
const builtSw = fs.readFileSync(swPath, 'utf8');
if (!builtHtml.includes(appVersion) || !builtSw.includes(appVersion) || builtSw.includes('{{APP_VERSION}}')) {
  throw new Error('Built HTML/SW version validation failed.');
}
console.log(`Build version: ${appVersion}`);
console.log(`Supabase public config: ${supabaseUrl && anonKey ? 'injected' : 'not configured'}`);
console.log(`Generated Cloudflare files: ${path.join(dist, '_headers')}, ${path.join(dist, '_redirects')}`);
console.log(`Static app built: ${dist}`);
