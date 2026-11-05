// Runs before `npm run dev`: checks Node.js and installs anything missing.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const [major, minor] = process.versions.node.split('.').map(Number);
const ok = (major === 20 && minor >= 19) || (major === 22 && minor >= 12) || major > 22;
if (!ok) {
  console.error(`\n✖ Mindora needs Node.js 20.19+ or 22.12+. You have ${process.versions.node}.`);
  console.error('  Install the LTS version from https://nodejs.org, close VS Code, reopen it and run `npm run dev` again.\n');
  process.exit(1);
}
for (const dir of ['.', 'server', 'client']) {
  if (!existsSync(path.join(root, dir, 'node_modules'))) {
    console.log(`→ Installing packages in ${dir === '.' ? 'the project root' : dir}/ (first run only)…`);
    execSync('npm install', { cwd: path.join(root, dir), stdio: 'inherit', shell: true });
  }
}
console.log('✔ Ready. Starting Firebase Auth emulator, API (port 4000) and website (port 5173)…\n');
