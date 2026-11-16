import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { openCodeActivity, openCodeTracePath, renderOpenCodeTranscript } from './transcripts-opencode.js';

const CONVERTER = path.join(path.dirname(fileURLToPath(import.meta.url)), 'opencode-trace-html.py');

function fixture(): { root: string; trace: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'oc-archive-'));
  const dir = path.join(root, 'slang-triager', '.opencode-trace');
  fs.mkdirSync(dir, { recursive: true });
  const trace = path.join(dir, 'session-sess-1-abc.jsonl');
  const reply =
    'data: ' + JSON.stringify({ choices: [{ delta: { content: 'Triage done.' } }] }) + '\n\ndata: [DONE]\n\n';
  const rec = {
    at: '2026-11-16T08:00:00.000Z',
    status: 200,
    url: '/v1/chat/completions',
    request: { body: { model: 'nvidia/zai-org/glm-5.3', messages: [{ role: 'user', content: 'Look at issue 42.' }] } },
    response: { body: reply },
  };
  fs.writeFileSync(trace, JSON.stringify(rec) + '\n');
  fs.writeFileSync(path.join(dir, 'session-sess-1-abc.events.jsonl'), '{"type":"server.connected"}\n');
  return { root, trace };
}

describe('OpenCode sessions in the transcripts archive', () => {
  it('finds the trace of a session by its NanoClaw session id, and nothing for other sessions', () => {
    const { root, trace } = fixture();
    expect(openCodeTracePath(root, 'slang-triager', 'sess-1-abc')).toBe(trace);
    expect(openCodeTracePath(root, 'slang-triager', 'sess-2-xyz')).toBeNull();
    expect(openCodeTracePath(root, 'main', 'sess-1-abc')).toBeNull();
  });

  it('dates a session by its trace and gives 0 when there is none', () => {
    const { trace } = fixture();
    const when = new Date('2026-11-16T09:00:00Z');
    fs.utimesSync(trace, when, when);
    expect(openCodeActivity(trace)).toBe(when.getTime());
    expect(openCodeActivity(null)).toBe(0);
    expect(openCodeActivity('/no/such/file')).toBe(0);
  });

  it('renders the trace into a transcript page with the real converter', () => {
    const { root, trace } = fixture();
    const out = path.join(root, 'out', 'opencode', 'index.html');
    expect(renderOpenCodeTranscript(CONVERTER, trace, out)).toEqual({ ok: true });
    const page = fs.readFileSync(out, 'utf8');
    expect(page).toContain('Look at issue 42.');
    expect(page).toContain('Triage done.');
  });

  it('reports a failed render instead of throwing', () => {
    const { root, trace } = fixture();
    const failing = () => {
      throw new Error('converter crashed');
    };
    expect(renderOpenCodeTranscript(CONVERTER, trace, path.join(root, 'x.html'), failing)).toEqual({
      ok: false,
      error: 'converter crashed',
    });
  });
});
