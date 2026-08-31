import { describe, it, expect, beforeEach, afterEach } from 'bun:test';

import { closeSessionDb, getInboundDb, initTestSessionDb } from './mailbox/sqlite/connection.js';
import { buildSystemPromptAddendum, getAllDestinations, getDestinationsFingerprint } from './destinations.js';

beforeEach(() => {
  initTestSessionDb();
});

afterEach(() => {
  closeSessionDb();
});

function insertDest(name: string, displayName: string = name): void {
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (?, ?, 'channel', 'discord', 'chan', NULL)`,
    )
    .run(name, displayName);
}

// Upstream helper (used by the SessionMode-aware system-prompt tests). Kept
// alongside insertDest — nv-main's fingerprint tests use insertDest; upstream's
// task-vs-chat tests use seedDestination with explicit channel/platform.
function seedDestination(name: string, displayName: string, channelType: string, platformId: string): void {
  getInboundDb()
    .prepare(
      `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
       VALUES (?, ?, 'channel', ?, ?, NULL)`,
    )
    .run(name, displayName, channelType, platformId);
}

describe('destinations fingerprint', () => {
  it('returns the empty string when the table is empty', () => {
    expect(getDestinationsFingerprint()).toBe('');
  });

  it('stays stable across identical reads', () => {
    insertDest('alpha');
    insertDest('beta');
    const a = getDestinationsFingerprint();
    const b = getDestinationsFingerprint();
    expect(a).toBe(b);
    expect(a.length).toBeGreaterThan(0);
  });

  it('changes when a new destination is added', () => {
    insertDest('alpha');
    const before = getDestinationsFingerprint();
    insertDest('beta');
    expect(getDestinationsFingerprint()).not.toBe(before);
  });

  it('changes when a destination is removed', () => {
    insertDest('alpha');
    insertDest('beta');
    const before = getDestinationsFingerprint();
    getInboundDb().prepare('DELETE FROM destinations WHERE name = ?').run('beta');
    expect(getDestinationsFingerprint()).not.toBe(before);
  });

  it('changes when a destination is renamed (display_name)', () => {
    insertDest('alpha', 'Alpha One');
    const before = getDestinationsFingerprint();
    getInboundDb()
      .prepare('UPDATE destinations SET display_name = ? WHERE name = ?')
      .run('Alpha Two', 'alpha');
    expect(getDestinationsFingerprint()).not.toBe(before);
  });
});

describe('buildSystemPromptAddendum reflects live destinations table', () => {
  it('picks up a newly-added destination without process restart', () => {
    insertDest('alpha');
    const first = buildSystemPromptAddendum();
    expect(first).toContain('alpha');
    expect(first).not.toContain('beta');

    insertDest('beta');
    const second = buildSystemPromptAddendum();
    expect(second).toContain('alpha');
    expect(second).toContain('beta');
  });

  it('getAllDestinations returns live rows', () => {
    insertDest('alpha');
    expect(getAllDestinations().map((d) => d.name)).toEqual(['alpha']);
    insertDest('beta');
    expect(getAllDestinations().map((d) => d.name).sort()).toEqual(['alpha', 'beta']);
  });

  it('gives task sessions only explicit-tool delivery instructions', () => {
    seedDestination('casa', 'Casa', 'whatsapp', 'group-1@g.us');

    const prompt = buildSystemPromptAddendum('Casa', { kind: 'task', taskId: 'daily-briefing-a25c' });

    expect(prompt).toContain('isolated task run');
    expect(prompt).toContain('send_message({ to: "name"');
    expect(prompt).toContain('tasks/daily-briefing-a25c.md');
    expect(prompt).toContain('Only notify someone when the task asks');
    expect(prompt).not.toContain('<message to=');
    expect(prompt).not.toContain('default to addressing');
  });

  it("defaults task escalation to the agent's own channel instead of its parent agent", () => {
    seedDestination('casa', 'Casa', 'whatsapp', 'group-1@g.us');
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('parent', 'Parent', 'agent', NULL, NULL, 'ag-parent')`,
      )
      .run();

    const prompt = buildSystemPromptAddendum('Casa', { kind: 'task', taskId: 'weekly-report' });

    expect(prompt).toContain(
      'For user-visible escalation output, default to your own channel destination(s): `casa`',
    );
    expect(prompt).toContain(
      'Use an agent-type destination like `parent` only when the task explicitly calls for routing through another agent, not as your default escalation path.',
    );
    expect(prompt).not.toContain('default to `parent`');
  });

  it('keeps generic task guidance when no channel destination exists', () => {
    getInboundDb()
      .prepare(
        `INSERT INTO destinations (name, display_name, type, channel_type, platform_id, agent_group_id)
         VALUES ('parent', 'Parent', 'agent', NULL, NULL, 'ag-parent')`,
      )
      .run();

    const prompt = buildSystemPromptAddendum('Casa', { kind: 'task', taskId: 'weekly-report' });

    expect(prompt).toContain('Always pass the explicit named destination.');
    expect(prompt).not.toContain('For user-visible escalation output, default to');
    expect(prompt).not.toContain('your own channel destination(s):');
  });
});
