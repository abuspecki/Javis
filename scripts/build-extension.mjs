// Packs the Vite build + extension files into extension/dist (load via chrome://extensions → "Entpackte Erweiterung laden").
import { cpSync, existsSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'extension', 'dist');
if (!existsSync(path.join(root, 'dist', 'index.html'))) throw new Error('Run `vite build` first');
rmSync(out, { recursive: true, force: true });
cpSync(path.join(root, 'dist'), out, { recursive: true });
for (const f of ['manifest.json', 'background.js']) cpSync(path.join(root, 'extension', f), path.join(out, f));
console.log('✓ Extension ready at', path.relative(root, out));
