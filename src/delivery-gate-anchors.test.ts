// The delivery-gate overlays (critique-gate, eval-sandbox, review-length) splice
// their directive before a workflow's delivery step, the step whose message their
// hooks refuse. Workflows name that step differently; each overlay lists the names
// as aliases of the canonical `report` anchor. Consider a review workflow whose last
// step is `{#return}` and sends `[Review Verdict]` to its parent: unless `return` is
// one of the aliases, the composer finds no anchor, warns on every compose, and the
// agent first reads about the gate when the hook refuses its verdict.

import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { renderCoworkerSpine } from './claude-composer/spine.js';

const REAL_ROOT = process.cwd();
const DELIVERY_GATE_OVERLAYS = ['critique-gate', 'eval-sandbox', 'review-length'];

let tmpRoot: string;

// A registry with one coworker whose only workflow ends in a `return` step, plus the
// shipped overlay files.
function scaffold(root: string): void {
  fs.mkdirSync(path.join(root, 'container', 'workflows', 'base'), { recursive: true });
  fs.copyFileSync(
    path.join(REAL_ROOT, 'container', 'workflows', 'base', 'WORKFLOW.md'),
    path.join(root, 'container', 'workflows', 'base', 'WORKFLOW.md'),
  );
  fs.mkdirSync(path.join(root, 'container', 'workflows', 'review-flow'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'container', 'workflows', 'review-flow', 'WORKFLOW.md'),
    [
      '---',
      'name: review-flow',
      'type: workflow',
      'description: "Scrape a review and return the verdict."',
      'requires: []',
      'uses:',
      '  skills: []',
      '  workflows: []',
      '---',
      '',
      '# Review flow',
      '',
      '## Steps',
      '',
      '1. **Scrape** {#scrape} — collect the findings.',
      '',
      '2. **Return findings** {#return} — send `[Review Verdict]` to the parent.',
      '',
    ].join('\n'),
  );
  for (const name of DELIVERY_GATE_OVERLAYS) {
    const src = path.join(REAL_ROOT, 'container', 'overlays', name);
    const dst = path.join(root, 'container', 'overlays', name);
    fs.mkdirSync(dst, { recursive: true });
    for (const f of fs.readdirSync(src)) fs.copyFileSync(path.join(src, f), path.join(dst, f));
  }
  fs.mkdirSync(path.join(root, 'container', 'spines', 'tests'), { recursive: true });
  fs.writeFileSync(path.join(root, 'container', 'spines', 'tests', 'identity.md'), 'You are a test coworker.\n');
  fs.writeFileSync(
    path.join(root, 'container', 'spines', 'tests', 'coworker-types.yaml'),
    'test-coworker:\n  title: Test\n  description: "Test coworker"\n  workflows: [review-flow]\n  identity: container/spines/tests/identity.md\n',
  );
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-gate-anchors-'));
  scaffold(tmpRoot);
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe('delivery-gate overlays anchor on a `return` delivery step', () => {
  for (const name of DELIVERY_GATE_OVERLAYS) {
    it(`${name} renders before step \`return\` without an anchor warning`, () => {
      const warnings: string[] = [];
      const original = console.warn;
      console.warn = (...args: unknown[]) => void warnings.push(args.map(String).join(' '));
      try {
        const text = renderCoworkerSpine(tmpRoot, 'test-coworker', null, { overlays: [name] });
        expect(text).toMatch(/\(before `return`\)/);
      } finally {
        console.warn = original;
      }
      expect(warnings.filter((w) => w.includes('No inline gate markers will render'))).toEqual([]);
    });
  }
});
