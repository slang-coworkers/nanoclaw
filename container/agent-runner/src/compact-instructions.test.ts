import { afterEach, describe, expect, it } from 'bun:test';
import path from 'path';

import { buildCompactInstructions, buildPostCompactionReminder, runPreCompactHook } from './compact-instructions.js';
import { closeSessionDb, initTestSessionDb } from './mailbox/sqlite/connection.js';

describe('compaction delivery reminder', () => {
  it('preserves final-output addressing in chat sessions', () => {
    const instructions = buildCompactInstructions(['family'], null);

    expect(instructions).toContain('<message to="name">');
    expect(instructions).toContain('`family`');
  });

  it('preserves explicit-tool delivery in task sessions without teaching final-output blocks', () => {
    const instructions = buildCompactInstructions(['family'], 'daily-digest-a1b2');

    expect(instructions).toContain('send_message');
    expect(instructions).toContain('explicit to destination');
    expect(instructions).toContain('tasks/daily-digest-a1b2.md');
    expect(instructions).not.toContain('<message to="name">');
  });

  it('renders the delivery reminder byte-identically to the pre-extraction wording', () => {
    const chat = buildCompactInstructions(['family', 'ops'], null);
    expect(chat).toContain(
      [
        '   "You MUST wrap all responses in <message to="name">...</message> blocks.',
        '   Available destinations: `family`, `ops`."',
      ].join('\n'),
    );

    const task = buildCompactInstructions(['family'], 'daily-digest-a1b2');
    expect(task).toContain(
      [
        '   "This is an isolated task run. If you need to send the user a message, use send_message with an explicit to destination.',
        '   Final output is not delivered; it becomes the automatic summary in tasks/daily-digest-a1b2.md.',
        '   Available destinations: `family`."',
      ].join('\n'),
    );
  });
});

describe('maintainer requirements survive compaction', () => {
  it('keeps plan-file pointers and URLs, forbids paraphrase, and orders a re-read', () => {
    const instructions = buildCompactInstructions(['family'], null);

    expect(instructions).toContain('/workspace/agent/reports/');
    expect(instructions).toContain('"## Maintainer requirements" section');
    expect(instructions).toContain('every maintainer GitHub comment URL verbatim');
    expect(instructions).toContain('Never restate or');
    expect(instructions).toContain('running any codex critique round, or posting to GitHub.');
  });

  it('keeps the verbatim delivery reminder as the last numbered item', () => {
    const instructions = buildCompactInstructions(['family'], null);
    const items = instructions.match(/^\d+\. /gm) ?? [];

    expect(items).toEqual(['1. ', '2. ', '3. ', '4. ', '5. ']);
    expect(instructions.indexOf('4. If any plan file')).toBeLessThan(
      instructions.indexOf('5. At the END of the compaction summary'),
    );
  });
});

describe('post-compaction reminder', () => {
  it('re-states the canonical delivery sentences with the live destinations', () => {
    const reminder = buildPostCompactionReminder(['family', 'ops'], null);

    expect(reminder).toBe(
      '<system>The conversation was just compacted into a summary. Delivery instructions can be lost in ' +
        'that summary, so as a reminder: You MUST wrap all responses in <message to="name">...</message> blocks. ' +
        'Available destinations: `family`, `ops`.</system>',
    );
  });

  it('teaches explicit-tool delivery in task sessions', () => {
    const reminder = buildPostCompactionReminder([], 'daily-digest-a1b2');

    expect(reminder).toContain('send_message');
    expect(reminder).toContain('tasks/daily-digest-a1b2.md');
    expect(reminder).toContain('Available destinations: (none).');
    expect(reminder).not.toContain('<message to="name">');
  });
});

// The PreCompact hook runs this file as its own process, which has no mailbox
// until it registers one. Without the registration every run failed with "No
// agent mailbox registered", and every compaction lost its instructions.
describe('the PreCompact hook entry', () => {
  afterEach(() => closeSessionDb());

  it('registers the session mailbox when run as its own process', () => {
    // A test process may not open the live session DB, so the child stops at
    // that guard, which it reaches only through a registered mailbox.
    const child = Bun.spawnSync(['bun', path.join(import.meta.dir, 'compact-instructions.ts')], {
      env: { ...process.env, NODE_ENV: 'test' },
      stderr: 'pipe',
      stdout: 'pipe',
    });
    const stderr = child.stderr.toString();
    expect(stderr).not.toContain('No agent mailbox registered');
    expect(stderr).toContain('Refusing to open the live inbound.db from a test process');
  });

  it("prints the instructions for the session's destinations and task", async () => {
    const { inbound } = initTestSessionDb();
    inbound
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('ops-room', NULL, 'channel', 'discord', 'room-1', NULL)`,
      )
      .run();
    inbound.exec(`CREATE TABLE IF NOT EXISTS session_routing (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      channel_type TEXT, platform_id TEXT, thread_id TEXT
    )`);
    inbound
      .prepare('INSERT INTO session_routing (id, channel_type, platform_id, thread_id) VALUES (1, ?, ?, ?)')
      .run('discord', 'room-1', 'system:tasks:nightly-a1b2');

    const out: string[] = [];
    await runPreCompactHook((text) => out.push(text));

    expect(out).toHaveLength(1);
    expect(out[0]).toContain('Preserve the following in the compaction summary:');
    expect(out[0]).toContain('Available destinations: `ops-room`.');
    expect(out[0]).toContain('tasks/nightly-a1b2.md');
  });
});
