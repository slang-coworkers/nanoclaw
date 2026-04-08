// Auto-discover and import channel modules.
// Each module calls registerChannel() as a side effect.
// Skill branches just drop a file here — no barrel edit needed.
import { readdirSync } from 'fs';
import { fileURLToPath, pathToFileURL } from 'url';
import { dirname, join } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKIP = new Set(['index.js', 'registry.js']);

for (const file of readdirSync(__dirname).sort()) {
  if (file.endsWith('.js') && !file.endsWith('.test.js') && !SKIP.has(file)) {
    await import(pathToFileURL(join(__dirname, file)).href);
  }
}
