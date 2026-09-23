/**
 * Disclosure lines for the approval card behind `ncl groups create --template`.
 *
 * `add_mcp_server` shows an admin one server's command, args and env before they
 * approve it. A template stamp wires a whole set of servers from an untrusted
 * manifest, and without this it minted the generic cli card — the command line and
 * nothing else. The cheaper ask was fully disclosed; the broader one was not.
 *
 * Deliberately the same shape as that card: the same secret patterns, the same
 * `redactSecret` (imported, not reimplemented), the same `escapeInvisibles` so no
 * payload can close the code fence the lines are rendered inside, and the true
 * destination host of an HTTP server always visible.
 *
 * Reads the template only. Nothing here creates a group, a directory or a config
 * row — the card is minted before the handler runs.
 */
import path from 'path';

import { SECRET_ENV_KEY_RE, SECRET_VALUE_RE, escapeInvisibles, redactSecret } from '../modules/self-mod/request.js';
import { resolveLocalTemplate } from './local-dir.js';
import { parseTemplate } from './parse.js';

/** JSON-encode for exact boundaries, then neutralize anything that could escape the fence. */
function show(value: unknown): string {
  return escapeInvisibles(JSON.stringify(value));
}

function redactIfSecret(value: string): string {
  return SECRET_VALUE_RE.test(value) ? redactSecret(value) : value;
}

/**
 * Per path segment and per query value, never the origin: the admin must always
 * see the true host. `SECRET_VALUE_RE` is start-anchored, so testing the whole
 * URL would match nothing — a Zapier-style `https://host/s/<token>/mcp` has to be
 * redacted segment-wise or not at all.
 */
function displayUrl(raw: string): string {
  const u = new URL(raw);
  const segments = u.pathname.split('/').map(redactIfSecret).join('/');
  const entries = [...u.searchParams];
  // Keep the query byte-faithful unless a value actually needs redacting —
  // re-serializing decodes percent-escapes and can invent structure.
  const query = entries.some(([, v]) => SECRET_VALUE_RE.test(v))
    ? `?${entries.map(([k, v]) => `${k}=${redactIfSecret(v)}`).join('&')}`
    : u.search;
  return u.origin + segments + query;
}

/**
 * What stamping `ref` would wire, as card lines. Throws for an unresolvable or
 * unreadable template: the command would fail anyway, and a card that under-states
 * the reach is the defect this exists to remove.
 */
export function templateApprovalDetail(ref: string, base?: string): string[] {
  const tpl = parseTemplate(base === undefined ? resolveLocalTemplate(ref) : resolveLocalTemplate(ref, base));
  const lines = [`template: ${show(ref)}`, `plugin: ${show(tpl.name)}`];

  const serverNames = Object.keys(tpl.mcpServers);
  if (serverNames.length === 0) {
    // Stated, not omitted: a missing line reads as "not checked", and the absence
    // of MCP reach is the single most useful thing an approver can be told.
    lines.push('mcp: no MCP servers');
  }
  for (const name of serverNames.sort()) {
    const server = tpl.mcpServers[name];
    if (server.type === 'http') {
      lines.push(`mcp ${show(name)}: http url=${show(displayUrl(server.url))}`);
      if (server.headers !== undefined) {
        const shown = Object.fromEntries(
          Object.entries(server.headers).map(([k, v]) => [
            k,
            SECRET_ENV_KEY_RE.test(k) || SECRET_VALUE_RE.test(v) ? redactSecret(v) : v,
          ]),
        );
        lines.push(`  headers=${show(shown)}`);
      }
      continue;
    }
    const args = (server.args ?? []).map(redactIfSecret);
    const env = Object.fromEntries(
      Object.entries(server.env ?? {}).map(([k, v]) => [
        k,
        SECRET_ENV_KEY_RE.test(k) || SECRET_VALUE_RE.test(v) ? redactSecret(v) : v,
      ]),
    );
    lines.push(`mcp ${show(name)}: stdio command=${show(server.command)} args=${show(args)} env=${show(env)}`);
  }

  // Skills and tasks are the rest of what a stamp installs. Names only: an
  // approver judging reach needs to know a skill named `/onecli-gateway` is
  // arriving, not to read its body.
  lines.push(tpl.skills.length > 0 ? `skills: ${show(tpl.skills.map((s) => s.name).sort())}` : 'skills: none');
  lines.push(`tasks: ${tpl.tasks.length} (created paused)`);
  if (tpl.instructions !== undefined) lines.push('persona: yes (inlined into CLAUDE.md every spawn)');
  if (tpl.contextExtras.length > 0) {
    lines.push(`context files: ${show(tpl.contextExtras.map((c) => path.posix.normalize(c.name)).sort())}`);
  }
  return lines;
}
