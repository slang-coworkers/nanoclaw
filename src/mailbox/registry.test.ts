import fs from 'fs';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { getAgentMailbox, registerAgentMailbox, resetAgentMailboxForTesting } from './index.js';
import { SqliteAgentMailbox } from './sqlite/index.js';
import type { AgentMailbox } from './types.js';

const composedFactory = resetAgentMailboxForTesting();
const fakeMailbox = (): AgentMailbox => ({}) as AgentMailbox;

beforeEach(() => {
  resetAgentMailboxForTesting();
});

afterEach(() => {
  resetAgentMailboxForTesting();
  if (composedFactory) registerAgentMailbox(composedFactory);
});

describe('agent mailbox registry', () => {
  it('uses the explicitly registered OSS implementation', () => {
    registerAgentMailbox(() => new SqliteAgentMailbox());
    expect(getAgentMailbox()).toBeInstanceOf(SqliteAgentMailbox);
  });

  it('keeps the host entrypoint on the real composition barrel', () => {
    expect(fs.readFileSync(new URL('../modules/index.ts', import.meta.url), 'utf8')).toContain(
      "import '../mailbox/compose.js';",
    );
    expect(fs.readFileSync(new URL('../index.ts', import.meta.url), 'utf8')).toContain("import './modules/index.js';");
  });

  it('keeps session SQLite code inside the SQLite driver', () => {
    expect(fs.existsSync(new URL('../db/session-db.ts', import.meta.url))).toBe(false);
    expect(fs.existsSync(new URL('./sqlite/session-db.ts', import.meta.url))).toBe(true);

    for (const relative of [
      '../session-manager.ts',
      '../host-sweep.ts',
      '../modules/scheduling/task-content.ts',
      '../modules/scheduling/recurrence.ts',
      '../modules/cross-session-context/prune.ts',
    ]) {
      const source = fs.readFileSync(new URL(relative, import.meta.url), 'utf8');
      expect(source).not.toMatch(/better-sqlite3|\.prepare\s*\(\s*['"`]/);
    }
  });

  // The one-writer-per-file rule is the invariant that makes the two-DB split
  // safe: outbound.db has exactly one writer, the container. A host write is
  // only sound while the container is provably gone.
  //
  // This is an ENUMERATION, not an allowlist of known-good files. The sibling
  // containment check above names five files by hand, so it cannot see a NEW
  // one — `reconcile-gh-sessions.ts` opens the canonical outbound.db writable
  // with raw better-sqlite3 and was invisible to it. Walking the tree means a
  // future writer has to come here and say why.
  it('keeps every host outbound.db writer accounted for', () => {
    const hostRoots = ['../../src', '../../setup', '../../scripts'];
    const sqlFiles: string[] = [];
    const walk = (dir: URL): void => {
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name === 'node_modules' || entry.name.endsWith('.test.ts')) continue;
        const child = new URL(`${entry.name}${entry.isDirectory() ? '/' : ''}`, dir);
        if (entry.isDirectory()) walk(child);
        else if (entry.name.endsWith('.ts')) sqlFiles.push(child.pathname);
      }
    };
    for (const root of hostRoots) walk(new URL(`${root}/`, import.meta.url));

    // A writable outbound handle comes from exactly two shapes: the seam's
    // `openOutboundDbWritable`/`openOutboundDbRw`, or a raw `new Database(...)`
    // on a path built by an `outbound` helper.
    const writers = sqlFiles.filter((file) => {
      const source = fs.readFileSync(file, 'utf8');
      const viaSeam = /openOutboundDb(Writable|Rw)\b/.test(source);
      const viaRaw = /new Database\(\s*\w*[Oo]utbound\w*(Path)?\b/.test(source);
      return viaSeam || viaRaw;
    });

    // Every entry needs a reason it cannot race the container. Add a file here
    // ONLY with the gate that makes it safe named alongside it.
    const sanctioned = new Set([
      // Defines the openers.
      'src/mailbox/sqlite/session-db.ts',
      // Re-exports them; opens nothing itself.
      'src/session-manager.ts',
      // The registered driver — the host's sanctioned writer.
      'src/mailbox/sqlite/index.ts',
      // Bounced-a2a redrive, gated on !isContainerRunning (host-sweep.ts:326).
      'src/host-sweep.ts',
      // Startup session merge; aborts if any affected session is running/idle
      // or has a -wal/-journal sidecar (reconcile-gh-sessions.ts:216-227).
      'src/reconcile-gh-sessions.ts',
    ]);

    const unsanctioned = writers
      .map((file) => file.replace(/^.*?\/(src|setup|scripts)\//, '$1/'))
      .filter((file) => !sanctioned.has(file))
      .sort();

    expect(unsanctioned).toEqual([]);
  });

  it('does not hide a missing composition behind a fallback', () => {
    expect(() => getAgentMailbox()).toThrow('No agent mailbox registered');
  });

  it('lets a skill install the active implementation without a selector', () => {
    const mailbox = fakeMailbox();
    registerAgentMailbox(() => mailbox);
    expect(getAgentMailbox()).toBe(mailbox);
  });

  it('rejects two implementations for the same capability', () => {
    registerAgentMailbox(fakeMailbox);
    expect(() => registerAgentMailbox(fakeMailbox)).toThrow('already registered');
  });

  it('rejects registration after the fallback was resolved', () => {
    registerAgentMailbox(fakeMailbox);
    getAgentMailbox();
    expect(() => registerAgentMailbox(fakeMailbox)).toThrow('already registered');
  });
});
