/**
 * A workflow may invoke a capability skill it declares in its own `uses.skills`
 * without the coworker type re-declaring it; the mirror ships that skill, so the
 * composer's slash-reference rewrite must know the name too and leave the
 * `/skill` literal without warning.
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

function write(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, contents);
}

describe('slash refs to workflow-declared skills', () => {
  it('a /skill named only in the workflow uses.skills is a known slash command', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-uses-'));
    tempDirs.push(root);
    write(path.join(root, 'spine/identity.md'), 'You are a tester.');
    const skill = (dir: string, fm: string, body: string): void =>
      write(path.join(root, 'container/skills', dir, 'SKILL.md'), `---\n${fm}\n---\n\n${body}\n`);
    skill('base-nanoclaw', 'name: base-nanoclaw\ndescription: Host tools.', '');
    skill('explainer', 'name: explainer\ndescription: Explain a PR.', 'Explain.');
    skill(
      'ship',
      "name: ship\ntype: workflow\ndescription: 'Ship a change.'\nuses:\n  skills: [explainer]\n  workflows: []",
      '## Steps\n\n1. **Ship** {#ship} — push, then run `/explainer` for the PR.\n',
    );
    write(
      path.join(root, 'container/skills/spine/coworker-types.yaml'),
      'base-common:\n  description: "base"\n  identity: spine/identity.md\n  skills:\n    - base-nanoclaw\nshipper:\n  extends: base-common\n  description: "shipper"\n  workflows:\n    - ship\n',
    );
    const warnings: string[] = [];
    const orig = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.join(' '));
    };
    let doc = '';
    try {
      doc = composeCoworkerSpine({ projectRoot: root, coworkerType: 'shipper' });
    } finally {
      console.warn = orig;
    }
    expect(warnings.filter((w) => w.includes('Unknown slash ref'))).toEqual([]);
    expect(doc).toContain('`/explainer`');
  });
});
