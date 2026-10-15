/**
 * The "How to Work" footer tells a role how to begin. "Always start with a
 * workflow" presumes a workflow for the role's job; a role whose only workflows
 * are the baseline planning one (or its children) and whose procedure lives in
 * its standing orders is sent to those orders instead. Every other shape keeps
 * the original footer.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';

const tempDirs: string[] = [];
afterEach(() => {
  for (const dir of tempDirs.splice(0)) fs.rmSync(dir, { recursive: true, force: true });
});

function writeFile(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

/** A project with the baseline `plan` workflow, a `plan`-extending `sweep`, a
 *  standalone read-only `review`, a code-editing `implement`, and leaf types
 *  over them. */
function makeProject(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-footer-'));
  tempDirs.push(root);
  writeFile(path.join(root, 'spine/identity.md'), 'You are a tester.');
  const skill = (dir: string, fm: string, body: string): void =>
    writeFile(path.join(root, 'container/skills', dir, 'SKILL.md'), `---\n${fm}\n---\n\n${body}\n`);
  skill('base-nanoclaw', 'name: base-nanoclaw\ndescription: Host tools.\nprovides: [code.read, code.edit]', '');
  skill(
    'plan',
    "name: plan\ntype: workflow\ndescription: 'Plan or investigate.'\nrequires: [code.read]\nuses:\n  skills: []\n  workflows: []",
    '## Steps\n\n1. **Read** {#read} — read.\n',
  );
  skill(
    'sweep',
    "name: sweep\ntype: workflow\nextends: plan\ndescription: 'Sweep the queue.'\nuses:\n  skills: []\n  workflows: []",
    '## Steps\n\n1. **Scan** {#scan} — scan.\n',
  );
  skill(
    'review',
    "name: review\ntype: workflow\ndescription: 'Review a change.'\nrequires: [code.read]\nuses:\n  skills: []\n  workflows: []",
    '## Steps\n\n1. **Judge** {#judge} — judge.\n',
  );
  skill(
    'implement',
    "name: implement\ntype: workflow\ndescription: 'Make the change.'\nrequires: [code.read, code.edit]\nuses:\n  skills: []\n  workflows: []",
    '## Steps\n\n1. **Change** {#change} — change.\n',
  );
  writeFile(
    path.join(root, 'container/skills/spine/coworker-types.yaml'),
    [
      'base-common:',
      '  description: "base"',
      '  identity: spine/identity.md',
      '  skills:',
      '    - base-nanoclaw',
      'reader:',
      '  extends: base-common',
      '  description: "reader"',
      '  workflows:',
      '    - sweep',
      'reviewer:',
      '  extends: base-common',
      '  description: "reviewer"',
      '  workflows:',
      '    - plan',
      '    - review',
      'writer:',
      '  extends: base-common',
      '  description: "writer"',
      '  workflows:',
      '    - plan',
      '    - implement',
      '',
    ].join('\n'),
  );
  return root;
}

const ORIGINAL = 'Always start with a workflow. Never jump straight to code.';
const ORDERS = 'Your procedure is your standing orders in [Additional Instructions](#additional-instructions)';
const ORDERS_LINK = 'Your role-specific standing orders: [Additional Instructions](#additional-instructions)';

describe('How to Work footer', () => {
  it('a plan-only role with standing orders is pointed at them', () => {
    const doc = composeCoworkerSpine({
      projectRoot: makeProject(),
      coworkerType: 'reader',
      extraInstructions: '## Role\nSweep.',
    });
    expect(doc).toContain(ORDERS);
    expect(doc).not.toContain(ORIGINAL);
    expect(doc).toContain('Workflow bodies are embedded below');
  });

  it('a plan-only role without standing orders keeps the original footer', () => {
    const doc = composeCoworkerSpine({ projectRoot: makeProject(), coworkerType: 'reader' });
    expect(doc).toContain(ORIGINAL);
    expect(doc).not.toContain(ORDERS);
    expect(doc).not.toContain(ORDERS_LINK);
  });

  it('a role with a job-specific read-only workflow keeps the original footer and the orders link', () => {
    const doc = composeCoworkerSpine({
      projectRoot: makeProject(),
      coworkerType: 'reviewer',
      extraInstructions: '## Role\nReview.',
    });
    expect(doc).toContain(ORIGINAL);
    expect(doc).toContain(ORDERS_LINK);
    expect(doc).not.toContain(ORDERS);
  });

  it('a role with a code-editing workflow keeps the original footer and the orders link', () => {
    const doc = composeCoworkerSpine({
      projectRoot: makeProject(),
      coworkerType: 'writer',
      extraInstructions: '## Role\nShip.',
    });
    expect(doc).toContain(ORIGINAL);
    expect(doc).toContain(ORDERS_LINK);
    expect(doc).not.toContain(ORDERS);
  });
});
