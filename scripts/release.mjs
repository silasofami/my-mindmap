import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const isWindows = process.platform === 'win32';

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: root,
    stdio: 'inherit',
    shell: options.shell ?? false
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.status}.`);
  }
}

function readBuiltVersions() {
  const distIndexPath = path.join(root, 'dist', 'index.html');
  const distSwPath = path.join(root, 'dist', 'sw.js');
  if (!fs.existsSync(distIndexPath) || !fs.existsSync(distSwPath)) {
    throw new Error('Build output is missing dist/index.html or dist/sw.js.');
  }

  const html = fs.readFileSync(distIndexPath, 'utf8');
  const sw = fs.readFileSync(distSwPath, 'utf8');
  const htmlVersion = html.match(/window\.BASE_APP_VERSION\s*=\s*"([^"]+)"\s*;/)?.[1];
  const swVersion = sw.match(/const APP_VERSION\s*=\s*"([^"]+)"\s*;/)?.[1];
  const cacheName = sw.match(/const CACHE_NAME\s*=\s*"([^"]+)"\s*;/)?.[1];

  if (!htmlVersion || !swVersion || !cacheName) {
    throw new Error('Could not read version fields from dist/index.html and dist/sw.js.');
  }
  if (htmlVersion !== swVersion) {
    throw new Error(`Version mismatch: index.html=${htmlVersion}, sw.js=${swVersion}.`);
  }
  if (cacheName !== `shinian-app-shell-${swVersion}`) {
    throw new Error(`Cache version mismatch: CACHE_NAME=${cacheName}, expected shinian-app-shell-${swVersion}.`);
  }
  if (!/^\d+\.\d+\.\d+\+\d+$/.test(swVersion)) {
    throw new Error(`Unexpected release version format: ${swVersion}.`);
  }

  return { version: swVersion, cacheName };
}

try {
  console.log('1/5 Building static app...');
  run(isWindows ? 'npm.cmd' : 'npm', ['run', 'build'], { shell: isWindows });

  console.log('2/5 Validating built versions...');
  const { version, cacheName } = readBuiltVersions();
  console.log(`Release version: ${version}`);
  console.log(`Service Worker cache: ${cacheName}`);

  console.log('3/5 Staging changes...');
  run('git', ['add', '.']);

  console.log('4/5 Creating release commit...');
  run('git', ['commit', '-m', `release: 自动发布版本 ${version}`]);

  console.log('5/5 Pushing to origin/main...');
  run('git', ['push', 'origin', 'main']);

  console.log('代码已推送，等待 Vercel 自动部署。');
} catch (error) {
  console.error(`Release failed: ${error.message}`);
  process.exitCode = 1;
}
