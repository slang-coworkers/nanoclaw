// Author-time guardrail: walks every registered coworker type through the
// composer, so missing spine fragments, unknown workflow/skill refs,
// unresolved traits, and cross-project extends errors surface before CI
// instead of at container-start time.
//
// Exit code 0 = all types compose cleanly, 1 = one or more failed.

import path from 'path';
import { fileURLToPath } from 'url';

import {
  composeCoworkerSpine,
  readCoworkerTypes,
  readSkillCatalog,
  type CoworkerTypeEntry,
} from '../src/claude-composer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

interface Failure {
  typeName: string;
  message: string;
}

// Types that are `extends:`'d by other types are treated as abstract bases —
// they define shared structure (e.g. base-common) but aren't composed on
// their own. Composing them directly would fail on unresolved traits the
// parent intentionally leaves for subtypes to bind.
function findAbstractBases(types: Record<string, CoworkerTypeEntry>): Set<string> {
  const bases = new Set<string>();
  for (const entry of Object.values(types)) {
    const parents = entry.extends
      ? Array.isArray(entry.extends)
        ? entry.extends
        : [entry.extends]
      : [];
    for (const parent of parents) bases.add(parent);
  }
  return bases;
}

function main(): number {
  let types: Record<string, CoworkerTypeEntry>;
  let catalog: ReturnType<typeof readSkillCatalog>;
  try {
    types = readCoworkerTypes(projectRoot);
  } catch (err) {
    console.error(`Failed to read coworker-types.yaml registry: ${(err as Error).message}`);
    return 1;
  }
  try {
    catalog = readSkillCatalog(projectRoot);
  } catch (err) {
    console.error(`Failed to read skill catalog: ${(err as Error).message}`);
    return 1;
  }

  const typeNames = Object.keys(types).sort();
  if (typeNames.length === 0) {
    console.error('No coworker types found under container/{spines,skills}/*/coworker-types.yaml');
    return 1;
  }

  const abstractBases = findAbstractBases(types);
  const failures: Failure[] = [];
  for (const name of typeNames) {
    if (abstractBases.has(name)) continue;
    try {
      composeCoworkerSpine({ projectRoot, coworkerType: name });
    } catch (err) {
      failures.push({ typeName: name, message: (err as Error).message });
    }
  }

  // Workflow body assertion: catches the silent-empty-body failure mode where
  // a WORKFLOW.md uses an unrecognized step format (e.g. `## Step N: TITLE`
  // instead of `N. **Title** {#id}`). The composer's step parser regex in
  // src/claude-composer/registry.ts only matches numbered-list items, so any
  // other format produces steps=[], stepBodies={}, and the rendered CLAUDE.md
  // emits the description with no body. Workflows that declare `extends:`
  // legitimately inherit step structure from a parent and may have an empty
  // own-body — those are exempt.
  for (const meta of Object.values(catalog)) {
    if (meta.type !== 'workflow') continue;
    if (meta.extendsWorkflow) continue;
    if (meta.steps.length > 0) continue;
    failures.push({
      typeName: meta.name,
      message:
        `WORKFLOW.md at ${meta.path} parsed to zero steps. The composer's step parser ` +
        `(src/claude-composer/registry.ts) only matches numbered-list items shaped ` +
        `\`N. **Title** {#id}\` — see container/workflows/plan/WORKFLOW.md for the ` +
        `canonical example. ` +
        `If you used \`## Step N: TITLE\` H2 headers or \`#### N. Title\` H4 headers, ` +
        `rewrite as numbered-list items at column 0. ` +
        `If this workflow inherits its steps from a parent, declare \`extends: <parent>\` ` +
        `in frontmatter to opt out of this check.`,
    });
  }

  const skillCount = Object.keys(catalog).length;
  const leafCount = typeNames.length - abstractBases.size;
  console.log(
    `Validated ${leafCount} coworker type(s) against ${skillCount} catalog entries ` +
      `(${abstractBases.size} abstract base(s) skipped).`,
  );
  for (const name of typeNames) {
    if (abstractBases.has(name)) {
      console.log(`  skip  ${name}  (abstract base)`);
      continue;
    }
    const ok = !failures.find((f) => f.typeName === name);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  }

  if (failures.length === 0) return 0;

  console.error(`\n${failures.length} coworker type(s) failed to compose:\n`);
  for (const { typeName, message } of failures) {
    console.error(`- ${typeName}`);
    console.error(`    ${message}\n`);
  }
  return 1;
}

process.exit(main());
