/**
 * GAP-1: the spine composer never read `container/CLAUDE.md`. `runtime-contract.ts`
 * renders it; these tests pin that it actually REACHES the composed document, on
 * both render paths.
 *
 * Both paths matter and they are not symmetric. `main` is `flat: true` and returns
 * early from `renderCoworkerSpine`, which is exactly how the first attempt at the
 * `COMPOSED_HEADER` seam missed the admin orchestrator. Flat mode also carries the
 * document's `# Title` inside its identity body, so a section prepended there
 * lands above the H1 — a real bug this suite caught during implementation.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';
import { EMITTED_CONTRACT_SECTIONS, RUNTIME_CONTRACT_SECTION } from './runtime-contract.js';

const ROOT = process.cwd();
const tempDirs: string[] = [];

afterEach(() => {
  while (tempDirs.length) fs.rmSync(tempDirs.pop()!, { recursive: true, force: true });
});

// Both real coworker types in the install: `main` (flat) and `default` (inherited).
const TYPES = ['main', 'default'] as const;

describe.each(TYPES)('coworker type: %s', (coworkerType) => {
  const out = (): string => composeCoworkerSpine({ coworkerType, projectRoot: ROOT });

  it('carries the runtime contract section', () => {
    expect(out()).toContain(`## ${RUNTIME_CONTRACT_SECTION}`);
  });

  it('carries every kept section', () => {
    const doc = out();

    for (const heading of EMITTED_CONTRACT_SECTIONS) expect(doc).toContain(`### ${heading}`);
  });

  // The three statements that reached NO agent before this layer existed. Asserted
  // as content, not headings: a heading with an empty body would pass the checks
  // above while still telling the agent nothing.
  it('states where inbound attachments land', () => {
    expect(out()).toContain('/workspace/inbox/<message-id>/<filename>');
  });

  it('states the standing-instructions vs durable-facts split', () => {
    const doc = out();

    expect(doc).toContain('instructions.prepend.md');
    expect(doc).toContain('durable facts belong in memory');
  });

  it('states that conversations/ holds past transcripts', () => {
    expect(out()).toContain('`conversations/` folder');
  });

  // Emitting the file whole would duplicate: the runtime system prompt already
  // states name and destinations, and the spine's own fragments cover the rest
  // more thoroughly.
  it('does not duplicate the dropped sections', () => {
    const doc = out();

    expect(doc).not.toContain('You are a NanoClaw agent. Your name, destinations');
    expect(doc).not.toContain('Files you create are saved in `/workspace/agent/`');
  });

  // Every heading in a composed document must nest under the one above it. The
  // `#`-count-only check is deliberate: it catches both an `##` leaking out of the
  // contract block and a section landing above the document title.
  it('keeps heading levels well-formed', () => {
    const headings = out()
      .split('\n')
      .filter((l) => /^#{1,6} /.test(l))
      .map((l) => l.match(/^(#+)/)![1].length);

    expect(headings[0]).toBe(1);
    for (let i = 1; i < headings.length; i++) {
      expect(headings[i]).toBeLessThanOrEqual(headings[i - 1] + 1);
    }
  });
});

describe('typed mode placement', () => {
  // Before Identity: the contract states environment facts true for every
  // coworker, so they precede this type's own material. Matches §4.3 and
  // upstream's composer, which emits the base document before capabilities.
  it('precedes Identity', () => {
    const doc = composeCoworkerSpine({ coworkerType: 'default', projectRoot: ROOT });

    expect(doc.indexOf(`## ${RUNTIME_CONTRACT_SECTION}`)).toBeLessThan(doc.indexOf('## Identity'));
  });

  it('follows the document title', () => {
    const doc = composeCoworkerSpine({ coworkerType: 'default', projectRoot: ROOT });

    expect(doc.indexOf('\n# ')).toBeLessThan(doc.indexOf(`## ${RUNTIME_CONTRACT_SECTION}`));
  });
});

describe('flat mode placement', () => {
  // `main`'s identity body opens with `# Main`. Prepending an `##` section there
  // emitted a subsection above the H1 — caught by the well-formedness check.
  it('follows the title that lives inside the identity body', () => {
    const doc = composeCoworkerSpine({ coworkerType: 'main', projectRoot: ROOT });

    expect(doc.indexOf('# Main')).toBeLessThan(doc.indexOf(`## ${RUNTIME_CONTRACT_SECTION}`));
  });

  it('emits it exactly once', () => {
    const doc = composeCoworkerSpine({ coworkerType: 'main', projectRoot: ROOT });

    expect(doc.split(`## ${RUNTIME_CONTRACT_SECTION}`)).toHaveLength(2);
  });
});

describe('a project without the contract document', () => {
  // Composition must not depend on the file existing: a partial payload install
  // has no base document yet, and every existing composer test builds a temp
  // project that lacks one.
  it('still composes', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-nocontract-'));
    tempDirs.push(dir);
    fs.mkdirSync(path.join(dir, 'container/skills/solo'), { recursive: true });
    fs.mkdirSync(path.join(dir, 'container/spines/base'), { recursive: true });
    fs.writeFileSync(path.join(dir, 'container/spines/base/identity.md'), '# Solo\n\nYou are a coworker.\n');
    fs.writeFileSync(
      path.join(dir, 'container/skills/solo/coworker-types.yaml'),
      'solo:\n  description: "Solo"\n  identity: container/spines/base/identity.md\n',
    );

    const doc = composeCoworkerSpine({ coworkerType: 'solo', projectRoot: dir });

    expect(doc).toContain('You are a coworker.');
    expect(doc).not.toContain(RUNTIME_CONTRACT_SECTION);
  });
});
