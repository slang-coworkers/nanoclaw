/**
 * scripts/build-transcripts-archive.ts
 *
 * Walks every agent group + NanoClaw session, renders Claude Code SDK
 * sessions (via sdk_session_routes) + Codex rollouts (via filesystem)
 * through the merged claude-code-transcripts venv, then writes a
 * hierarchical index.html: groups -> sessions -> transcripts.
 *
 * Usage:
 *   pnpm exec tsx scripts/build-transcripts-archive.ts \
 *     [--output /tmp/all-transcripts-html] \
 *     [--limit-per-group N]    # cap sessions per group (default: all)
 *
 * Output layout:
 *   <output>/
 *     index.html                                ← group list
 *     <group-folder>/
 *       index.html                              ← session list
 *       <sess-id>/
 *         index.html                            ← transcript list (claude + codex)
 *         claude/<sdk-uuid>/index.html          ← rendered by claude-code-transcripts
 *         codex/<rollout-id>/index.html         ← rendered by claude-code-transcripts
 */
import Database from 'better-sqlite3';
import { execSync } from 'node:child_process';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, '..');
const DB_PATH = path.join(REPO_ROOT, 'data/v2.db');
const SESSIONS_ROOT = path.join(REPO_ROOT, 'data/v2-sessions');
const RENDERER = '/home/ubuntu/.local/share/claude-code-transcripts-merged/.venv/bin/claude-code-transcripts';

const args = process.argv.slice(2);
const argMap = new Map<string, string>();
for (let i = 0; i < args.length; i++) {
  if (args[i].startsWith('--')) argMap.set(args[i].slice(2), args[i + 1] ?? 'true');
}
const OUT_DIR = argMap.get('output') ?? '/tmp/all-transcripts-html';
const LIMIT_PER_GROUP = argMap.has('limit-per-group') ? parseInt(argMap.get('limit-per-group')!) : 0;

if (!fs.existsSync(RENDERER)) {
  console.error(`renderer not found: ${RENDERER}`);
  console.error('expected: merged claude-code-transcripts venv at /home/ubuntu/.local/share/claude-code-transcripts-merged/.venv');
  process.exit(1);
}

fs.rmSync(OUT_DIR, { recursive: true, force: true });
fs.mkdirSync(OUT_DIR, { recursive: true });

const db = new Database(DB_PATH, { readonly: true });

type Group = { id: string; name: string; folder: string };
type Session = { id: string; agent_group_id: string; thread_id: string | null; created_at: string };
type SdkRoute = { sdk_session_id: string; nanoclaw_session_id: string; first_seen_at: number; last_seen_at: number };

const groups = db.prepare<[], Group>('SELECT id, name, folder FROM agent_groups ORDER BY name').all();
const sessionsByGroup = new Map<string, Session[]>();
for (const g of groups) {
  const rows = db
    .prepare<[string], Session>(
      'SELECT id, agent_group_id, thread_id, created_at FROM sessions WHERE agent_group_id = ? ORDER BY created_at DESC' +
        (LIMIT_PER_GROUP > 0 ? ' LIMIT ?' : ''),
    )
    .all(g.id, ...(LIMIT_PER_GROUP > 0 ? [LIMIT_PER_GROUP as unknown as string] : []));
  sessionsByGroup.set(g.id, rows);
}
const routesBySession = new Map<string, SdkRoute[]>();
for (const r of db
  .prepare<[], SdkRoute>(
    'SELECT sdk_session_id, nanoclaw_session_id, first_seen_at, last_seen_at FROM sdk_session_routes ORDER BY first_seen_at DESC',
  )
  .all()) {
  if (!routesBySession.has(r.nanoclaw_session_id)) routesBySession.set(r.nanoclaw_session_id, []);
  routesBySession.get(r.nanoclaw_session_id)!.push(r);
}
db.close();

function htmlEscape(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}

function findCodexRollouts(group: Group, sessionId: string): string[] {
  const codexDir = path.join(SESSIONS_ROOT, group.id, sessionId, 'codex/sessions');
  if (!fs.existsSync(codexDir)) return [];
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) walk(full);
      else if (entry.isFile() && entry.name.endsWith('.jsonl')) out.push(full);
    }
  };
  walk(codexDir);
  return out.sort();
}

function findClaudeJsonl(group: Group, sdkId: string): string | null {
  const p = path.join(SESSIONS_ROOT, group.id, '.claude-shared/projects/-workspace-agent', `${sdkId}.jsonl`);
  return fs.existsSync(p) ? p : null;
}

function renderTranscript(jsonlPath: string, outDir: string): { ok: boolean; error?: string } {
  fs.mkdirSync(outDir, { recursive: true });
  try {
    execSync(`"${RENDERER}" json "${jsonlPath}" -o "${outDir}"`, {
      stdio: ['ignore', 'pipe', 'pipe'],
      timeout: 60_000,
    });
    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, error: msg.slice(0, 200) };
  }
}

const PAGE_CSS = `
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; max-width: 1100px; margin: 24px auto; padding: 0 16px; color: #1a1a1a; }
  h1 { border-bottom: 2px solid #ddd; padding-bottom: 8px; }
  h2 { margin-top: 32px; color: #444; }
  h3 { margin: 16px 0 4px 0; font-size: 14px; color: #666; }
  ul { list-style: none; padding-left: 0; }
  li { padding: 6px 0; border-bottom: 1px solid #eee; }
  a { color: #2563eb; text-decoration: none; }
  a:hover { text-decoration: underline; }
  .meta { color: #888; font-size: 13px; margin-left: 8px; }
  .group-card { display: block; padding: 12px 16px; margin: 6px 0; background: #f5f5f5; border-radius: 6px; }
  .badge { display: inline-block; padding: 2px 8px; background: #e5e7eb; border-radius: 3px; font-size: 11px; margin-left: 6px; }
  .claude { background: #dbeafe; }
  .codex  { background: #fef3c7; }
  .empty  { color: #aaa; font-style: italic; }
</style>
`;

let totalClaude = 0;
let totalCodex = 0;
let totalFailed = 0;

const groupSummaries: { group: Group; sessionCount: number; claudeCount: number; codexCount: number }[] = [];

for (const group of groups) {
  const sessions = sessionsByGroup.get(group.id) ?? [];
  if (sessions.length === 0) {
    groupSummaries.push({ group, sessionCount: 0, claudeCount: 0, codexCount: 0 });
    continue;
  }
  const groupOutDir = path.join(OUT_DIR, group.folder);
  fs.mkdirSync(groupOutDir, { recursive: true });

  const sessionEntries: { sess: Session; claudeIds: string[]; codexFiles: string[] }[] = [];
  let groupClaude = 0;
  let groupCodex = 0;

  for (const sess of sessions) {
    const sessOutDir = path.join(groupOutDir, sess.id);
    fs.mkdirSync(sessOutDir, { recursive: true });
    const routes = routesBySession.get(sess.id) ?? [];
    const claudeIds: string[] = [];
    for (const r of routes) {
      const jsonl = findClaudeJsonl(group, r.sdk_session_id);
      if (!jsonl) continue;
      const out = path.join(sessOutDir, 'claude', r.sdk_session_id);
      const res = renderTranscript(jsonl, out);
      if (res.ok) {
        claudeIds.push(r.sdk_session_id);
        groupClaude++;
        totalClaude++;
      } else {
        totalFailed++;
        console.error(`claude render failed: ${jsonl}: ${res.error}`);
      }
    }
    const codexFiles = findCodexRollouts(group, sess.id);
    const codexRendered: string[] = [];
    for (const cfile of codexFiles) {
      const cid = path.basename(cfile, '.jsonl');
      const out = path.join(sessOutDir, 'codex', cid);
      const res = renderTranscript(cfile, out);
      if (res.ok) {
        codexRendered.push(cid);
        groupCodex++;
        totalCodex++;
      } else {
        totalFailed++;
        console.error(`codex render failed: ${cfile}: ${res.error}`);
      }
    }
    sessionEntries.push({ sess, claudeIds, codexFiles: codexRendered });

    const sessHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${group.name} · ${sess.id}</title>${PAGE_CSS}</head><body>
<p><a href="../index.html">← ${group.name}</a> · <a href="../../index.html">All groups</a></p>
<h1>${htmlEscape(sess.id)}</h1>
<p class="meta">created ${sess.created_at}${sess.thread_id ? ` · thread <code>${htmlEscape(sess.thread_id)}</code>` : ''}</p>

<h2>Claude Code transcripts <span class="badge claude">${claudeIds.length}</span></h2>
${
  claudeIds.length === 0
    ? '<p class="empty">none</p>'
    : '<ul>' +
      claudeIds
        .map((id) => `<li><a href="claude/${id}/index.html">${id}</a></li>`)
        .join('\n') +
      '</ul>'
}

<h2>Codex transcripts <span class="badge codex">${codexRendered.length}</span></h2>
${
  codexRendered.length === 0
    ? '<p class="empty">none</p>'
    : '<ul>' +
      codexRendered
        .map((id) => `<li><a href="codex/${id}/index.html">${id}</a></li>`)
        .join('\n') +
      '</ul>'
}
</body></html>`;
    fs.writeFileSync(path.join(sessOutDir, 'index.html'), sessHtml);
  }

  const groupHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>${group.name} sessions</title>${PAGE_CSS}</head><body>
<p><a href="../index.html">← All groups</a></p>
<h1>${group.name}</h1>
<p class="meta">${sessions.length} sessions · ${groupClaude} Claude transcripts · ${groupCodex} Codex transcripts</p>
<ul>
${sessionEntries
  .map(
    (e) => `<li><a href="${e.sess.id}/index.html">${e.sess.id}</a>
  <span class="meta">${e.sess.created_at}${e.sess.thread_id ? ` · ${htmlEscape(e.sess.thread_id)}` : ''}</span>
  <span class="badge claude">${e.claudeIds.length} claude</span>
  <span class="badge codex">${e.codexFiles.length} codex</span></li>`,
  )
  .join('\n')}
</ul>
</body></html>`;
  fs.writeFileSync(path.join(groupOutDir, 'index.html'), groupHtml);

  groupSummaries.push({ group, sessionCount: sessions.length, claudeCount: groupClaude, codexCount: groupCodex });
  console.log(`${group.name}: ${sessions.length} sessions, ${groupClaude} claude, ${groupCodex} codex`);
}

const topHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"><title>NanoClaw transcripts</title>${PAGE_CSS}</head><body>
<h1>NanoClaw transcripts</h1>
<p class="meta">${groupSummaries.length} agent groups · ${totalClaude} Claude transcripts · ${totalCodex} Codex transcripts${totalFailed ? ` · ${totalFailed} render failures` : ''}</p>
${groupSummaries
  .map(
    (s) =>
      `<a class="group-card" href="${s.group.folder}/index.html">
  <strong>${s.group.name}</strong>
  <span class="meta">${s.group.folder} · ${s.sessionCount} sessions</span>
  <span class="badge claude">${s.claudeCount} claude</span>
  <span class="badge codex">${s.codexCount} codex</span>
</a>`,
  )
  .join('\n')}
</body></html>`;
fs.writeFileSync(path.join(OUT_DIR, 'index.html'), topHtml);

console.log(`\nDone. ${totalClaude} Claude + ${totalCodex} Codex transcripts. Output: ${OUT_DIR}`);
if (totalFailed > 0) console.log(`${totalFailed} render failures (see stderr above)`);
