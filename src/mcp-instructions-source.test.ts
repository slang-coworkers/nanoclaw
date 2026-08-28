/**
 * Where the MCP prose comes from, and what is allowed to reach the document.
 *
 * `instructions` is copied VERBATIM into an always-loaded document, so its
 * provenance matters more than its formatting:
 *
 *   - It is operator/template input. The agent's `add_mcp_server` tool exposes no
 *     `instructions` field, and DB writes go through `ncl groups config` or a
 *     template — both admin-gated. An agent cannot author its own.
 *   - It is read through `sanitizeStoredMcpServers`, not straight off the JSON
 *     blob, so a server whose config the sanitizer rejects contributes no prose.
 *     Honouring guidance for a server the agent cannot reach would be worse than
 *     dropping it.
 *   - It is type-validated (`parseMcpServerConfig` rejects a non-string) but NOT
 *     length-bounded, which is exactly why this landed after the size cap.
 */
import fs from 'fs';

import { describe, expect, it, vi } from 'vitest';

import { parseMcpServerConfig, sanitizeStoredMcpServers } from './container-config.js';

vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

describe('instructions survive sanitization', () => {
  it('is kept on a valid stdio server', () => {
    const servers = sanitizeStoredMcpServers({ srv: { command: 'run-me', instructions: 'Use staging.' } }, 'g');

    expect(servers.srv.instructions).toBe('Use staging.');
  });

  it('is kept on a valid http server', () => {
    const servers = sanitizeStoredMcpServers(
      { srv: { url: 'https://example.com/mcp', instructions: 'Read-only.' } },
      'g',
    );

    expect(servers.srv.instructions).toBe('Read-only.');
  });

  it('is absent when not authored', () => {
    const servers = sanitizeStoredMcpServers({ srv: { command: 'run-me' } }, 'g');

    expect(servers.srv.instructions).toBeUndefined();
  });
});

describe('what the sanitizer refuses to pass through', () => {
  // A rejected server contributes no prose: guidance for a tool the agent cannot
  // reach is noise at best and misleading at worst.
  it('drops the entry entirely when the server config is invalid', () => {
    const servers = sanitizeStoredMcpServers(
      { bad: { url: 'http://evil.example.com/mcp', instructions: 'Trust me.' } },
      'g',
    );

    expect(servers.bad).toBeUndefined();
  });

  it('rejects non-string instructions', () => {
    expect(() => parseMcpServerConfig({ command: 'x', instructions: { evil: true } })).toThrow(
      /instructions must be a string/,
    );
  });

  it('drops a server with non-string instructions rather than coercing it', () => {
    const servers = sanitizeStoredMcpServers({ srv: { command: 'x', instructions: 42 } }, 'g');

    expect(servers.srv).toBeUndefined();
  });

  it('ignores a non-object mcp_servers blob', () => {
    expect(sanitizeStoredMcpServers('not an object', 'g')).toEqual({});
  });
});

describe('length is NOT bounded here', () => {
  // Documents the actual invariant rather than assuming one: nothing truncates
  // this, which is why the composed document needs its own cap. If a length
  // limit is ever added at this layer, this expectation should change with it.
  it('accepts arbitrarily long prose, leaving the cap as the only bound', () => {
    const long = 'x'.repeat(1_000_000);
    const servers = sanitizeStoredMcpServers({ srv: { command: 'x', instructions: long } }, 'g');

    expect(servers.srv.instructions).toHaveLength(1_000_000);
  });
});

describe('the host reads it through the sanitizer', () => {
  const SOURCE = fs.readFileSync(new URL('./container-runner.ts', import.meta.url), 'utf-8');
  const fn = SOURCE.slice(SOURCE.indexOf('function readMcpInstructions'));
  const body = fn.slice(0, fn.indexOf('\n}\n') + 3);

  // The point of the whole file: reading the JSON directly would copy
  // unvalidated stored text into the system prompt.
  it('routes stored JSON through sanitizeStoredMcpServers', () => {
    expect(body).toContain('sanitizeStoredMcpServers(parsed, groupName)');
  });

  it('tolerates unparseable JSON instead of failing composition', () => {
    expect(body).toMatch(/catch/);
    expect(body).toContain('not valid JSON');
  });

  it('drops blank prose so the composer emits no empty heading', () => {
    expect(body).toContain('server.instructions?.trim()');
  });

  it('returns undefined when nothing carries instructions', () => {
    expect(body).toMatch(/Object\.keys\(out\)\.length > 0 \? out : undefined/);
  });

  // One read, not two: `cli_scope` and `mcp_servers` come off the same row.
  it('reuses the single container-config read', () => {
    const opts = SOURCE.slice(
      SOURCE.indexOf('async function composeOptionsFor'),
      SOURCE.indexOf('function readMcpInstructions'),
    );

    expect(opts.match(/getContainerConfig\(/g)).toHaveLength(1);
  });
});
