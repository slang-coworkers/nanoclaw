/**
 * Rendering contract for the Checks views in dashboard/public/app.js: the
 * Checks section of a coworker, Admin › Checks, and the MCP handshake table in
 * Infra. app.js is a browser script with no exports, so each function is
 * extracted from source and evaluated, as unit-cost-panel.test.ts does.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');
const esc = (s: unknown) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function source(name: string): string {
  const start = APP.indexOf(`function ${name}(`);
  expect(start, `${name} must exist in app.js`).toBeGreaterThan(-1);
  let depth = 0;
  for (let j = APP.indexOf('{', start); j < APP.length; j++) {
    if (APP[j] === '{') depth++;
    else if (APP[j] === '}' && --depth === 0) return APP.slice(start, j + 1);
  }
  throw new Error(`${name} is not brace-balanced`);
}

function load<T>(name: string, prelude = ''): T {
  return new Function('esc', `${prelude}\n${source(name)}; return ${name};`)(esc) as T;
}

const gateRe = APP.match(/const GATE_HOOK_RE = [^;]+;/)?.[0] ?? '';

describe('checksCardHtml', () => {
  const render = load<(c: unknown) => string>('checksCardHtml', gateRe);

  it('lists gate hooks, counts the rest, and shows task state and events', () => {
    const html = render({
      hookSource: 'settings',
      hooks: [
        { event: 'PreToolUse', matcher: 'Bash', script: 'gate-critique-on-deliver.sh' },
        { event: 'PreToolUse', matcher: 'Edit|Write', script: 'gate-plan.sh' },
        { event: 'PostToolUse', matcher: null, script: 'track-edits.sh' },
      ],
      overlays: ['plan-gate'],
      workflow: { planWritten: true, planPath: '/workspace/agent/reports/p.md', critiqueRounds: 2, editsSincePlan: 3 },
      hookEventsLastHour: { Stop: 4, PreToolUse: 30 },
    });
    expect(html).toContain('gate-critique-on-deliver.sh');
    expect(html).toContain('gate-plan.sh');
    expect(html).not.toContain('track-edits.sh');
    expect(html).toContain('1 other hooks');
    expect(html).toContain('plan-gate');
    expect(html).toContain('plan written');
    expect(html).toContain('critique rounds 2');
    expect(html).toContain('PreToolUse 30 · Stop 4');
  });

  it('names the Codex hook file and says when there is no state', () => {
    const html = render({ hookSource: 'codex-image', hooks: [], overlays: [], workflow: null, hookEventsLastHour: {} });
    expect(html).toContain('the Codex hook file in the image');
    expect(html).toContain('No gate hooks');
    expect(html).toContain('No task state');
    expect(html).toContain('none in the last hour');
  });

  it('escapes what it shows', () => {
    const html = render({
      hooks: [{ event: 'PreToolUse', matcher: '<b>', script: 'gate-<x>.sh' }],
      overlays: ['<img>'],
      workflow: null,
      hookEventsLastHour: {},
    });
    expect(html).not.toContain('<img>');
    expect(html).not.toContain('gate-<x>');
  });
});

describe('adminChecksHtml', () => {
  const render = load<(d: unknown) => string>('adminChecksHtml');

  it('shows problems, non-selective groups, gate decisions and unpriced models', () => {
    const html = render({
      checkedAt: '2026-11-13T08:00:00Z',
      groupCount: 3,
      policyProblems: [{ folder: 'oc-x', problems: ['critic model gpt is not an open-weights model'] }],
      onecli: {
        rows: [
          { folder: 'a', mode: 'selective' },
          { folder: 'b', mode: 'all' },
          { folder: 'c', mode: 'missing' },
        ],
      },
      inputGate: { rows: [{ mode: 'shadow', outcome: 'allowed', n: 5 }] },
      unpricedModels: ['nvidia/new/model'],
    });
    expect(html).toContain('critic model gpt is not an open-weights model');
    expect(html).toContain('1/3');
    expect(html).toContain('<td>b</td><td>all</td>');
    expect(html).toContain('<td>c</td><td>missing</td>');
    expect(html).toContain('<td>shadow</td><td>allowed</td><td>5</td>');
    expect(html).toContain('nvidia/new/model');
  });

  it('shows a failed source as an error, and the other sources still render', () => {
    const html = render({
      policyProblems: [],
      onecli: { error: 'HTTP 503' },
      inputGate: { error: 'no such table: input_gate_decisions' },
      unpricedModels: [],
    });
    expect(html).toContain('HTTP 503');
    expect(html).toContain('no such table');
    expect(html).toContain('None: every open-weights group resolves to open models.');
  });
});

describe('mcpHandshakeHtml', () => {
  const render = load<(h: unknown) => string>('mcpHandshakeHtml');

  it('shows each server with its time and result', () => {
    const html = render({
      servers: [
        { name: 'slang-mcp', ms: 1200, ok: true },
        { name: 'slow', ms: null, ok: false, error: 'timed out' },
      ],
    });
    expect(html).toContain('slang-mcp');
    expect(html).toContain('1.2 s');
    expect(html).toContain('timed out');
  });

  it('says it is measuring before the result arrives, and shows a failure', () => {
    expect(render(null)).toContain('Measuring');
    expect(render({ error: 'proxy HTTP 401', servers: [] })).toContain('proxy HTTP 401');
  });
});
