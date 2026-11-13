import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { recordCritiqueRound } from './critique-record.js';

// Fork-owned. The codex MCP bridge records each critique round itself, for
// every provider; these pin when it records and the payload the script gets.

let dir: string;
let seen: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'critique-record-'));
  seen = path.join(dir, 'seen.jsonl');
  fs.writeFileSync(path.join(dir, 'track-critique.sh'), `cat >> ${seen}; echo >> ${seen}\n`);
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

const result = { threadId: 'thread-1', text: '### Verdict\napprove' };

describe('recordCritiqueRound', () => {
  it('hands track-critique.sh the PostToolUse payload of the codex call', async () => {
    const input = { prompt: 'STAGE: CODE_REVIEW\nreview this', 'developer-instructions': 'You are a reviewer' };
    await recordCritiqueRound('codex', input, result, {
      NANOCLAW_HOOKS_DIR: dir,
      CRITIQUE_GATE_ACTIVE: '1',
      PATH: process.env.PATH,
    });
    const payload = JSON.parse(fs.readFileSync(seen, 'utf-8').trim());
    expect(payload).toMatchObject({
      hook_event_name: 'PostToolUse',
      tool_name: 'mcp__codex__codex',
      tool_input: input,
    });
    expect(JSON.parse(payload.tool_response)).toEqual({ threadId: 'thread-1', content: '### Verdict\napprove' });
  });

  it('records for a group with the critique overlay even while the gate is off, as the hook did', async () => {
    await recordCritiqueRound('codex-reply', { threadId: 't', prompt: 'p' }, result, {
      NANOCLAW_HOOKS_DIR: dir,
      CRITIQUE_GATE_ACTIVE: '0',
      PATH: process.env.PATH,
    });
    expect(JSON.parse(fs.readFileSync(seen, 'utf-8').trim()).tool_name).toBe('mcp__codex__codex-reply');
  });

  it('records nothing for a group without the critique overlay (no CRITIQUE_GATE_ACTIVE)', async () => {
    await recordCritiqueRound('codex', { prompt: 'p' }, result, { NANOCLAW_HOOKS_DIR: dir, PATH: process.env.PATH });
    expect(fs.existsSync(seen)).toBe(false);
  });

  it('logs and goes on when the script is missing', async () => {
    await recordCritiqueRound('codex', { prompt: 'p' }, result, {
      NANOCLAW_HOOKS_DIR: path.join(dir, 'none'),
      CRITIQUE_GATE_ACTIVE: '1',
    });
  });
});
