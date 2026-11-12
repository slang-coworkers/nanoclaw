import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { checkDeliveryGate, deliveryGateEnv, fileGateText } from './delivery-gate.js';

// Fork-owned. The critique gate script runs at every message door; these pin
// the runner side: what text the gate sees for a file, which env reaches the
// MCP server, and what happens when the script is missing.

let dir: string;
beforeEach(() => {
  dir = fs.mkdtempSync(path.join(os.tmpdir(), 'delivery-gate-'));
});
afterEach(() => {
  fs.rmSync(dir, { recursive: true, force: true });
});

describe('fileGateText', () => {
  it('reads the caption and the text of a small text file', () => {
    const file = path.join(dir, 'report.md');
    fs.writeFileSync(file, '[Resolution] PR #9 fixed.\n');
    expect(fileGateText('see attached', file)).toBe('see attached\n[Resolution] PR #9 fixed.\n');
    expect(fileGateText('', file)).toBe('[Resolution] PR #9 fixed.\n');
  });

  it('keeps only the caption for a binary file, a large file, or a missing one', () => {
    const bin = path.join(dir, 'image.png');
    fs.writeFileSync(bin, Buffer.from([0x89, 0x50, 0x00, 0x47]));
    expect(fileGateText('chart', bin)).toBe('chart');
    const big = path.join(dir, 'big.log');
    fs.writeFileSync(big, `[Resolution] x\n${'a'.repeat(300 * 1024)}`);
    expect(fileGateText('log', big)).toBe('log');
    expect(fileGateText('gone', path.join(dir, 'missing'))).toBe('gone');
  });
});

describe('deliveryGateEnv', () => {
  it('forwards the settings the script reads, including an explicit CRITIQUE_GATE_ACTIVE=0, and nothing else', () => {
    expect(
      deliveryGateEnv({
        CRITIQUE_GATE_ACTIVE: '0',
        CRITIQUE_REQUIRED_STAGES: '["OUTPUT_REVIEW"]',
        EXPLAIN_DIFF_GATE: '1',
        REVIEW_REQUEST_GATE: '0',
        PATH: '/usr/bin',
        HOME: '/home/node',
        GH_TOKEN: 'ROUTED_VIA_ONECLI_PROXY',
        ANTHROPIC_MODEL: 'x',
      }),
    ).toEqual({
      CRITIQUE_GATE_ACTIVE: '0',
      CRITIQUE_REQUIRED_STAGES: '["OUTPUT_REVIEW"]',
      EXPLAIN_DIFF_GATE: '1',
      REVIEW_REQUEST_GATE: '0',
      PATH: '/usr/bin',
      HOME: '/home/node',
    });
  });
});

describe('checkDeliveryGate', () => {
  it('lets the delivery through when the script is missing (as a failed hook does)', async () => {
    expect(await checkDeliveryGate('[Resolution] x', 'send_message', { NANOCLAW_HOOKS_DIR: dir })).toEqual({
      blocked: false,
    });
  });

  it("returns the script's refusal as the reason", async () => {
    fs.writeFileSync(
      path.join(dir, 'gate-critique-on-deliver.sh'),
      `jq -e '.tool_name == "mcp__nanoclaw__send_file"' >/dev/null && { echo 'CRITIQUE REQUIRED before delivery' >&2; exit 2; }; exit 0\n`,
    );
    const env = { ...process.env, NANOCLAW_HOOKS_DIR: dir };
    expect(await checkDeliveryGate('[Resolution] x', 'send_file', env)).toEqual({
      blocked: true,
      reason: 'CRITIQUE REQUIRED before delivery',
    });
    expect(await checkDeliveryGate('[Resolution] x', 'send_message', env)).toEqual({ blocked: false });
  });
});
