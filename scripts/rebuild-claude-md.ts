import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { composeCoworkerSpine } from '../src/claude-composer.js';
import { writeComposedDocument } from '../src/group-persona.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

const checkMode = process.argv.includes('--check');

// Only groups/main/CLAUDE.md is rebuilt here. The retired 'global' flat
// type is gone; typed coworkers' CLAUDE.md is composed at container spawn
// time, not tracked on disk.
const targets: { rel: string; coworkerType: string }[] = [
  { rel: 'groups/main/CLAUDE.md', coworkerType: 'main' },
];

let drift = 0;
for (const { rel, coworkerType } of targets) {
  const composed = composeCoworkerSpine({ projectRoot, coworkerType });
  const filePath = path.join(projectRoot, rel);
  if (checkMode) {
    const onDisk = fs.existsSync(filePath) ? fs.readFileSync(filePath, 'utf-8') : '';
    if (onDisk !== composed) {
      drift++;
      console.error(`drift ${rel}: on-disk differs from composed output`);
    } else {
      console.log(`ok    ${rel}`);
    }
  } else {
    // groups/* is gitignored, so groups/main/ doesn't exist on a fresh clone —
    // and rebuild:claude can run before setup scaffolds it (e.g. the setup
    // project-integrations step runs merge-train, whose tail calls this). Create
    // the target dir so the write can't ENOENT.
    fs.mkdirSync(path.dirname(filePath), { recursive: true });
    writeComposedDocument(filePath, composed);
    console.log(`updated ${rel}`);
  }
}

if (checkMode && drift > 0) {
  console.error(`\n${drift} file(s) drifted. Run 'npm run rebuild:claude' to refresh.`);
  process.exit(1);
}
