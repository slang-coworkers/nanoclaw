/**
 * `container/CLAUDE.md` tells every agent, unconditionally, that its memory
 * index and system definition arrive in the session-start context. That was
 * only true under Claude: the section is delivered by a Claude Code SessionStart
 * hook, and `registerMemorySessionHook` was a silent no-op in `codex.ts`,
 * `opencode.ts` and `pi.ts` — three of the four registered providers.
 *
 * Same shape of bug as the `conversations/` one fixed in #1326, and the same
 * shape of fix: deliver at a provider-independent point instead of behind a
 * per-provider hook. Here the provider reports whether it wired the hook, and
 * the runner falls back to the system prompt when it did not.
 */
import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { appendMemorySection, memoryContextForSystemPrompt, renderMemorySection } from './context.js';
import { MEMORY_SESSION_HOOK } from './session-hook.js';
import { ensureMemoryScaffold } from './scaffold.js';
import { CodexProvider } from '../providers/codex.js';
import { PiProvider } from '../providers/pi.js';

let tmp: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mem-neutral-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('every provider without a session-start hook says so', () => {
  // The boolean is what makes the fallback reachable. A provider that adds a
  // hook returns true here and stops paying for the system-prompt copy.
  it.each([
    ['codex', () => new CodexProvider()],
    ['pi', () => new PiProvider()],
  ])('%s returns false from registerMemorySessionHook', (_name, make) => {
    expect(make().registerMemorySessionHook(MEMORY_SESSION_HOOK)).toBe(false);
  });

  // opencode is not constructed here: importing it pulls `@opencode-ai/sdk`,
  // which only exists once /add-opencode has run, so the whole file would error
  // out on a trunk checkout. Assert on its source instead.
  it('opencode returns false', () => {
    const source = fs.readFileSync(path.join(import.meta.dir, '..', 'providers', 'opencode.ts'), 'utf-8');
    expect(source).toMatch(/registerMemorySessionHook\([^)]*\): boolean \{\s*return false;/);
  });
});

describe('memoryContextForSystemPrompt', () => {
  it('carries both always-loaded files once the tree is scaffolded', () => {
    ensureMemoryScaffold(tmp);
    fs.writeFileSync(path.join(tmp, 'memory', 'index.md'), '# Memory Index\n\nCore fact: the sky is blue.\n');

    const section = memoryContextForSystemPrompt(tmp);

    expect(section).toContain('## Memory');
    expect(section).toContain('Core fact: the sky is blue.');
    expect(section).toContain('Open Knowledge Format');
  });

  // A heading promising two files that do not exist is worse than no heading.
  it('returns undefined when no memory tree exists', () => {
    expect(memoryContextForSystemPrompt(tmp)).toBeUndefined();
  });

  // The hook re-reads the files for every new context window; the system prompt
  // is pinned at the query that opened the turn. Telling the agent "loaded at
  // startup, after clear, and after compaction" through the system prompt would
  // be a promise the delivery cannot keep.
  it('describes when its copy was taken, not the hook refresh schedule', () => {
    ensureMemoryScaffold(tmp);

    // Assert on the delivery line only — the definition body quoted underneath
    // it describes the refresh schedule too, and that text belongs to the
    // template, not to this section.
    const deliveryLine = (section: string) => section.split('\n')[2];

    expect(deliveryLine(memoryContextForSystemPrompt(tmp)!)).toBe(
      'These files are copied below as of the start of this turn:',
    );
    expect(deliveryLine(renderMemorySection(tmp))).toBe(
      'These files are loaded at startup, after clear, and after compaction:',
    );
  });
});

describe('appendMemorySection', () => {
  it('appends the section to the addendum', () => {
    expect(appendMemorySection('## Sending messages', '## Memory')).toBe('## Sending messages\n\n## Memory');
  });

  it('leaves the addendum untouched when there is no section (the Claude path)', () => {
    expect(appendMemorySection('## Sending messages', undefined)).toBe('## Sending messages');
  });
});

describe('runner wiring', () => {
  const runnerSource = fs.readFileSync(path.join(import.meta.dir, '..', 'index.ts'), 'utf-8');
  const pollLoopSource = fs.readFileSync(path.join(import.meta.dir, '..', 'poll-loop.ts'), 'utf-8');

  // The fallback reads the tree, so the scaffold has to exist by then.
  it('scaffolds memory before it builds the addendum', () => {
    expect(runnerSource.indexOf('ensureMemoryScaffold()')).toBeLessThan(
      runnerSource.indexOf('buildSystemPromptAddendum('),
    );
  });

  it('derives the fallback from the hook registration result', () => {
    expect(runnerSource).toMatch(
      /provider\.registerMemorySessionHook\(MEMORY_SESSION_HOOK\)\s*\?\s*undefined\s*:\s*memoryContextForSystemPrompt\(/,
    );
  });

  // A destinations change rebuilds `instructions` from scratch mid-session;
  // without the re-append, memory would silently vanish from that point on.
  it('re-appends memory when the destinations refresher rebuilds instructions', () => {
    expect(pollLoopSource).toMatch(
      /appendMemorySection\(buildSystemPromptAddendum\(\), systemContext\.memorySection\)/,
    );
  });
});
