/**
 * A template stamp must disclose the MCP reach it is asking for.
 *
 * `add_mcp_server` renders one server's command, args and env into the approval
 * card. `ncl groups create --template <ref>` wires a whole set of them and, until
 * this, minted the GENERIC cli card — the command line and nothing else. So the
 * cheaper ask (one server) was fully disclosed while the broader one (several,
 * from an untrusted manifest) was disclosed as a bare ref.
 *
 * Redaction, escaping and the byte cap are deliberately the same shape as the
 * add_mcp_server card: an admin should not have to learn a second format, and a
 * second redactor would be free to drift from the first.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { MCP_SCHEMA_URL, PLUGIN_SCHEMA_URL } from './manifest.js';
import { templateApprovalDetail } from './approval-detail.js';

let base: string;
let dir: string;

beforeEach(() => {
  base = fs.mkdtempSync(path.join(os.tmpdir(), 'tpl-card-'));
  dir = path.join(base, 'vendor', 'agent');
  fs.mkdirSync(dir, { recursive: true });
});
afterEach(() => {
  fs.rmSync(base, { recursive: true, force: true });
});

function write(rel: string, content: string): void {
  const full = path.join(dir, rel);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, content);
}
function writeManifest(overrides: Record<string, unknown> = {}): void {
  write('plugin.json', JSON.stringify({ $schema: PLUGIN_SCHEMA_URL, name: 'agent', ...overrides }));
}
function writeMcp(servers: Record<string, unknown>): void {
  write('mcp.json', JSON.stringify({ $schema: MCP_SCHEMA_URL, mcpServers: servers }));
}
function writeSkill(name: string): void {
  write(`skills/${name}/SKILL.md`, `---\nname: ${name}\ndescription: does things\n---\n\nBody.`);
}

describe('templateApprovalDetail', () => {
  it('names every MCP server the stamp would wire', () => {
    writeManifest();
    writeMcp({
      hubspot: { type: 'stdio', command: 'hubspot-mcp', args: ['--mode', 'crm'] },
      exa: { type: 'streamable-http', url: 'https://api.exa.ai/mcp' },
    });

    const lines = templateApprovalDetail('vendor/agent', base).join('\n');

    expect(lines).toContain('hubspot');
    expect(lines).toContain('hubspot-mcp');
    expect(lines).toContain('--mode');
    expect(lines).toContain('exa');
    // The true destination host is never hidden — that is the whole point.
    expect(lines).toContain('https://api.exa.ai');
  });

  it('redacts a secret-shaped env value but still shows its key', () => {
    writeManifest();
    writeMcp({ crm: { type: 'stdio', command: 'srv', env: { CRM_TOKEN: 'placeholder' } } });

    const lines = templateApprovalDetail('vendor/agent', base).join('\n');

    expect(lines).toContain('CRM_TOKEN');
    expect(lines).not.toContain('placeholder');
    expect(lines).toMatch(/<redacted: \d+ bytes, sha256 [0-9a-f]{8}>/);
  });

  it('discloses the skills and tasks the stamp brings', () => {
    writeManifest();
    writeSkill('vendor-agent');

    const lines = templateApprovalDetail('vendor/agent', base).join('\n');

    expect(lines).toContain('vendor-agent');
  });

  it('says so plainly when a template wires no MCP servers', () => {
    writeManifest();
    writeSkill('vendor-agent');

    const lines = templateApprovalDetail('vendor/agent', base).join('\n');

    // Absence has to be stated, not left as a missing line an admin may not notice.
    expect(lines).toMatch(/no MCP servers/i);
  });

  it('cannot break out of the card it is rendered into', () => {
    writeManifest();
    writeMcp({ srv: { type: 'stdio', command: 'x', args: ['a`b', 'c‮d'] } });

    const lines = templateApprovalDetail('vendor/agent', base).join('\n');

    // A backtick would close the fence; a bidi override would reorder the display.
    expect(lines).not.toContain('`');
    expect(lines).not.toContain('‮');
    expect(lines).toContain('\\u202e');
  });

  it('propagates a bad ref instead of returning a vague card', () => {
    expect(() => templateApprovalDetail('nope/missing', base)).toThrow(/Template not found/);
    expect(() => templateApprovalDetail('../escape', base)).toThrow(/escapes the templates directory/);
  });
});
