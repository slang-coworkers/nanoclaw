/**
 * The Recall rule reaches every coworker type from one file.
 *
 * Typed coworkers get `context/recall.md` through base-common's extends chain;
 * `main` is `flat: true` and lists the same file in its own context. The rule has
 * its own file because `main` cannot list `workspace.md`, whose `/workspace/shared/`
 * (ro) bullet is false for main. `main-body.md` links to the section and does not
 * restate the procedure, so the full `Agent(...)` block is what every type reads.
 *
 * These assertions hold in both CI states (standalone and the composed nv-* merge),
 * because no sibling branch contributes recall text.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';

const ROOT = process.cwd();
const RECALL_FILE = path.join(ROOT, 'container', 'spines', 'base', 'context', 'recall.md');

/** The first line of the fenced `Agent(...)` block: the procedure itself. */
const AGENT_CALL = 'Agent(prompt="Check if /workspace/shared/wiki/index.md exists.';

function compose(coworkerType: string): string {
  return composeCoworkerSpine({ coworkerType, projectRoot: ROOT });
}

function count(doc: string, needle: string): number {
  return doc.split(needle).length - 1;
}

describe('Recall rule', () => {
  it('is authored once, in context/recall.md', () => {
    const fragment = fs.readFileSync(RECALL_FILE, 'utf-8');
    expect(fragment.startsWith('## Recall rule\n')).toBe(true);
    expect(count(fragment, AGENT_CALL)).toBe(1);

    const workspace = fs.readFileSync(path.join(path.dirname(RECALL_FILE), 'workspace.md'), 'utf-8');
    expect(workspace).not.toContain(AGENT_CALL);
  });

  it('renders in main as its own section, once, after the runtime contract', () => {
    const doc = compose('main');
    expect(count(doc, '\n## Recall rule\n')).toBe(1);
    expect(count(doc, AGENT_CALL)).toBe(1);
    expect(doc.indexOf('## Recall rule')).toBeGreaterThan(doc.indexOf('## NanoClaw Runtime Contract'));
  });

  // main-body.md links to the section rather than restating it, so the link has to
  // land on a heading that exists in the composed document.
  it("resolves main-body's #recall-rule link", () => {
    const doc = compose('main');
    expect(doc).toContain('[Recall rule](#recall-rule)');
    const slugs = (doc.match(/^#{1,6} .+$/gm) ?? []).map((h) =>
      h
        .replace(/^#+ /, '')
        .toLowerCase()
        .replace(/[^a-z0-9 -]/g, '')
        .trim()
        .replace(/ /g, '-'),
    );
    expect(slugs).toContain('recall-rule');
  });

  it('renders in typed coworkers under Context, right after Workspace', () => {
    const doc = compose('default');
    expect(count(doc, '\n### Recall rule\n')).toBe(1);
    expect(count(doc, AGENT_CALL)).toBe(1);
    const context = doc.indexOf('\n## Context\n');
    const workspace = doc.indexOf('\n### Workspace\n');
    const recall = doc.indexOf('\n### Recall rule\n');
    expect(context).toBeGreaterThan(-1);
    expect(workspace).toBeGreaterThan(context);
    expect(recall).toBeGreaterThan(workspace);
    // Nothing between Workspace and the Recall rule but the Workspace body.
    expect(doc.slice(workspace + 1, recall).match(/^#{1,6} /gm)).toHaveLength(1);
  });
});
