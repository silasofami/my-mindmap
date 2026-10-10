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
const supabaseUrl = (process.env.SHINIAN_SUPABASE_URL || fileEnv.SHINIAN_SUPABASE_URL || '').trim().replace(/\/+$/, '');
const anonKey = (process.env.SHINIAN_SUPABASE_ANON_KEY || fileEnv.SHINIAN_SUPABASE_ANON_KEY || '').trim();
const requireConfig = process.argv.includes('--require-config');
if (requireConfig && (!supabaseUrl || !anonKey)) {
  throw new Error('Set SHINIAN_SUPABASE_URL and SHINIAN_SUPABASE_ANON_KEY (environment or .env.production) before deployment.');
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
  'index.html', 'app.js', 'style.css', 'manifest.json', 'manifest.webmanifest', 'privacy.html', 'sw.js', 'icon.svg', 'icon-192.png', 'icon-512.png',
  '_redirects', 'vercel.json'
];
for (const name of files) {
  const source = path.join(root, name);
  if (!fs.existsSync(source)) throw new Error(`Required static file is missing: ${name}`);
}

let vercelProjectLink = null;
const vercelProjectLinkPath = path.join(dist, '.vercel', 'project.json');
try { vercelProjectLink = fs.readFileSync(vercelProjectLinkPath, 'utf8'); } catch {}
const sourceIndex = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const baseVersionMatch = sourceIndex.match(/const APP_VERSION = "(\d+\.\d+\.\d+)";/);
if (!baseVersionMatch) throw new Error('index.html must define const APP_VERSION = "x.y.z";');
const buildVersion = `${baseVersionMatch[1]}+${Date.now()}`;
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });
for (const name of files) fs.copyFileSync(path.join(root, name), path.join(dist, name));
const distIndexPath = path.join(dist, 'index.html');
const distIndex = fs.readFileSync(distIndexPath, 'utf8').replace(
  /const APP_VERSION = "\d+\.\d+\.\d+";/,
  `const APP_VERSION = ${JSON.stringify(buildVersion)};`
);
fs.writeFileSync(distIndexPath, distIndex, 'utf8');
fs.writeFileSync(path.join(dist, 'version.json'), `${JSON.stringify({ version: buildVersion }, null, 2)}\n`, 'utf8');
const distSwPath = path.join(dist, 'sw.js');
const distSw = fs.readFileSync(distSwPath, 'utf8').replace(
  /const CACHE_NAME = 'shinian-app-shell-v1';/,
  `const CACHE_NAME = ${JSON.stringify(`shinian-app-shell-${buildVersion}`)};`
);
if (distSw === fs.readFileSync(distSwPath, 'utf8')) throw new Error('sw.js cache name placeholder was not found.');
fs.writeFileSync(distSwPath, distSw, 'utf8');
if (vercelProjectLink) {
  const linkDir = path.join(dist, '.vercel');
  fs.mkdirSync(linkDir, { recursive: true });
  fs.writeFileSync(path.join(linkDir, 'project.json'), vercelProjectLink, 'utf8');
}

const publicConfig = `// Public browser configuration. Use only the Supabase anon/publishable key.\nwindow.SHINIAN_PUBLIC_SUPABASE = ${JSON.stringify({ url: supabaseUrl, anonKey })};\n`;
fs.writeFileSync(path.join(dist, 'supabase-public-config.js'), publicConfig, 'utf8');

if (!supabaseUrl || !anonKey) console.warn('Built without public Supabase config. Login can still use browser settings; public share previews need this config.');
console.log(`Static app built: ${dist}`);
