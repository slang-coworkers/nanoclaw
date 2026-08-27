/**
 * NanoClaw Dashboard Server
 *
 * Four-tab dashboard:
 *   Tab 1: Pixel Art Office — real-time interactive coworker visualization
 *   Tab 2: Coworkers — manage coworker agents, containers, files
 *   Tab 3: Timeline — event audit log, task history
 *   Tab 4: Admin — config, debug, infrastructure, logs, skills, chat, metrics
 *
 * Reads NanoClaw state from SQLite/session DBs and forwards browser chat to the
 * NanoClaw host over a localhost-only ingress.
 * Receives real-time hook events via POST /api/hook-event.
 */

import { createServer } from 'http';
import { createHash, randomUUID } from 'crypto';
import { createGzip, createGunzip } from 'zlib';
import { pipeline } from 'stream/promises';
import { exec, execFile, execSync } from 'child_process';
import { cpus, homedir } from 'os';
import {
  readFileSync,
  readdirSync,
  existsSync,
  statSync,
  statfsSync,
  lstatSync,
  symlinkSync,
  cpSync,
  watch,
  watchFile,
  unwatchFile,
  writeFileSync,
  renameSync,
  unlinkSync,
  mkdirSync,
  rmSync,
  copyFileSync,
  createWriteStream,
} from 'fs';
import { join, resolve, relative, normalize, isAbsolute, extname, basename, dirname } from 'path';
import Database from 'better-sqlite3';
import { createRequire } from 'node:module';
import { Worker } from 'node:worker_threads';

import { initDb as initSrcDb } from '../src/db/connection.js';
import { CONTAINER_RUNTIME_BIN } from '../src/container-runtime.js';
import { refreshDestinationsForAgentGroup } from '../src/modules/agent-to-agent/write-destinations.js';
import { CANONICAL_DECISIONS, canonicalizeDecision } from '../src/modules/approvals/decision.js';
import { kbDoctorUnavailable, readKbDoctorArtifact, type KbDoctorView } from './kb-doctor-artifact.js';
import { isoWeekStart, isoWeekStartFromMs, sessionIdMs, unitCostByWeek, UNIT_COST_GROUPS } from './unit-cost.js';
import { priceUsage, normalizeModel, MODEL_PRICING, type SessionCostEntry, type TokenUsage } from './session-costs.js';
import {
  CODEX_MODEL_PRICING,
  codexUsageKey,
  codexUsageTokens,
  normalizeCodexModel,
  parseCodexRollout,
  priceCodexUsage,
} from './codex-costs.js';
import {
  parseCostCapBlob,
  buildCostCapEntry,
  buildSessionCostFields,
  mapEpisodeToLatestAdjustment,
  validateCeilingRequest,
  type SessionCostCapEntry,
  type CostEpisodeLikeRow,
  type LatestCostAdjustment,
} from './session-cost-caps.js';

/**
 * Check if `target` is inside (or equal to) `baseDir`.
 * Uses path.relative to avoid the startsWith('/foo/bar') vs '/foo/bar-evil' bug.
 * Mirrors ensureWithinBase() from src/group-folder.ts.
 */
/** Safe decodeURIComponent — returns null on malformed input instead of throwing. */
function safeDecode(s: string): string | null {
  try {
    return decodeURIComponent(s);
  } catch {
    return null;
  }
}

function isInsideDir(baseDir: string, target: string): boolean {
  const rel = relative(resolve(baseDir), resolve(target));
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel);
}

function assetVersion(fileName: string): string {
  try {
    const publicDir = getPublicDir();
    const content = readFileSync(resolve(publicDir, fileName));
    return createHash('sha256').update(content).digest('hex').slice(0, 12);
  } catch {
    return String(Date.now());
  }
}

function injectAssetVersions(html: Buffer): Buffer {
  const versions = new Map<string, string>();
  return Buffer.from(
    html.toString('utf8').replace(/\b(src|href)="([^"?]+\.(?:js|css))"/g, (match, attr, assetPath) => {
      if (/^(?:[a-z]+:)?\/\//i.test(assetPath) || assetPath.startsWith('/')) return match;
      let version = versions.get(assetPath);
      if (!version) {
        version = assetVersion(assetPath);
        versions.set(assetPath, version);
      }
      return `${attr}="${assetPath}?v=${version}"`;
    }),
  );
}

// Expose the operator-configured TZ to the frontend so message timestamps
// render in the install's timezone, not the viewing browser's. Read from
// the same env var the host's TIMEZONE constant resolves from (src/config.ts).
// Validated against Intl so a typo'd TZ falls back to browser-local instead
// of throwing in toLocaleTimeString.
function injectTimezone(html: Buffer): Buffer {
  const raw = process.env.TZ || '';
  if (!raw) return html;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: raw });
  } catch {
    return html;
  }
  const safe = raw.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
  const meta = `<meta name="nanoclaw-tz" content="${safe}">`;
  return Buffer.from(html.toString('utf8').replace(/(<meta\s+charset="[^"]*">)/i, `$1\n  ${meta}`));
}

function injectDashboardMode(html: Buffer, readOnly: boolean): Buffer {
  if (!readOnly) return html;
  return Buffer.from(
    html
      .toString('utf8')
      .replace(/<html(\s[^>]*)?>/i, (match, attrs = '') => `<html${attrs} data-dashboard-mode="readonly">`)
      .replace(/(<meta\s+charset="[^"]*">)/i, '$1\n  <meta name="nanoclaw-dashboard-mode" content="readonly">')
      .replace(/(<\/head>)/i, '  <link rel="stylesheet" href="viewer.css">\n$1'),
  );
}

// ──────────────────────────────────────────────────────────────────────
// Session display-title heuristic.
//
// The slug (`main · dusky-meadow-drifts`) is only a stable identifier.
// What an operator actually scans is: "what is this session about?"
// These helpers produce a short task-shaped string from the first user
// prompt, with light extraction of the signals operators care about:
// PR/issue references, file paths, and imperative verbs.
// ──────────────────────────────────────────────────────────────────────

/**
 * Strip code fences, URLs, envelope wrappers, control chars, decorative
 * punctuation; collapse ws.
 *
 * UserPromptSubmit messages are pre-wrapped by the host/router in
 * XML-like envelopes like:
 *   <context timezone=Asia/Kolkata>
 *   <message id=6 from=orchestrator send=...>
 *   <actual-body>
 *   </message>
 *   </context>
 *
 * Without stripping those, the titler's first-8-words rule surfaces
 * `context timezone Asia/Kolkata message id 6 from ...` as the session
 * title — operator-hostile. We remove the whole envelope first, then
 * operate on the surviving body.
 */
export function sanitizeSessionTitle(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let cleaned = raw
    // Drop fenced code and URLs — rarely useful in a 3–8 word title.
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/https?:\/\/\S+/g, ' ')
    // Drop HTML/XML-ish tags entirely, whether self-closing, open, or
    // close. Covers `<context ...>`, `<message id=N from=X>`, `</message>`,
    // etc. Multi-line safe because we allow '.' to match across \n via
    // the [\s\S] alternative.
    .replace(/<[\w/][^>]*>/g, ' ')
    // Drop any leftover attr-shaped tokens like `timezone=Asia/Kolkata`
    // or `from=orchestrator`. A bare `word=value` at word boundaries is
    // almost never the thing an operator wants in a title.
    .replace(/\b[a-zA-Z_][\w-]*=[^\s<>]+/g, ' ');

  cleaned = cleaned
    .replace(/[\r\n\t]+/g, ' ')
    .replace(/["'`*_#>\[\]{}]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned) return null;
  return cleaned;
}

/**
 * Extract task-detail signals from a prompt:
 *  - PR references: "PR #123", "pull request 45", "PR-A"
 *  - Issue references: "issue #45", "bug #12"
 *  - File paths / extensions: `src/foo.ts`, `migrations/*.sql`
 *  - Leading imperative verb: Review | Fix | Investigate | Implement | Update | Debug | Refactor | Add | Remove
 *
 * Returns an ordered list of tokens that are good candidates to surface
 * in a 3–8 word title, in descending priority.
 */
function extractTitleSignals(raw: string): { verb: string | null; refs: string[]; files: string[] } {
  const refs: string[] = [];
  const files: string[] = [];

  // Preserve original casing of the first word — used for verb extraction.
  const firstWordMatch = raw.match(/^\s*(please|can you|could you|would you|help me|i need you to)\s+(\w+)/i);
  let verb: string | null = null;
  if (firstWordMatch) {
    verb = firstWordMatch[2];
  } else {
    const leadWord = raw.match(/^\s*(\w+)/);
    if (leadWord) verb = leadWord[1];
  }
  // Only keep a verb if it looks imperative. Don't hijack the title with
  // a filler word ("i", "the", "this", etc.).
  if (verb) {
    const v = verb.toLowerCase();
    const imperatives = new Set([
      'review',
      'fix',
      'investigate',
      'implement',
      'update',
      'debug',
      'refactor',
      'add',
      'remove',
      'delete',
      'rename',
      'migrate',
      'merge',
      'split',
      'rebase',
      'check',
      'verify',
      'build',
      'test',
      'document',
      'write',
      'rewrite',
      'port',
      'extract',
      'inline',
      'optimize',
      'profile',
      'trace',
      'audit',
      'explore',
      'land',
      'ship',
      'wire',
      'replace',
      'restore',
      'revert',
      'tidy',
      'clean',
    ]);
    verb = imperatives.has(v) ? verb.charAt(0).toUpperCase() + verb.slice(1).toLowerCase() : null;
  }

  // PR / issue references. Accept `PR #123`, `PR-123`, `#PR-A`, `issue #45`, `pull request 99`.
  const prRefRe =
    /(?:\bPR\s?#?\s?([A-Za-z]?\d+[A-Za-z0-9-]*)|\bpull\s+request\s+#?\s?(\d+[A-Za-z0-9-]*)|#PR-([A-Za-z0-9-]+)|\bPR-([A-Za-z0-9-]+))/gi;
  let m: RegExpExecArray | null;
  while ((m = prRefRe.exec(raw)) !== null) {
    const id = m[1] ?? m[2] ?? m[3] ?? m[4];
    if (id) refs.push(`PR #${id}`);
  }
  const issueRe = /\b(?:issue|bug)\s+#?\s?(\d+[A-Za-z0-9-]*)/gi;
  while ((m = issueRe.exec(raw)) !== null) refs.push(`issue #${m[1]}`);

  // File paths. Accept `src/foo.ts`, `dashboard/server.ts`, `a/b.md`, etc.
  // Must contain a `/` and a known extension OR must be a clear relative path.
  const fileRe = /\b([\w.-]+\/[\w./-]+\.[a-zA-Z]{1,5})\b/g;
  while ((m = fileRe.exec(raw)) !== null) files.push(m[1]);

  return { verb, refs: Array.from(new Set(refs)), files: Array.from(new Set(files)) };
}

/**
 * Build a short, task-describing title from the first user prompt.
 *
 * Strategy:
 *   1. Sanitize the raw prompt.
 *   2. Extract (verb, refs, files).
 *   3. If we have a verb + refs/files → "<Verb> <ref/file>" (preferred
 *      "task-detail" shape, e.g. "Review PR #178" or "Fix src/a2a.ts").
 *   4. If we only have refs or files → join one or two of them.
 *   5. Otherwise → first ~8 words of the sanitized prompt.
 *   6. Cap at 72 chars with an ellipsis.
 *
 * Callers can upgrade via `titleFromPromptWithAgent()` which wraps this
 * and kicks off an async LLM refinement — returns immediately with the
 * heuristic title while the LLM pass UPSERTs a better one in the
 * background.
 */
export function titleFromPrompt(prompt: string | null | undefined): string | null {
  const cleaned = sanitizeSessionTitle(prompt);
  if (!cleaned) return null;

  const { verb, refs, files } = extractTitleSignals(cleaned);
  const signals = [...refs, ...files.slice(0, 2)];

  let title: string;
  if (verb && signals.length > 0) {
    title = `${verb} ${signals.slice(0, 2).join(' + ')}`;
  } else if (signals.length > 0) {
    title = signals.slice(0, 2).join(' + ');
  } else {
    // Strip common pleasantries from the front, then first ~8 words.
    const stripped = cleaned
      .replace(/^(please|can you|could you|would you|help me|i need you to)\s+/i, '')
      .replace(/[?.!,;:]+$/g, '')
      .trim();
    const words = stripped.split(/\s+/).filter(Boolean).slice(0, 8);
    title = words.join(' ');
  }

  if (!title) return null;
  return title.length > 72 ? title.slice(0, 69).trimEnd() + '...' : title;
}

/**
 * Fire-and-forget LLM-backed title upgrade. Only runs when
 * DASHBOARD_TITLE_AGENT=anthropic and ANTHROPIC_API_KEY is set — otherwise
 * the heuristic title stays in place. Uses claude-haiku-4-5, 30 tokens,
 * single turn. Failures are swallowed (log only) — the heuristic title
 * the host already wrote is the fallback.
 *
 * Runs AFTER the heuristic UPDATE completes, so the user sees a title
 * immediately and it optionally refines within ~1s.
 */
async function refineTitleWithAgent(heDb: Database.Database, sessionId: string, rawPrompt: string): Promise<void> {
  if (process.env.DASHBOARD_TITLE_AGENT !== 'anthropic') return;
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return;

  const cleaned = sanitizeSessionTitle(rawPrompt);
  if (!cleaned) return;
  // Keep the prompt we feed the model bounded — operators can paste long
  // logs into a session prompt and we don't want to pay for that.
  const snippet = cleaned.length > 800 ? cleaned.slice(0, 800) + '...' : cleaned;

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': key,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5',
        max_tokens: 30,
        messages: [
          {
            role: 'user',
            content:
              'Write a 3-6 word imperative task title that describes what this session is about. ' +
              'Examples: "Review PR #178", "Fix A2A routing bug", "Investigate dashboard timeout". ' +
              'Respond with just the title, no quotes, no trailing punctuation.\n\n' +
              'Session prompt:\n' +
              snippet,
          },
        ],
      }),
    });
    if (!res.ok) return;
    const data = (await res.json()) as { content?: Array<{ type: string; text?: string }> };
    const text = data.content?.find((c) => c.type === 'text')?.text;
    if (!text) return;
    const trimmed = text
      .trim()
      .replace(/^["'`]|["'`]$/g, '')
      .replace(/[?.!;:]+$/g, '');
    if (!trimmed || trimmed.length > 72) return;

    heDb
      .prepare(
        `UPDATE sessions
            SET display_title = ?, title_source = 'heuristic', title_updated_at = ?
          WHERE id = ?
            AND COALESCE(title_source, '') != 'manual'`,
      )
      .run(trimmed, new Date().toISOString(), sessionId);
  } catch {
    // Network/API/DB error — silent. The heuristic title already in place
    // is the acceptable fallback.
  }
}

function getProjectRoot(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_PROJECT_ROOT || resolve(import.meta.dirname, '..'));
}
function getPublicDir(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_PUBLIC_DIR || resolve(import.meta.dirname, 'public'));
}
function getDataDir(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_DATA_DIR || join(getProjectRoot(), 'data'));
}
function getDbPath(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_DB_PATH || join(getDataDir(), 'v2.db'));
}
function getGroupsDir(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_GROUPS_DIR || join(getProjectRoot(), 'groups'));
}
/**
 * Find the dashboard messaging_group row for a coworker. Primary lookup by
 * canonical platform_id ('dashboard:<folder>'); fallback joins via
 * messaging_group_agents for older rows that use a non-canonical
 * platform_id. Returns null if the coworker has no dashboard wiring.
 */
function resolveDashboardMessagingGroupId(db: Database.Database, agentGroupId: string, folder: string): string | null {
  const primary = db
    .prepare("SELECT id FROM messaging_groups WHERE channel_type = 'dashboard' AND platform_id = ?")
    .get(`dashboard:${folder}`) as { id: string } | undefined;
  if (primary?.id) return primary.id;
  const fallback = db
    .prepare(
      "SELECT mg.id AS id FROM messaging_groups mg JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id WHERE mga.agent_group_id = ? AND mg.channel_type = 'dashboard' LIMIT 1",
    )
    .get(agentGroupId) as { id: string } | undefined;
  return fallback?.id ?? null;
}

function toSqliteDatetime(iso: string | null | undefined): string | null {
  if (!iso) return null;
  return iso
    .replace('T', ' ')
    .replace(/\.\d{3}Z$/, '')
    .replace(/Z$/, '');
}
function getMcpManagementTokenPath(): string {
  return join(getDataDir(), '.mcp-management-token');
}
function getSkillsDir(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_SKILLS_DIR || join(getProjectRoot(), 'container', 'skills'));
}
function getChannelsDir(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_CHANNELS_DIR || join(getProjectRoot(), 'src', 'channels'));
}
function getLogsDir(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_LOGS_DIR || join(getProjectRoot(), 'logs'));
}
function getCoworkerTypesPath(): string {
  return join(getGroupsDir(), 'coworker-types.json');
}

/**
 * Sanitize an imported folder name to the same constraints enforced by
 * src/group-folder.ts#isValidGroupFolder. Mirrors its rules inline rather
 * than crossing the dashboard/src compile boundary: strip invalid chars,
 * force non-empty leading alnum, reject reserved names (`global`, `shared`,
 * `templates`, `main`). Reserved/empty names get `_imported` suffixed so
 * the follow-up collision loop can resolve them to `_imported-2`, etc.
 */
const RESERVED_GROUP_FOLDERS_DASHBOARD = new Set(['global', 'shared', 'templates', 'main']);
function sanitizeImportedFolder(raw: string): string {
  let folder = (raw || '').replace(/[^a-zA-Z0-9_-]/g, '-');
  // Folder must start with alnum (match GROUP_FOLDER_PATTERN)
  if (!/^[A-Za-z0-9]/.test(folder)) folder = `group${folder}`;
  // Truncate to 64 chars (pattern max)
  if (folder.length > 64) folder = folder.slice(0, 64);
  // Reject reserved names by appending a suffix (collision loop will finish the job)
  if (!folder || RESERVED_GROUP_FOLDERS_DASHBOARD.has(folder.toLowerCase())) {
    folder = `${folder || 'group'}_imported`;
  }
  return folder;
}
/**
 * Post-import group filesystem init. Mirrors the critical steps from
 * src/group-init.ts so that imported groups are immediately ready —
 * global symlink, settings.json, container skills, agent-runner-src.
 * Idempotent: each step is gated on target not existing.
 */
function postImportGroupInit(
  agentGroupId: string,
  folder: string,
  warnings: string[],
  containerConfig?: unknown,
): void {
  const projectRoot = getProjectRoot();
  const groupDir = join(getGroupsDir(), folder);
  const claudeSharedDir = join(getDataDir(), 'v2-sessions', agentGroupId, '.claude-shared');

  // 0. Materialize container.json — the runtime (src/container-config.ts#readContainerConfig)
  //    reads groups/<folder>/container.json, NOT the agent_groups.container_config DB column.
  //    Without this write, imported provider/mount/MCP/package/image settings are dead: the DB
  //    column holds them but nothing reads it at wake time.
  if (containerConfig && typeof containerConfig === 'object') {
    try {
      mkdirSync(groupDir, { recursive: true });
      const containerJson = join(groupDir, 'container.json');
      if (!existsSync(containerJson)) {
        writeFileSync(containerJson, JSON.stringify(containerConfig, null, 2) + '\n');
      }
    } catch (e: any) {
      warnings.push(`container.json materialize failed: ${e.message}`);
    }
  }

  // 1. (removed) .claude-global.md symlink — the flat-global @-import pattern
  //    is retired. Main's CLAUDE.md is composed on every wake with all
  //    content baked in; no runtime import symlink is needed. Legacy
  //    symlinks from older installs are cleaned up by
  //    scripts/migrate-global-to-shared.ts.

  // 2. settings.json
  mkdirSync(claudeSharedDir, { recursive: true });
  const settingsFile = join(claudeSharedDir, 'settings.json');
  if (!existsSync(settingsFile)) {
    writeFileSync(
      settingsFile,
      JSON.stringify(
        {
          preferences: { reasoningEffort: 'max' },
          env: {
            CLAUDE_CODE_ADDITIONAL_DIRECTORIES_CLAUDE_MD: '1',
            CLAUDE_CODE_DISABLE_AUTO_MEMORY: '0',
          },
        },
        null,
        2,
      ) + '\n',
    );
  }

  // 3. Container skills — merge individual skill dirs (import may have
  //    already created the parent with a subset of skills from V1 data)
  const skillsDst = join(claudeSharedDir, 'skills');
  const skillsSrc = join(projectRoot, 'container', 'skills');
  if (existsSync(skillsSrc)) {
    mkdirSync(skillsDst, { recursive: true });
    for (const skill of readdirSync(skillsSrc)) {
      const dst = join(skillsDst, skill);
      if (!existsSync(dst)) {
        try {
          cpSync(join(skillsSrc, skill), dst, { recursive: true });
        } catch (e: any) {
          warnings.push(`Skill copy '${skill}' failed: ${e.message}`);
        }
      }
    }
  }

  // 3b. Subagent definitions — mirror src/group-init.ts:85-104. Any
  //     skill or overlay directory with a sibling `agent.md` contributes
  //     a subagent; without this, imported coworkers couldn't invoke
  //     codex-critique and other overlay-backed subagents.
  const agentsDst = join(claudeSharedDir, 'agents');
  mkdirSync(agentsDst, { recursive: true });
  for (const subdir of ['skills', 'overlays']) {
    const srcRoot = join(projectRoot, 'container', subdir);
    if (!existsSync(srcRoot)) continue;
    for (const entry of readdirSync(srcRoot)) {
      const agentFile = join(srcRoot, entry, 'agent.md');
      if (existsSync(agentFile)) {
        const dst = join(agentsDst, `${entry}.md`);
        if (!existsSync(dst)) {
          try {
            copyFileSync(agentFile, dst);
          } catch (e: any) {
            warnings.push(`Subagent copy '${entry}' failed: ${e.message}`);
          }
        }
      }
    }
  }

  // 4. Agent-runner source
  const runnerDst = join(getDataDir(), 'v2-sessions', agentGroupId, 'agent-runner-src');
  if (!existsSync(runnerDst)) {
    const runnerSrc = join(projectRoot, 'container', 'agent-runner', 'src');
    if (existsSync(runnerSrc)) {
      try {
        cpSync(runnerSrc, runnerDst, { recursive: true });
      } catch (e: any) {
        warnings.push(`Agent-runner copy failed: ${e.message}`);
      }
    }
  }
}

const DASHBOARD_PORT_DEFAULT = '3737';
const DASHBOARD_READONLY_PORT_DEFAULT = '3739';
const DASHBOARD_HOST_DEFAULT = '127.0.0.1'; // localhost-only; set to 0.0.0.0 to expose on all interfaces
const MAX_CONCURRENT_CONTAINERS = Math.max(1, parseInt(process.env.MAX_CONCURRENT_CONTAINERS || '5', 10) || 5);
const DASHBOARD_INGRESS_PORT_DEFAULT = '3738';
const DASHBOARD_AUTH_COOKIE = 'nanoclaw_dashboard_auth';

// --- SQLite (read-only) ---

function openDb(): Database.Database | null {
  try {
    return new Database(getDbPath(), { readonly: true, fileMustExist: true });
  } catch {
    console.warn(`[dashboard] Cannot open DB at ${getDbPath()} — running without DB`);
    return null;
  }
}

let db: Database.Database | null = null;

// Persistent write connection (lazy-opened, reused across requests)
let writeDb: Database.Database | null = null;

function getWriteDb(): Database.Database | null {
  if (writeDb) return writeDb;
  try {
    writeDb = new Database(getDbPath(), { fileMustExist: true });
    // Self-heal the sidebar_group column so coworker creation works even on a
    // dashboard-only deploy where the host migration (023-sidebar-group) hasn't
    // run yet. Idempotent and additive — mirrors the host migration's ALTER.
    try {
      const cols = writeDb.prepare('PRAGMA table_info(agent_groups)').all() as Array<{ name: string }>;
      if (!cols.some((c) => c.name === 'sidebar_group')) {
        writeDb.exec('ALTER TABLE agent_groups ADD COLUMN sidebar_group TEXT');
      }
    } catch {
      /* column ensure is best-effort; INSERT will surface a real failure */
    }
    return writeDb;
  } catch {
    return null;
  }
}

// Lazy init of the src/ db connection so we can call shared helpers like
// refreshDestinationsForAgentGroup() which rely on getDb(). Separate handle
// from writeDb above; both target the same WAL-mode SQLite file.
let _srcDbReady = false;
function ensureSrcDb(): void {
  if (_srcDbReady) return;
  try {
    initSrcDb(getDbPath());
    _srcDbReady = true;
  } catch {
    /* already initialised in this process (e.g. tests) — getDb() will work */
    _srcDbReady = true;
  }
}

/**
 * After mutating `agent_destinations` from a dashboard handler, fire this
 * to project the change into the per-session `inbound.db` of every active
 * session for `agentGroupId`. Silently no-ops if the helper isn't available
 * (e.g. agent-to-agent module not installed).
 */
function refreshRunningSessions(agentGroupId: string): void {
  try {
    ensureSrcDb();
    // Fire-and-forget on purpose (every caller is a sync handler), but the
    // rejection MUST be caught HERE: this helper became async with the central-DB
    // refactor, so the surrounding try/catch no longer sees its failures — the
    // rejection would escape unhandled and the projection would fail silently.
    void refreshDestinationsForAgentGroup(agentGroupId).catch((err) => {
      console.warn('[dashboard] failed to refresh destinations for', agentGroupId, err);
    });
  } catch (err) {
    console.warn('[dashboard] failed to refresh destinations for', agentGroupId, err);
  }
}

function parseJsonObject(value: unknown): Record<string, any> | null {
  if (typeof value !== 'string' || !value.trim()) return null;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? (parsed as Record<string, any>) : null;
  } catch {
    return null;
  }
}

const MESSAGE_ATTACHMENT_MIME_TYPES: Record<string, string> = {
  md: 'text/markdown',
  txt: 'text/plain',
  json: 'application/json',
  slang: 'text/plain',
  cpp: 'text/plain',
  h: 'text/plain',
  py: 'text/plain',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  svg: 'image/svg+xml',
  webp: 'image/webp',
  ico: 'image/x-icon',
  bmp: 'image/bmp',
};

function getMessageAttachmentMimeType(filename: string): string {
  const ext = extname(filename).replace(/^\./, '').toLowerCase();
  return MESSAGE_ATTACHMENT_MIME_TYPES[ext] || 'application/octet-stream';
}

// Normalize any stored-timestamp shape the sessions DBs have ever written into
// a numeric epoch-ms. Known shapes:
//   • ISO UTC string:          "2026-05-05T08:05:45.526Z"
//   • SQLite datetime (UTC):   "2026-05-05 08:06:38"
//   • Numeric string / number: "1777692192745" | 1777692192745 | "1777692192745.0"
// Anything unparseable returns NaN; callers must treat NaN as "unknown" and
// avoid subtraction with it (NaN poisons a comparator — one bad row then
// bisects the whole sort).
export function timestampToEpochMs(raw: unknown): number {
  if (raw == null || raw === '') return NaN;
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : NaN;
  const s = String(raw).trim();
  if (!s) return NaN;
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    const n = Number(s);
    return Number.isFinite(n) ? n : NaN;
  }
  const hasSpace = s.includes(' ') && !s.includes('T');
  const iso = hasSpace ? s.replace(' ', 'T') + (/[Zz]|[+-]\d{2}:?\d{2}$/.test(s) ? '' : 'Z') : s;
  const parsed = Date.parse(iso);
  return Number.isNaN(parsed) ? NaN : parsed;
}

export function compareMessagesAscending(a: any, b: any): number {
  const at = timestampToEpochMs(a.timestamp);
  const bt = timestampToEpochMs(b.timestamp);
  const aBad = Number.isNaN(at);
  const bBad = Number.isNaN(bt);
  if (aBad && bBad) {
    // Both unparseable: fall through to id tiebreaker so the compare stays
    // transitive (returning 0 for many pairs breaks TimSort's partial order).
  } else if (aBad) {
    return 1; // push NaN rows to the end
  } else if (bBad) {
    return -1;
  } else if (at !== bt) {
    return at - bt;
  }
  const aid = String(a.id ?? '');
  const bid = String(b.id ?? '');
  return aid.localeCompare(bid);
}

function compareMessagesDescending(a: any, b: any): number {
  return compareMessagesAscending(b, a);
}

function buildMessageAttachments(
  agentGroupId: string,
  sessionId: string,
  messageId: string,
  fileNames: string[],
): Array<{ name: string; url: string; mime: string; isImage: boolean }> {
  const outboxDir = join(getDataDir(), 'v2-sessions', agentGroupId, sessionId, 'outbox', messageId);
  const inboxDir = join(getDataDir(), 'v2-sessions', agentGroupId, sessionId, 'inbox', messageId);
  const attachmentDir = existsSync(outboxDir) ? outboxDir : inboxDir;
  if (!existsSync(attachmentDir)) return [];

  return fileNames
    .filter((fileName) => typeof fileName === 'string' && fileName)
    .filter((fileName) => {
      const fullPath = join(attachmentDir, fileName);
      return isInsideDir(attachmentDir, fullPath) && existsSync(fullPath) && !statSync(fullPath).isDirectory();
    })
    .map((fileName) => {
      const mime = getMessageAttachmentMimeType(fileName);
      return {
        name: fileName,
        url:
          `/api/messages/attachment?agentGroupId=${encodeURIComponent(agentGroupId)}` +
          `&sessionId=${encodeURIComponent(sessionId)}` +
          `&messageId=${encodeURIComponent(messageId)}` +
          `&name=${encodeURIComponent(fileName)}`,
        mime,
        isImage: mime.startsWith('image/'),
      };
    });
}

function applyMessageOperations(messages: any[]): any[] {
  const ordered = [...messages].sort(compareMessagesAscending);
  const byPlatformMessageId = new Map<string, any>();
  const visible: any[] = [];

  for (const message of ordered) {
    if (message.direction === 'outgoing' && message.operationType === 'edit' && message.targetPlatformMessageId) {
      const target = byPlatformMessageId.get(message.targetPlatformMessageId);
      if (target) {
        target.displayContent = message.operationText || target.displayContent;
        target.edited = true;
        if (target.cardType === 'credential_request') {
          target.question = target.displayContent;
        }
        continue;
      }
    }

    if (message.direction === 'outgoing' && message.operationType === 'reaction' && message.targetPlatformMessageId) {
      const target = byPlatformMessageId.get(message.targetPlatformMessageId);
      if (target && message.emoji) {
        if (!Array.isArray(target.reactions)) target.reactions = [];
        target.reactions.push(message.emoji);
        continue;
      }
    }

    if (message.direction === 'outgoing' && message.platformMessageId) {
      byPlatformMessageId.set(message.platformMessageId, message);
    }

    visible.push(message);
  }

  return visible;
}

function normalizeMessageForDisplay(message: any): any {
  message.rawContent = message.content;
  const parsed = parseJsonObject(message.content);
  if (!parsed) {
    message.displayContent = message.content;
    return message;
  }
  message.parsedContent = parsed;
  message.displayContent =
    parsed.text || parsed.markdown || parsed.prompt || parsed.question || parsed.fallbackText || '';

  const fileNames = Array.isArray(parsed.files) ? parsed.files.filter((file: any) => typeof file === 'string') : [];
  if (fileNames.length > 0) {
    message.fileNames = fileNames;
  }

  if (parsed.operation === 'edit') {
    message.operationType = 'edit';
    message.targetPlatformMessageId = typeof parsed.messageId === 'string' ? parsed.messageId : null;
    message.operationText =
      (typeof parsed.text === 'string' && parsed.text) ||
      (typeof parsed.markdown === 'string' && parsed.markdown) ||
      '';
    message.displayContent = message.operationText || 'Edited a previous message';
  } else if (parsed.operation === 'reaction') {
    message.operationType = 'reaction';
    message.targetPlatformMessageId = typeof parsed.messageId === 'string' ? parsed.messageId : null;
    message.emoji = typeof parsed.emoji === 'string' ? parsed.emoji : null;
    message.displayContent = message.emoji ? `Reacted with ${message.emoji}` : 'Reacted to a previous message';
  } else if (!message.displayContent && fileNames.length === 0) {
    message.displayContent = message.content;
  }

  if (parsed.type === 'ask_question') {
    message.cardType = 'ask_question';
    message.questionId = typeof parsed.questionId === 'string' ? parsed.questionId : null;
    message.options = Array.isArray(parsed.options)
      ? parsed.options.filter((opt: any) => typeof opt === 'string' || (typeof opt === 'object' && opt?.label))
      : [];
  } else if (parsed.type === 'credential_request') {
    message.cardType = 'credential_request';
    message.credentialId = typeof parsed.credentialId === 'string' ? parsed.credentialId : null;
    message.question = typeof parsed.question === 'string' ? parsed.question : message.displayContent;
  } else if (parsed.type === 'card' && parsed.card && typeof parsed.card === 'object') {
    message.cardType = 'card';
    message.cardTitle = typeof parsed.card.title === 'string' ? parsed.card.title : '';
    message.cardDescription = typeof parsed.card.description === 'string' ? parsed.card.description : '';
    message.cardChildren = Array.isArray(parsed.card.children) ? parsed.card.children : [];
    message.cardActions = Array.isArray(parsed.card.actions) ? parsed.card.actions : [];
  }

  return message;
}

function getPendingQuestionRow(questionId: string): any | null {
  if (!db || !questionId) return null;
  try {
    return db.prepare('SELECT * FROM pending_questions WHERE question_id = ?').get(questionId) as any;
  } catch {
    return null;
  }
}

function getPendingCredentialRow(credentialId: string): any | null {
  if (!db || !credentialId) return null;
  try {
    return db.prepare('SELECT * FROM pending_credentials WHERE id = ?').get(credentialId) as any;
  } catch {
    return null;
  }
}

function normalizeDestinationName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'unnamed'
  );
}

function allocateDestinationNameDb(wdb: Database.Database, agentGroupId: string, preferredName: string): string {
  const baseLocalName = normalizeDestinationName(preferredName);
  let localName = baseLocalName;
  let suffix = 2;
  while (
    wdb
      .prepare('SELECT 1 FROM agent_destinations WHERE agent_group_id = ? AND local_name = ? LIMIT 1')
      .get(agentGroupId, localName)
  ) {
    localName = `${baseLocalName}-${suffix}`;
    suffix++;
  }
  return localName;
}

function getDestinationByLocalNameDb(
  wdb: Database.Database,
  agentGroupId: string,
  localName: string,
): { target_type: string; target_id: string } | undefined {
  return wdb
    .prepare(
      'SELECT target_type, target_id FROM agent_destinations WHERE agent_group_id = ? AND local_name = ? LIMIT 1',
    )
    .get(agentGroupId, localName) as { target_type: string; target_id: string } | undefined;
}

interface CoworkerTypeMetadata {
  description: string;
  allowedMcpTools: string[];
  known: boolean;
}

export function resolveCoworkerTypeMetadata(
  coworkerType: string | null,
  types: Record<string, any>,
): CoworkerTypeMetadata {
  if (!coworkerType) {
    return { description: '', allowedMcpTools: [], known: false };
  }

  const exact = types[coworkerType];
  if (exact) {
    return {
      description: exact.description || '',
      allowedMcpTools: Array.isArray(exact.allowedMcpTools) ? exact.allowedMcpTools : [],
      known: true,
    };
  }

  const roles = coworkerType
    .split('+')
    .map((role) => role.trim())
    .filter(Boolean);
  if (roles.length === 0) {
    return { description: '', allowedMcpTools: [], known: false };
  }

  const descriptions: string[] = [];
  const allowed = new Set<string>();
  let known = true;
  for (const role of roles) {
    const entry = types[role];
    if (!entry) {
      known = false;
      descriptions.push(role);
      continue;
    }
    descriptions.push(entry.description || role);
    if (Array.isArray(entry.allowedMcpTools)) {
      for (const tool of entry.allowedMcpTools) allowed.add(tool);
    }
  }

  return {
    description: descriptions.join(' + '),
    allowedMcpTools: [...allowed],
    known,
  };
}

/**
 * Ensure a trigger pattern is unique across all messaging_group_agents.
 * If the candidate already exists (for a different agent), appends a numeric suffix.
 */
export function getUniqueTrigger(db: Database.Database, candidate: string, excludeAgentGroupId?: string): string {
  const existing = db
    .prepare('SELECT mga.agent_group_id, mga.engage_mode, mga.engage_pattern FROM messaging_group_agents mga')
    .all() as { agent_group_id: string; engage_mode: string | null; engage_pattern: string | null }[];

  const usedPatterns = new Set<string>();
  for (const row of existing) {
    if (excludeAgentGroupId && row.agent_group_id === excludeAgentGroupId) continue;
    if (!row.engage_pattern) continue;
    if (row.engage_mode === 'pattern' && row.engage_pattern) usedPatterns.add(row.engage_pattern);
  }

  if (!usedPatterns.has(candidate)) return candidate;

  // Also check prefix collisions: @Slang would collide with @SlangBuild
  // and @SlangBuild would collide with @Slang (either direction)
  const candidateLower = candidate.toLowerCase();
  for (const used of usedPatterns) {
    const usedLower = used.toLowerCase();
    if (candidateLower.startsWith(usedLower) || usedLower.startsWith(candidateLower)) {
      // Prefix collision — need a different trigger
      let suffix = 2;
      let attempt = `${candidate}${suffix}`;
      while (usedPatterns.has(attempt)) {
        suffix++;
        attempt = `${candidate}${suffix}`;
      }
      return attempt;
    }
  }

  return candidate;
}

export function ensureDashboardChatWiring(
  wdb: Database.Database,
  group: { id: string; folder: string; name: string },
  triggerPattern: string,
  now = new Date().toISOString(),
): { messagingGroupId: string } {
  const platformId = `dashboard:${group.folder}`;
  let mg = wdb
    .prepare(
      "SELECT id, name, channel_type, platform_id FROM messaging_groups WHERE channel_type = 'dashboard' AND platform_id = ?",
    )
    .get(platformId) as { id: string; name: string | null; channel_type: string; platform_id: string } | undefined;

  // Also check if this agent already has ANY dashboard messaging group (prevents
  // duplicates when register step used a different platform_id than the folder-based one).
  if (!mg) {
    mg = wdb
      .prepare(
        `SELECT mg.id, mg.name, mg.channel_type, mg.platform_id FROM messaging_groups mg
         JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
         WHERE mg.channel_type = 'dashboard' AND mga.agent_group_id = ? LIMIT 1`,
      )
      .get(group.id) as typeof mg;
  }

  if (!mg) {
    mg = {
      id: `mg-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      name: group.name,
      channel_type: 'dashboard',
      platform_id: platformId,
    };
    wdb
      .prepare(
        "INSERT INTO messaging_groups (id, channel_type, platform_id, instance, name, is_group, unknown_sender_policy, created_at) VALUES (?, 'dashboard', ?, 'dashboard', ?, 0, 'public', ?)",
      )
      .run(mg.id, platformId, group.name, now);
  }

  // Dashboard wirings use per-thread sessions so each Slack-style thread
  // spawns its own isolated agent session. Upgrade existing rows in-place;
  // first /api/chat/send after deploy self-heals pre-existing 'shared' rows.
  wdb
    .prepare(
      "UPDATE messaging_group_agents SET session_mode = 'per-thread' WHERE messaging_group_id = ? AND agent_group_id = ? AND session_mode <> 'per-thread'",
    )
    .run(mg.id, group.id);

  const existingMga = wdb
    .prepare('SELECT 1 FROM messaging_group_agents WHERE messaging_group_id = ? AND agent_group_id = ? LIMIT 1')
    .get(mg.id, group.id);
  if (!existingMga) {
    wdb
      .prepare(
        "INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, session_mode, priority, created_at) VALUES (?, ?, ?, 'always', ?, 'all', 'per-thread', 0, ?)",
      )
      .run(`mga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, mg.id, group.id, triggerPattern, now);
  }

  const existingDestination = wdb
    .prepare(
      "SELECT 1 FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'channel' AND target_id = ? LIMIT 1",
    )
    .get(group.id, mg.id);
  if (!existingDestination) {
    const preferredName = mg.name ? `${mg.name}-${mg.channel_type}` : `${mg.channel_type}-${mg.platform_id.slice(-8)}`;
    const localName = allocateDestinationNameDb(wdb, group.id, preferredName);
    wdb
      .prepare(
        "INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id, created_at) VALUES (?, ?, 'channel', ?, ?)",
      )
      .run(group.id, localName, mg.id, now);
  }

  return { messagingGroupId: mg.id };
}

function bootstrapEagerSession(
  wdb: Database.Database,
  agentGroupId: string,
  messagingGroupId: string,
  now = new Date().toISOString(),
): void {
  const sessId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  try {
    wdb
      .prepare(
        "INSERT INTO sessions (id, agent_group_id, messaging_group_id, thread_id, status, container_status, created_at) VALUES (?, ?, ?, NULL, 'active', 'stopped', ?)",
      )
      .run(sessId, agentGroupId, messagingGroupId, now);
  } catch {
    return;
  }
  const dataDir = join(getProjectRoot(), 'data');
  const sessDir = join(dataDir, 'v2-sessions', agentGroupId, sessId);
  mkdirSync(sessDir, { recursive: true });
  for (const [file, schema] of [
    ['inbound.db', 'inbound'],
    ['outbound.db', 'outbound'],
  ] as const) {
    const dbPath = join(sessDir, file);
    const sdb = new Database(dbPath);
    sdb.pragma('journal_mode = DELETE');
    sdb.exec(
      schema === 'inbound'
        ? `CREATE TABLE IF NOT EXISTS messages_in (id TEXT PRIMARY KEY, seq INTEGER UNIQUE, kind TEXT NOT NULL, timestamp TEXT NOT NULL, status TEXT DEFAULT 'pending', process_after TEXT, recurrence TEXT, series_id TEXT, tries INTEGER DEFAULT 0, trigger INTEGER NOT NULL DEFAULT 1, platform_id TEXT, channel_type TEXT, thread_id TEXT, content TEXT NOT NULL);
           CREATE INDEX IF NOT EXISTS idx_messages_in_series ON messages_in(series_id);
           CREATE TABLE IF NOT EXISTS delivered (message_out_id TEXT PRIMARY KEY, platform_message_id TEXT, status TEXT NOT NULL DEFAULT 'delivered', delivered_at TEXT NOT NULL);
           CREATE TABLE IF NOT EXISTS destinations (name TEXT PRIMARY KEY, display_name TEXT, type TEXT NOT NULL, channel_type TEXT, platform_id TEXT, agent_group_id TEXT);
           CREATE TABLE IF NOT EXISTS session_routing (id INTEGER PRIMARY KEY CHECK (id = 1), channel_type TEXT, platform_id TEXT, thread_id TEXT);`
        : `CREATE TABLE IF NOT EXISTS messages_out (id TEXT PRIMARY KEY, seq INTEGER UNIQUE, in_reply_to TEXT, timestamp TEXT NOT NULL, deliver_after TEXT, recurrence TEXT, kind TEXT NOT NULL, platform_id TEXT, channel_type TEXT, thread_id TEXT, content TEXT NOT NULL);
           CREATE TABLE IF NOT EXISTS processing_ack (message_id TEXT PRIMARY KEY, status TEXT NOT NULL, status_changed TEXT NOT NULL);`,
    );
    sdb.close();
  }
}

function readProjectEnvValue(key: string): string | null {
  try {
    const envContent = readFileSync(join(getProjectRoot(), '.env'), 'utf-8');
    const match = envContent.match(new RegExp(`^${key}=([^\\n]+)$`, 'm'));
    return match ? match[1].trim().replace(/^['"]|['"]$/g, '') : null;
  } catch {
    return null;
  }
}

function getDashboardIngressBaseUrl(): string {
  const explicitPort =
    process.env.DASHBOARD_INGRESS_PORT ||
    readProjectEnvValue('DASHBOARD_INGRESS_PORT') ||
    DASHBOARD_INGRESS_PORT_DEFAULT;
  return `http://127.0.0.1:${explicitPort}`;
}

function getDashboardPort(): number {
  return parseInt(process.env.DASHBOARD_PORT || readProjectEnvValue('DASHBOARD_PORT') || DASHBOARD_PORT_DEFAULT, 10);
}

function getDashboardReadOnlyPort(): number {
  return parseInt(
    process.env.DASHBOARD_READONLY_PORT ||
      readProjectEnvValue('DASHBOARD_READONLY_PORT') ||
      DASHBOARD_READONLY_PORT_DEFAULT,
    10,
  );
}

function getDashboardHost(): string {
  return process.env.DASHBOARD_HOST || DASHBOARD_HOST_DEFAULT;
}

function getDashboardSecret(): string {
  return process.env.DASHBOARD_SECRET || readProjectEnvValue('DASHBOARD_SECRET') || '';
}

function getAllowedV1ImportRoot(): string {
  return resolve(process.env.NANOCLAW_DASHBOARD_V1_IMPORT_ROOT || '/home');
}

function parseCookies(req: import('http').IncomingMessage): Record<string, string> {
  const header = req.headers.cookie || '';
  const cookies: Record<string, string> = {};
  for (const part of header.split(';')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!key) continue;
    cookies[key] = decodeURIComponent(value);
  }
  return cookies;
}

function buildAuthCookie(secret: string, clear = false): string {
  const parts = [
    `${DASHBOARD_AUTH_COOKIE}=${clear ? '' : encodeURIComponent(secret)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Strict',
  ];
  if (clear) {
    parts.push('Max-Age=0');
  } else {
    parts.push('Max-Age=43200');
  }
  return parts.join('; ');
}

function isDashboardAuthenticated(req: import('http').IncomingMessage, secret = getDashboardSecret()): boolean {
  if (!secret) return true;
  const auth = req.headers.authorization || '';
  if (auth === `Bearer ${secret}`) return true;
  const cookies = parseCookies(req);
  return cookies[DASHBOARD_AUTH_COOKIE] === secret;
}

// --- State snapshot ---

interface CoworkerState {
  folder: string;
  agentGroupId: string | null;
  name: string;
  type: string;
  description: string;
  status: 'idle' | 'active' | 'working' | 'error' | 'thinking';
  currentTask: string | null;
  lastActivity: string | null;
  taskCount: number;
  color: string;
  // live hook data
  lastToolUse: string | null;
  lastNotification: string | null;
  hookTimestamp: number | null;
  subagents: SubagentState[];
  isAutoUpdate: boolean;
  allowedMcpTools: string[];
  disallowedMcpTools: string[];
  overlays: string[];
  lastMessageTs: string | null;
  // Context indicator: token usage
  contextTokens: number | null;
  maxContextTokens: number | null;
  contextUsagePercent: number | null;
  cacheHitPercent: number | null;
  contextModel: string | null;
  // Context indicator: composition breakdown
  spineSkillCount: number | null;
  spineWorkflowCount: number | null;
  spineOverlayCount: number | null;
  spineContextCount: number | null;
  spineInvariantCount: number | null;
  spineToolCount: number | null;
  spineSkills: string[] | null;
  spineWorkflows: string[] | null;
  spineOverlays: string[] | null;
  spineTools: string[] | null;
  spineInvariants: string[] | null;
  spineContextFragments: string[] | null;
}

interface SubagentState {
  agentId: string;
  agentType: string | null;
  phase: 'active' | 'leaving';
  status: 'idle' | 'active' | 'working' | 'error' | 'thinking';
  lastToolUse: string | null;
  lastNotification: string | null;
  startedAt: number;
  lastActivity: number;
  sessionId: string | null;
  exitAt: number | null;
}

interface DashboardState {
  coworkers: CoworkerState[];
  tasks: any[];
  taskRunLogs: any[];
  registeredGroups: any[];
  timestamp: number;
  lastHookEventId: number;
}

interface HookEvent {
  id?: number;
  group: string;
  agent_group_id?: string;
  event: string;
  tool?: string;
  message?: string;
  tool_input?: string;
  tool_response?: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
  tool_use_id?: string;
  transcript_path?: string;
  cwd?: string;
  extra?: Record<string, any>;
  timestamp: number;
}

interface HookEventSummary {
  id?: number;
  group: string;
  agent_group_id?: string;
  event: string;
  tool?: string;
  message?: string;
  session_id?: string;
  agent_id?: string;
  agent_type?: string;
  tool_use_id?: string;
  transcript_path?: string;
  cwd?: string;
  extra?: Record<string, unknown>;
  timestamp: number;
  has_details: boolean;
}

const HOOK_SUMMARY_MESSAGE_LIMIT = 1_000;
const HOOK_SUMMARY_EXTRA_FIELDS = 8;
const HOOK_SUMMARY_EXTRA_VALUE_LIMIT = 256;

function truncateHookSummaryText(value: string | undefined, limit: number): string | undefined {
  if (!value) return undefined;
  return value.length <= limit ? value : `${value.slice(0, limit)}…`;
}

function summarizeHookExtra(extra: Record<string, any> | undefined): Record<string, unknown> | undefined {
  if (!extra) return undefined;
  const summary: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(extra).slice(0, HOOK_SUMMARY_EXTRA_FIELDS)) {
    if (value === null || typeof value === 'number' || typeof value === 'boolean') {
      summary[key] = value;
    } else if (typeof value === 'string') {
      summary[key] = truncateHookSummaryText(value, HOOK_SUMMARY_EXTRA_VALUE_LIMIT);
    }
  }
  return Object.keys(summary).length > 0 ? summary : undefined;
}

function toHookEventSummary(event: HookEvent, hasDetails = false): HookEventSummary {
  const summarizedExtra = summarizeHookExtra(event.extra);
  const message = truncateHookSummaryText(event.message, HOOK_SUMMARY_MESSAGE_LIMIT);
  return {
    id: event.id,
    group: event.group,
    agent_group_id: event.agent_group_id,
    event: event.event,
    tool: event.tool,
    message,
    session_id: event.session_id,
    agent_id: event.agent_id,
    agent_type: event.agent_type,
    tool_use_id: event.tool_use_id,
    transcript_path: event.transcript_path,
    cwd: event.cwd,
    extra: summarizedExtra,
    timestamp: event.timestamp,
    has_details:
      hasDetails ||
      !!event.tool_input ||
      !!event.tool_response ||
      message !== event.message ||
      JSON.stringify(summarizedExtra ?? {}) !== JSON.stringify(event.extra ?? {}),
  };
}

function parseHookExtra(value: unknown): Record<string, any> | undefined {
  if (!value) return undefined;
  if (typeof value === 'object') return value as Record<string, any>;
  if (typeof value !== 'string') return undefined;
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : undefined;
  } catch {
    return undefined;
  }
}

// Keep only compact metadata in memory. Full tool inputs and responses remain
// in SQLite and are fetched lazily when a timeline row is expanded.
const hookEvents: HookEventSummary[] = [];
// In-memory ring buffer cap raised 200 → 5000 on 2026-05-29: an active
// install with bursty a2a fan-outs (slang chains during a fix run) emits
// 700-900 events/hour. The old 200 cap meant the timeline-bootstrap state
// only spanned ~13 minutes during peaks, so a webhook from 6 hours ago
// (e.g. issue #11349) wasn't in the bootstrap and required ~70 "Load older"
// clicks at 100/click to reach. 5000 ≈ 8 h on a busy day.
//
// The ring contains summaries only. Full event bodies live in hook_events.
const MAX_HOOK_EVENTS = 5000;

const RECENT_HOOK_EVENT_LIMIT = 200;

// Hook events DB (write connection, lazy-opened)
let hookEventsDb: Database.Database | null = null;

function getHookEventsDb(): Database.Database | null {
  if (hookEventsDb) return hookEventsDb;
  try {
    hookEventsDb = new Database(getDbPath(), { fileMustExist: true });
    hookEventsDb.pragma('journal_mode = WAL');
    // hook_events table is created by migration 007 in the v2 central DB.
    return hookEventsDb;
  } catch {
    return null;
  }
}

// Bootstrap ring buffer from DB so timeline has history after restart
function bootstrapHookEvents(): void {
  const db = getHookEventsDb();
  if (!db) return;
  try {
    const rows = db
      .prepare(
        `SELECT he.id, he.group_folder, ag.id AS agent_group_id, he.event, he.tool, he.tool_use_id,
                substr(he.message, 1, ${HOOK_SUMMARY_MESSAGE_LIMIT}) AS message,
                he.session_id, he.agent_id, he.agent_type, he.transcript_path, he.cwd,
                CASE WHEN length(he.extra) <= 2048 THEN he.extra ELSE NULL END AS extra,
                he.timestamp,
                CASE WHEN he.tool_input IS NOT NULL
                        OR he.tool_response IS NOT NULL
                        OR length(he.message) > ${HOOK_SUMMARY_MESSAGE_LIMIT}
                        OR length(he.extra) > 2048
                     THEN 1 ELSE 0 END AS has_details
           FROM hook_events he
           LEFT JOIN agent_groups ag ON ag.folder = he.group_folder
          ORDER BY he.timestamp DESC LIMIT ?`,
      )
      .all(MAX_HOOK_EVENTS) as any[];
    for (const row of rows.reverse()) {
      hookEvents.push(
        toHookEventSummary(
          {
            id: row.id,
            group: row.group_folder,
            agent_group_id: row.agent_group_id || undefined,
            event: row.event,
            tool: row.tool || undefined,
            tool_use_id: row.tool_use_id || undefined,
            message: row.message || undefined,
            session_id: row.session_id || undefined,
            agent_id: row.agent_id || undefined,
            agent_type: row.agent_type || undefined,
            transcript_path: row.transcript_path || undefined,
            cwd: row.cwd || undefined,
            extra: parseHookExtra(row.extra),
            timestamp: row.timestamp,
          },
          !!row.has_details,
        ),
      );
    }
  } catch {
    /* DB not ready yet — buffer stays empty, events will arrive live */
  }
}
bootstrapHookEvents();

// Last message timestamp cache (group_folder -> ISO timestamp)
const lastMessageTsCache = new Map<string, string>();

// Live per-session cost-cap/ceiling state (dash-1 set-ceiling-v2), keyed by
// session id. Fed by the scan worker's `costCaps` deltas when it's active, or
// by this file's own main-thread fallback (pickLatestMessageTs below) when the
// worker is unavailable — same dual-path shape as lastMessageTsCache/
// activityDataCache above. /api/sessions joins this map for EVERY session,
// independent of the `period` query param: that's what fixes "a session's live
// ceiling disappears when you change the day-window filter" (the old code only
// read cost_cap when the SELECTED PERIOD's priced cost was positive). See
// session-cost-caps.ts for the entry shape and blob-parsing.
const sessionCostCapsMap = new Map<string, SessionCostCapEntry>();

// Fleet-scan timer handles at module scope so the scan worker (dash-perf round
// 2) can stop them on handoff and restart them on fallback. When the worker is
// active these are cleared and the corresponding caches are fed by worker deltas
// instead; under VITEST (no worker) the timers are the live path.
let msgTsTimer: ReturnType<typeof setInterval> | undefined;
let activityTimer: ReturnType<typeof setInterval> | undefined;

// Per-file mtime gate for refreshMessageTimestamps: session DBs use
// journal_mode=DELETE (writes land in the main .db file, so its mtime advances
// on every commit — see container/agent-runner/src/db/connection.ts). We stat
// the file (cheap) and only re-open+query it when the mtime changed since the
// last poll; an idle session costs one stat instead of a full sqlite open.
// This is what makes a 1s poll cheaper than the old 3s full-open sweep.
// `costCapRaw` (outbound paths only) mirrors the scan worker's per-file cache —
// see pickLatestMessageTs.
const msgTsFileCache = new Map<string, { mtimeMs: number; ts: string | null; costCapRaw?: string | null }>();

/** Apply one session's freshly-read (or cache-reused) cost_cap raw text to the
 *  shared map. `raw === null` means "no cost_cap key on this build/session" —
 *  removes any existing entry rather than leaving a stale one behind. */
function applyMainThreadCostCap(sessionId: string, agentGroupId: string, raw: string | null, mtimeMs: number): void {
  const entry = raw ? buildCostCapEntry(agentGroupId, parseCostCapBlob(raw), new Date(mtimeMs).toISOString()) : null;
  if (entry) sessionCostCapsMap.set(sessionId, entry);
  else sessionCostCapsMap.delete(sessionId);
}

function pickLatestMessageTs(
  current: string | null,
  dbPath: string,
  table: 'messages_in' | 'messages_out',
  // Set only for the outbound call site: reading cost_cap only makes sense for
  // outbound.db, and passing this drives applyMainThreadCostCap in the SAME
  // open used for the message-timestamp read (don't open the DB twice).
  costCapSink?: { sessionId: string; agentGroupId: string },
): string | null {
  let ts: string | null;
  try {
    const mtimeMs = statSync(dbPath).mtimeMs; // throws if the file doesn't exist
    const cached = msgTsFileCache.get(dbPath);
    if (cached && cached.mtimeMs === mtimeMs) {
      ts = cached.ts; // unchanged since last poll — reuse, skip the open
      if (costCapSink) {
        applyMainThreadCostCap(costCapSink.sessionId, costCapSink.agentGroupId, cached.costCapRaw ?? null, mtimeMs);
      }
    } else {
      const sdb = new Database(dbPath, { readonly: true });
      const row = sdb.prepare(`SELECT timestamp FROM ${table} ORDER BY timestamp DESC LIMIT 1`).get() as any;
      let costCapRaw: string | null = null;
      if (costCapSink) {
        try {
          const cols = sdb.prepare('PRAGMA table_info(session_state)').all() as Array<{ name: string }>;
          if (cols.some((c) => c.name === 'value')) {
            const capRow = sdb.prepare("SELECT value FROM session_state WHERE key = 'cost_cap'").get() as
              | { value: string }
              | undefined;
            if (capRow?.value) costCapRaw = capRow.value;
          }
        } catch {
          /* session_state absent/unreadable on this build — not fatal to the ts read */
        }
      }
      sdb.close();
      ts = (row?.timestamp as string | undefined) ?? null;
      msgTsFileCache.set(dbPath, { mtimeMs, ts, costCapRaw });
      if (costCapSink) applyMainThreadCostCap(costCapSink.sessionId, costCapSink.agentGroupId, costCapRaw, mtimeMs);
    }
  } catch {
    return current; // missing/unreadable → treat as no change
  }
  if (!ts) return current;
  if (!current) return ts;
  return Date.parse(ts) > Date.parse(current) ? ts : current;
}

function refreshMessageTimestamps(): void {
  if (!db) return;
  const next = new Map<string, string>();
  const liveSessionIds = new Set<string>();
  try {
    const groups = db.prepare('SELECT id, folder FROM agent_groups').all() as { id: string; folder: string }[];
    for (const group of groups) {
      let maxTs: string | null = null;
      const sessions = db.prepare('SELECT id FROM sessions WHERE agent_group_id = ?').all(group.id) as { id: string }[];
      const sessionsDir = join(getDataDir(), 'v2-sessions', group.id);
      for (const sess of sessions) {
        liveSessionIds.add(sess.id);
        maxTs = pickLatestMessageTs(maxTs, join(sessionsDir, sess.id, 'inbound.db'), 'messages_in');
        maxTs = pickLatestMessageTs(maxTs, join(sessionsDir, sess.id, 'outbound.db'), 'messages_out', {
          sessionId: sess.id,
          agentGroupId: group.id,
        });
      }
      if (maxTs) next.set(group.folder, maxTs);
    }
    lastMessageTsCache.clear();
    for (const [folder, ts] of next.entries()) lastMessageTsCache.set(folder, ts);
    // Tombstone cost-cap entries for sessions that no longer exist. Safe here
    // because this loop is a COMPLETE enumeration of every live session on
    // EVERY call (unlike the scan worker's hot/cold per-file cadence) — a
    // session absent from this pass is genuinely gone, not just not-yet-due
    // for a recheck. Mirrors the scan worker's own inventory-pruning (see
    // refreshInventory in scan-worker.mjs).
    for (const sessionId of sessionCostCapsMap.keys()) {
      if (!liveSessionIds.has(sessionId)) sessionCostCapsMap.delete(sessionId);
    }
  } catch {
    /* DB not ready */
  }
}
refreshMessageTimestamps();
// Poll every 1s — agent-originated messages (a2a replies, fix reports, peer-review
// verdicts) write to outbound.db inside container subprocesses; the dashboard has no
// direct hook, so we rely on this poll to surface new activity to the unread badge
// and drive the coworker-chat auto-refresh (app.js keys on lastMessageTs). The poll
// is now mtime-gated (pickLatestMessageTs), so an idle session is a cheap stat rather
// than a sqlite open — 1s is both snappier than the old 3s and lighter on disk I/O.
if (!process.env.VITEST) {
  msgTsTimer = setInterval(refreshMessageTimestamps, 1000);
  msgTsTimer.unref?.();
}

// ---------- JSONL discovery (projects + skill transcripts) ----------
function collectClaudeJsonlFiles(claudeSharedDir: string): string[] {
  const files: string[] = [];
  const walk = (dir: string): void => {
    try {
      for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const full = join(dir, entry.name);
        if (entry.isDirectory()) walk(full);
        else if (entry.name.endsWith('.jsonl')) files.push(full);
      }
    } catch {
      /* skip */
    }
  };
  const projectsDir = join(claudeSharedDir, 'projects');
  if (existsSync(projectsDir)) walk(projectsDir);
  const skillsDir = join(claudeSharedDir, 'skills');
  try {
    for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skill.isDirectory()) continue;
      const txDir = join(skillsDir, skill.name, 'transcripts');
      if (existsSync(txDir)) walk(txDir);
    }
  } catch {
    /* skills dir may not exist */
  }
  return files;
}

// ---------- Context window cache (token usage per coworker) ----------
interface ContextWindowInfo {
  contextTokens: number;
  outputTokens: number;
  cacheReadTokens: number;
  cacheCreationTokens: number;
  maxContext: number;
  usagePercent: number;
  cacheHitPercent: number;
  model: string;
}
function modelMaxContext(model: string): number {
  // The 1M-context variants carry a [1m] marker in the model id
  // (e.g. bedrock-claude-opus-4-8[1m]); that suffix is the authoritative signal.
  if (model.includes('[1m]')) return 1000000;
  if (model.includes('opus-4-8')) return 1000000;
  if (model.includes('opus-4-7')) return 1000000;
  if (model.includes('opus-4-6')) return 200000;
  if (model.includes('sonnet-5')) return 200000;
  if (model.includes('sonnet-4')) return 200000;
  if (model.includes('haiku')) return 200000;
  return 200000;
}
const contextWindowCache = new Map<string, ContextWindowInfo>();
// dash-perf round 2: remember which (newest-file path, mtime) produced each
// group's current contextWindowCache entry, so an idle group whose newest
// transcript hasn't advanced is a single stat rather than a full file re-read +
// reverse-scan every 10s. Only the group whose active transcript actually grew
// pays the read.
const ctxWindowFileCache = new Map<string, { path: string; mtimeMs: number }>();

function refreshContextWindowCache(): void {
  if (!db) return;
  try {
    const groups = db.prepare('SELECT id, folder FROM agent_groups').all() as { id: string; folder: string }[];
    const sessionsDir = join(getDataDir(), 'v2-sessions');
    for (const group of groups) {
      const claudeShared = join(sessionsDir, group.id, '.claude-shared');
      const jsonlFiles = collectClaudeJsonlFiles(claudeShared);
      if (jsonlFiles.length === 0) continue;

      // Stat each candidate exactly once (the old comparator called statSync
      // twice per comparison → O(F log F) stats every 10s per group), then pick
      // the single newest file.
      let newestPath = '';
      let newestMtime = -1;
      for (const f of jsonlFiles) {
        let m: number;
        try {
          m = statSync(f).mtimeMs;
        } catch {
          continue;
        }
        if (m > newestMtime) {
          newestMtime = m;
          newestPath = f;
        }
      }
      if (!newestPath) continue;

      // mtime-gate: skip the read+parse when the newest transcript is unchanged
      // since we last parsed it for this group.
      const gate = ctxWindowFileCache.get(group.folder);
      if (gate && gate.path === newestPath && gate.mtimeMs === newestMtime) continue;

      // Read FIRST, commit the gate only on success. Committing up front made a
      // transient read failure permanent: the (path, mtime) would already be
      // recorded as processed, so every later tick short-circuits on the
      // unchanged file and the stale context reading sticks until the transcript
      // happens to grow again.
      let content: string;
      try {
        content = readFileSync(newestPath, 'utf-8');
      } catch {
        continue; // leave the previous gate in place → retried next tick
      }
      ctxWindowFileCache.set(group.folder, { path: newestPath, mtimeMs: newestMtime });

      const lines = content.split('\n');
      for (let i = lines.length - 1; i >= 0; i--) {
        if (!lines[i].trim()) continue;
        try {
          const r = JSON.parse(lines[i]);
          if (r.type === 'assistant' && r.message?.usage) {
            const u = r.message.usage;
            const model = r.message.model || 'unknown';
            const inputTokens = u.input_tokens || 0;
            const cacheRead = u.cache_read_input_tokens || 0;
            const cacheCreation = u.cache_creation_input_tokens || 0;
            const ctx = inputTokens + cacheRead + cacheCreation;
            const maxCtx = modelMaxContext(model);
            contextWindowCache.set(group.folder, {
              contextTokens: ctx,
              outputTokens: u.output_tokens || 0,
              cacheReadTokens: cacheRead,
              cacheCreationTokens: cacheCreation,
              maxContext: maxCtx,
              usagePercent: maxCtx > 0 ? Math.round((ctx / maxCtx) * 100) : 0,
              cacheHitPercent: ctx > 0 ? Math.round((cacheRead / ctx) * 100) : 0,
              model,
            });
            break;
          }
        } catch {
          /* skip line */
        }
      }
    }
  } catch {
    /* DB not ready */
  }
}
refreshContextWindowCache();
if (!process.env.VITEST) {
  const ctxTimer = setInterval(refreshContextWindowCache, 10000);
  ctxTimer.unref?.();
}

// ---------- Context-usage stats per coworker (compactions + peak histogram) ----------
// Distinct from contextWindowCache (which only snapshots the *latest* turn): this
// scans every session transcript for a group and answers "how hard is this
// coworker pushing context?" — how often it compacts, and the distribution of
// per-session peak context. Feeds the "Context" column in the By-Coworker table.
interface ContextStats {
  sessions: number; // transcript files that had at least one usage/compaction signal
  compactions: number; // total compact_boundary events
  autoCompactions: number;
  manualCompactions: number;
  avgPreTokens: number; // mean context size (tokens) at the moment of compaction
  avgPeakContext: number; // mean per-session peak context tokens
  avgPeakPct: number; // avgPeakContext as % of model max context
  maxContext: number; // model context window used for the % scale
  histogram: number[]; // per-session peak-context% distribution, 5 buckets
  capped: boolean; // true if the transcript scan hit the per-group file cap
}
// Peak-context% buckets: <25, 25–50, 50–75, 75–90, 90%+. The last two are narrow
// on purpose — that's where compaction risk lives and where the signal matters.
const CONTEXT_HIST_BUCKETS = [0.25, 0.5, 0.75, 0.9, Infinity];
const MAX_CONTEXT_FILES_PER_GROUP = 400; // bound the scan on very long-lived groups
// Period windows for the Context column — the SAME day-based windows the cost
// columns use (see the ccusage refresh + `within` at the cost path). 'all' = no
// filter. Keeping the cutoffs identical (via ccusageSinceDate) means the two
// columns agree on window boundaries by construction.
type ContextPeriod = '1d' | '7d' | '30d' | 'all';
const CONTEXT_PERIODS: ContextPeriod[] = ['1d', '7d', '30d', 'all'];
// Signal with no/invalid timestamp buckets here — never passes `>=` a real
// YYYYMMDD cutoff, so it lands only in 'all'.
const MISSING_TS_KEY = '00000000';
// One transcript day's worth of signal, keyed YYYYMMDD. Per-day granularity is
// exactly enough to reconstruct any of the day-based period windows without
// re-reading the (append-only, mtime-cached) file.
interface DayContextAgg {
  peak: number; // max (input + cache_read + cache_creation) across that day's assistant turns
  compactions: number;
  auto: number;
  manual: number;
  preTokensSum: number;
}
interface PerFileContext {
  mtimeMs: number;
  days: Map<string, DayContextAgg>; // YYYYMMDD -> that day's aggregate
  maxWindow: number; // max model context window seen in this file (0 if none)
  hadSignal: boolean;
}
// "2026-07-10T19:20:34.405Z" -> "20260710". Matches the cost columns' YYYYMMDD
// format; ISO YYYY-MM-DD is fixed-width big-endian, so lexical `>=` == numeric.
// No Date parsing.
function isoDayKey(ts: unknown): string | null {
  if (typeof ts !== 'string' || ts.length < 10) return null;
  return ts.slice(0, 10).replace(/-/g, '');
}
function contextDayAgg(out: PerFileContext, key: string): DayContextAgg {
  let d = out.days.get(key);
  if (!d) {
    d = { peak: 0, compactions: 0, auto: 0, manual: 0, preTokensSum: 0 };
    out.days.set(key, d);
  }
  return d;
}
// Per-file cache keyed by path: transcripts are append-only, so a file whose mtime
// is unchanged never needs re-parsing. Only the active session file (which grows
// each turn) is re-read on a given cycle.
const perFileContextCache = new Map<string, PerFileContext>();
// Per group, one ContextStats per period ('1d'|'7d'|'30d'|'all'); null when the
// group has no in-window signal for that period.
const contextStatsCache = new Map<string, Record<ContextPeriod, ContextStats | null>>();

function scanFileContext(path: string, mtimeMs: number): PerFileContext {
  const cached = perFileContextCache.get(path);
  if (cached && cached.mtimeMs === mtimeMs) return cached;
  const out: PerFileContext = {
    mtimeMs,
    days: new Map(),
    maxWindow: 0,
    hadSignal: false,
  };
  try {
    const lines = readFileSync(path, 'utf-8').split('\n');
    for (const line of lines) {
      if (!line.trim()) continue;
      // Cheap pre-filter before JSON.parse — most lines are neither.
      if (line.indexOf('"usage"') < 0 && line.indexOf('compact_boundary') < 0) continue;
      let r: Record<string, unknown>;
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      if (r.type === 'system' && r.subtype === 'compact_boundary') {
        const m = (r.compactMetadata || {}) as { trigger?: string; preTokens?: number };
        const d = contextDayAgg(out, isoDayKey(r.timestamp) ?? MISSING_TS_KEY);
        d.compactions++;
        if (m.trigger === 'manual') d.manual++;
        else d.auto++;
        d.preTokensSum += m.preTokens || 0;
        out.hadSignal = true;
        continue;
      }
      const msg = r.message as { usage?: Record<string, number>; model?: string } | undefined;
      if (r.type === 'assistant' && msg?.usage) {
        const u = msg.usage;
        const ctx = (u.input_tokens || 0) + (u.cache_read_input_tokens || 0) + (u.cache_creation_input_tokens || 0);
        const d = contextDayAgg(out, isoDayKey(r.timestamp) ?? MISSING_TS_KEY);
        if (ctx > d.peak) d.peak = ctx;
        // Track the LARGEST window across models used — a session's effective
        // context is the 1M Opus window whenever any turn runs on it, even if a
        // later turn hands off to a 200k model (sonnet/haiku/gpt). Scaling to the
        // last-seen model would understate the window and inflate the peak %.
        // File-level (period-independent): the % scale stays fixed across periods.
        if (msg.model) out.maxWindow = Math.max(out.maxWindow, modelMaxContext(msg.model));
        out.hadSignal = true;
      }
    }
  } catch {
    /* unreadable file — treat as no signal */
  }
  perFileContextCache.set(path, out);
  return out;
}

// Per-period accumulator over a group's sessions. One per ContextPeriod.
interface ContextAcc {
  peaks: number[];
  compactions: number;
  auto: number;
  manual: number;
  preTokensSum: number;
  preTokensCount: number;
  sessions: number;
}
function newContextAcc(): ContextAcc {
  return { peaks: [], compactions: 0, auto: 0, manual: 0, preTokensSum: 0, preTokensCount: 0, sessions: 0 };
}
// Fold one accumulator into a ContextStats. maxContext is passed in (fixed across
// periods) so the % scale/histogram bucketing stay comparable when toggling
// periods. Math mirrors the original single-period build. null when no sessions.
function buildContextStats(a: ContextAcc, maxContext: number, capped: boolean): ContextStats | null {
  if (a.sessions === 0) return null;
  const avgPeakContext = a.peaks.length ? a.peaks.reduce((x, y) => x + y, 0) / a.peaks.length : 0;
  const histogram = new Array(CONTEXT_HIST_BUCKETS.length).fill(0);
  for (const p of a.peaks) {
    const pct = maxContext > 0 ? p / maxContext : 0;
    const bi = CONTEXT_HIST_BUCKETS.findIndex((t) => pct < t);
    histogram[bi < 0 ? CONTEXT_HIST_BUCKETS.length - 1 : bi]++;
  }
  return {
    sessions: a.sessions,
    compactions: a.compactions,
    autoCompactions: a.auto,
    manualCompactions: a.manual,
    avgPreTokens: a.preTokensCount ? Math.round(a.preTokensSum / a.preTokensCount) : 0,
    avgPeakContext: Math.round(avgPeakContext),
    avgPeakPct: maxContext > 0 ? Math.round((avgPeakContext / maxContext) * 100) : 0,
    maxContext,
    histogram,
    capped,
  };
}

function refreshContextStatsCache(): void {
  if (!db) return;
  try {
    const groups = db.prepare('SELECT id, folder FROM agent_groups').all() as { id: string; folder: string }[];
    const sessionsDir = join(getDataDir(), 'v2-sessions');
    const livePaths = new Set<string>();
    // Day cutoffs, computed once per refresh — identical to the cost columns
    // (see the ccusage refresh). '' = no filter for 'all'.
    const cutoffs: Record<ContextPeriod, string> = {
      '1d': ccusageSinceDate(0),
      '7d': ccusageSinceDate(7),
      '30d': ccusageSinceDate(30),
      all: '',
    };
    for (const group of groups) {
      const claudeShared = join(sessionsDir, group.id, '.claude-shared');
      let files = collectClaudeJsonlFiles(claudeShared);
      if (files.length === 0) {
        contextStatsCache.delete(group.id);
        continue;
      }
      // Most-recent files first, then cap — a group with thousands of archived
      // transcripts shouldn't stall the poll; we log the cap via `capped`.
      const withMtime = files
        .map((f) => {
          try {
            return { f, m: statSync(f).mtimeMs };
          } catch {
            return { f, m: 0 };
          }
        })
        .sort((a, b) => b.m - a.m);
      const capped = withMtime.length > MAX_CONTEXT_FILES_PER_GROUP;
      const chosen = withMtime.slice(0, MAX_CONTEXT_FILES_PER_GROUP);

      const acc: Record<ContextPeriod, ContextAcc> = {
        '1d': newContextAcc(),
        '7d': newContextAcc(),
        '30d': newContextAcc(),
        all: newContextAcc(),
      };
      // Widest window the coworker ever ran on, over ALL signal files — the fixed
      // % scale shared by every period (1M for Opus fleets).
      let groupMaxWindow = 0;
      for (const { f, m } of chosen) {
        livePaths.add(f);
        const fc = scanFileContext(f, m);
        if (!fc.hadSignal) continue;
        if (fc.maxWindow > groupMaxWindow) groupMaxWindow = fc.maxWindow;
        for (const period of CONTEXT_PERIODS) {
          const since = cutoffs[period];
          let sessionPeak = 0,
            comp = 0,
            au = 0,
            man = 0,
            preSum = 0,
            inWindow = false;
          for (const [key, d] of fc.days) {
            // 'all' keeps every day (incl. MISSING_TS_KEY); dated periods require
            // key >= cutoff — MISSING_TS_KEY ('00000000') never qualifies.
            if (period !== 'all' && !(key >= since)) continue;
            inWindow = true;
            if (d.peak > sessionPeak) sessionPeak = d.peak;
            comp += d.compactions;
            au += d.auto;
            man += d.manual;
            preSum += d.preTokensSum;
          }
          if (!inWindow) continue; // session has no activity in this window — not counted
          const a = acc[period];
          a.sessions++;
          if (sessionPeak > 0) a.peaks.push(sessionPeak);
          a.compactions += comp;
          a.auto += au;
          a.manual += man;
          a.preTokensSum += preSum;
          a.preTokensCount += comp;
        }
      }
      // Fall back to the model default if no model was ever identified.
      const maxContext = groupMaxWindow || modelMaxContext('unknown');
      const rec: Record<ContextPeriod, ContextStats | null> = {
        '1d': buildContextStats(acc['1d'], maxContext, capped),
        '7d': buildContextStats(acc['7d'], maxContext, capped),
        '30d': buildContextStats(acc['30d'], maxContext, capped),
        all: buildContextStats(acc.all, maxContext, capped),
      };
      // rec.all is the superset — null there means no signal in any window, the
      // same condition the old `sessions === 0` delete guarded.
      if (!rec.all) {
        contextStatsCache.delete(group.id);
        continue;
      }
      contextStatsCache.set(group.id, rec);
    }
    // Evict per-file cache entries for transcripts no longer in any group's window.
    if (perFileContextCache.size > livePaths.size * 2 + 1000) {
      for (const k of perFileContextCache.keys()) if (!livePaths.has(k)) perFileContextCache.delete(k);
    }
  } catch {
    /* DB not ready */
  }
}

// ---------- Per-session cost (Sessions tab cost column) ----------
//
// ccusage is per-group-per-day, so a per-SESSION figure is summed from the raw
// per-message `usage` in each transcript, priced by session-costs.ts (LiteLLM
// rates, guarded against FALLBACK_PRICING drift). One transcript file under
// `.claude-shared/projects/` is one SDK session (its basename is the SDK uuid),
// mapped to the nanoclaw session id via sdk_session_routes so a row can link.
//
// Mirrors the context refresh: mtime-keyed per-file cache, 60s cycle, file cap.

interface PerFileCost {
  mtimeMs: number;
  // YYYYMMDD -> { cost, tokens } for that day; summed per period at refresh.
  days: Map<string, { cost: number; tokens: number }>;
  unpriced: boolean; // saw usage from a model MODEL_PRICING doesn't know
  hadSignal: boolean;
  // Read + parse finished without throwing. A transient read failure leaves this
  // false; persistPerFileCostCache skips such entries so a one-off error never
  // freezes a file at $0 across restarts (in-memory only — not persisted).
  ok: boolean;
}
const perFileCostCache = new Map<string, PerFileCost>();

function scanFileCost(path: string, mtimeMs: number): PerFileCost {
  const cached = perFileCostCache.get(path);
  if (cached && cached.mtimeMs === mtimeMs) return cached;
  const out: PerFileCost = { mtimeMs, days: new Map(), unpriced: false, hadSignal: false, ok: false };
  // Dedupe by message id. A transcript replays the SAME assistant message on
  // multiple rows when a session is resumed/rewound — each carries an identical
  // `message.id` but a distinct top-level `uuid`. Counting every row double- to
  // triple-counts cost (measured 1.7–2.2x on prod); ccusage dedupes by message
  // id, so we do too, keeping this column reconciled with the group totals the
  // Overview reads. requestId is null on Bedrock, so message.id alone is the key.
  const seenMsgIds = new Set<string>();
  try {
    const content = readFileSync(path, 'utf-8');
    for (const line of content.split('\n')) {
      if (line.indexOf('"usage"') < 0) continue;
      let r: {
        type?: string;
        timestamp?: string;
        message?: { id?: string; usage?: TokenUsage; model?: string };
      };
      try {
        r = JSON.parse(line);
      } catch {
        continue;
      }
      const msg = r.message;
      if (r.type !== 'assistant' || !msg?.usage) continue;
      if (msg.id) {
        if (seenMsgIds.has(msg.id)) continue;
        seenMsgIds.add(msg.id);
      }
      const cost = priceUsage(msg.model, msg.usage);
      const u = msg.usage;
      const tokens =
        (u.input_tokens || 0) +
        (u.output_tokens || 0) +
        (u.cache_creation_input_tokens || 0) +
        (u.cache_read_input_tokens || 0);
      out.hadSignal = true;
      // Flag "unpriced" only when an unknown model actually billed tokens. Zero-usage
      // synthetic rows (model "<synthetic>") carry no cost and must not raise the `*`.
      if (cost === 0 && tokens > 0 && msg.model && !normalizeModel(msg.model)) out.unpriced = true;
      const key = isoDayKey(r.timestamp) ?? MISSING_TS_KEY;
      const d = out.days.get(key) || { cost: 0, tokens: 0 };
      d.cost += cost;
      d.tokens += tokens;
      out.days.set(key, d);
    }
    // Full read + parse completed without throwing — this entry is durable and
    // safe to persist. A read that throws (catch below) leaves ok=false so
    // persistPerFileCostCache skips it, rather than freezing a transient failure
    // as a $0 file across restarts.
    out.ok = true;
  } catch {
    /* unreadable — treat as no signal (ok stays false: transient, don't persist) */
  }
  perFileCostCache.set(path, out);
  return out;
}

// ---------- Per-session CODEX cost (the other half of the cost column) ----------
//
// `codex-critique` calls `mcp__codex__codex` as a plain MCP tool, so its spend
// never lands in a Claude transcript and the walk above cannot see it (issue
// #1327). Codex writes its own rollouts under the SESSION's own directory —
// `<sessionDir>/codex/sessions/YYYY/MM/DD/rollout-*.jsonl` (src/providers/codex.ts
// mounts `<sessionDir>/codex` as the container's CODEX_HOME) — so unlike the
// Claude side there is no `sdk_session_routes` hop: the path IS the attribution.
//
// Caching is per SESSION, not per file, because the dedupe that keeps this
// reconciled with ccusage is inherently cross-file: a codex subagent thread
// spawn replays its parent's already-billed turns into its own rollout (see
// codex-costs.ts). A session is rescanned only when its rollout set changes
// (signature over path+mtime), so steady state re-reads only live sessions.
//
// Deliberately NOT persisted across restarts (unlike perFileCostCache): the
// cross-file dedupe means the cacheable unit is a whole session, so a warm
// snapshot would have to be invalidated by the same signature it stores, and the
// cold rescan is a single pass over files that are small relative to Claude
// transcripts. Revisit if cold-start latency becomes visible.

interface CodexSessionCost {
  /** Signature of the session's rollout set: recompute only when this changes. */
  sig: string;
  /** YYYYMMDD -> { cost, tokens }, from each event's OWN timestamp (ccusage's day attribution). */
  days: Map<string, { cost: number; tokens: number }>;
  unpriced: boolean;
  hadSignal: boolean;
  lastActiveMs: number;
}
const codexSessionCostCache = new Map<string, CodexSessionCost>();

/** `rollout-*.jsonl` under a CODEX_HOME (`sessions/YYYY/MM/DD/`), with mtimes. Bounded, fail-soft. */
function listCodexRollouts(codexHome: string): { f: string; m: number }[] {
  const out: { f: string; m: number }[] = [];
  const root = join(codexHome, 'sessions');
  // Depth-bounded walk: sessions/<year>/<month>/<day>/rollout-*.jsonl. A plain
  // recursive walk would also descend into anything else codex parks in there.
  let years: string[];
  try {
    years = readdirSync(root);
  } catch {
    return out; // no codex dir for this session — by far the common case
  }
  for (const y of years) {
    let months: string[];
    try {
      months = readdirSync(join(root, y));
    } catch {
      continue;
    }
    for (const mo of months) {
      let days: string[];
      try {
        days = readdirSync(join(root, y, mo));
      } catch {
        continue;
      }
      for (const d of days) {
        const dir = join(root, y, mo, d);
        let names: string[];
        try {
          names = readdirSync(dir);
        } catch {
          continue;
        }
        for (const n of names) {
          if (!n.startsWith('rollout-') || !n.endsWith('.jsonl')) continue;
          const f = join(dir, n);
          let m = 0;
          try {
            m = statSync(f).mtimeMs;
          } catch {
            /* unreadable — treat as oldest */
          }
          out.push({ f, m });
        }
      }
    }
  }
  out.sort((a, b) => (a.f < b.f ? -1 : a.f > b.f ? 1 : 0));
  return out;
}

/**
 * Priced codex spend for one session, bucketed by day.
 *
 * Dedupes calls across the session's rollout files by their usage tuple — the
 * key ccusage uses, and the reason a forked subagent rollout's replayed prefix
 * is not billed twice. Files are visited in path order (which is chronological:
 * the timestamp is in the name), so the surviving copy of a duplicated call is
 * the earliest one, matching ccusage's day attribution.
 */
function scanSessionCodexCost(codexHome: string): CodexSessionCost {
  const files = listCodexRollouts(codexHome);
  const sig = createHash('sha1')
    .update(files.map((x) => `${x.f}:${x.m}`).join('\n'))
    .digest('hex')
    .slice(0, 16);
  const cached = codexSessionCostCache.get(codexHome);
  if (cached && cached.sig === sig) return cached;

  const out: CodexSessionCost = { sig, days: new Map(), unpriced: false, hadSignal: false, lastActiveMs: 0 };
  const seen = new Set<string>();
  for (const { f, m } of files) {
    let content: string;
    try {
      content = readFileSync(f, 'utf-8');
    } catch {
      continue; // unreadable — skip; the signature will retry it next mtime change
    }
    if (m > out.lastActiveMs) out.lastActiveMs = m;
    for (const ev of parseCodexRollout(content)) {
      const key = codexUsageKey(ev.model, ev.usage);
      if (seen.has(key)) continue;
      seen.add(key);
      const cost = priceCodexUsage(ev.model, ev.usage);
      const tokens = codexUsageTokens(ev.usage);
      out.hadSignal = true;
      // Same rule as the Claude side: only raise the `*` when an UNKNOWN model
      // actually billed tokens, never for a zero-usage row.
      if (cost === 0 && tokens > 0 && ev.model && !normalizeCodexModel(ev.model)) out.unpriced = true;
      const dayKey = ev.dayKey ?? MISSING_TS_KEY;
      const d = out.days.get(dayKey) || { cost: 0, tokens: 0 };
      d.cost += cost;
      d.tokens += tokens;
      out.days.set(dayKey, d);
    }
  }
  codexSessionCostCache.set(codexHome, out);
  return out;
}

// nanoclaw session id -> cost row, per period. Endpoint joins this onto the
// /api/sessions rows; the ranked arrays back an optional sort=cost.
type SessionCostByPeriod = Record<ContextPeriod, Map<string, SessionCostEntry>>;
let sessionCostCache: SessionCostByPeriod = {
  '1d': new Map(),
  '7d': new Map(),
  '30d': new Map(),
  all: new Map(),
};

// Per-session cost-cap state, published by the runner into outbound.db
// session_state under the single JSON key `cost_cap`. Shared contract with the
// agent-runner (nv-dashboard):
//   { capUsd, spentUsd, status:'ok'|'warn'|'escalated'|'stopped',
//     immortal, window:'lifetime'|'daily', dayKey?, escalatedAt?, decision?, decidedAt?,
//     ceilingUsd? }
// `window` distinguishes a per-run (lifetime) cap from an immortal orchestrator's
// per-DAY visibility bound (dayKey present only when window==='daily').
//
// dash-1 set-ceiling-v2: this used to be read inline in /api/sessions, per row,
// gated on `s.cost > 0` in the SELECTED period — which is exactly the bug that
// hid a session's ceiling whenever it had no priced spend in the currently
// selected day-window even though it was very much alive. It's now read by the
// scan worker / main-thread fallback above (pickLatestMessageTs,
// applyMainThreadCostCap) into the always-fresh `sessionCostCapsMap`, joined
// for every session unconditionally — see the /api/sessions handler and
// session-cost-caps.ts.

// ---------- claude-trace directory index (Sessions-tab deep links) ----------
// dash-perf round 2: /api/sessions previously ran a readdirSync + a statSync per
// matching file for EVERY priced session on every request — O(priced sessions ×
// files in the group's trace dir) of synchronous filesystem work on the request
// path, which starves stream flushing. Instead we cache the per-group trace-dir
// listing (name + mtime) behind a short TTL: a warm request does ZERO trace
// filesystem calls, and the per-row work is an in-memory prefix scan. The TTL
// (not directory mtime alone) is the refresh trigger because appending to an
// existing trace file doesn't bump the directory mtime.
interface TraceDirListing {
  scannedAt: number;
  files: { name: string; mtimeMs: number }[];
}
const TRACE_DIR_TTL_MS = 45_000;
// After a READ ERROR (as opposed to a confirmed-absent dir) we retry this soon
// instead of holding the fallback listing for the full TTL.
const TRACE_DIR_ERROR_RETRY_MS = 5_000;
const traceDirCache = new Map<string, TraceDirListing>();

/** Cached listing of `session-*.html` files (with mtimes) under a group's
 *  `.claude-trace` dir. Rebuilt at most once per TTL per dir; warm calls touch
 *  no filesystem. A confirmed-absent dir caches as empty; a transient read
 *  ERROR keeps the previous listing (an empty cache entry would silently strip
 *  the trace link from every priced session in the group for a full TTL). */
function getTraceDirListing(traceDir: string): { name: string; mtimeMs: number }[] {
  const now = Date.now();
  const cached = traceDirCache.get(traceDir);
  if (cached && now - cached.scannedAt < TRACE_DIR_TTL_MS) return cached.files;
  const files: { name: string; mtimeMs: number }[] = [];
  let names: string[];
  try {
    names = readdirSync(traceDir);
  } catch (e: any) {
    const absent = e && (e.code === 'ENOENT' || e.code === 'ENOTDIR');
    if (absent) {
      // Genuinely no trace dir → an empty listing is the correct answer.
      traceDirCache.set(traceDir, { scannedAt: now, files });
      return files;
    }
    // Transient (EMFILE/EACCES/EIO/…): serve the last good listing and retry soon.
    const fallback = cached ? cached.files : files;
    traceDirCache.set(traceDir, { scannedAt: now - TRACE_DIR_TTL_MS + TRACE_DIR_ERROR_RETRY_MS, files: fallback });
    return fallback;
  }
  for (const f of names) {
    if (!f.startsWith('session-') || !f.endsWith('.html')) continue;
    let m = 0;
    try {
      m = statSync(join(traceDir, f)).mtimeMs;
    } catch {
      /* unreadable — treat as oldest */
    }
    files.push({ name: f, mtimeMs: m });
  }
  traceDirCache.set(traceDir, { scannedAt: now, files });
  return files;
}

// Guard against overlapping cold scans: the uncapped 30d pass can exceed the 60s
// tick interval on a cold cache, so a second tick must not stack on the first.
let sessionCostScanning = false;
function refreshSessionCostCache(): void {
  if (!db || sessionCostScanning) return;
  sessionCostScanning = true;
  try {
    const groups = db.prepare('SELECT id, folder, name FROM agent_groups').all() as {
      id: string;
      folder: string;
      name: string;
    }[];
    // SDK uuid -> nanoclaw session id (for the link). Newest route wins.
    const sdkToNano = new Map<string, string>();
    try {
      for (const r of db.prepare('SELECT sdk_session_id, nanoclaw_session_id FROM sdk_session_routes').all() as {
        sdk_session_id: string;
        nanoclaw_session_id: string;
      }[]) {
        if (r.sdk_session_id && r.nanoclaw_session_id) sdkToNano.set(r.sdk_session_id, r.nanoclaw_session_id);
      }
    } catch {
      /* table may not exist on older installs — links just fall back to '' */
    }

    const cutoffs: Record<ContextPeriod, string> = {
      '1d': ccusageSinceDate(0),
      '7d': ccusageSinceDate(7),
      '30d': ccusageSinceDate(30),
      all: '',
    };
    const next: SessionCostByPeriod = { '1d': new Map(), '7d': new Map(), '30d': new Map(), all: new Map() };
    const sessionsDir = join(getDataDir(), 'v2-sessions');
    // Widest period this cache serves is 30d; only scan files touched within it
    // (+1d slack). A file older than that has no rows in any served window.
    const cutoffMs = Date.now() - 31 * 86400 * 1000;
    const livePaths = new Set<string>();
    const liveCodexHomes = new Set<string>();

    for (const group of groups) {
      const claudeShared = join(sessionsDir, group.id, '.claude-shared');
      // Sessions only — `projects/<sdk-uuid>.jsonl`. collectClaudeJsonlFiles
      // also returns `skills/…` transcripts, whose basename is not an SDK
      // session id (so they'd never map to a nanoclaw session) and which are
      // skill runs, not sessions. Excluding them keeps the tab to real sessions
      // and matches the reconciliation (projects-only) against ccusage.
      const files = collectClaudeJsonlFiles(claudeShared).filter((f) => f.includes('/projects/'));
      // NOTE: no `continue` when this is empty. A group whose provider is codex
      // (or whose only spend is codex-critique tool calls) has no Claude
      // transcripts at all, and skipping it here would skip the codex walk below
      // too — which is exactly the hole issue #1327 is closing.
      //
      // Accurate over the whole 30d window: scan EVERY file touched in the last
      // ~31d, no count cap. The old 400-file cap truncated the busiest groups
      // (main/fixer/triager each have ~1000 files/30d), undercounting the 30d
      // total ~2x. The per-file mtime cache keeps steady state cheap — only the
      // cold scan reads them all.
      const chosen = files
        .map((f) => {
          try {
            return { f, m: statSync(f).mtimeMs };
          } catch {
            return { f, m: 0 };
          }
        })
        .filter((x) => x.m >= cutoffMs);

      for (const { f, m } of chosen) {
        livePaths.add(f);
        const fc = scanFileCost(f, m);
        if (!fc.hadSignal) continue;
        const sdkId = basename(f).replace(/\.jsonl$/, '');
        const nanoId = sdkToNano.get(sdkId) || '';
        for (const period of CONTEXT_PERIODS) {
          const since = cutoffs[period];
          let cost = 0;
          let tokens = 0;
          let inWindow = false;
          for (const [key, d] of fc.days) {
            if (period !== 'all' && !(key >= since)) continue;
            inWindow = true;
            cost += d.cost;
            tokens += d.tokens;
          }
          if (!inWindow) continue;
          // Merge onto the nanoclaw session (a session can span multiple SDK
          // sub-sessions/files); unmapped files bucket under their SDK id so
          // their cost is still counted, just without a working link.
          const mapKey = nanoId || sdkId;
          const bucket = next[period];
          const prev = bucket.get(mapKey);
          if (prev) {
            prev.cost += cost;
            prev.claudeUsd += cost;
            prev.tokens += tokens;
            prev.lastActiveMs = Math.max(prev.lastActiveMs, m);
            prev.unpriced = prev.unpriced || fc.unpriced;
          } else {
            bucket.set(mapKey, {
              sessionId: nanoId,
              sdkSessionId: sdkId,
              groupFolder: group.folder,
              groupName: group.name,
              cost,
              claudeUsd: cost,
              codexUsd: 0,
              tokens,
              lastActiveMs: m,
              unpriced: fc.unpriced,
            });
          }
        }
      }

      // Codex half. Keyed by the nanoclaw session id straight off the path, so
      // it merges onto the Claude row for the same session when there is one and
      // stands up its own row when there isn't — a session that ONLY ever called
      // `mcp__codex__codex` used to report a confident $0 (issue #1327).
      let sessDirs: string[];
      try {
        sessDirs = readdirSync(join(sessionsDir, group.id)).filter((d) => d.startsWith('sess-'));
      } catch {
        continue; // group has no session dir yet
      }
      for (const sessId of sessDirs) {
        const codexHome = join(sessionsDir, group.id, sessId, 'codex');
        liveCodexHomes.add(codexHome);
        const cc = scanSessionCodexCost(codexHome);
        if (!cc.hadSignal) continue;
        if (cc.lastActiveMs < cutoffMs) continue; // outside every served window
        for (const period of CONTEXT_PERIODS) {
          const since = cutoffs[period];
          let cost = 0;
          let tokens = 0;
          let inWindow = false;
          for (const [key, d] of cc.days) {
            if (period !== 'all' && !(key >= since)) continue;
            inWindow = true;
            cost += d.cost;
            tokens += d.tokens;
          }
          if (!inWindow) continue;
          const bucket = next[period];
          const prev = bucket.get(sessId);
          if (prev) {
            prev.cost += cost;
            prev.codexUsd += cost;
            prev.tokens += tokens;
            prev.lastActiveMs = Math.max(prev.lastActiveMs, cc.lastActiveMs);
            prev.unpriced = prev.unpriced || cc.unpriced;
          } else {
            bucket.set(sessId, {
              sessionId: sessId,
              sdkSessionId: '',
              groupFolder: group.folder,
              groupName: group.name,
              cost,
              claudeUsd: 0,
              codexUsd: cost,
              tokens,
              lastActiveMs: cc.lastActiveMs,
              unpriced: cc.unpriced,
            });
          }
        }
      }
    }
    sessionCostCache = next;
    if (perFileCostCache.size > livePaths.size * 2 + 1000) {
      for (const k of perFileCostCache.keys()) if (!livePaths.has(k)) perFileCostCache.delete(k);
    }
    // Same prune shape for the codex cache — an entry per session, so it only
    // grows when sessions are deleted out from under it.
    if (codexSessionCostCache.size > liveCodexHomes.size + 100) {
      for (const k of codexSessionCostCache.keys()) if (!liveCodexHomes.has(k)) codexSessionCostCache.delete(k);
    }
    writeCostThresholdFile(next);
    // Snapshot the freshly-updated + pruned per-file cache so the next process
    // start is warm (see loadPerFileCostCache). Fail-soft; advisory only.
    persistPerFileCostCache();
  } catch {
    /* DB not ready */
  } finally {
    sessionCostScanning = false;
  }
}

/**
 * Publish `data/cost-thresholds.json` — the p90 of priced per-session cost over
 * a trailing window — so the runner can seed each new per-run cost cap from the
 * fleet's recent spend distribution. Shared contract (dashboard WRITES, host
 * READS): { p90Usd, period, sampleSize, computedAt }.
 *
 * Prefer the 7d window (responsive to recent spend); fall back to 30d when 7d
 * has no priced sessions yet. Percentile method matches the Sessions-tab pctl
 * (sort asc; index = floor(0.9*(n-1))). Written atomically (tmp + rename) and
 * fail-soft — the file is advisory, so any error just skips this cycle.
 */
function writeCostThresholdFile(byPeriod: SessionCostByPeriod): void {
  try {
    let period: ContextPeriod = '30d';
    let entries: SessionCostEntry[] = [];
    for (const p of ['7d', '30d'] as ContextPeriod[]) {
      const priced = [...byPeriod[p].values()].filter((e) => e.cost > 0);
      if (priced.length) {
        period = p;
        entries = priced;
        break;
      }
    }
    if (entries.length === 0) return;

    // p90 of a cost array — sort asc, index = floor(0.9*(n-1)). Matches the
    // Sessions-tab pctl and the host's resolveCostCapT2Usd read contract.
    const p90Of = (arr: number[]): number => {
      const s = [...arr].sort((a, b) => a - b);
      return s[Math.min(s.length - 1, Math.floor(0.9 * (s.length - 1)))];
    };

    // Per-group p90 over each group's OWN priced sessions — the Tier-1 cap the
    // host prefers over the fleet number. A fleet p90 is dragged down by the many
    // cheap orchestrator/reviewer sessions (so it under-serves fixer) and can't
    // over-cap a reviewer at once. Only groups with a real sample get an entry;
    // the host falls back to the fleet p90 for smaller/newer groups.
    const MIN_GROUP_SAMPLE = 10;
    const byGroup = new Map<string, number[]>();
    for (const e of entries) {
      if (!e.groupFolder) continue;
      (byGroup.get(e.groupFolder) ?? byGroup.set(e.groupFolder, []).get(e.groupFolder)!).push(e.cost);
    }
    const perGroupP90Usd: Record<string, number> = {};
    for (const [folder, arr] of byGroup) {
      if (arr.length >= MIN_GROUP_SAMPLE) perGroupP90Usd[folder] = p90Of(arr);
    }

    const payload =
      JSON.stringify({
        p90Usd: p90Of(entries.map((e) => e.cost)),
        perGroupP90Usd,
        period,
        sampleSize: entries.length,
        computedAt: new Date().toISOString(),
      }) + '\n';
    const outPath = join(getDataDir(), 'cost-thresholds.json');
    const tmpPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, payload);
    renameSync(tmpPath, outPath);
  } catch {
    /* fail-soft: threshold file is advisory */
  }
}

/**
 * Per-group p99 of priced cost for a period-scoped cost map — the "is this
 * session unusually expensive for ITS group" signal the Sessions-tab pill
 * colors by (see renderCostCapCell in app.js). Purely visual/informational:
 * unlike the runner's Tier-2 ceiling (which actually blocks new work), this
 * never gates or stops anything — it's read fresh per `/api/sessions` request
 * from the already-cached `sessionCostCache[period]`, no disk I/O, no shared
 * contract with the runner (compare `writeCostThresholdFile` above, which
 * publishes p90 for the runner's Tier-1 cap — a completely separate number
 * for a completely separate purpose). Small groups (<MIN_GROUP_SAMPLE priced
 * sessions) fall back to the fleet p99 rather than a noisy few-sample stat.
 */
function computeCostP99ByGroup(costByNano: Map<string, SessionCostEntry>): {
  fleetP99: number | null;
  perGroupP99: Map<string, number>;
} {
  const MIN_GROUP_SAMPLE = 10;
  const priced = [...costByNano.values()].filter((e) => e.cost > 0);
  if (priced.length === 0) return { fleetP99: null, perGroupP99: new Map() };

  // Same percentile method as writeCostThresholdFile's p90Of: sort asc, index
  // = floor(p*(n-1)).
  const percentileOf = (arr: number[], p: number): number => {
    const s = [...arr].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(p * (s.length - 1)))];
  };

  const byGroup = new Map<string, number[]>();
  for (const e of priced) {
    if (!e.groupFolder) continue;
    (byGroup.get(e.groupFolder) ?? byGroup.set(e.groupFolder, []).get(e.groupFolder)!).push(e.cost);
  }
  const perGroupP99 = new Map<string, number>();
  for (const [folder, arr] of byGroup) {
    if (arr.length >= MIN_GROUP_SAMPLE) perGroupP99.set(folder, percentileOf(arr, 0.99));
  }
  return { fleetP99: percentileOf(priced.map((e) => e.cost), 0.99), perGroupP99 };
}

// ---------- Warm-start persistence for the per-file cost cache ----------
//
// A cold start otherwise re-parses EVERY per-session transcript (thousands of
// files on a large install) before the Sessions cost column populates. The
// in-memory `perFileCostCache` is lost on restart, so this snapshots it to disk
// after each refresh and reloads it on startup. Because entries are mtime-keyed,
// the next scan re-parses ONLY files whose mtime changed — a warm start.
//
// Fail-soft in every direction: a missing / corrupt / older-schema file falls
// back to a full cold scan and NEVER throws. This never changes computed output —
// a warm cache hit returns the same PerFileCost a fresh parse would (numbers
// round-trip through JSON exactly, and day-key insertion order is preserved), so
// percentile/threshold output is bit-identical to today; only cold-start latency
// drops.
//
// Two invalidation keys, both mandatory on load:
//   - COST_CACHE_VERSION    — bump on any PerFileCost SHAPE change.
//   - COST_MATH_FINGERPRINT — a hash of the cost MATH (the pricing table plus the
//     priceUsage / normalizeModel / scanFileCost bodies). An mtime keys a file's
//     RAW content; it cannot see a pricing or parser edit that changes the
//     COMPUTED cost of otherwise-unchanged files. Folding the math into the tag
//     means such an edit invalidates the whole persisted cache (and its derived
//     thresholds) instead of serving stale costs forever. Hashing MODEL_PRICING's
//     data is required — priceUsage closes over the table, so its .toString()
//     alone would miss a rate change.
const COST_CACHE_VERSION = 1;
const COST_MATH_FINGERPRINT = createHash('sha1')
  .update(JSON.stringify(MODEL_PRICING))
  .update('\0')
  .update(priceUsage.toString())
  .update('\0')
  .update(normalizeModel.toString())
  .update('\0')
  .update(scanFileCost.toString())
  .digest('hex')
  .slice(0, 16);
function costCachePath(): string {
  return join(getDataDir(), 'dashboard-cost-cache.json');
}

// PerFileCost.days is a Map, which JSON can't serialize directly. Carry it as an
// array of [dayKey, {cost, tokens}] pairs (preserving insertion order so summed
// floats stay bit-identical) and rebuild the Map on load. `ok` is intentionally
// NOT persisted: only ok entries are written, so a loaded entry is ok by
// construction.
interface PersistedPerFileCost {
  mtimeMs: number;
  days: Array<[string, { cost: number; tokens: number }]>;
  unpriced: boolean;
  hadSignal: boolean;
}

function loadPerFileCostCache(): void {
  try {
    const p = costCachePath();
    if (!existsSync(p)) return;
    const parsed = JSON.parse(readFileSync(p, 'utf-8')) as {
      version?: number;
      fingerprint?: string;
      entries?: Array<[string, PersistedPerFileCost]>;
    };
    if (
      !parsed ||
      parsed.version !== COST_CACHE_VERSION ||
      parsed.fingerprint !== COST_MATH_FINGERPRINT ||
      !Array.isArray(parsed.entries)
    )
      return;
    for (const entry of parsed.entries) {
      if (!Array.isArray(entry) || entry.length !== 2) continue;
      const [path, v] = entry;
      if (typeof path !== 'string' || !v || typeof v.mtimeMs !== 'number' || !Array.isArray(v.days)) continue;
      const days = new Map<string, { cost: number; tokens: number }>();
      let malformed = false;
      for (const dv of v.days) {
        if (!Array.isArray(dv) || dv.length !== 2) {
          malformed = true;
          break;
        }
        const [k, ct] = dv;
        if (typeof k !== 'string' || !ct || typeof ct.cost !== 'number' || typeof ct.tokens !== 'number') {
          malformed = true;
          break;
        }
        days.set(k, { cost: ct.cost, tokens: ct.tokens });
      }
      // A malformed day record means this entry can't be trusted as complete —
      // skip it entirely so the next scan sees a cache MISS and cold-re-parses
      // the file, rather than serving a silently-undercounted cost with a
      // still-trusted mtime.
      if (malformed) continue;
      perFileCostCache.set(path, {
        mtimeMs: v.mtimeMs,
        days,
        unpriced: v.unpriced === true,
        hadSignal: v.hadSignal === true,
        ok: true,
      });
    }
  } catch {
    /* fail-soft: a missing/corrupt/older cache just means a full cold scan */
  }
}

function persistPerFileCostCache(): void {
  try {
    const entries: Array<[string, PersistedPerFileCost]> = [];
    for (const [path, v] of perFileCostCache) {
      // Skip transient/failed reads (ok=false): persisting an empty error entry
      // would suppress that file's cost across every restart until its mtime
      // changes. Only durable, successfully-parsed entries earn a warm slot.
      if (!v.ok) continue;
      entries.push([
        path,
        { mtimeMs: v.mtimeMs, days: [...v.days.entries()], unpriced: v.unpriced, hadSignal: v.hadSignal },
      ]);
    }
    const payload = JSON.stringify({ version: COST_CACHE_VERSION, fingerprint: COST_MATH_FINGERPRINT, entries });
    const outPath = costCachePath();
    const tmpPath = `${outPath}.tmp-${process.pid}-${Date.now()}`;
    writeFileSync(tmpPath, payload);
    renameSync(tmpPath, outPath);
  } catch {
    /* fail-soft: the warm-start cache is advisory */
  }
}

if (!process.env.VITEST) {
  // Defer the first (cold) scan a few seconds so it never blocks server startup —
  // it reads every transcript once (~seconds on a large install); after that the
  // per-file cache makes each 60s cycle cheap (only the growing active files are
  // re-read). Until the first scan lands the endpoint just reports null stats.
  setTimeout(refreshContextStatsCache, 4000).unref?.();
  const ctxStatsTimer = setInterval(refreshContextStatsCache, 60000);
  ctxStatsTimer.unref?.();
  // Per-session cost shares the same cadence. Offset the cold scan slightly so
  // the two full-transcript passes don't land in the same tick on startup.
  // Warm the per-file cache from disk first (before the first scan) so the cold
  // scan re-parses only files whose mtime changed since the last snapshot.
  loadPerFileCostCache();
  setTimeout(refreshSessionCostCache, 6000).unref?.();
  const sessCostTimer = setInterval(refreshSessionCostCache, 60000);
  sessCostTimer.unref?.();
}

// ---------- Per-group token aggregation (removed — dash-perf round 2) ----------
// The former `GroupTokenBucket` / `groupTokenCache` / `refreshGroupTokens()` +
// 30s timer recursively discovered every JSONL transcript across the whole
// fleet, read each file from byte zero, split every line, and JSON.parsed every
// object — twice a minute — yet the resulting cache had NO reader anywhere in
// the dashboard (it was only ever written and reset). It was the single largest
// avoidable CPU sink on a large install, so it is deleted outright. If a future
// panel needs per-group token totals, derive them from the already-parsed,
// mtime-gated `perFileCostCache` (see refreshSessionCostCache) rather than
// reintroducing a full-fleet whole-file re-parse on a timer.

// ---------- Token metrics via ccusage (container data only) ----------
interface CcusageDayEntry {
  date: string;
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  totalTokens: number;
  totalCost: number;
  modelsUsed: string[];
  modelBreakdowns: {
    modelName: string;
    inputTokens: number;
    outputTokens: number;
    cacheCreationTokens: number;
    cacheReadTokens: number;
    cost: number;
  }[];
}
interface CcusageGroupData {
  groupId: string;
  groupName: string;
  daily: CcusageDayEntry[];
}
interface CcusageCache {
  '1d': { combined: CcusageDayEntry[]; byGroup: CcusageGroupData[] };
  '7d': { combined: CcusageDayEntry[]; byGroup: CcusageGroupData[] };
  '30d': { combined: CcusageDayEntry[]; byGroup: CcusageGroupData[] };
  all: { combined: CcusageDayEntry[]; byGroup: CcusageGroupData[] };
  lastRefresh: number;
}
const emptyCcusagePeriod = { combined: [] as CcusageDayEntry[], byGroup: [] as CcusageGroupData[] };
let ccusageCache: CcusageCache = {
  '1d': { ...emptyCcusagePeriod },
  '7d': { ...emptyCcusagePeriod },
  '30d': { ...emptyCcusagePeriod },
  all: { ...emptyCcusagePeriod },
  lastRefresh: 0,
};

function ccusageSinceDate(daysAgo: number): string {
  const d = new Date(Date.now() - daysAgo * 86400000);
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Normalise a `ccusage daily --json` entry to our shared CcusageDayEntry shape.
 *
 * Schema drift defense: ccusage 19+ renamed `date` to `period` and dropped
 * the `modelBreakdowns` array. The dashboard's mergeDailyEntries depends on
 * both. We synthesize them here so changes upstream don't take cost reporting
 * to zero — observed on 2026-05-18 with ccusage 19.0.3.
 */
/**
 * ccusage 19+ auto-aggregates ALL detected coding agents (Claude, Codex, Gemini)
 * regardless of CLAUDE_CONFIG_DIR. We only want Claude data here — codex
 * is collected separately per-session via runCodexCcusage. Without this
 * filter, every per-coworker row gets the host-wide codex spend mixed in,
 * mis-attributing global codex usage to lego/dev coworkers that have zero
 * session-local codex/ directories.
 */
function isClaudeModel(name: string): boolean {
  // Claude model identifiers: 'claude-*', 'aws/anthropic/*', 'anthropic/*'
  return /^(claude-|aws\/anthropic\/|anthropic\/)/.test(name);
}

function normalizeCcusageEntry(raw: Record<string, unknown>): CcusageDayEntry {
  const date = (raw.date as string) || (raw.period as string) || '';
  const allModels = Array.isArray(raw.modelsUsed) ? (raw.modelsUsed as string[]) : [];
  const modelsUsed = allModels.filter(isClaudeModel);
  // If no Claude models in this entry, return a zero entry (caller can drop
  // it; mergeDailyEntries already skips entries without dates).
  if (modelsUsed.length === 0) {
    return {
      date: '',
      inputTokens: 0,
      outputTokens: 0,
      cacheCreationTokens: 0,
      cacheReadTokens: 0,
      totalTokens: 0,
      totalCost: 0,
      modelsUsed: [],
      modelBreakdowns: [],
    };
  }
  // ccusage gives totals across ALL models (claude+codex). To get the
  // Claude-only slice, prefer per-model breakdown if present (sum the
  // Claude-only entries); otherwise proportionally split.
  const rawBreakdowns = raw.modelBreakdowns as
    | {
        modelName: string;
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        cost: number;
      }[]
    | undefined;
  let modelBreakdowns: CcusageDayEntry['modelBreakdowns'];
  let inputTokens: number;
  let outputTokens: number;
  let cacheCreationTokens: number;
  let cacheReadTokens: number;
  let totalTokens: number;
  let totalCost: number;
  if (Array.isArray(rawBreakdowns) && rawBreakdowns.length > 0) {
    modelBreakdowns = rawBreakdowns.filter((mb) => isClaudeModel(mb.modelName)).map((mb) => ({ ...mb }));
    inputTokens = modelBreakdowns.reduce((s, mb) => s + (mb.inputTokens || 0), 0);
    outputTokens = modelBreakdowns.reduce((s, mb) => s + (mb.outputTokens || 0), 0);
    cacheCreationTokens = modelBreakdowns.reduce((s, mb) => s + (mb.cacheCreationTokens || 0), 0);
    cacheReadTokens = modelBreakdowns.reduce((s, mb) => s + (mb.cacheReadTokens || 0), 0);
    totalTokens = inputTokens + outputTokens + cacheCreationTokens + cacheReadTokens;
    totalCost = modelBreakdowns.reduce((s, mb) => s + (mb.cost || 0), 0);
  } else {
    const allCount = allModels.length || 1;
    const claudeShare = modelsUsed.length / allCount;
    inputTokens = Math.round(((raw.inputTokens as number) || 0) * claudeShare);
    outputTokens = Math.round(((raw.outputTokens as number) || 0) * claudeShare);
    cacheCreationTokens = Math.round(((raw.cacheCreationTokens as number) || 0) * claudeShare);
    cacheReadTokens = Math.round(((raw.cacheReadTokens as number) || 0) * claudeShare);
    totalTokens = Math.round(((raw.totalTokens as number) || 0) * claudeShare);
    totalCost = ((raw.totalCost as number) || 0) * claudeShare;
    if (modelsUsed.length > 0) {
      const share = 1 / modelsUsed.length;
      modelBreakdowns = modelsUsed.map((modelName) => ({
        modelName,
        inputTokens: Math.round(inputTokens * share),
        outputTokens: Math.round(outputTokens * share),
        cacheCreationTokens: Math.round(cacheCreationTokens * share),
        cacheReadTokens: Math.round(cacheReadTokens * share),
        cost: totalCost * share,
      }));
    } else {
      modelBreakdowns = [];
    }
  }
  return {
    date,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens,
    totalCost,
    modelsUsed,
    modelBreakdowns,
  };
}

// Per-token USD/token pricing for the skill-transcript scanner, which parses
// raw JSONL and so cannot go through ccusage at all.
//
// THIS TABLE IS A DENYLIST IN DISGUISE. `scanSkillTranscriptCosts` does
// `if (!FALLBACK_PRICING[model]) continue;` — a model missing here is not
// merely unpriced, it is DROPPED, tokens and all. On slang-coworkers prod
// 2026-08-11 the skill transcripts held 2,002 `claude-opus-5` entries against
// 205 `claude-sonnet-5` ones, so the single-entry table was discarding ~90% of
// the sampled records while reporting the remainder as if it were the total.
//
// Rates below are LiteLLM's (`model_prices_and_context_window.json`), the same
// source ccusage prices against, so the two paths agree. Keeping them in sync
// matters: the previous `claude-sonnet-5` row carried 3e-6/15e-6/3.75e-6/3e-7,
// which is `claude-sonnet-4-6`'s price list verbatim — sonnet-5 actually bills
// at 2e-6/1e-5/2.5e-6/2e-7, so every sonnet-5 skill transcript was marked up
// 50%. A wrong rate is worse than a missing one: it renders with full
// confidence and nothing about the output suggests it should be checked.
//
// When a new model ships, ADD IT HERE — otherwise its cost silently reads zero.
export const FALLBACK_PRICING: Record<
  string,
  { input: number; output: number; cacheCreate: number; cacheRead: number }
> = {
  'claude-opus-5': { input: 5e-6, output: 25e-6, cacheCreate: 6.25e-6, cacheRead: 5e-7 },
  'aws/anthropic/bedrock-claude-opus-5': { input: 5e-6, output: 25e-6, cacheCreate: 6.25e-6, cacheRead: 5e-7 },
  'claude-opus-4-8': { input: 5e-6, output: 25e-6, cacheCreate: 6.25e-6, cacheRead: 5e-7 },
  'claude-sonnet-5': { input: 2e-6, output: 10e-6, cacheCreate: 2.5e-6, cacheRead: 2e-7 },
  'claude-sonnet-4-6': { input: 3e-6, output: 15e-6, cacheCreate: 3.75e-6, cacheRead: 3e-7 },
};

function scanSkillTranscriptCosts(claudeSharedDir: string, since?: string): CcusageDayEntry[] {
  const skillsDir = join(claudeSharedDir, 'skills');
  // Collect { file, dirDate } pairs — dirDate is extracted from the parent
  // directory name (e.g. "pr-20260702T092508Z" → "2026-07-02") since skill
  // transcript JSONL entries typically lack a timestamp field.
  const files: { path: string; dirDate: string }[] = [];
  const extractDirDate = (dir: string): string => {
    const m = dir.match(/(\d{4})(\d{2})(\d{2})T/);
    return m ? `${m[1]}-${m[2]}-${m[3]}` : '';
  };
  try {
    for (const skill of readdirSync(skillsDir, { withFileTypes: true })) {
      if (!skill.isDirectory()) continue;
      const txDir = join(skillsDir, skill.name, 'transcripts');
      if (!existsSync(txDir)) continue;
      const walk = (dir: string, dirDate: string): void => {
        try {
          for (const entry of readdirSync(dir, { withFileTypes: true })) {
            const full = join(dir, entry.name);
            if (entry.isDirectory()) walk(full, extractDirDate(entry.name) || dirDate);
            else if (entry.name.endsWith('.jsonl')) files.push({ path: full, dirDate });
          }
        } catch {
          /* skip */
        }
      };
      walk(txDir, '');
    }
  } catch {
    return [];
  }
  if (files.length === 0) return [];

  const byDate: Record<
    string,
    Record<string, { input: number; output: number; cacheCreate: number; cacheRead: number }>
  > = {};
  for (const { path: filePath, dirDate } of files) {
    let content: string;
    try {
      content = readFileSync(filePath, 'utf-8');
    } catch {
      continue;
    }
    // Fall back to file mtime if no dir-based date available
    let fallbackDate = dirDate;
    if (!fallbackDate) {
      try {
        fallbackDate = new Date(statSync(filePath).mtimeMs).toISOString().slice(0, 10);
      } catch {
        /* skip */
      }
    }
    for (const line of content.split('\n')) {
      if (!line.trim()) continue;
      try {
        const r = JSON.parse(line);
        if (r.type !== 'assistant' || !r.message?.usage) continue;
        const model = r.message.model || '';
        if (!FALLBACK_PRICING[model]) continue;
        const ts = r.timestamp;
        let date = '';
        if (typeof ts === 'string' && ts.length >= 10) date = ts.slice(0, 10);
        else if (typeof ts === 'number') date = new Date(ts).toISOString().slice(0, 10);
        if (!date) date = fallbackDate;
        if (!date) continue;
        if (since && date.replace(/-/g, '') < since) continue;
        if (!byDate[date]) byDate[date] = {};
        if (!byDate[date][model]) byDate[date][model] = { input: 0, output: 0, cacheCreate: 0, cacheRead: 0 };
        const u = r.message.usage;
        byDate[date][model].input += u.input_tokens || 0;
        byDate[date][model].output += u.output_tokens || 0;
        byDate[date][model].cacheCreate += u.cache_creation_input_tokens || 0;
        byDate[date][model].cacheRead += u.cache_read_input_tokens || 0;
      } catch {
        /* skip */
      }
    }
  }

  const entries: CcusageDayEntry[] = [];
  for (const [date, models] of Object.entries(byDate)) {
    const modelBreakdowns: CcusageDayEntry['modelBreakdowns'] = [];
    let totalCost = 0;
    let totalInput = 0,
      totalOutput = 0,
      totalCC = 0,
      totalCR = 0;
    for (const [modelName, tokens] of Object.entries(models)) {
      const p = FALLBACK_PRICING[modelName];
      const cost =
        tokens.input * p.input +
        tokens.output * p.output +
        tokens.cacheCreate * p.cacheCreate +
        tokens.cacheRead * p.cacheRead;
      modelBreakdowns.push({
        modelName,
        inputTokens: tokens.input,
        outputTokens: tokens.output,
        cacheCreationTokens: tokens.cacheCreate,
        cacheReadTokens: tokens.cacheRead,
        cost,
      });
      totalCost += cost;
      totalInput += tokens.input;
      totalOutput += tokens.output;
      totalCC += tokens.cacheCreate;
      totalCR += tokens.cacheRead;
    }
    entries.push({
      date,
      inputTokens: totalInput,
      outputTokens: totalOutput,
      cacheCreationTokens: totalCC,
      cacheReadTokens: totalCR,
      totalTokens: totalInput + totalOutput + totalCC + totalCR,
      totalCost,
      modelsUsed: Object.keys(models),
      modelBreakdowns,
    });
  }
  return entries;
}

// ---------- ccusage CLI resolution (locked dependency, never npx) ----------
//
// ccusage is a PINNED, LOCKFILE-RESOLVED dependency (`"ccusage": "20.0.19"` in
// package.json). It is resolved out of this project's own node_modules and from
// nowhere else.
//
// It used to be pulled on demand by `npx`, which had two problems.
//
// The one that was already fixed: every `npx ccusage …` re-ran npm's exec
// resolution (a `sh -c npx` → `npm exec ccusage` → node chain) costing ~1.7s of
// npm/node startup PER CALL (measured: npx 2.48s vs direct node 0.73s). A
// refresh fans out ~30–56 of these; under host load the fan-out outran the 60s
// refresh interval, batches stacked, and the event loop wedged. (#484 cleanup,
// #488 bound fan-out, #617 re-entrancy cap all capped the NUMBER of calls but
// never removed the per-call npm-exec tax.)
//
// The one that was NOT fixed, and is why this was rewritten: `npx --yes`
// DOWNLOADS AND EXECUTES whatever the registry currently serves. Despite #937's
// title, it still warmed its cache with `npx --yes ccusage --version` and still
// fell back to `npx ccusage …`. So merely opening dashboard cost data could
// fetch and run an arbitrary current npm release ON THE HOST, as the host user,
// bypassing both the lockfile and this repo's 3-day release-age quarantine —
// and it made the panel depend on registry reachability at read time.
//
// Both are gone. No runtime-install path remains: if the local dependency does
// not resolve we report the metric unavailable (see `ccusageUnavailableReason`)
// instead of reaching for the network.
//
// `ccusage`'s `bin` is `./src/cli.js` and it publishes no `exports` map, so the
// subpath resolves directly. That cli.js is a thin launcher that spawns the
// platform-native binary from an exact-pinned optional dependency
// (`@ccusage/ccusage-<platform>-<arch>@20.0.19`); it has no download path of its
// own, and prints a bounded error when the native package is absent.
//
// `null` = not yet resolved; `''` = resolved-and-failed; non-empty = abs path.
let ccusageCliPathCache: string | null = null;

/**
 * Why this is surfaced rather than swallowed: an unresolvable CLI used to
 * degrade to `npx`, so the panel always had something to show. With the fallback
 * gone, staying silent would render as "$0.00 everywhere" — indistinguishable
 * from a genuinely idle install. Callers read this to say "metric unavailable".
 */
let ccusageUnavailableReason: string | null = null;

const ccusageRequire = createRequire(import.meta.url);

/** Resolve `ccusage/src/cli.js` from this project's node_modules. Memoized.
 *  Returns '' if the dependency is not installed — never installs anything. */
function resolveCcusageCli(): string {
  if (ccusageCliPathCache !== null) return ccusageCliPathCache;
  try {
    ccusageCliPathCache = ccusageRequire.resolve('ccusage/src/cli.js');
    ccusageUnavailableReason = null;
  } catch (err) {
    ccusageCliPathCache = '';
    ccusageUnavailableReason =
      'ccusage is not installed in this checkout — run `pnpm install --frozen-lockfile`' +
      ` (${err instanceof Error ? err.message.split('\n')[0] : String(err)})`;
  }
  return ccusageCliPathCache;
}

/**
 * Non-null means the cost numbers are not merely zero — they are ABSENT.
 * Endpoints echo this so the UI can distinguish "no spend" from "never ran";
 * without it, an install whose CLI cannot resolve renders a confident $0.00.
 * Resolution is memoized, so this is free after the first call.
 */
function ccusageUnavailable(): string | null {
  resolveCcusageCli();
  return ccusageUnavailableReason;
}

/**
 * The exact `ccusage` argv for the Claude cost query.
 *
 * Extracted so it can be asserted on. The defect this replaced lived ENTIRELY
 * in the argument list — a single `--offline` — and no test of the response
 * parser could have caught it, because ccusage's output was well-formed and
 * self-consistent the whole time. It just priced the busiest model at zero.
 */
export function ccusageDailyArgs(since?: string): string[] {
  const args = ['daily', '--json'];
  if (since) args.push('--since', since);
  return args;
}

function runCcusage(claudeConfigDir: string, since?: string): Promise<CcusageDayEntry[]> {
  return new Promise((resolve) => {
    // --breakdown and other legacy flags were removed in ccusage 19. Keep
    // the call to the lowest-common-denominator flags that still work.
    //
    // NO --offline HERE, DELIBERATELY. `--offline` prices from the pricing
    // snapshot bundled inside the pinned ccusage (20.0.19 — already the latest
    // release, so there is no version bump that fixes this). That snapshot has
    // no entry for `claude-opus-5` or `aws/anthropic/bedrock-claude-opus-5`,
    // and ccusage's response to an unknown model is to emit cost 0 with the
    // TOKENS INTACT rather than to error. Measured on slang-coworkers prod
    // 2026-08-11, all 23 agent groups, since 2026-08-01:
    //
    //   claude-opus-5   in 41.0M  out 129.4M  cacheR 38.0B  ->  $0.00 offline
    //                                                           $30,884.70 online
    //
    // opus-5 carries ~98% of the tokens on this box, so every cost number the
    // dashboard rendered — the cost tiles, the daily chart, and cost-per-PR in
    // the funnel — was the 2% tail: ~$603 shown against ~$31,511 actual, a 52x
    // understatement. Nothing went red; an unpriced model and a genuinely free
    // one are indistinguishable in ccusage's output.
    //
    // Online pricing resolves against LiteLLM's live DB, which has had opus-5
    // all along, and leaves every already-correct model byte-identical (haiku
    // 4-5, opus-4-8, sonnet-5 all unchanged) — the signature of a pure
    // pricing-data gap rather than a computation bug. Cost measured at 0.476s
    // vs 0.385s offline, so this is not a latency trade.
    //
    // If the network is unavailable ccusage falls back to the bundled snapshot
    // silently (verified by blackholing the proxy: same $165.58 the offline run
    // produced, no error, full 11 days of data). So this is fail-soft, never
    // fail-blank — but a sustained outage would quietly reinstate the $0. This
    // box has network.
    const ccusageArgs = ccusageDailyArgs(since);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (proc) {
        proc.kill('SIGKILL');
      }
    }, 35000);
    let proc: any;
    // Empty CLAUDE_CONFIG_DIR means "use ccusage's host-default discovery"
    // (single global call covering all detected agents). When set, scopes to
    // that one coworker's Claude history.
    const env: Record<string, string | undefined> = { ...process.env };
    if (claudeConfigDir) env.CLAUDE_CONFIG_DIR = claudeConfigDir;
    else delete env.CLAUDE_CONFIG_DIR;
    // NO sonnet-5 ALIAS. This used to force `claude-sonnet-5=claude-sonnet-4-6`
    // — the workaround for the same offline-snapshot gap that hid opus-5, added
    // when sonnet-5 shipped and the bundled price list didn't know it yet.
    //
    // Against live LiteLLM pricing it is now both redundant and WRONG in two
    // ways. Redundant: `claude-sonnet-5` resolves natively (verified on prod
    // 2026-08-11 — the same $5.83 with the env var unset). Wrong: sonnet-4-6
    // bills at 3e-6/1.5e-5 against sonnet-5's 2e-6/1e-5, so the alias marked
    // sonnet-5 up 50%; and aliasing MERGES THE LABELS, folding sonnet-5's rows
    // into sonnet-4-6 so the per-model breakdown could no longer tell the two
    // apart. That is a bad trade for a panel whose whole job is attribution.
    //
    // Deliberately not replaced with an opus-5 alias for the same reason: an
    // alias buys a plausible total at the cost of a truthful breakdown. Live
    // pricing gives both.
    const cb = (err: any, stdout: string) => {
      clearTimeout(timer);
      if (timedOut || err) {
        resolve([]);
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        const daily = Array.isArray(parsed.daily) ? parsed.daily : [];
        // Global call (no scope) → don't filter by Claude-only; we want
        // both Claude and Codex agent costs in the unified result.
        // Per-coworker call → filter to Claude only (Codex is collected
        // separately per-session via runCodexCcusage).
        const normalize = claudeConfigDir ? normalizeCcusageEntry : normalizeCcusageEntryUnfiltered;
        resolve(daily.map(normalize));
      } catch {
        resolve([]);
      }
    };
    const opts = { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env };
    const cli = resolveCcusageCli();
    if (!cli) {
      // No npx fallback by design — see the resolution block above. The caller
      // renders "metric unavailable" from ccusageUnavailableReason.
      clearTimeout(timer);
      resolve([]);
      return;
    }
    // Direct `node <cli.js> …`: one process, no shell, no npm exec.
    proc = execFile(process.execPath, [cli, ...ccusageArgs], opts, cb);
  });
}

// Normaliser for the global ccusage call — keeps totals across all detected
// agents (Claude + Codex + Gemini + …). Used by refreshCcusageCache's single
// global call. Per-coworker normaliser (normalizeCcusageEntry) still filters
// to Claude-only because per-coworker scope intentionally separates the
// Claude side from the per-session-Codex side.
function normalizeCcusageEntryUnfiltered(raw: Record<string, unknown>): CcusageDayEntry {
  const date = (raw.date as string) || (raw.period as string) || '';
  const modelsUsed = Array.isArray(raw.modelsUsed) ? (raw.modelsUsed as string[]) : [];
  const inputTokens = (raw.inputTokens as number) || 0;
  const outputTokens = (raw.outputTokens as number) || 0;
  const cacheCreationTokens = (raw.cacheCreationTokens as number) || 0;
  const cacheReadTokens = (raw.cacheReadTokens as number) || 0;
  const totalTokens = (raw.totalTokens as number) || 0;
  const totalCost = (raw.totalCost as number) || 0;
  const rawBreakdowns = raw.modelBreakdowns as
    | {
        modelName: string;
        inputTokens: number;
        outputTokens: number;
        cacheCreationTokens: number;
        cacheReadTokens: number;
        cost: number;
      }[]
    | undefined;
  const modelBreakdowns: CcusageDayEntry['modelBreakdowns'] = Array.isArray(rawBreakdowns)
    ? rawBreakdowns.map((mb) => ({ ...mb }))
    : [];
  return {
    date,
    inputTokens,
    outputTokens,
    cacheCreationTokens,
    cacheReadTokens,
    totalTokens,
    totalCost,
    modelsUsed,
    modelBreakdowns,
  };
}

/**
 * Normalise a @ccusage/codex daily entry to the shared CcusageDayEntry shape.
 *
 * Invariant: @ccusage/codex reports `inputTokens` *inclusive* of
 * `cachedInputTokens` (mirrors the raw OpenAI `input_tokens` field, which
 * includes cached). The Anthropic-side `ccusage` feed is non-cached. To keep
 * the two comparable in the Metrics UI — and avoid visually double-counting
 * cached tokens across the INPUT and CACHE READ columns — subtract the
 * cached subset before surfacing `inputTokens`. Pricing is unaffected:
 * @ccusage/codex computes `costUSD` internally with the correct split.
 */
function normalizeCodexEntry(raw: Record<string, unknown>): CcusageDayEntry {
  // Codex dates come as "Apr 06, 2026"; convert to ISO "2026-04-06" so they merge with Claude entries.
  const date = new Date(raw.date as string).toISOString().slice(0, 10);
  const totalCost = (raw.costUSD as number) || 0;
  const totalTokens = (raw.totalTokens as number) || 0;
  const models = (raw.models || {}) as Record<string, Record<string, unknown>>;
  const modelNames = Object.keys(models);
  const modelBreakdowns = modelNames.map((modelName) => {
    const m = models[modelName];
    const modelTokens = (m.totalTokens as number) || 0;
    // Allocate cost proportionally by tokens; exact when there's one model.
    const cost = totalTokens > 0 ? (modelTokens / totalTokens) * totalCost : 0;
    const mCacheRead = (m.cachedInputTokens as number) || 0;
    const mRawInput = (m.inputTokens as number) || 0;
    return {
      modelName,
      inputTokens: Math.max(0, mRawInput - mCacheRead),
      outputTokens: (m.outputTokens as number) || 0,
      cacheCreationTokens: 0,
      cacheReadTokens: mCacheRead,
      cost,
    };
  });
  const cacheRead = (raw.cachedInputTokens as number) || 0;
  const rawInput = (raw.inputTokens as number) || 0;
  return {
    date,
    inputTokens: Math.max(0, rawInput - cacheRead),
    outputTokens: (raw.outputTokens as number) || 0,
    cacheCreationTokens: 0,
    cacheReadTokens: cacheRead,
    totalTokens,
    totalCost,
    modelsUsed: modelNames,
    modelBreakdowns,
  };
}

// Scoped to a specific CODEX_HOME so we can attribute Codex usage to the coworker that
// produced it. Each NanoClaw session that used the codex provider has its own codex dir
// (src/providers/codex.ts mounts <sessionDir>/codex → /home/node/.codex inside the
// container), so we point ccusage's codex subcommand at that dir and get just
// that session's rows.
//
// Why `ccusage codex` (not `@ccusage/codex`): ccusage 20.x absorbed every
// per-agent shim package into a unified CLI with subcommands. The old
// `@ccusage/codex` is now a stub that prints "use npx ccusage instead" to
// stdout — JSON.parse fails on that, runCodexCcusage silently returns [],
// and the dashboard Overview shows zero cost for every Codex coworker even
// when usage is logged. The unified `ccusage codex daily` accepts the same
// flags (`--json --offline --since`) and produces the same shape, so the
// rest of the pipeline (normalizeCodexEntry → mergeDailyEntries) is
// untouched.
function runCodexCcusage(codexHome: string, since?: string): Promise<CcusageDayEntry[]> {
  return new Promise((resolve) => {
    const ccusageArgs = ['codex', 'daily', '--json', '--offline'];
    if (since) ccusageArgs.push('--since', since);
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      if (proc) {
        proc.kill('SIGKILL');
      }
    }, 35000);
    let proc: any;
    const opts = { timeout: 30000, maxBuffer: 10 * 1024 * 1024, env: { ...process.env, CODEX_HOME: codexHome } };
    const cb = (err: any, stdout: string) => {
      clearTimeout(timer);
      if (timedOut || err) {
        resolve([]);
        return;
      }
      try {
        const parsed = JSON.parse(stdout);
        resolve((parsed.daily || []).map(normalizeCodexEntry));
      } catch {
        resolve([]);
      }
    };
    const cli = resolveCcusageCli();
    if (!cli) {
      // No npx fallback by design — see the resolution block above.
      clearTimeout(timer);
      resolve([]);
      return;
    }
    // Direct `node <cli.js> codex …`: one process, no shell, no npm exec.
    proc = execFile(process.execPath, [cli, ...ccusageArgs], opts, cb);
  });
}

function mergeDailyEntries(allDays: CcusageDayEntry[][]): CcusageDayEntry[] {
  const byDate: Record<string, CcusageDayEntry> = {};
  for (const days of allDays) {
    for (const d of days) {
      if (!d.date) continue; // entry missing date field — can't merge, skip rather than crash
      const breakdowns = Array.isArray(d.modelBreakdowns) ? d.modelBreakdowns : [];
      const models = Array.isArray(d.modelsUsed) ? d.modelsUsed : [];
      if (!byDate[d.date]) {
        byDate[d.date] = {
          ...d,
          modelBreakdowns: breakdowns.map((mb) => ({ ...mb })),
          modelsUsed: [...models],
        };
      } else {
        const t = byDate[d.date];
        t.inputTokens += d.inputTokens;
        t.outputTokens += d.outputTokens;
        t.cacheCreationTokens += d.cacheCreationTokens;
        t.cacheReadTokens += d.cacheReadTokens;
        t.totalTokens += d.totalTokens;
        t.totalCost += d.totalCost;
        for (const m of models) {
          if (!t.modelsUsed.includes(m)) t.modelsUsed.push(m);
        }
        for (const mb of breakdowns) {
          const existing = t.modelBreakdowns.find((e) => e.modelName === mb.modelName);
          if (existing) {
            existing.cost += mb.cost;
            existing.inputTokens += mb.inputTokens;
            existing.outputTokens += mb.outputTokens;
            existing.cacheReadTokens += mb.cacheReadTokens;
            existing.cacheCreationTokens += mb.cacheCreationTokens;
          } else {
            t.modelBreakdowns.push({ ...mb });
          }
        }
      }
    }
  }
  return Object.values(byDate).sort((a, b) => a.date.localeCompare(b.date));
}

// Re-entrancy guard: refreshCcusageCache is driven by a 60s setInterval AND a
// boot warm-up. Each refresh fans out a batch of `npx ccusage` subprocesses
// that, under host load, can take far longer than 60s. Without this guard the
// timer stacks a fresh batch on top of every still-running one, the process
// count grows without bound, and load spirals (observed: 5 dashboards × stacked
// batches → load 79 on 8 cores). When a refresh is already in flight we SKIP
// the new tick rather than queue it — a stale-by-60s cache is fine; a fork bomb
// is not.
let ccusageRefreshInFlight = false;

async function refreshCcusageCache(): Promise<void> {
  if (ccusageRefreshInFlight) return;
  ccusageRefreshInFlight = true;
  try {
    await refreshCcusageCacheInner();
  } finally {
    ccusageRefreshInFlight = false;
  }
}

async function refreshCcusageCacheInner(): Promise<void> {
  // Per-coworker ccusage refresh, but bounded:
  //  - One Claude call per coworker (CLAUDE_CONFIG_DIR=<agDir>/.claude-shared, --since 30d)
  //  - One Codex call per session that actually has rollout-*.jsonl (skip empty codex/ dirs)
  //  - Concurrency cap = 4 to keep host load bounded
  //  - Single 30-day window, period buckets derived locally
  //
  // Previously: 4 calls × 13 ag-dirs + 4 calls × 70 codex sessions = 332 npx subprocesses
  // per refresh, never finishing before the next refresh kicked in. New shape on lego:
  // 13 Claude + 15 Codex sessions-with-rollouts = ~28 sequential ccusage calls.
  const sessionsDir = join(getDataDir(), 'v2-sessions');
  if (!existsSync(sessionsDir)) return;

  const nameMap = new Map<string, string>();
  if (db) {
    try {
      const groups = db.prepare('SELECT id, name FROM agent_groups').all() as { id: string; name: string }[];
      for (const g of groups) nameMap.set(g.id, g.name);
    } catch {
      /* ignore */
    }
  }

  let agDirs: string[];
  try {
    agDirs = readdirSync(sessionsDir).filter((d) => d.startsWith('ag-'));
  } catch {
    return;
  }

  const month = ccusageSinceDate(30);
  const today1 = ccusageSinceDate(0);
  const today7 = ccusageSinceDate(7);
  const today30 = ccusageSinceDate(30);
  const within = (entry: CcusageDayEntry, since: string) =>
    !since || (entry.date && entry.date.replace(/-/g, '') >= since);

  // Build the work list: one task per coworker for Claude, one task per
  // session-with-codex-rollouts for Codex. We keep them as { agDir, kind, dir }
  // tuples so concurrency-bounded execution can interleave both providers.
  type Task = { agDir: string; kind: 'claude'; dir: string } | { agDir: string; kind: 'codex'; dir: string };
  const tasks: Task[] = [];
  for (const agDir of agDirs) {
    const claudeShared = join(sessionsDir, agDir, '.claude-shared');
    if (existsSync(join(claudeShared, 'projects'))) {
      tasks.push({ agDir, kind: 'claude', dir: claudeShared });
    }
    let sessIds: string[] = [];
    try {
      sessIds = readdirSync(join(sessionsDir, agDir)).filter((s) => s.startsWith('sess-'));
    } catch {
      continue;
    }
    for (const sessId of sessIds) {
      const cxHome = join(sessionsDir, agDir, sessId, 'codex');
      // Skip if codex/ is just a scaffold with no rollouts — empty calls
      // were the bulk of the old fan-out's wasted work.
      let hasRollouts = false;
      try {
        const sessRoot = join(cxHome, 'sessions');
        if (existsSync(sessRoot)) {
          const stack = [sessRoot];
          while (stack.length > 0 && !hasRollouts) {
            const cur = stack.pop()!;
            for (const e of readdirSync(cur, { withFileTypes: true })) {
              if (e.isDirectory()) stack.push(join(cur, e.name));
              else if (e.isFile() && e.name.startsWith('rollout-') && e.name.endsWith('.jsonl')) {
                hasRollouts = true;
                break;
              }
            }
          }
        }
      } catch {
        /* skip on read error */
      }
      if (hasRollouts) tasks.push({ agDir, kind: 'codex', dir: cxHome });
    }
  }

  // Per-coworker accumulator
  const perGroup = new Map<string, CcusageDayEntry[][]>();
  for (const agDir of agDirs) perGroup.set(agDir, []);

  // Bounded-concurrency runner. Cap to CPU threads (minus a couple reserved for
  // the event loop + other work), floored at 2 and ceilinged at 8 — a single
  // `npx ccusage` is CPU-light but the npm-exec resolution it does per call is
  // not free, so we never want this fan-out to saturate the box. Multiple
  // dashboards may run on one host, so staying well under nproc per dashboard
  // keeps the aggregate sane.
  const CONCURRENCY = Math.max(2, Math.min(8, (cpus().length || 4) - 2));
  let nextIdx = 0;
  async function worker() {
    while (true) {
      const idx = nextIdx++;
      if (idx >= tasks.length) return;
      const t = tasks[idx];
      const rows = t.kind === 'claude' ? await runCcusage(t.dir, month) : await runCodexCcusage(t.dir, month);
      perGroup.get(t.agDir)!.push(rows);
    }
  }
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, tasks.length) }, worker));

  // Supplement with skill-transcript JSONL entries for models ccusage doesn't
  // price yet (e.g. claude-sonnet-5). Synchronous scan — these files are small.
  for (const agDir of agDirs) {
    const claudeShared = join(sessionsDir, agDir, '.claude-shared');
    const skillEntries = scanSkillTranscriptCosts(claudeShared, month);
    if (skillEntries.length > 0) perGroup.get(agDir)!.push(skillEntries);
  }

  // Build the cache: per-coworker merged daily, then combined.
  const result: CcusageCache = {
    '1d': { combined: [], byGroup: [] },
    '7d': { combined: [], byGroup: [] },
    '30d': { combined: [], byGroup: [] },
    all: { combined: [], byGroup: [] },
    lastRefresh: Date.now(),
  };
  const allByPeriod: Record<'1d' | '7d' | '30d' | 'all', CcusageDayEntry[][]> = {
    '1d': [],
    '7d': [],
    '30d': [],
    all: [],
  };
  for (const agDir of agDirs) {
    const slices = perGroup.get(agDir)!;
    if (slices.length === 0) continue;
    const merged = mergeDailyEntries(slices);
    if (merged.length === 0) continue;
    const groupName = nameMap.get(agDir) || agDir;
    const daily30 = merged.filter((e) => within(e, today30));
    const daily7 = merged.filter((e) => within(e, today7));
    const daily1 = merged.filter((e) => within(e, today1));
    const dailyAll = merged.slice();
    result['1d'].byGroup.push({ groupId: agDir, groupName, daily: daily1 });
    result['7d'].byGroup.push({ groupId: agDir, groupName, daily: daily7 });
    result['30d'].byGroup.push({ groupId: agDir, groupName, daily: daily30 });
    result.all.byGroup.push({ groupId: agDir, groupName, daily: dailyAll });
    allByPeriod['1d'].push(daily1);
    allByPeriod['7d'].push(daily7);
    allByPeriod['30d'].push(daily30);
    allByPeriod.all.push(dailyAll);
  }
  result['1d'].combined = mergeDailyEntries(allByPeriod['1d']);
  result['7d'].combined = mergeDailyEntries(allByPeriod['7d']);
  result['30d'].combined = mergeDailyEntries(allByPeriod['30d']);
  result.all.combined = mergeDailyEntries(allByPeriod.all);

  ccusageCache = result;
}

// Track which client (if any) is actively viewing the Admin > Infra screen
let ccusageRefreshClient: any = null;
let ccusageRefreshTimer: any = null;

function startCcusageRefresh(clientSocket: any): void {
  // Only one client can trigger refreshes at a time
  if (ccusageRefreshClient === clientSocket) return;

  // Stop previous refresh
  if (ccusageRefreshTimer) {
    clearInterval(ccusageRefreshTimer);
    ccusageRefreshTimer = null;
  }
  if (ccusageRefreshClient && ccusageRefreshClient !== clientSocket) {
    ccusageRefreshClient = null;
  }

  // Set new client
  ccusageRefreshClient = clientSocket;

  // Initial refresh immediately
  refreshCcusageCache();

  // Then refresh every 60 seconds only while this client is active
  ccusageRefreshTimer = setInterval(() => {
    if (ccusageRefreshClient === clientSocket) {
      refreshCcusageCache();
    } else {
      clearInterval(ccusageRefreshTimer);
      ccusageRefreshTimer = null;
    }
  }, 60000);
  ccusageRefreshTimer.unref?.();
}

function stopCcusageRefresh(clientSocket: any): void {
  if (ccusageRefreshClient === clientSocket) {
    ccusageRefreshClient = null;
    if (ccusageRefreshTimer) {
      clearInterval(ccusageRefreshTimer);
      ccusageRefreshTimer = null;
    }
  }
}

// ---------- 24h message activity cache ----------
interface ActivityBucket {
  hour: string;
  inbound: number;
  outbound: number;
}
// Funnel recompute state. The funnel makes ~180 GitHub calls and takes ~3 min,
// so the dashboard "Refresh" button kicks off an async recompute rather than
// holding the request. `funnelRefresh.running` guards against concurrent runs
// (button spam, or a click that overlaps the 6-hourly cron). We shell out to
// scripts/funnel-cron.sh — the single source of truth for the proxy-stripping
// env and logging the cron already relies on — instead of duplicating it here.
let funnelRefresh: {
  running: boolean;
  startedAt: number | null;
  finishedAt: number | null;
  lastError: string | null;
} = { running: false, startedAt: null, finishedAt: null, lastError: null };

function startFunnelRefresh(): { started: boolean } {
  if (funnelRefresh.running) return { started: false };
  funnelRefresh = {
    running: true,
    startedAt: Date.now(),
    finishedAt: null,
    lastError: null,
  };
  const script = join(getProjectRoot(), 'scripts', 'funnel-cron.sh');
  // The script sets PATH, HOME, strips proxy vars, cds to the repo, and writes
  // reports/funnel.json + logs/funnel-cron.log. We just launch it detached.
  const child = exec(
    `bash ${JSON.stringify(script)}`,
    { timeout: 8 * 60 * 1000, maxBuffer: 16 * 1024 * 1024 },
    (err) => {
      funnelRefresh.running = false;
      funnelRefresh.finishedAt = Date.now();
      funnelRefresh.lastError = err ? String(err.message || err) : null;
    },
  );
  // Don't let a slow refresh keep the event loop / process alive on shutdown.
  child.unref?.();
  return { started: true };
}

let activityDataCache: ActivityBucket[] | null = null;

function refreshActivityData(): void {
  const sessionsDir = join(getDataDir(), 'v2-sessions');
  if (!existsSync(sessionsDir)) {
    activityDataCache = null;
    return;
  }

  const now = Date.now();
  const buckets: Record<string, { inbound: number; outbound: number }> = {};
  for (let i = 0; i < 24; i++) {
    const key = new Date(now - i * 3600000).toISOString().slice(0, 13);
    buckets[key] = { inbound: 0, outbound: 0 };
  }
  const cutoff = new Date(now - 86400000).toISOString();

  let agDirs: string[];
  try {
    agDirs = readdirSync(sessionsDir).filter((d) => d.startsWith('ag-'));
  } catch {
    return;
  }

  for (const agDir of agDirs) {
    const agPath = join(sessionsDir, agDir);
    let sessDirs: string[];
    try {
      sessDirs = readdirSync(agPath).filter((d) => d.startsWith('sess-'));
    } catch {
      continue;
    }
    for (const sessDir of sessDirs) {
      for (const [dbName, direction] of [
        ['inbound.db', 'inbound'],
        ['outbound.db', 'outbound'],
      ] as const) {
        const dbPath = join(agPath, sessDir, dbName);
        if (!existsSync(dbPath)) continue;
        let sdb: InstanceType<typeof Database> | null = null;
        try {
          sdb = new Database(dbPath, { readonly: true });
          sdb.pragma('busy_timeout = 1000');
          const table = direction === 'outbound' ? 'messages_out' : 'messages_in';
          const rows = sdb.prepare(`SELECT timestamp FROM ${table} WHERE timestamp > ?`).all(cutoff) as {
            timestamp: string;
          }[];
          for (const row of rows) {
            const key = row.timestamp.slice(0, 13);
            if (buckets[key]) buckets[key][direction]++;
          }
        } catch {
          /* skip */
        } finally {
          try {
            sdb?.close();
          } catch {
            /* ignore */
          }
        }
      }
    }
  }

  activityDataCache = Object.entries(buckets)
    .map(([hour, counts]) => ({ hour, ...counts }))
    .sort((a, b) => a.hour.localeCompare(b.hour));
}
refreshActivityData();
activityTimer = setInterval(refreshActivityData, 30000);
activityTimer.unref?.();

// ---------- Users data collection ----------
interface UserData {
  id: string;
  kind: string;
  display_name: string | null;
  privilege: string;
  roles: { role: string; agent_group_id: string | null; agent_group_name: string | null }[];
  memberships: { agent_group_id: string; agent_group_name: string }[];
  dmChannels: { channel_type: string }[];
}

function collectUsersData(): UserData[] {
  if (!db) return [];
  try {
    const users = db.prepare('SELECT id, kind, display_name, created_at FROM users').all() as any[];
    return users.map((u) => {
      const roles = db!.prepare('SELECT role, agent_group_id FROM user_roles WHERE user_id = ?').all(u.id) as any[];
      const memberships = db!
        .prepare(
          `SELECT agm.agent_group_id, ag.name as agent_group_name
         FROM agent_group_members agm
         JOIN agent_groups ag ON ag.id = agm.agent_group_id
         WHERE agm.user_id = ?`,
        )
        .all(u.id) as any[];
      const dms = db!.prepare('SELECT channel_type FROM user_dms WHERE user_id = ?').all(u.id) as any[];

      const rolesWithNames = roles.map((r: any) => {
        let agName: string | null = null;
        if (r.agent_group_id) {
          const ag = db!.prepare('SELECT name FROM agent_groups WHERE id = ?').get(r.agent_group_id) as any;
          agName = ag?.name || null;
        }
        return { role: r.role, agent_group_id: r.agent_group_id, agent_group_name: agName };
      });

      let privilege = 'none';
      if (roles.some((r: any) => r.role === 'owner')) privilege = 'owner';
      else if (roles.some((r: any) => r.role === 'admin' && !r.agent_group_id)) privilege = 'global_admin';
      else if (roles.some((r: any) => r.role === 'admin')) privilege = 'admin';
      else if (memberships.length > 0) privilege = 'member';

      return {
        id: u.id,
        kind: u.kind,
        display_name: u.display_name,
        privilege,
        roles: rolesWithNames,
        memberships,
        dmChannels: dms,
      };
    });
  } catch {
    return [];
  }
}

// ---------- Channel status collection ----------
interface ChannelStatusData {
  channelType: string;
  configured: boolean;
  groupCount: number;
  groups: { id: string; name: string | null; platform_id: string; is_group: number; agentGroups: string[] }[];
}

function collectChannelStatus(): ChannelStatusData[] {
  if (!db) return [];
  try {
    const channelsDir = resolve(
      process.env.NANOCLAW_DASHBOARD_CHANNELS_DIR || join(getProjectRoot(), 'src', 'channels'),
    );
    const exclude = new Set([
      'index.ts',
      'registry.ts',
      'registry.test.ts',
      'channel-registry.ts',
      'channel-registry.test.ts',
      'adapter.ts',
      'chat-sdk-bridge.ts',
      'chat-sdk-bridge.test.ts',
      'ask-question.ts',
      'cli.ts',
      'telegram-pairing.ts',
      'telegram-markdown-sanitize.ts',
    ]);
    const results: ChannelStatusData[] = [];
    if (!existsSync(channelsDir)) return [];

    const prefixMap: Record<string, string> = {
      telegram: 'telegram:',
      whatsapp: 'wa:',
      discord: 'disc:',
      slack: 'slack:',
      signal: 'sig:',
      matrix: 'mx:',
      gmail: 'gmail:',
      dashboard: 'dashboard:',
    };

    for (const file of readdirSync(channelsDir)) {
      if (!file.endsWith('.ts') || exclude.has(file) || file.includes('.test.')) continue;
      const name = file.replace('.ts', '');
      const prefix = prefixMap[name] || `${name}:`;
      const groups: ChannelStatusData['groups'] = [];
      try {
        const rows = db
          .prepare(
            `SELECT mg.id, mg.platform_id, mg.name, mg.is_group, ag.name as ag_name
           FROM messaging_groups mg
           JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
           JOIN agent_groups ag ON ag.id = mga.agent_group_id
           WHERE mg.platform_id LIKE ?`,
          )
          .all(`${prefix}%`) as any[];
        const byMg = new Map<
          string,
          { id: string; name: string | null; platform_id: string; is_group: number; agentGroups: string[] }
        >();
        for (const r of rows) {
          if (!byMg.has(r.id))
            byMg.set(r.id, {
              id: r.id,
              name: r.name,
              platform_id: r.platform_id,
              is_group: r.is_group,
              agentGroups: [],
            });
          byMg.get(r.id)!.agentGroups.push(r.ag_name);
        }
        groups.push(...byMg.values());
      } catch {
        /* ignore */
      }
      results.push({ channelType: name, configured: groups.length > 0, groupCount: groups.length, groups });
    }

    return results.sort((a, b) => a.channelType.localeCompare(b.channelType));
  } catch {
    return [];
  }
}

// ---------- Manifest summary cache (composition breakdown) ----------
interface ManifestSummary {
  typeName: string;
  skillCount: number;
  workflowCount: number;
  overlayCount: number;
  invariantCount: number;
  contextFragmentCount: number;
  bindingCount: number;
  toolCount: number;
  mcpServerCount: number;
  skills: string[];
  workflows: string[];
  overlays: string[];
  tools: string[];
  invariants: string[];
  contextFragments: string[];
}
const manifestSummaryCache = new Map<string, ManifestSummary>();

function refreshManifestSummaryCache(): void {
  if (!db) return;
  try {
    const req = createRequire(import.meta.url);
    const { resolveCoworkerManifest, readCoworkerTypes, readSkillCatalog } = req(
      join(getProjectRoot(), 'dist', 'claude-composer.js'),
    );
    const types = readCoworkerTypes(getProjectRoot());
    const catalog = readSkillCatalog(getProjectRoot());
    const groups = db
      .prepare("SELECT folder, coworker_type FROM agent_groups WHERE coworker_type IS NOT NULL AND coworker_type != ''")
      .all() as { folder: string; coworker_type: string }[];
    for (const group of groups) {
      try {
        const manifest = resolveCoworkerManifest(types, group.coworker_type, catalog, getProjectRoot());
        const overlayNames = [
          ...new Set(
            (manifest.customizations || [])
              .filter((c: any) => c.kind === 'overlay' && c.overlayName)
              .map((c: any) => c.overlayName as string),
          ),
        ];
        manifestSummaryCache.set(group.folder, {
          typeName: manifest.typeName || group.coworker_type,
          skillCount: manifest.skills?.length || 0,
          workflowCount: manifest.workflows?.length || 0,
          overlayCount: overlayNames.length,
          invariantCount: manifest.invariants?.length || 0,
          contextFragmentCount: manifest.context?.length || 0,
          bindingCount: Object.keys(manifest.bindings || {}).length,
          toolCount: manifest.tools?.length || 0,
          mcpServerCount: Object.keys(manifest.mcpServers || {}).length,
          skills: (manifest.skills || []).map((s: any) => s.name),
          workflows: (manifest.workflows || []).map((w: any) => w.name),
          overlays: overlayNames,
          tools: manifest.tools || [],
          invariants: (manifest.invariants || []).map(
            (t: string) =>
              t
                .split('\n')[0]
                .replace(/^#+\s*/, '')
                .trim() || 'unnamed',
          ),
          contextFragments: (manifest.context || []).map(
            (t: string) =>
              t
                .split('\n')[0]
                .replace(/^#+\s*/, '')
                .trim() || 'unnamed',
          ),
        });
      } catch {
        /* skip broken type */
      }
    }
  } catch {
    /* composer not available */
  }
}
refreshManifestSummaryCache();
const manifestTimer = setInterval(refreshManifestSummaryCache, 30000);
manifestTimer.unref?.();

// Live status from hooks (group_folder -> latest state)
const liveHookState = new Map<
  string,
  {
    tool?: string;
    notification?: string;
    status: CoworkerState['status'];
    ts: number;
    agentActive: boolean;
  }
>();
const liveSubagentState = new Map<string, Map<string, SubagentState>>();
const SUBAGENT_STALE_MS = 5 * 60 * 1000;
const SUBAGENT_EXIT_MS = 12 * 1000;
// Groups that have ever sent a hook event — prevents "container running + no hookState" from
// being treated as "working" after hook state expires following a Stop event.
const hookEverSeen = new Set<string>();
// Seed hookEverSeen from DB so dashboard restarts don't reset status
try {
  if (db) {
    const rows = db.prepare('SELECT DISTINCT group_folder FROM hook_events').all() as { group_folder: string }[];
    for (const r of rows) hookEverSeen.add(r.group_folder);
  }
} catch {
  /* hook_events table may not exist yet */
}

// Cached set of running container name prefixes (refreshed async every 5s).
// Scoped to the instance's CONTAINER_PREFIX so containers belonging to
// sibling NanoClaw instances on the same host (prod, another dev, etc.)
// don't bleed into this dashboard's running-state view.
const runningContainers = new Set<string>();

/** Container-name prefix used for docker ps --filter. Falls back to
 * 'nanoclaw-' for historical setups that never set CONTAINER_PREFIX. */
function getContainerNameFilter(): string {
  const prefix = process.env.CONTAINER_PREFIX || 'nanoclaw';
  return `${prefix}-`;
}

function refreshContainerStatus(): void {
  const filter = getContainerNameFilter();
  exec(`docker ps --filter name=${filter} --format "{{.Names}}" 2>/dev/null`, { timeout: 3000 }, (_err, stdout) => {
    runningContainers.clear();
    if (stdout) {
      for (const name of stdout.trim().split('\n')) {
        if (name) runningContainers.add(name);
      }
    }
  });
}

// Initial refresh + periodic update
refreshContainerStatus();
const containerStatusTimer = setInterval(refreshContainerStatus, 5000);
containerStatusTimer.unref?.();

/** Check if a group folder has a running container (from cache). */
function hasRunningContainer(folder: string): boolean {
  return findRunningContainer(folder) !== null;
}

let cachedTypes: { data: Record<string, any>; mtimeMs: number } | null = null;
function getCoworkerTypes(): Record<string, any> {
  let jsonTypes: Record<string, any> = {};
  try {
    const st = statSync(getCoworkerTypesPath());
    if (cachedTypes && cachedTypes.mtimeMs === st.mtimeMs) {
      jsonTypes = cachedTypes.data;
    } else {
      jsonTypes = JSON.parse(readFileSync(getCoworkerTypesPath(), 'utf-8'));
      cachedTypes = { data: jsonTypes, mtimeMs: st.mtimeMs };
    }
  } catch {
    /* no JSON file */
  }
  const legoTypes = readLegoCoworkerTypes();
  return { ...legoTypes, ...jsonTypes };
}

// Shallow merge of the lego coworker-type registry: every
// container/skills/<skill>/coworker-types.yaml is read and merged. Duplicate type
// names have their extends left-wins-ish (first skill's extends retained
// unless a later one sets it explicitly). Only fields the dashboard needs are
// preserved: extends, description. Full merge semantics live in the
// composer (src/claude-composer.ts); this helper exists because the dashboard
// only needs the extends chain for requires.coworkerTypes walks.
function readLegoCoworkerTypes(): Record<
  string,
  { extends?: string | string[]; description?: string; project?: string; flat?: boolean; skills?: string[] }
> {
  const registry: Record<
    string,
    { extends?: string | string[]; description?: string; project?: string; flat?: boolean; skills?: string[] }
  > = {};
  // Post-refactor, project/spine types (base-common, nanoclaw-*, slang-*,
  // slangpy-*) live under container/spines/*/coworker-types.yaml.
  // Capability-skill addons (dashboard-base, nanoclaw-base) still ship
  // coworker-types.yaml under container/skills/ to contribute `context`
  // fragments to main/global. Scan both roots — spines first so authoritative
  // type definitions register before skill-layer addons extend them. This
  // mirrors TYPE_SOURCE_DIRS in src/claude-composer/registry.ts.
  const roots = [join(getProjectRoot(), 'container', 'spines'), getSkillsDir()];
  let yamlLoad: (input: string) => any;
  try {
    yamlLoad = createRequire(import.meta.url)('js-yaml').load;
  } catch {
    return registry;
  }
  for (const rootDir of roots) {
    let dirents: string[];
    try {
      dirents = readdirSync(rootDir);
    } catch {
      continue;
    }
    dirents.sort();
    for (const entry of dirents) {
      const filePath = join(rootDir, entry, 'coworker-types.yaml');
      if (!existsSync(filePath)) continue;
      try {
        const doc = yamlLoad(readFileSync(filePath, 'utf-8'));
        if (!doc || typeof doc !== 'object') continue;
        for (const [name, rawEntry] of Object.entries(doc) as [string, any][]) {
          if (!rawEntry || typeof rawEntry !== 'object') continue;
          const existing = registry[name];
          const existingSkills = existing?.skills || [];
          const newSkills = Array.isArray(rawEntry.skills) ? rawEntry.skills : [];
          registry[name] = {
            extends: rawEntry.extends ?? existing?.extends,
            description: rawEntry.description ?? existing?.description,
            project: rawEntry.project ?? existing?.project,
            flat: rawEntry.flat ?? existing?.flat,
            skills: [...new Set([...existingSkills, ...newSkills])],
          };
        }
      } catch {
        /* skip malformed file */
      }
    }
  }
  return registry;
}

/** Read allowed-tools from all SKILL.md frontmatter. Returns skill name → mcp tool list. */
let _skillToolsCache: Record<string, string[]> | null = null;
function readSkillAllowedTools(): Record<string, string[]> {
  if (_skillToolsCache) return _skillToolsCache;
  const result: Record<string, string[]> = {};
  const skillsDir = getSkillsDir();
  try {
    for (const entry of readdirSync(skillsDir)) {
      const skillMd = join(skillsDir, entry, 'SKILL.md');
      if (!existsSync(skillMd)) continue;
      try {
        const content = readFileSync(skillMd, 'utf-8');
        const fmMatch = content.match(/^---\n([\s\S]*?)\n---/);
        if (!fmMatch) continue;
        let yamlLoad: (input: string) => any;
        try {
          yamlLoad = createRequire(import.meta.url)('js-yaml').load;
        } catch {
          continue;
        }
        const meta = yamlLoad(fmMatch[1]);
        if (!meta?.name || !meta['allowed-tools']) continue;
        const tools = String(meta['allowed-tools'])
          .split(',')
          .map((t) => t.trim())
          .filter((t) => t.startsWith('mcp__'));
        if (tools.length > 0) result[meta.name] = tools;
      } catch {
        /* skip */
      }
    }
  } catch {
    /* no skills dir */
  }
  _skillToolsCache = result;
  return result;
}

/** Resolve all MCP tools for a coworker type by walking the skill chain. */
function resolveLegoMcpTools(coworkerType: string): string[] {
  const types = readLegoCoworkerTypes();
  const skillTools = readSkillAllowedTools();
  const allSkills = new Set<string>();

  function walkType(name: string, depth = 0): void {
    if (depth > 10) return;
    const t = types[name];
    if (!t) return;
    for (const s of t.skills || []) allSkills.add(s);
    const ext = t.extends;
    if (Array.isArray(ext)) ext.forEach((e) => walkType(e, depth + 1));
    else if (ext) walkType(ext, depth + 1);
  }

  walkType(coworkerType);
  const tools = new Set<string>();
  for (const skill of allSkills) {
    for (const tool of skillTools[skill] || []) tools.add(tool);
  }
  return [...tools].sort();
}

/**
 * Resolve a coworker folder (and optionally a specific NanoClaw session id)
 * to a running docker container name.
 *
 * With per-thread sessions, a single folder can have N concurrent
 * containers. When `sessionId` is provided we match exactly on the
 * container-name embedding format written by container-runner.ts:
 *   `<prefix>-<folder>-<session-tail>-<ts>`
 * (where `<session-tail>` is `sess-xxx` with the `sess-` prefix stripped).
 *
 * When `sessionId` is omitted the old folder-only match is preserved so
 * unthreaded callers keep working — this is a compatibility shim while
 * UI callers migrate to passing `sessionId` / `threadId`.
 */
/**
 * Pure matcher for container names — exported so unit tests can hit the
 * folder/session matching rules without booting the whole dashboard
 * server. `names` is injected as an iterable so the test can just hand in
 * a list of candidates.
 *
 * Name format (from src/container-runner.ts:433):
 *     <prefix>-<folder>-<session-tail>-<ts>
 *  where ts is `Date.now()` (13 digits) and session-tail is
 *  `<sessionId-without-sess-prefix>`, which itself contains a `-`.
 *
 * Rules this enforces that the old prefix-only check did not:
 *  1. Suffix after `<prefix>-<folder>-` MUST end with `-<13-digit-ts>`.
 *     Rejects stray names that happen to share the folder prefix but
 *     aren't NanoClaw containers (old ad-hoc containers, exec helpers).
 *  2. When `sessionId` is supplied, match exactly on
 *     `<prefix>-<folder>-<tail>-...-<ts>`. The tail-delimiter rules
 *     out `foo-bar`'s containers masquerading as folder `foo` session
 *     `bar-...`.
 *  3. When `knownFolders` is supplied, prefer the LONGEST known folder
 *     that prefixes the name — so a lookup for `foo` against
 *     `<prefix>-foo-bar-...` returns null when `foo-bar` is also a
 *     registered folder. Callers that don't have the known-folders set
 *     skip this step (permissive behaviour, used by non-shell code paths
 *     that just need "is anything running for this folder").
 */
export function matchContainerName(
  names: Iterable<string>,
  folder: string,
  sessionId: string | null,
  prefix: string,
  knownFolders?: Iterable<string>,
): string | null {
  // Container names preserve folder underscores verbatim — see
  // src/container-runner.ts:435 which builds the name as
  // `${CONTAINER_PREFIX}-${agentGroup.folder}-${tail}-${ts}`. An earlier
  // version of this matcher normalized `_` → `-`, which silently broke
  // container lookup for any coworker whose folder contains an underscore
  // (e.g. `codex_test`): findRunningContainer returned null even though
  // docker ps showed `<prefix>-codex_test-…` running, surfacing in the
  // dashboard as "Shell: nothing running" while the container was healthy.
  const folderPrefix = `${prefix}-${folder}-`;

  const rivalFolderPrefixes: string[] = [];
  if (knownFolders) {
    // PR #448 dropped the `_` → `-` normalization on `folder` but left
    // dangling references to the now-removed `containerFolder` local AND
    // a `kfNorm` that normalized known-folder names. Both wrong under
    // verbatim matching: just compare known folders to `folder` directly.
    for (const kf of knownFolders) {
      if (kf === folder) continue;
      if (kf.length > folder.length && kf.startsWith(`${folder}-`)) {
        rivalFolderPrefixes.push(`${prefix}-${kf}-`);
      }
    }
  }

  const ownedByRival = (name: string): boolean => rivalFolderPrefixes.some((rp) => name.startsWith(rp));

  if (sessionId) {
    const tail = sessionId.startsWith('sess-') ? sessionId.slice(5) : sessionId;
    const exactPrefix = `${folderPrefix}${tail}-`;
    for (const name of names) {
      if (ownedByRival(name)) continue;
      if (name.startsWith(exactPrefix) && /-\d{13}$/.test(name)) return name;
    }
    return null;
  }
  for (const name of names) {
    if (!name.startsWith(folderPrefix)) continue;
    if (ownedByRival(name)) continue;
    if (!/-\d{13}$/.test(name)) continue;
    return name;
  }
  return null;
}

/**
 * Resolve the container used by a shell request.
 *
 * An explicit thread must match its exact session container. A folder-scoped
 * request (used by Shared Artifacts) prefers the root session container, but
 * may use any live container for that coworker because every session mounts
 * the same /workspace/agent directory.
 */
export function matchContainerNameForRequest(
  names: Iterable<string>,
  folder: string,
  sessionId: string | null,
  hasExplicitThread: boolean,
  prefix: string,
  knownFolders?: Iterable<string>,
): string | null {
  if (sessionId) {
    const exact = matchContainerName(names, folder, sessionId, prefix, knownFolders);
    if (exact) return exact;
  }
  if (hasExplicitThread) return null;
  return matchContainerName(names, folder, null, prefix, knownFolders);
}

function findRunningContainer(
  folder: string,
  sessionId?: string | null,
  knownFolders?: Iterable<string>,
): string | null {
  const prefix = process.env.CONTAINER_PREFIX || 'nanoclaw';
  return matchContainerName(runningContainers, folder, sessionId ?? null, prefix, knownFolders);
}

function findRunningContainerForRequest(
  folder: string,
  sessionId: string | null,
  hasExplicitThread: boolean,
): string | null {
  const prefix = process.env.CONTAINER_PREFIX || 'nanoclaw';
  return matchContainerNameForRequest(runningContainers, folder, sessionId, hasExplicitThread, prefix);
}

export function containerExecArgs(containerName: string, command: string): string[] {
  return ['exec', containerName, 'bash', '-c', command];
}

/**
 * Registered folders from agent_groups. Handed to matchContainerName so
 * it can use longest-prefix-wins to reject false matches where folder
 * `foo` would otherwise hit a container for `foo-bar`. Returns an empty
 * set when the DB isn't available — callers degrade to permissive
 * matching, which is acceptable (collisions are rare).
 */
function listKnownFolders(db: import('better-sqlite3').Database | null): Set<string> {
  if (!db) return new Set<string>();
  try {
    const rows = db.prepare('SELECT folder FROM agent_groups').all() as { folder: string }[];
    return new Set(rows.map((r) => r.folder));
  } catch {
    return new Set<string>();
  }
}

/**
 * Resolve `(folder, thread_id)` → active NanoClaw session id. Used by the
 * shell-exec endpoints to thread UI context (currently-viewed session)
 * through to `findRunningContainer`. Returns null when no matching active
 * session exists — callers should fall back to the folder-scoped match
 * for back-compat.
 */
function sessionIdForThread(
  db: import('better-sqlite3').Database,
  folder: string,
  threadId: string | null,
): string | null {
  try {
    const row = db
      .prepare(
        threadId
          ? `SELECT s.id AS id FROM sessions s
               JOIN agent_groups ag ON ag.id = s.agent_group_id
              WHERE ag.folder = ? AND s.thread_id = ? AND s.status = 'active'
              ORDER BY s.created_at DESC LIMIT 1`
          : `SELECT s.id AS id FROM sessions s
               JOIN agent_groups ag ON ag.id = s.agent_group_id
              WHERE ag.folder = ? AND s.thread_id IS NULL AND s.status = 'active'
              ORDER BY s.created_at DESC LIMIT 1`,
      )
      .get(...(threadId ? [folder, threadId] : [folder])) as { id: string } | undefined;
    return row?.id ?? null;
  } catch {
    return null;
  }
}

/** Load coworker type colors from coworker-types.json. Cached. */
let _typeColors: Record<string, string> | null = null;
function getTypeColors(): Record<string, string> {
  if (_typeColors) return _typeColors;
  _typeColors = {};
  try {
    const types = JSON.parse(readFileSync(getCoworkerTypesPath(), 'utf-8'));
    for (const [name, entry] of Object.entries(types) as [string, any][]) {
      if (entry.color) _typeColors[name] = entry.color;
    }
  } catch {
    /* file missing — no colors */
  }
  return _typeColors;
}

/** Full MCP tool inventory — loaded from proxy at startup, refreshed on demand. */
let _mcpAllTools: string[] = [];

/** Read the MCP management token from the runtime file written by the auth proxy. */
function getMcpManagementToken(): string | null {
  try {
    return readFileSync(getMcpManagementTokenPath(), 'utf-8').trim();
  } catch {
    return null;
  }
}

function watchMcpManagementToken(onChange: () => void): (() => void) | null {
  const tokenPath = getMcpManagementTokenPath();
  const cleanups: (() => void)[] = [];

  // fs.watch on a directory doesn't reliably fire for file creation on all
  // platforms. Use watchFile (stat-polling) on the token path itself so we
  // catch both creation and content changes.
  try {
    watchFile(tokenPath, { interval: 2000 }, (curr, prev) => {
      if (curr.mtimeMs !== prev.mtimeMs || (curr.size > 0 && prev.size === 0)) onChange();
    });
    cleanups.push(() => unwatchFile(tokenPath));
  } catch {
    /* ignore */
  }

  // Also watch the directory for renames/moves (belt-and-suspenders).
  try {
    const watcher = watch(getDataDir(), (_eventType, filename) => {
      if (filename === '.mcp-management-token') onChange();
    });
    cleanups.push(() => watcher.close());
  } catch {
    /* ignore */
  }

  // Startup race: the main service may still be booting when the dashboard
  // starts. Poll every 3s for up to 30s until the token file appears.
  if (!getMcpManagementToken()) {
    let attempts = 0;
    const poll = setInterval(() => {
      attempts++;
      if (getMcpManagementToken() || attempts >= 10) {
        clearInterval(poll);
        if (getMcpManagementToken()) onChange();
      }
    }, 3000);
    poll.unref?.();
  }

  return cleanups.length > 0 ? () => cleanups.forEach((fn) => fn()) : null;
}

async function refreshMcpTools(): Promise<void> {
  try {
    const proxyPort = process.env.MCP_PROXY_PORT || '3100';
    const token = getMcpManagementToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`http://127.0.0.1:${proxyPort}/tools`, { headers });
    const data = (await res.json()) as Record<string, string[]>;
    _mcpAllTools = Object.values(data).flat();
  } catch {
    /* proxy not ready — will retry later */
  }
}

// Default MCP tools for base-tier coworkers when no type-specific tools are configured.
// Empty by default — project-specific defaults come from coworker-types.json.
const BASE_TIER_TOOLS: string[] = [];

function resolveAllowedMcpTools(
  dbAllowed: string[] | null,
  coworkerType: string | null,
  isMain: boolean,
  types: Record<string, any>,
): string[] {
  if (dbAllowed && dbAllowed.length > 0) return dbAllowed;
  if (coworkerType) {
    // First try the JSON-based metadata (legacy coworker-types.json)
    const metadata = resolveCoworkerTypeMetadata(coworkerType, types);
    if (metadata.allowedMcpTools.length > 0) return metadata.allowedMcpTools;
    // Fall back to the lego skill catalog (resolves from SKILL.md allowed-tools)
    const legoTools = resolveLegoMcpTools(coworkerType);
    if (legoTools.length > 0) return legoTools;
  }
  if (isMain) return _mcpAllTools.length > 0 ? [..._mcpAllTools] : ['mcp__deepwiki__ask_question'];
  return BASE_TIER_TOOLS;
}

function computeDisallowed(allowed: string[]): string[] {
  const set = new Set(allowed);
  return _mcpAllTools.filter((t) => !set.has(t));
}

const READISH_TOOLS = new Set(['Read', 'Grep', 'Glob', 'LS', 'TodoRead', 'NotebookRead']);
const WRITEISH_TOOLS = new Set(['Write', 'Edit', 'MultiEdit', 'Bash', 'NotebookEdit', 'TodoWrite']);

function classifyToolStatus(
  tool: string | undefined,
  fallback: CoworkerState['status'] = 'working',
): CoworkerState['status'] {
  if (!tool) return fallback;
  if (READISH_TOOLS.has(tool)) return 'thinking';
  if (WRITEISH_TOOLS.has(tool)) return 'working';
  return fallback;
}

function classifyEventStatus(
  event: Pick<HookEvent, 'event' | 'tool' | 'message'>,
  previous: CoworkerState['status'] = 'working',
): CoworkerState['status'] {
  if (event.event === 'PostToolUseFailure') return 'error';
  if (event.event === 'PreToolUse' || event.event === 'PostToolUse') {
    return classifyToolStatus(event.tool, previous);
  }
  if (event.event === 'Notification') {
    const msg = (event.message || '').toLowerCase();
    if (/(waiting|approval|permission|confirm|blocked|input required)/.test(msg)) return 'thinking';
  }
  if (event.event === 'SessionEnd' || event.event === 'Stop') return 'idle';
  return previous;
}

function getOrCreateGroupSubagents(group: string): Map<string, SubagentState> {
  let groupMap = liveSubagentState.get(group);
  if (!groupMap) {
    groupMap = new Map<string, SubagentState>();
    liveSubagentState.set(group, groupMap);
  }
  return groupMap;
}

function updateLiveSubagentState(event: HookEvent): void {
  if (!event.group || !event.agent_id) return;

  if (event.event === 'SubagentStart') {
    const groupMap = getOrCreateGroupSubagents(event.group);
    const previous = groupMap.get(event.agent_id);
    groupMap.set(event.agent_id, {
      agentId: event.agent_id,
      agentType: event.agent_type || previous?.agentType || null,
      phase: 'active',
      status: classifyEventStatus(event, previous?.status || 'working'),
      lastToolUse: previous?.lastToolUse || null,
      lastNotification: event.message || previous?.lastNotification || null,
      startedAt: previous?.startedAt || event.timestamp,
      lastActivity: event.timestamp,
      sessionId: event.session_id || previous?.sessionId || null,
      exitAt: null,
    });
    return;
  }

  const groupMap = liveSubagentState.get(event.group);
  if (!groupMap || !groupMap.has(event.agent_id)) return;

  if (event.event === 'SubagentStop') {
    const previous = groupMap.get(event.agent_id)!;
    groupMap.set(event.agent_id, {
      ...previous,
      phase: 'leaving',
      status: 'idle',
      lastNotification: event.message || previous.lastNotification || 'Leaving desk',
      lastActivity: event.timestamp,
      exitAt: event.timestamp + SUBAGENT_EXIT_MS,
    });
    return;
  }

  const previous = groupMap.get(event.agent_id)!;
  groupMap.set(event.agent_id, {
    agentId: event.agent_id,
    agentType: event.agent_type || previous.agentType,
    phase: 'active',
    status: classifyEventStatus(event, previous.status),
    lastToolUse: event.tool || previous.lastToolUse,
    lastNotification: event.message || previous.lastNotification,
    startedAt: previous.startedAt,
    lastActivity: event.timestamp,
    sessionId: event.session_id || previous.sessionId,
    exitAt: null,
  });
}

function getState(): DashboardState {
  const types = getCoworkerTypes();
  const coworkers: CoworkerState[] = [];

  // Scan groups/ for spawned instances (slang_* folders)
  try {
    const folders = readdirSync(getGroupsDir()).filter(
      (f) => statSync(join(getGroupsDir(), f)).isDirectory() && !f.startsWith('.'),
    );

    // Collect registered group folders for filtering
    const registeredFolders = new Set<string>();
    if (db) {
      try {
        const rows = db.prepare('SELECT folder FROM agent_groups').all() as { folder: string }[];
        for (const r of rows) registeredFolders.add(r.folder);
      } catch {
        /* ignore */
      }
    }

    for (const folder of folders) {
      // Skip legacy 'global' folder if present on pre-migration installs —
      // it's retired as an agent group; the migration cleans it up.
      if (folder === 'global') continue;
      // Skip folders not registered in the DB (deleted coworkers leave stale folders)
      if (!registeredFolders.has(folder)) continue;

      // Determine coworker type
      let type = 'unknown';
      let description = '';
      let name = folder;
      let isAutoUpdate = false;

      // Check if this is a template folder (matches a type key)
      // but allow it if it's registered as a coworker in the DB
      if (types[folder] && !registeredFolders.has(folder)) {
        continue;
      }

      // Match spawned instances by coworker type prefix (e.g., type "slang-ir" matches folder "slang_ir-generics")
      for (const [typeName, typeInfo] of Object.entries(types) as [string, any][]) {
        const normalizedType = typeName.replace(/-/g, '_');
        if (folder.startsWith(normalizedType + '_') || folder.startsWith(typeName + '_')) {
          type = typeName;
          description = typeInfo.description || '';
          name = folder.replace(new RegExp(`^${normalizedType}_`), '');
          isAutoUpdate = true;
          break;
        }
      }

      // Resolve type, name, MCP tools, and overlays from DB
      let dbAllowedMcp: string[] | null = null;
      let dbOverlays: string[] = [];
      let dbAgentGroupId: string | null = null;
      let isMainGroup = false;
      if (db) {
        try {
          const row = db
            .prepare(
              'SELECT id, name, folder, coworker_type, allowed_mcp_tools, overlays, is_admin FROM agent_groups WHERE folder = ?',
            )
            .get(folder) as any;
          if (row) {
            dbAgentGroupId = row.id || null;
            name = row.name || folder;
            isMainGroup = !!row.is_admin;
            dbAllowedMcp = row.allowed_mcp_tools ? JSON.parse(row.allowed_mcp_tools) : null;
            dbOverlays = row.overlays ? JSON.parse(row.overlays) : [];
            if (row.coworker_type) {
              type = row.coworker_type;
              const metadata = resolveCoworkerTypeMetadata(row.coworker_type, types);
              description = metadata.description || 'Custom type (no template)';
              isAutoUpdate = metadata.known;
            } else if (row.is_admin) {
              type = 'coordinator';
              description = 'Main coordinator — orchestrates all coworkers';
            }
          }
        } catch {
          /* ignore */
        }
      }

      // Skip legacy 'global' folder (retired; migration cleans it up).
      if (folder === 'global') continue;

      // Determine status from IPC and task state
      let status: CoworkerState['status'] = 'idle';
      let currentTask: string | null = null;
      let lastActivity: string | null = null;
      let taskCount = 0;

      // v2: check session/container status from central DB
      if (db) {
        try {
          const agRow = db.prepare('SELECT id FROM agent_groups WHERE folder = ?').get(folder) as any;
          if (agRow) {
            const sessRow = db
              .prepare(
                "SELECT container_status, last_active FROM sessions WHERE agent_group_id = ? AND status = 'active' ORDER BY last_active DESC LIMIT 1",
              )
              .get(agRow.id) as any;
            if (sessRow) {
              lastActivity = sessRow.last_active;
              if (sessRow.container_status === 'running' || sessRow.container_status === 'idle') status = 'active';
            }
          }
        } catch {
          /* ignore query errors */
        }
      }

      // Count scheduled tasks from the background-refreshed per-group snapshot.
      // getGroupTaskSummary is a memo hit in steady state, so the 5s state
      // broadcast no longer walks every session dir + opens every inbound.db;
      // it falls back to a live (mtime-cached) scan only when the memo is cold.
      if (db) {
        try {
          const agRow2 = db.prepare('SELECT id FROM agent_groups WHERE folder = ?').get(folder) as any;
          if (agRow2) {
            taskCount = getGroupTaskSummary(agRow2.id).tasks.length;
          }
        } catch {
          /* ignore */
        }
      }

      // Use agent hook state for real-time status (preferred over container check)
      const hookState = liveHookState.get(folder);
      const containerRunning = hasRunningContainer(folder);
      if (hookState && hookState.agentActive) {
        // Agent is actively processing — use live hook-derived status.
        // No time limit: long-running tools (builds) can take minutes;
        // agentActive is cleared explicitly by Stop/SessionEnd events.
        status = hookState.status || classifyToolStatus(hookState.tool, 'working');
      } else if ((status === 'idle' || status === 'active') && containerRunning && !hookState) {
        // Container is alive but quiet (e.g. long-running Bash/cmake); show active, not idle.
        status = 'active';
      }

      const subagents = Array.from(liveSubagentState.get(folder)?.values() || [])
        .sort((a, b) => a.startedAt - b.startedAt)
        .map((subagent) => ({ ...subagent }));

      // If subagents are active, parent should show working
      if ((status === 'idle' || status === 'active') && subagents.length > 0) {
        status = 'working';
      }

      const ctxInfo = contextWindowCache.get(folder);
      const mfInfo = manifestSummaryCache.get(folder);
      coworkers.push({
        folder,
        agentGroupId: dbAgentGroupId,
        name,
        type,
        description,
        status,
        currentTask,
        lastActivity,
        taskCount,
        color: getTypeColors()[type] || '#6B7280',
        lastToolUse: hookState?.tool || null,
        lastNotification: hookState?.notification || null,
        hookTimestamp: hookState?.ts || null,
        subagents,
        isAutoUpdate,
        allowedMcpTools: resolveAllowedMcpTools(
          dbAllowedMcp,
          type !== 'unknown' && type !== 'coordinator' ? type : null,
          isMainGroup,
          types,
        ),
        disallowedMcpTools: [],
        overlays: dbOverlays,
        lastMessageTs: lastMessageTsCache.get(folder) || null,
        contextTokens: ctxInfo?.contextTokens ?? null,
        maxContextTokens: ctxInfo?.maxContext ?? null,
        contextUsagePercent: ctxInfo?.usagePercent ?? null,
        cacheHitPercent: ctxInfo?.cacheHitPercent ?? null,
        contextModel: ctxInfo?.model ?? null,
        spineSkillCount: mfInfo?.skillCount ?? null,
        spineWorkflowCount: mfInfo?.workflowCount ?? null,
        spineOverlayCount: mfInfo?.overlayCount ?? null,
        spineContextCount: mfInfo?.contextFragmentCount ?? null,
        spineInvariantCount: mfInfo?.invariantCount ?? null,
        spineToolCount: mfInfo?.toolCount ?? null,
        spineSkills: mfInfo?.skills ?? null,
        spineWorkflows: mfInfo?.workflows ?? null,
        spineOverlays: mfInfo?.overlays ?? null,
        spineTools: mfInfo?.tools ?? null,
        spineInvariants: mfInfo?.invariants ?? null,
        spineContextFragments: mfInfo?.contextFragments ?? null,
      });
      // Compute disallowed after push (needs allowedMcpTools)
      const last = coworkers[coworkers.length - 1];
      last.disallowedMcpTools = computeDisallowed(last.allowedMcpTools);
    }
  } catch {
    /* groups dir may not exist */
  }

  // Add transient entries for groups that have live hook state but no folder yet
  const knownFolders = new Set(coworkers.map((c) => c.folder));
  for (const [folder, hookState] of liveHookState.entries()) {
    if (knownFolders.has(folder)) continue;
    coworkers.push({
      folder,
      name: folder,
      type: 'unknown',
      description: '',
      status: hookState.status || classifyToolStatus(hookState.tool, 'working'),
      currentTask: null,
      lastActivity: new Date(hookState.ts).toISOString(),
      taskCount: 0,
      color: '#6B7280',
      lastToolUse: hookState.tool || null,
      lastNotification: hookState.notification || null,
      isAutoUpdate: false,
      hookTimestamp: hookState.ts || null,
      subagents: Array.from(liveSubagentState.get(folder)?.values() || []),
      allowedMcpTools: BASE_TIER_TOOLS,
      disallowedMcpTools: computeDisallowed(BASE_TIER_TOOLS),
      overlays: [],
      lastMessageTs: lastMessageTsCache.get(folder) || null,
      contextTokens: null,
      maxContextTokens: null,
      contextUsagePercent: null,
      cacheHitPercent: null,
      contextModel: null,
      spineSkillCount: null,
      spineWorkflowCount: null,
      spineOverlayCount: null,
      spineContextCount: null,
      spineInvariantCount: null,
      spineToolCount: null,
      spineSkills: null,
      spineWorkflows: null,
      spineOverlays: null,
      spineTools: null,
      spineInvariants: null,
      spineContextFragments: null,
    });
  }

  // Get registered agent groups enriched with trigger/JID from messaging tables
  let registeredGroups: any[] = [];

  if (db) {
    try {
      registeredGroups = db.prepare('SELECT * FROM agent_groups').all();
      // Enrich with trigger_pattern and jid from messaging_group_agents / messaging_groups
      for (const g of registeredGroups) {
        try {
          const mga = db
            .prepare(
              `SELECT mga.engage_mode, mga.engage_pattern, mg.platform_id
             FROM messaging_group_agents mga
             JOIN messaging_groups mg ON mg.id = mga.messaging_group_id
             WHERE mga.agent_group_id = ?
             LIMIT 1`,
            )
            .get(g.id) as any;
          if (mga) {
            g.trigger_pattern = mga.engage_mode === 'pattern' && mga.engage_pattern ? mga.engage_pattern : null;
            g.jid = mga.platform_id || null;
          }
        } catch {
          /* ignore */
        }
      }
    } catch {
      /* ignore */
    }
  }

  return {
    coworkers,
    tasks: [],
    taskRunLogs: [],
    registeredGroups,
    timestamp: Date.now(),
    lastHookEventId: hookEvents.at(-1)?.id ?? 0,
    maxConcurrentContainers: MAX_CONCURRENT_CONTAINERS,
  };
}

// --- WebSocket (manual, no external dep) ---

function computeAcceptKey(key: string): string {
  return createHash('sha1')
    .update(key + '258EAFA5-E914-47DA-95CA-5AB5DC6552AA')
    .digest('base64');
}

const wsClients = new Set<any>();
const sseClients = new Set<import('http').ServerResponse>();

const STATE_REFRESH_MS = 5_000;
const BACKPRESSURE_THRESHOLD = 512 * 1024;
// A client kept continuously blocked (never drains) past this bound is
// disconnected — a slow reader must not pin memory forever. This replaces the
// old "5 consecutive skipped frames" heuristic with a wall-clock bound, since a
// blocked client now receives at most one small `resync` marker on drain rather
// than a queue of full snapshots.
const BLOCKED_MAX_MS = 60_000;

// ---- Revisioned state + delta broadcast (dash-perf round 2) --------------
// The live channel (WS + SSE) no longer fans out a full state snapshot every
// 5s. Instead:
//   • A client obtains a full snapshot from /api/state (initial load, resync)
//     or the SSE `snapshot`/WS-connect frame — the legacy `type:'state'`
//     envelope, now carrying a monotonic `stateRev`.
//   • On each reconciliation pass we rebuild state, diff it against the last
//     broadcast baseline, and push only the CHANGED keyed objects as a
//     `state-delta` (coworker/registered-group upsert+remove + scalar fields)
//     tagged with `{ baseRev, rev }`. An empty diff sends nothing.
//   • A client that misses a delta (slow socket) sees the next delta's baseRev
//     fail to match its local rev and refetches /api/state (self-healing). On
//     drain a blocked client is nudged with a single `resync` marker.
// This eliminates the periodic triple-serialization + full-state fan-out that
// dominated idle CPU/bandwidth while keeping correctness: the client's merged
// state always converges to exactly what a full snapshot would produce, and any
// ambiguity resolves to a resync rather than a wrong count.
interface StablePublishedState {
  coworkers: CoworkerState[];
  registeredGroups: any[];
  maxConcurrentContainers: number;
}
interface KeyedChange<T> {
  upsert: T[];
  remove: string[];
  /** Full key list of the NEW array, in server order — present ONLY when
   *  `orderChanged` is true. The client rebuilds its array in exactly this
   *  order: a keyed upsert/remove merge alone preserves the CLIENT's insertion
   *  order, which silently diverges from the server's whenever the server
   *  reorders without changing any item (index-positional UI like the
   *  pixel-office desk assignment then renders the wrong layout).
   *
   *  Omitted on an unchanged order because it is O(fleet) bytes on EVERY delta —
   *  a one-coworker status change shipped the whole fleet's key list twice, which
   *  is most of the bandwidth win this delta protocol exists to deliver. When it
   *  is absent, `orderChanged: false` is the server's explicit statement that the
   *  membership AND order are untouched, which a client-side Map merge
   *  reproduces exactly. A keyed change carrying NEITHER is a legacy/mixed
   *  version frame and the client refuses it (fail closed). */
  order?: string[];
  /** True when `order` differs from the baseline's order. Ordering-only changes
   *  produce no upserts/removes, so this is what keeps them from being dropped
   *  as an "empty" delta — and its `false` is what licenses omitting `order`. */
  orderChanged: boolean;
}
interface StateDelta {
  coworkers: KeyedChange<CoworkerState>;
  registeredGroups: KeyedChange<any>;
  fields: Record<string, unknown>;
}
// Identity of THIS server process. Revisions are per-process counters, so a
// restart resets them: without an epoch a client left at rev N by the old
// process would happily accept `{baseRev:N, rev:N+1}` from the new process and
// patch it onto a baseline the new process never had (e.g. a coworker deleted
// during downtime would stay on screen forever, because the new server's
// baseline has no row to remove). Clients compare (epoch, rev) and full-resync
// on any epoch change.
const STATE_EPOCH = randomUUID();
let publishedRev = 0; // rev of `publishedStable`; 0 == nothing published yet
let publishedStable: StablePublishedState | null = null; // diff baseline == what in-sync live clients hold
let publishedData: DashboardState | null = null; // full data for /api/state, matching publishedRev
let publishedAt = 0;
let stateDirtyHint = true; // a mutating path asked for a prompt rebuild

// Instrumentation (dash-perf acceptance gates) — exposed via /api/debug.
const perfCounters = {
  deltaFramesSent: 0,
  deltaBytesSent: 0,
  fullStateFramesSent: 0,
  resyncsSent: 0,
  emptyPublishes: 0,
  changedPublishes: 0,
  slowClientDrops: 0,
  blockedClientEvents: 0,
  maxObservedWritableLength: 0,
  scanMsgTsPublishes: 0,
  scanActivityPublishes: 0,
  scanCostCapsPublishes: 0,
  workerActive: false,
};

/** Ask the next publish to rebuild promptly rather than reuse the throttle window. */
function invalidateStateCache(): void {
  stateDirtyHint = true;
}

function keyedDiff<T extends Record<string, unknown>>(
  prev: T[],
  next: T[],
  keyOf: (x: T) => string,
): KeyedChange<T> {
  const prevByKey = new Map<string, string>();
  for (const p of prev) prevByKey.set(keyOf(p), JSON.stringify(p));
  const upsert: T[] = [];
  const order: string[] = [];
  const seen = new Set<string>();
  for (const n of next) {
    const k = keyOf(n);
    seen.add(k);
    order.push(k);
    const pj = prevByKey.get(k);
    if (pj === undefined || pj !== JSON.stringify(n)) upsert.push(n);
  }
  const remove: string[] = [];
  for (const k of prevByKey.keys()) if (!seen.has(k)) remove.push(k);
  const prevOrder = prev.map(keyOf);
  const orderChanged = prevOrder.length !== order.length || prevOrder.some((k, i) => k !== order[i]);
  // Ship `order` only when it actually changed — see KeyedChange.order.
  return orderChanged ? { upsert, remove, order, orderChanged } : { upsert, remove, orderChanged };
}

function diffStable(prev: StablePublishedState, next: StablePublishedState): StateDelta {
  const fields: Record<string, unknown> = {};
  if (prev.maxConcurrentContainers !== next.maxConcurrentContainers) {
    fields.maxConcurrentContainers = next.maxConcurrentContainers;
  }
  return {
    coworkers: keyedDiff(prev.coworkers as any, next.coworkers as any, (c: any) => String(c.folder)),
    registeredGroups: keyedDiff(prev.registeredGroups as any, next.registeredGroups as any, (g: any) => String(g.id)),
    fields,
  };
}

function isEmptyDelta(d: StateDelta): boolean {
  return (
    d.coworkers.upsert.length === 0 &&
    d.coworkers.remove.length === 0 &&
    !d.coworkers.orderChanged &&
    d.registeredGroups.upsert.length === 0 &&
    d.registeredGroups.remove.length === 0 &&
    !d.registeredGroups.orderChanged &&
    Object.keys(d.fields).length === 0
  );
}

/** Test-only surface for the state-delta diff + scan-worker handoff (dash-perf round 2). */
export const __dashPerfTestHooks = {
  diffStable: (prev: StablePublishedState, next: StablePublishedState): StateDelta => diffStable(prev, next),
  isEmptyDelta: (d: StateDelta): boolean => isEmptyDelta(d),
  stateEpoch: (): string => STATE_EPOCH,
  createScanHandoff: (hooks: ScanHandoffHooks) => createScanHandoff(hooks),
};

/**
 * Rebuild state, diff it against the last broadcast baseline, broadcast a
 * `state-delta` if the stable body changed, and return the current full data +
 * its rev. Throttled: unless `force` or a dirty hint is set, a call within
 * STATE_REFRESH_MS of the last build reuses the previous result so bursty
 * /api/state polls don't each trigger a full rebuild. The reconciliation timer
 * calls it with `force` so out-of-band (DB/filesystem-backed) changes — e.g. a
 * container status the dashboard has no JS hook for — are still picked up.
 */
function publishState(force = false): { data: DashboardState; rev: number } {
  const now = Date.now();
  if (!force && !stateDirtyHint && publishedData && now - publishedAt < STATE_REFRESH_MS) {
    return { data: publishedData, rev: publishedRev };
  }
  if (!db) db = openDb();
  const data = getState();
  const stable: StablePublishedState = {
    coworkers: data.coworkers,
    registeredGroups: data.registeredGroups,
    maxConcurrentContainers: data.maxConcurrentContainers,
  };
  stateDirtyHint = false;
  publishedAt = now;

  if (publishedStable) {
    const delta = diffStable(publishedStable, stable);
    if (isEmptyDelta(delta)) {
      perfCounters.emptyPublishes++;
      publishedData = data; // refresh volatile fields (timestamp/lastHookEventId) without a rev bump
      return { data, rev: publishedRev };
    }
    perfCounters.changedPublishes++;
    const prevRev = publishedRev;
    publishedRev += 1;
    publishedStable = stable;
    publishedData = data;
    if (wsClients.size || sseClients.size) {
      broadcastMessageJson(
        JSON.stringify({
          type: 'state-delta',
          stateEpoch: STATE_EPOCH,
          baseRev: prevRev,
          rev: publishedRev,
          ...delta,
        }),
      );
    }
    return { data, rev: publishedRev };
  }

  // First publish: establish the baseline at rev 1. No delta (no client has an
  // older baseline to patch — new connections fetch full state at this rev).
  publishedRev = 1;
  publishedStable = stable;
  publishedData = data;
  return { data, rev: publishedRev };
}

/** Full-state envelope for the live channel's initial/resync frame (WS connect,
 *  SSE snapshot). Carries the current rev so the client can base its deltas. */
function fullStateEnvelope(): string {
  const { data, rev } = publishState();
  perfCounters.fullStateFramesSent++;
  return JSON.stringify({ type: 'state', data: { ...data, stateEpoch: STATE_EPOCH, stateRev: rev } });
}

/** Full-state JSON for /api/state (raw body, no envelope) with the rev inlined. */
function fullStateJson(): string {
  const { data, rev } = publishState();
  return JSON.stringify({ ...data, stateEpoch: STATE_EPOCH, stateRev: rev });
}

// ---- Session-DB scan worker (dash-perf round 2) --------------------------
// A dedicated worker_threads worker owns the message-timestamp + activity fleet
// scans (the ~6k stats/sec + thousands of SQLite opens/30s that used to run on
// the event loop). It publishes immutable cache deltas; the main thread applies
// them here and never opens a session DB for these scans. If the worker can't
// start or dies, we fall back to the main-thread timers so behavior degrades to
// pre-round-2, never breaks. Disabled under VITEST and via
// DASHBOARD_DISABLE_SCAN_WORKER=1 (the escape hatch for the adversarial review).
let scanWorker: Worker | null = null;
let workerStats: Record<string, unknown> | null = null;

function applyMsgTsDelta(changed: [string, string][], removed: string[]): void {
  let any = false;
  for (const [folder, ts] of changed) {
    if (typeof folder === 'string' && typeof ts === 'string') {
      lastMessageTsCache.set(folder, ts);
      any = true;
    }
  }
  for (const folder of removed) {
    if (lastMessageTsCache.delete(folder)) any = true;
  }
  // lastMessageTs feeds coworker state → ask the next publish to pick it up so a
  // new message surfaces as a state-delta.
  if (any) invalidateStateCache();
  perfCounters.scanMsgTsPublishes++;
}

/**
 * Apply the worker's `costCaps` deltas to sessionCostCapsMap (dash-1
 * set-ceiling-v2). `changed` entries carry the RAW `session_state.value` TEXT —
 * parsing/interpretation happens here (buildCostCapEntry), not in the worker —
 * matching applyMainThreadCostCap's division of labor so the worker path and
 * the main-thread-fallback path can never disagree on what a given raw blob
 * means.
 */
function applyCostCapsDelta(changed: [string, string, string, number][], removed: string[]): void {
  for (const [sessionId, agentGroupId, raw, mtimeMs] of changed) {
    if (typeof sessionId !== 'string' || typeof agentGroupId !== 'string' || typeof raw !== 'string') continue;
    const entry = buildCostCapEntry(agentGroupId, parseCostCapBlob(raw), new Date(mtimeMs).toISOString());
    if (entry) sessionCostCapsMap.set(sessionId, entry);
    else sessionCostCapsMap.delete(sessionId);
  }
  for (const sessionId of removed) {
    if (typeof sessionId === 'string') sessionCostCapsMap.delete(sessionId);
  }
  perfCounters.scanCostCapsPublishes++;
}

function restartMainThreadScans(): void {
  if (process.env.VITEST) return;
  if (!msgTsTimer) {
    refreshMessageTimestamps();
    msgTsTimer = setInterval(refreshMessageTimestamps, 1000);
    msgTsTimer.unref?.();
  }
  if (!activityTimer) {
    refreshActivityData();
    activityTimer = setInterval(refreshActivityData, 30000);
    activityTimer.unref?.();
  }
}

/**
 * Host half of the scan-worker handoff protocol.
 *
 * The worker publishes nothing until its warm-up pass has settled every session
 * path, and posts `ready` immediately BEFORE its first data frame. This side
 * still queues anything that arrives pre-`ready` instead of DISCARDING it — the
 * bug that made round 1 wrong was structural, not cosmetic: MessagePort delivery
 * is ordered, so a discarded frame is gone for good while the worker has already
 * recorded it as published and will never resend it, leaving every group's
 * lastMessageTs (unread badge, chat auto-refresh) stale indefinitely on an idle
 * fleet. Queue-and-apply makes the handoff lossless from either side; the queue
 * is bounded, and overflowing it asks the worker for a full republish rather
 * than silently keeping a partial cache.
 *
 * Extracted (and exported via `__dashPerfTestHooks`) so the ordering can be
 * tested without spawning a worker or a session fleet.
 */
interface ScanHandoffHooks {
  applyMsgTs: (changed: [string, string][], removed: string[]) => void;
  applyActivity: (buckets: unknown[]) => void;
  /** Optional so existing hook objects (e.g. tests written before dash-1
   *  set-ceiling-v2) don't need updating just to keep compiling. */
  applyCostCaps?: (changed: [string, string, string, number][], removed: string[]) => void;
  /** Handoff complete: the worker owns these scans, stop the main-thread timers. */
  onReady: () => void;
  onStats: (stats: Record<string, unknown>) => void;
  /** The worker declared its cache unusable — revert to main-thread scans. */
  onFatal: (message: string) => void;
  /** Ask the worker to re-send its full state (our pre-ready queue overflowed). */
  requestRepublish: () => void;
  maxPreReadyFrames?: number;
}

function createScanHandoff(hooks: ScanHandoffHooks): {
  handle: (msg: any) => void;
  isReady: () => boolean;
  stop: () => void;
} {
  const maxPreReady = hooks.maxPreReadyFrames ?? 64;
  let ready = false;
  let stopped = false;
  let pending: any[] = [];
  let droppedPreReady = false;

  const applyFrame = (msg: any): void => {
    if (msg.kind === 'msgTs') hooks.applyMsgTs(msg.changed || [], msg.removed || []);
    else if (msg.kind === 'activity' && Array.isArray(msg.buckets)) hooks.applyActivity(msg.buckets);
    else if (msg.kind === 'costCaps') hooks.applyCostCaps?.(msg.changed || [], msg.removed || []);
  };

  const handle = (msg: any): void => {
    // After a fallback the main thread owns these scans again; a late frame from
    // a dying worker must not write to the caches it is now rebuilding itself.
    if (stopped) return;
    if (!msg || typeof msg !== 'object') return;
    switch (msg.kind) {
      case 'ready': {
        if (ready) break;
        ready = true;
        hooks.onReady();
        // Apply in arrival order — the worker's frames are cumulative deltas
        // against what it believes we hold, so order is load-bearing.
        const queued = pending;
        pending = [];
        for (const frame of queued) applyFrame(frame);
        if (droppedPreReady) {
          droppedPreReady = false;
          hooks.requestRepublish();
        }
        break;
      }
      case 'msgTs':
      case 'activity':
      case 'costCaps':
        if (!ready) {
          if (pending.length >= maxPreReady) droppedPreReady = true;
          else pending.push(msg);
          break;
        }
        applyFrame(msg);
        break;
      case 'stats':
        hooks.onStats(msg);
        break;
      case 'error':
        console.error('[dashboard] scan worker init error:', msg.message);
        break;
      case 'fatal':
        hooks.onFatal(String(msg.message || 'unspecified'));
        break;
      default:
        break;
    }
  };

  return {
    handle,
    isReady: () => ready,
    stop: () => {
      stopped = true;
      pending = [];
    },
  };
}

function startScanWorker(): void {
  if (process.env.VITEST || process.env.DASHBOARD_DISABLE_SCAN_WORKER === '1') return;
  let worker: Worker;
  try {
    worker = new Worker(new URL('./scan-worker.mjs', import.meta.url), {
      workerData: { dataDir: getDataDir(), centralDbPath: getDbPath() },
    });
  } catch (e) {
    console.error('[dashboard] scan worker failed to start; using main-thread scans', e);
    return;
  }
  scanWorker = worker;
  let stopHandoff: (() => void) | null = null;
  const fallback = (reason: string): void => {
    if (scanWorker !== worker) return; // already replaced
    scanWorker = null;
    perfCounters.workerActive = false;
    // Stop applying worker frames BEFORE the main-thread scans resume, so the
    // two can never both write the caches.
    if (stopHandoff) stopHandoff();
    console.error(`[dashboard] scan worker ${reason}; reverting to main-thread scans`);
    restartMainThreadScans();
  };
  const handoff = createScanHandoff({
    applyMsgTs: (changed, removed) => applyMsgTsDelta(changed, removed),
    applyActivity: (buckets) => {
      activityDataCache = buckets as ActivityBucket[];
      perfCounters.scanActivityPublishes++;
    },
    applyCostCaps: (changed, removed) => applyCostCapsDelta(changed, removed),
    onReady: () => {
      perfCounters.workerActive = true;
      // Hand off: the worker now owns these scans, so stop the main-thread
      // timers to avoid duplicate work. The queued pre-ready frames are applied
      // by the handoff immediately after this returns, so there is no window in
      // which neither side owns the cache.
      if (msgTsTimer) {
        clearInterval(msgTsTimer);
        msgTsTimer = undefined;
      }
      if (activityTimer) {
        clearInterval(activityTimer);
        activityTimer = undefined;
      }
    },
    onStats: (stats) => {
      workerStats = stats;
    },
    onFatal: (message) => {
      fallback(`reported a fatal warm-up failure (${message})`);
      void worker.terminate();
    },
    requestRepublish: () => {
      try {
        worker.postMessage('republish');
      } catch (e) {
        console.error('[dashboard] scan worker republish request failed', e);
      }
    },
  });
  stopHandoff = handoff.stop;
  worker.on('message', (msg: any) => handoff.handle(msg));
  worker.on('error', (e) => {
    console.error('[dashboard] scan worker error', e);
    fallback('errored');
  });
  worker.on('exit', (code) => {
    if (code !== 0) fallback(`exited (code ${code})`);
  });
  worker.unref?.();
}

startScanWorker();

function getLiveCoworkerPatch(event: HookEvent): Partial<CoworkerState> & { folder: string } {
  const hookState = liveHookState.get(event.group);
  const subagents = Array.from(liveSubagentState.get(event.group)?.values() || [])
    .sort((a, b) => a.startedAt - b.startedAt)
    .map((subagent) => ({ ...subagent }));
  return {
    folder: event.group,
    agentGroupId: event.agent_group_id ?? null,
    status: hookState?.agentActive ? hookState.status || 'working' : 'idle',
    lastToolUse: hookState?.tool || null,
    lastNotification: hookState?.notification || null,
    hookTimestamp: hookState?.ts || event.timestamp,
    subagents,
  };
}

export function resetTransientDashboardStateForTests(): void {
  hookEvents.length = 0;
  liveHookState.clear();
  liveSubagentState.clear();
  hookEverSeen.clear();
  lastMessageTsCache.clear();
  msgTsFileCache.clear();
  sessionCostCapsMap.clear();
  groupTaskCache.clear();
  perFileTaskCache.clear();
  runningContainers.clear();
  _mcpAllTools = [];
  _typeColors = null;
  cachedTypes = null;
  wsClients.clear();
  sseClients.clear();
  publishedRev = 0;
  publishedStable = null;
  publishedData = null;
  publishedAt = 0;
  stateDirtyHint = true;
  try {
    db?.close();
  } catch {
    /* ignore */
  }
  try {
    writeDb?.close();
  } catch {
    /* ignore */
  }
  try {
    hookEventsDb?.close();
  } catch {
    /* ignore */
  }
  db = null;
  writeDb = null;
  hookEventsDb = null;
  ccusageCache = {
    '1d': { ...emptyCcusagePeriod },
    '7d': { ...emptyCcusagePeriod },
    '30d': { ...emptyCcusagePeriod },
    all: { ...emptyCcusagePeriod },
    lastRefresh: 0,
  };
  activityDataCache = null;
}

/** Force-open the readonly DB handle for tests (avoids waiting on broadcast timer). */
export function forceOpenDbForTests(): void {
  if (!db) db = openDb();
}

/**
 * Force one pass of the main-thread fallback scan (msgTs + cost-cap mtime
 * read) for tests. The scan worker is disabled under VITEST and the
 * main-thread timer only self-schedules outside VITEST too (see
 * msgTsTimer/refreshMessageTimestamps above), so nothing re-reads a session's
 * outbound.db on its own during a test — this gives tests a synchronous
 * "the fleet-scan tick just ran" hook, exactly like forceOpenDbForTests gives
 * a synchronous "the DB handle is open" hook.
 */
export function refreshCostCapsForTests(): void {
  refreshMessageTimestamps();
}

/**
 * Peek at sessionCostCapsMap directly, bypassing /api/sessions' SQL join —
 * needed to prove tombstoning actually REMOVES the map entry (shrinks memory)
 * rather than merely observing that a deleted session's row no longer appears
 * in /api/sessions, which would be true regardless of whether the map entry
 * was ever cleaned up (the SQL join already excludes a deleted session's row
 * on its own).
 */
export function getSessionCostCapForTests(sessionId: string): SessionCostCapEntry | undefined {
  return sessionCostCapsMap.get(sessionId);
}

/** Reconciliation tick: force a rebuild + diff so DB/filesystem-backed changes
 *  (e.g. a container status the dashboard has no JS hook for) are picked up, and
 *  push a delta if anything changed. Skipped when no client is connected — the
 *  next connection rebuilds a fresh baseline on demand via /api/state. */
function broadcastState(): void {
  if (wsClients.size === 0 && sseClients.size === 0) return;
  publishState(true);
}

// Clients we skipped a frame for because their socket was blocked; each gets a
// single `resync` marker once it drains (bounding the pending queue to one small
// frame instead of a growing pile of snapshots). Wall-clock start of the current
// blocked stretch, used to disconnect a reader that never drains.
const staleClients = new WeakSet<any>();
const clientBlockedSince = new WeakMap<any, number>();
// One-shot disconnect timer armed the FIRST time a client blocks. Without it the
// BLOCKED_MAX_MS bound was only evaluated when markStaleClient() happened to run
// again, so a WS client blocked by the very last frame before the fleet went
// idle (no heartbeat on the WS path) was never revisited and pinned its buffer
// indefinitely.
const clientBlockedTimer = new WeakMap<any, ReturnType<typeof setTimeout>>();

function clearBlockedTimer(client: any): void {
  const t = clientBlockedTimer.get(client);
  if (t) {
    clearTimeout(t);
    clientBlockedTimer.delete(client);
  }
}

/** Terminal drop for a client that never drained. res.end() is not a hard
 *  disconnect when the peer never reads (the FIN sits behind the unflushed
 *  buffer), so destroy the underlying socket in both cases. */
function hardCloseClient(client: any, clients: Set<any>, isWs: boolean): void {
  clients.delete(client);
  clearBlockedTimer(client);
  clientBlockedSince.delete(client);
  staleClients.delete(client);
  perfCounters.slowClientDrops++;
  try {
    if (isWs) {
      client.destroy();
    } else {
      try {
        client.end();
      } catch {
        /* ignore */
      }
      client.socket?.destroy?.();
    }
  } catch {
    /* ignore */
  }
}

/** True when the socket can't accept another frame right now. Both a raw WS
 *  net.Socket and an SSE ServerResponse expose writableLength/writableNeedDrain. */
function isClientBlocked(client: any): boolean {
  const len = client.writableLength ?? 0;
  if (len > perfCounters.maxObservedWritableLength) perfCounters.maxObservedWritableLength = len;
  return client.writableNeedDrain === true || len > BACKPRESSURE_THRESHOLD;
}

/** Mark a blocked client stale and, once, arrange to nudge it with a `resync`
 *  marker on drain. A client blocked continuously past BLOCKED_MAX_MS is
 *  disconnected. `isWs` selects the frame encoding + the hard-close method. */
function markStaleClient(client: any, clients: Set<any>, isWs: boolean): void {
  const now = Date.now();
  const since = clientBlockedSince.get(client);
  if (since === undefined) {
    clientBlockedSince.set(client, now);
    perfCounters.blockedClientEvents++;
    // Arm the bound now rather than relying on a later markStaleClient() call —
    // there may never be one (idle fleet, and the WS path has no heartbeat).
    const timer = setTimeout(() => {
      clientBlockedTimer.delete(client);
      if (!clients.has(client)) return;
      if (!clientBlockedSince.has(client)) return; // drained in the meantime
      hardCloseClient(client, clients, isWs);
    }, BLOCKED_MAX_MS);
    timer.unref?.();
    clientBlockedTimer.set(client, timer);
  } else if (now - since > BLOCKED_MAX_MS) {
    hardCloseClient(client, clients, isWs);
    return;
  }
  if (staleClients.has(client)) return;
  staleClients.add(client);
  const onDrain = (): void => {
    staleClients.delete(client);
    clientBlockedSince.delete(client);
    clearBlockedTimer(client);
    if (!clients.has(client)) return;
    if (!isWs) {
      // SSE recovery = RECONNECT, not an in-stream snapshot. A blocked SSE client
      // skipped an arbitrary run of hook-event frames while stale; a full state
      // snapshot restores coworker state but NOT those events, and the client's
      // replay cursor (its last *delivered* event id) would then be advanced past
      // the gap by the next live event — silently losing the skipped events.
      // Ending the response makes the browser EventSource reconnect from that
      // delivered id (?after= / Last-Event-ID), which replays the gap AND arrives
      // with a fresh in-stream snapshot. The socket already drained, so end()
      // closes cleanly — no need for the hard socket.destroy() of a slow drop.
      clients.delete(client);
      try {
        client.end();
      } catch {
        /* ignore */
      }
      perfCounters.resyncsSent++;
      return;
    }
    try {
      // WS recovery: no per-frame event id or automatic reconnect to lean on, so
      // recover IN-STREAM with a full snapshot rather than a `resync` marker that
      // sends the client off to /api/state (an HTTP resync races the live delta
      // stream). A same-stream snapshot is ordered by construction, so the client
      // resumes from exactly this revision. publishState() first so any pending
      // delta is flushed to everyone BEFORE this snapshot; the throttled second
      // call inside fullStateEnvelope() cannot broadcast again.
      publishState();
      const json = fullStateEnvelope();
      // Through sendToClient(), not a raw write(): a full snapshot is the LARGEST
      // frame we ever send, so it is the one most likely to re-block the socket.
      // A raw write that returns false left the client with no armed blocked-timer
      // and no further state change to trigger one (WS has no heartbeat) — i.e.
      // retained forever. sendToClient re-arms stale tracking, bounding lifetime.
      sendToClient(client, clients, createWsFrame(Buffer.from(json)), true);
      perfCounters.resyncsSent++;
    } catch {
      clients.delete(client);
    }
  };
  try {
    client.once('drain', onDrain);
  } catch {
    /* socket without an event emitter — best-effort */
  }
}

/** Write to one client, honoring backpressure: skip (and schedule a drain
 *  resync) if the socket is blocked or the write fills the buffer; never enqueue
 *  another frame for a blocked client. */
function sendToClient(client: any, clients: Set<any>, payload: string | Buffer, isWs: boolean): void {
  if (isClientBlocked(client)) {
    markStaleClient(client, clients, isWs);
    return;
  }
  let ok = true;
  try {
    ok = client.write(payload);
  } catch {
    clients.delete(client);
    clientBlockedSince.delete(client);
    staleClients.delete(client);
    clearBlockedTimer(client);
    return;
  }
  if (ok) {
    clientBlockedSince.delete(client);
    clearBlockedTimer(client);
  } else {
    // The frame was buffered but the socket is now full — wait for drain before
    // sending anything else, then resync.
    markStaleClient(client, clients, isWs);
  }
}

function broadcastMessageJson(json: string, eventId?: number): void {
  if (json.startsWith('{"type":"state-delta"')) {
    perfCounters.deltaFramesSent++;
    perfCounters.deltaBytesSent += json.length;
  }
  // Build the WS frame only when at least one WS client can take it.
  if (wsClients.size) {
    let wsFrame: Buffer | null = null;
    for (const ws of wsClients) {
      if (isClientBlocked(ws)) {
        markStaleClient(ws, wsClients, true);
        continue;
      }
      if (!wsFrame) wsFrame = createWsFrame(Buffer.from(json));
      sendToClient(ws, wsClients, wsFrame, true);
    }
  }

  if (sseClients.size) {
    const ssePayload = `${eventId ? `id: ${eventId}\n` : ''}data: ${json}\n\n`;
    for (const client of sseClients) {
      sendToClient(client, sseClients, ssePayload, false);
    }
  }
}

function broadcastHookEvent(event: HookEventSummary, coworker: Partial<CoworkerState> & { folder: string }): void {
  broadcastMessageJson(JSON.stringify({ type: 'hook-event', data: event, coworker }), event.id);
}

function createWsFrame(data: Buffer, opcode = 0x1): Buffer {
  const len = data.length;
  let header: Buffer;
  if (len < 126) {
    header = Buffer.alloc(2);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = len;
  } else if (len < 65536) {
    header = Buffer.alloc(4);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 126;
    header.writeUInt16BE(len, 2);
  } else {
    header = Buffer.alloc(10);
    header[0] = 0x80 | (opcode & 0x0f);
    header[1] = 127;
    header.writeBigUInt64BE(BigInt(len), 2);
  }
  return Buffer.concat([header, data]);
}

function parseWsFrame(buf: Buffer): { opcode: number; payload: Buffer; consumed: number } | null {
  if (buf.length < 2) return null;
  const opcode = buf[0] & 0x0f;
  const masked = (buf[1] & 0x80) !== 0;
  let payloadLen = buf[1] & 0x7f;
  let offset = 2;
  if (payloadLen === 126) {
    if (buf.length < 4) return null;
    payloadLen = buf.readUInt16BE(2);
    offset = 4;
  } else if (payloadLen === 127) {
    if (buf.length < 10) return null;
    payloadLen = Number(buf.readBigUInt64BE(2));
    offset = 10;
  }
  if (masked) {
    if (buf.length < offset + 4 + payloadLen) return null;
    const mask = buf.subarray(offset, offset + 4);
    offset += 4;
    const payload = Buffer.alloc(payloadLen);
    for (let i = 0; i < payloadLen; i++) {
      payload[i] = buf[offset + i] ^ mask[i % 4];
    }
    return { opcode, payload, consumed: offset + payloadLen };
  }
  if (buf.length < offset + payloadLen) return null;
  return { opcode, payload: buf.subarray(offset, offset + payloadLen), consumed: offset + payloadLen };
}

// --- HTTP Server ---

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
};

/**
 * Check DASHBOARD_SECRET for admin-mutating requests.
 * If DASHBOARD_SECRET is set, requires Authorization: Bearer <secret> header.
 * Hook events from containers are exempt (they use their own auth path).
 */
function requireAuth(req: import('http').IncomingMessage, res: import('http').ServerResponse): boolean {
  const secret = getDashboardSecret();
  if (!secret) return true; // no secret configured → open (localhost-only by default)
  if (isDashboardAuthenticated(req, secret)) return true;
  res.writeHead(401, { 'Content-Type': 'application/json' });
  res.end('{"error":"unauthorized"}');
  return false;
}

const MAX_BODY_SIZE = 1024 * 1024; // 1 MB
const MAX_ARCHIVE_SIZE = 500 * 1024 * 1024; // 500 MB
const MAX_ARCHIVE_ENTRIES = 50_000;
const MAX_EXTRACTED_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB
const MAX_SINGLE_FILE_SIZE = 100 * 1024 * 1024; // 100 MB
const MAX_GROUP_SUBDIR_SIZE = 2 * 1024 * 1024 * 1024; // 2 GB (exports stay on host)
const EXCLUDE_DIR_PATTERNS =
  /^(node_modules|cmake-.*|conda.*|build|dist|target|__pycache__|\.cache|venv|\.venv|\.tox|\.mypy_cache|\.pytest_cache)$/;

/** Read request body with size limit. Rejects with 413 if exceeded. */
function readBody(req: import('http').IncomingMessage, res: import('http').ServerResponse): Promise<string | null> {
  return new Promise((resolve) => {
    let body = '';
    let exceeded = false;
    req.on('data', (chunk: string) => {
      body += chunk;
      if (body.length > MAX_BODY_SIZE && !exceeded) {
        exceeded = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end('{"error":"Request body too large"}');
        req.destroy();
        resolve(null);
      }
    });
    req.on('end', () => {
      if (!exceeded) resolve(body);
    });
    req.on('error', () => {
      if (!exceeded) resolve(null);
    });
  });
}

/** Read request body as raw Buffer for binary uploads (archives). */
function readBodyBinary(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  maxSize = MAX_ARCHIVE_SIZE,
): Promise<Buffer | null> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    let totalSize = 0;
    let exceeded = false;
    req.on('data', (chunk: Buffer) => {
      totalSize += chunk.length;
      if (totalSize > maxSize && !exceeded) {
        exceeded = true;
        res.writeHead(413, { 'Content-Type': 'application/json' });
        res.end('{"error":"Archive too large"}');
        req.destroy();
        resolve(null);
        return;
      }
      chunks.push(chunk);
    });
    req.on('end', () => {
      if (!exceeded) resolve(Buffer.concat(chunks));
    });
    req.on('error', () => {
      if (!exceeded) resolve(null);
    });
  });
}

// ---------------------------------------------------------------------------
// Full-archive file collection helpers
// ---------------------------------------------------------------------------

/** Check if a relative path (or directory name) should be excluded from archive. */
function shouldExcludeFromArchive(relativePath: string, isDir: boolean): boolean {
  const name = basename(relativePath);
  // Always exclude system-composed files (recomposed every container wake)
  if (name === 'CLAUDE.md' || name === '.claude-global.md') return true;
  if (isDir && EXCLUDE_DIR_PATTERNS.test(name)) return true;
  return false;
}

/** Walk a directory recursively, collecting { relativePath → absolutePath } entries.
 *  Skips excluded dirs/files. Enforces per-file and per-subdir size limits. */
function walkDir(baseDir: string, opts?: { maxFileSize?: number; maxSubdirSize?: number }): Map<string, string> {
  const maxFile = opts?.maxFileSize ?? MAX_SINGLE_FILE_SIZE;
  const maxSubdir = opts?.maxSubdirSize ?? Infinity;
  const result = new Map<string, string>();

  function recurse(dir: string, relPrefix: string, budgetLeft: number): number {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return 0;
    }
    let consumed = 0;
    for (const entry of entries) {
      const abs = join(dir, entry);
      const rel = relPrefix ? `${relPrefix}/${entry}` : entry;
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (shouldExcludeFromArchive(rel, true)) continue;
        consumed += recurse(abs, rel, budgetLeft - consumed);
      } else if (st.isFile()) {
        if (shouldExcludeFromArchive(rel, false)) continue;
        if (st.size > maxFile) continue;
        if (consumed + st.size > budgetLeft) continue;
        consumed += st.size;
        result.set(rel, abs);
      }
    }
    return consumed;
  }

  if (maxSubdir < Infinity) {
    // Apply per-top-level-subdir budget
    let entries: string[];
    try {
      entries = readdirSync(baseDir);
    } catch {
      return result;
    }
    for (const entry of entries) {
      const abs = join(baseDir, entry);
      const rel = entry;
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (shouldExcludeFromArchive(rel, true)) continue;
        recurse(abs, rel, maxSubdir);
      } else if (st.isFile()) {
        if (shouldExcludeFromArchive(rel, false)) continue;
        if (st.size <= maxFile) result.set(rel, abs);
      }
    }
  } else {
    recurse(baseDir, '', Infinity);
  }
  return result;
}

/** Collect files from groups/{folder}/ with size exclusions. */
function collectGroupFiles(groupDir: string): Map<string, string> {
  if (!existsSync(groupDir)) return new Map();
  return walkDir(groupDir, {
    maxFileSize: MAX_SINGLE_FILE_SIZE,
    maxSubdirSize: MAX_GROUP_SUBDIR_SIZE,
  });
}

/** Collect FULL .claude-shared/ directory (Docker-like — copy everything). */
function collectClaudeShared(agentGroupId: string): Map<string, string> {
  const claudeDir = join(getDataDir(), 'v2-sessions', agentGroupId, '.claude-shared');
  if (!existsSync(claudeDir)) return new Map();
  return walkDir(claudeDir, { maxFileSize: MAX_SINGLE_FILE_SIZE });
}

/** Collect inbound.db + outbound.db per session. Returns { relPath → absPath }. */
function collectSessionDbFiles(agentGroupId: string): { files: Map<string, string>; sessionIds: string[] } {
  const files = new Map<string, string>();
  const sessionIds: string[] = [];
  const agDir = join(getDataDir(), 'v2-sessions', agentGroupId);
  let entries: string[];
  try {
    entries = readdirSync(agDir);
  } catch {
    return { files, sessionIds };
  }
  for (const entry of entries) {
    if (!entry.startsWith('sess-')) continue;
    const sessDir = join(agDir, entry);
    let st: ReturnType<typeof statSync>;
    try {
      st = statSync(sessDir);
    } catch {
      continue;
    }
    if (!st.isDirectory()) continue;
    sessionIds.push(entry);
    for (const dbFile of ['inbound.db', 'outbound.db']) {
      const dbPath = join(sessDir, dbFile);
      if (existsSync(dbPath)) {
        files.set(`sessions/${entry}/${dbFile}`, dbPath);
      }
    }
  }
  return { files, sessionIds };
}

/** One pending/paused scheduled task row, as surfaced to the dashboard. */
interface ScheduledTaskRow {
  origId: string;
  sessionId: string;
  recurrence: string | null;
  processAfter: string | null;
  content: string;
  status: string;
}

// mtime-keyed cache of the pending/paused task rows in each session's inbound.db.
// A scheduled task only changes when the host writes messages_in (create / pause
// / resume / delete), which bumps the file's mtime; an idle session's inbound.db
// is therefore a cheap stat rather than a sqlite open on every scan. Mirrors the
// perFileCostCache / msgTsFileCache mtime-gating already used for the cost and
// message-timestamp scans. Pruned in refreshGroupTaskCache once it outgrows the
// live session set. Correctness is mtime-exact: a task mutation changes the file,
// so the very next scan re-reads it (no stale window past the mutating write).
const perFileTaskCache = new Map<string, { mtimeMs: number; tasks: ScheduledTaskRow[] }>();

/** Read the pending/paused tasks from one session's inbound.db, mtime-gated:
 *  reuse the cached rows when the file is unchanged since the last scan, so only
 *  sessions whose task set actually moved pay a sqlite open. Tri-state: `ok:false`
 *  means the DB open/query failed (transient lock / I/O). Callers building a
 *  cached aggregate must NOT publish a `!ok` result, else a momentary lock gets
 *  memoized as a group-wide undercount. A genuinely absent file is `ok:true` with
 *  no tasks. Only clean reads are cached; a failed read is retried next scan. */
function extractSessionTasks(dbPath: string, sessionId: string): { ok: boolean; tasks: ScheduledTaskRow[] } {
  let mtimeMs: number;
  try {
    mtimeMs = statSync(dbPath).mtimeMs; // throws if the file doesn't exist
  } catch {
    perFileTaskCache.delete(dbPath);
    return { ok: true, tasks: [] }; // no inbound.db → genuinely no tasks
  }
  const cached = perFileTaskCache.get(dbPath);
  if (cached && cached.mtimeMs === mtimeMs) return { ok: true, tasks: cached.tasks };
  let sdb: Database.Database | null = null;
  try {
    sdb = new Database(dbPath, { readonly: true });
    sdb.pragma('busy_timeout = 3000');
    const rows = sdb
      .prepare(
        "SELECT id, recurrence, process_after, content, status FROM messages_in WHERE kind = 'task' AND status IN ('pending', 'paused')",
      )
      .all() as any[];
    const tasks: ScheduledTaskRow[] = rows.map((r) => ({
      origId: r.id,
      sessionId,
      recurrence: r.recurrence || null,
      processAfter: r.process_after || null,
      content: r.content,
      status: r.status,
    }));
    perFileTaskCache.set(dbPath, { mtimeMs, tasks }); // cache only on a clean read
    return { ok: true, tasks };
  } catch {
    return { ok: false, tasks: [] }; // corrupt/locked — don't cache; next scan retries
  } finally {
    try {
      sdb?.close();
    } catch {
      /* */
    }
  }
}

/** Scan a group's sessions for scheduled tasks. Tri-state: `ok:false` if ANY
 *  constituent session read failed, so the memo layer can decline to publish a
 *  possibly-undercounted aggregate (a transient lock must not poison the memo). */
function extractGroupTasks(agentGroupId: string, sessionIds: string[]): { ok: boolean; tasks: ScheduledTaskRow[] } {
  const tasks: ScheduledTaskRow[] = [];
  let ok = true;
  for (const sessId of sessionIds) {
    const dbPath = join(getDataDir(), 'v2-sessions', agentGroupId, sessId, 'inbound.db');
    const r = extractSessionTasks(dbPath, sessId);
    if (!r.ok) ok = false;
    for (const t of r.tasks) tasks.push(t);
  }
  return { ok, tasks };
}

/** Fail-soft task list across a group's sessions (returns whatever read cleanly).
 *  Used by /api/tasks and the import/export paths, which surface a live snapshot
 *  and can tolerate a transient partial without poisoning the shared memo. */
function extractScheduledTasks(agentGroupId: string, sessionIds: string[]): ScheduledTaskRow[] {
  return extractGroupTasks(agentGroupId, sessionIds).tasks;
}

// Per-agent-group scheduled-task snapshot, refreshed on a background interval so
// the hot paths (getState's 5s state broadcast, the /api/overview landing panel,
// /api/tasks) serve counts/rows from memory instead of walking every session dir
// and opening every inbound.db inline on the request/broadcast path. Mirrors
// sessionCostCache / refreshSessionCostCache. The underlying scan is mtime-gated
// (extractSessionTasks), so a steady-state refresh is a stat per session, not a
// sqlite open. Readers fall back to a direct (still mtime-cached) scan when a
// group is not yet in the snapshot, so a freshly-created group is never missed.
interface GroupTaskSummary {
  tasks: ScheduledTaskRow[];
  active: number;
  paused: number;
  completed: number;
  // When this group's summary was last (re)published — per-group, since the
  // refresh publishes each group independently rather than swapping the whole
  // map at the end, so readers observe a completed group's fresh count at once.
  refreshedAt: number;
}
const groupTaskCache = new Map<string, GroupTaskSummary>();

function summarizeGroupTasks(tasks: ScheduledTaskRow[]): GroupTaskSummary {
  let active = 0;
  let paused = 0;
  let completed = 0;
  for (const t of tasks) {
    const st = t.status === 'pending' ? 'active' : t.status;
    if (st === 'active') active++;
    else if (st === 'paused') paused++;
    else if (st === 'completed') completed++;
  }
  return { tasks, active, paused, completed, refreshedAt: Date.now() };
}

/** Snapshot of a group's scheduled tasks: memo hit when warm, else a live
 *  (mtime-cached) scan. The memo is seeded only on a clean read: a partial (a
 *  constituent DB read failed) is returned for this one response but not cached,
 *  so the next reader/refresh retries instead of memoizing an undercount. */
function getGroupTaskSummary(agentGroupId: string): GroupTaskSummary {
  const cached = groupTaskCache.get(agentGroupId);
  if (cached) return cached;
  const { sessionIds } = collectSessionDbFiles(agentGroupId);
  const scan = extractGroupTasks(agentGroupId, sessionIds);
  const summary = summarizeGroupTasks(scan.tasks);
  if (scan.ok) groupTaskCache.set(agentGroupId, summary);
  return summary;
}

// Re-entrancy guard: the scan yields between groups (setImmediate), so a slow
// fleet refresh can outlast the 15s interval; a second tick must not stack on
// the first. Mirrors sessionCostScanning.
let groupTaskRefreshing = false;

/** Refresh the per-group task snapshot. Publishes each group independently the
 *  moment its scan completes (with a per-group refreshedAt) rather than swapping
 *  the whole map after the last group, so a slow scan can't push staleness toward
 *  two intervals. Yields between groups so requests/SSE/WS keep flowing on a
 *  several-thousand-session install. A group whose scan hit a transient read
 *  error keeps its previous summary and is retried next cycle. Deleted groups are
 *  pruned separately after the pass. */
async function refreshGroupTaskCache(): Promise<void> {
  if (groupTaskRefreshing) return;
  groupTaskRefreshing = true;
  try {
    if (!db) db = openDb();
    if (!db) return;
    let groups: { id: string }[];
    try {
      groups = db.prepare('SELECT id FROM agent_groups').all() as { id: string }[];
    } catch {
      return; // DB not ready
    }
    const liveGroupIds = new Set<string>();
    const livePaths = new Set<string>();
    for (const g of groups) {
      liveGroupIds.add(g.id);
      const { sessionIds } = collectSessionDbFiles(g.id);
      for (const sid of sessionIds) {
        livePaths.add(join(getDataDir(), 'v2-sessions', g.id, sid, 'inbound.db'));
      }
      const scan = extractGroupTasks(g.id, sessionIds);
      // Publish a clean read only; a partial retains the previous summary.
      if (scan.ok) groupTaskCache.set(g.id, summarizeGroupTasks(scan.tasks));
      // Yield so a large fleet scan doesn't monopolize the event loop; each
      // published group is observable by readers immediately.
      await new Promise<void>((resolve) => setImmediate(resolve));
    }
    // Prune summaries for groups that no longer exist (replaces the old
    // whole-map swap, which is gone now that we publish per group).
    for (const id of groupTaskCache.keys()) {
      if (!liveGroupIds.has(id)) groupTaskCache.delete(id);
    }
    // Drop per-file cache entries for sessions that no longer exist.
    if (perFileTaskCache.size > livePaths.size * 2 + 1000) {
      for (const k of perFileTaskCache.keys()) if (!livePaths.has(k)) perFileTaskCache.delete(k);
    }
  } finally {
    groupTaskRefreshing = false;
  }
}

// ---------------------------------------------------------------------------
// V1 → V2 migration: package a v1 NanoClaw instance's agent data into a
// v4-compatible archive buffer. Generic — works for any v1 instance path.
// ---------------------------------------------------------------------------

/** Inbound DB schema (duplicated from src/db/schema.ts to keep dashboard self-contained). */
const V2_INBOUND_SCHEMA = `
CREATE TABLE IF NOT EXISTS messages_in (
  id TEXT PRIMARY KEY, seq INTEGER UNIQUE, kind TEXT NOT NULL,
  timestamp TEXT NOT NULL, status TEXT DEFAULT 'pending', process_after TEXT,
  recurrence TEXT, tries INTEGER DEFAULT 0, platform_id TEXT,
  channel_type TEXT, thread_id TEXT, content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS delivered (
  message_out_id TEXT PRIMARY KEY, platform_message_id TEXT,
  status TEXT NOT NULL DEFAULT 'delivered', delivered_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS destinations (
  name TEXT PRIMARY KEY, display_name TEXT, type TEXT NOT NULL,
  channel_type TEXT, platform_id TEXT, agent_group_id TEXT
);
CREATE TABLE IF NOT EXISTS session_routing (
  id INTEGER PRIMARY KEY CHECK (id = 1), channel_type TEXT, platform_id TEXT, thread_id TEXT
);`;

/** Outbound DB schema. */
const V2_OUTBOUND_SCHEMA = `
CREATE TABLE IF NOT EXISTS messages_out (
  id TEXT PRIMARY KEY, seq INTEGER UNIQUE, in_reply_to TEXT,
  timestamp TEXT NOT NULL, deliver_after TEXT, recurrence TEXT,
  kind TEXT NOT NULL, platform_id TEXT, channel_type TEXT,
  thread_id TEXT, content TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS processing_ack (
  message_id TEXT PRIMARY KEY, status TEXT NOT NULL, status_changed TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS session_state (
  key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT NOT NULL
);`;

/** V1 directories to skip entirely when collecting group files. */
const V1_SKIP_GROUP_DIRS = /^(node_modules|build|cmake-.*|conda.*|dist|target|__pycache__|\.cache|venv|\.venv)$/;

/**
 * Parse v1 conversation markdown files into inbound/outbound message pairs.
 * V1 format: alternating `**User**:` and `**AgentName**:` blocks.
 * User blocks contain `<message ... time="Apr 10, 2026, 1:10 PM">text</message>` XML.
 * Returns arrays ready for DB insertion.
 */
/**
 * Compose the v1 base CLAUDE.md from a v1 instance's own template files.
 * Mirrors v1's composeClaudeMd() logic: global base + \n\n---\n\n + each section.
 * Returns null if the template files aren't found (e.g. very old v1 instance).
 */
function composeV1Base(v1Root: string): string | null {
  const globalPath = join(v1Root, 'groups', 'global', 'CLAUDE.md');
  if (!existsSync(globalPath)) return null;

  let composed = readFileSync(globalPath, 'utf-8');

  // Read manifest to discover section order (default: dashboard-formatting, coworker-extensions)
  const manifestPath = join(v1Root, 'groups', 'templates', 'manifests', 'coworker.yaml');
  let sections = ['dashboard-formatting', 'coworker-extensions']; // v1 default
  if (existsSync(manifestPath)) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const yaml = require('js-yaml');
      const manifest = yaml.load(readFileSync(manifestPath, 'utf-8')) as any;
      if (Array.isArray(manifest?.sections)) sections = manifest.sections;
    } catch {
      /* use defaults */
    }
  }

  const sectionsDir = join(v1Root, 'groups', 'templates', 'sections');
  for (const section of sections) {
    const sectionPath = join(sectionsDir, `${section}.md`);
    if (existsSync(sectionPath)) {
      composed += `\n\n---\n\n${readFileSync(sectionPath, 'utf-8')}`;
    }
  }

  // Project overlays (sorted alphabetically)
  const projectsDir = join(v1Root, 'groups', 'templates', 'projects');
  if (existsSync(projectsDir)) {
    try {
      const projects = readdirSync(projectsDir).sort();
      for (const proj of projects) {
        const overlayPath = join(projectsDir, proj, 'coworker-base.md');
        if (existsSync(overlayPath)) {
          composed += `\n\n---\n\n${readFileSync(overlayPath, 'utf-8')}`;
        }
      }
    } catch {
      /* no overlays */
    }
  }

  return composed;
}

/**
 * Strip lego spine content from a CLAUDE.md so only user-authored lines remain.
 * Used during V1 import of typed coworkers to extract the custom delta.
 */
function stripLegoSpineContent(instructions: string, coworkerType: string): string {
  let spine: string;
  try {
    const req = createRequire(import.meta.url);
    const { composeCoworkerSpine } = req(join(getProjectRoot(), 'dist', 'claude-composer.js'));
    spine = composeCoworkerSpine({ coworkerType });
  } catch {
    return instructions;
  }
  const spineLines = new Set(
    spine
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l.length > 0),
  );
  const legoHeaders = new Set([
    '## Identity',
    '## Invariants',
    '## Context',
    '## Workflows Available',
    '## Skills Available',
    '## Trait Bindings',
    '## Workflow Customizations',
    '### Safety invariants',
    '### Truthfulness invariants',
    '### Scope invariants',
  ]);
  const filtered = instructions.split('\n').filter((line) => {
    const trimmed = line.trim();
    if (trimmed.length === 0) return true;
    if (legoHeaders.has(trimmed)) return false;
    if (spineLines.has(trimmed)) return false;
    return true;
  });
  const collapsed: string[] = [];
  let prevBlank = false;
  for (const line of filtered) {
    const blank = line.trim().length === 0;
    if (blank && prevBlank) continue;
    collapsed.push(line);
    prevBlank = blank;
  }
  const result = collapsed.join('\n').trim();
  const meaningful = result.split('\n').filter((l) => l.trim().length > 0);
  return meaningful.length < 5 ? '' : result;
}

/**
 * Package a v1 NanoClaw agent into a v4-format archive buffer.
 * Works with any v1 instance — pass the root path and folder name.
 */
async function packageV1Archive(
  v1Root: string,
  folder: string,
): Promise<{ buffer: Buffer; agentName: string; stats: Record<string, number> }> {
  const tarStream = await import('tar-stream');
  const { Readable } = await import('stream');

  const v1GroupDir = join(v1Root, 'groups', folder);
  const v1SessionDir = join(v1Root, 'data', 'sessions', folder);
  const v1StoreDb = join(v1Root, 'store', 'messages.db');

  if (!existsSync(v1GroupDir)) throw new Error(`V1 group dir not found: ${v1GroupDir}`);

  const stats = { groupFiles: 0, claudeFiles: 0, tasks: 0 };

  // 1. Read agent metadata from v1 store/messages.db
  let agentName = folder
    .replace(/^dashboard_/, '')
    .replace(/-/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
  let triggerPattern = `@${agentName.replace(/\s+/g, '')}`;
  let v1SessionId: string | null = null;
  let coworkerType: string | null = null;
  let allowedMcpTools: string | null = null;
  let containerConfig: string | null = null;
  const v1Tasks: any[] = [];
  const v1Messages: any[] = [];

  if (existsSync(v1StoreDb)) {
    let sdb: Database | null = null;
    try {
      sdb = new Database(v1StoreDb, { readonly: true });
      sdb.pragma('busy_timeout = 3000');

      // registered_groups
      const reg = sdb.prepare('SELECT * FROM registered_groups WHERE folder = ?').get(folder) as any;
      if (reg) {
        agentName = reg.name || agentName;
        triggerPattern = reg.trigger_pattern || triggerPattern;
        coworkerType = reg.coworker_type || null;
        allowedMcpTools = reg.allowed_mcp_tools || null;
        containerConfig = reg.container_config || null;
      }

      // sessions
      const sess = sdb.prepare('SELECT session_id FROM sessions WHERE group_folder = ?').get(folder) as any;
      if (sess) v1SessionId = sess.session_id;

      // scheduled_tasks
      const tasks = sdb.prepare('SELECT * FROM scheduled_tasks WHERE group_folder = ?').all(folder) as any[];
      for (const t of tasks) v1Tasks.push(t);

      // messages — v1 stores chat history in the central messages table
      // keyed by chat_jid = 'dashboard:{short_name}' where short_name = folder minus 'dashboard_'
      try {
        const shortName = folder.replace(/^dashboard_/, '');
        const chatJid = `dashboard:${shortName}`;
        const msgs = sdb
          .prepare(
            'SELECT id, content, timestamp, is_from_me, is_bot_message, sender, sender_name FROM messages WHERE chat_jid = ? ORDER BY timestamp',
          )
          .all(chatJid) as any[];
        for (const m of msgs) v1Messages.push(m);
      } catch {
        /* messages table may not exist in older v1 instances */
      }
    } catch {
      /* v1 DB may not exist or have different schema */
    } finally {
      try {
        sdb?.close();
      } catch {
        /* */
      }
    }
  }

  // Fallback: if V1 DB didn't have coworkerType, look up from coworkers/*.yaml
  if (!coworkerType) {
    try {
      const jsYamlLookup = await import('js-yaml');
      const coworkersDir = join(dirname(dirname(import.meta.url.replace('file://', ''))), 'coworkers');
      const yamlCandidates = [
        join(coworkersDir, `${folder}.yaml`),
        join(coworkersDir, `${folder.replace(/^dashboard_/, '')}.yaml`),
      ];
      for (const yp of yamlCandidates) {
        if (existsSync(yp)) {
          const parsed = jsYamlLookup.load(readFileSync(yp, 'utf-8')) as any;
          if (parsed?.agent?.coworkerType) {
            coworkerType = parsed.agent.coworkerType;
            if (parsed.agent.allowedMcpTools && !allowedMcpTools) {
              allowedMcpTools = JSON.stringify(parsed.agent.allowedMcpTools);
            }
            break;
          }
        }
      }
    } catch {
      /* YAML lookup is best-effort */
    }
  }

  // 2. Extract custom instructions from CLAUDE.md.
  // V1 composed CLAUDE.md = base (groups/global/CLAUDE.md, retired in v2)
  // + sections (templates/sections/*.md) + optional role templates (typed
  // coworkers). V2 recomposes from its own base + sections + .instructions.md,
  // so we must extract only the custom delta — not the shared boilerplate.
  //
  // Algorithm:
  //   a) Compose the v1 base from the v1 instance's own template files.
  //   b) If the agent's CLAUDE.md starts with that base → delta is everything
  //      after the base (the claudeMdAppend content, or role template for typed).
  //   c) If it doesn't match → fully rewritten static coworker; entire file
  //      is the instructions.
  //   d) For typed coworkers whose delta matches role templates, v2 will
  //      recompose from coworker-types.json, so we store coworkerType in the
  //      manifest and the instructions can be empty. BUT we still extract the
  //      delta in case v2 doesn't have the same role templates.
  let instructions = '';
  const claudeMdPath = join(v1GroupDir, 'CLAUDE.md');
  if (existsSync(claudeMdPath)) {
    const fullClaudeMd = readFileSync(claudeMdPath, 'utf-8');
    const v1Base = composeV1Base(v1Root);
    if (v1Base && fullClaudeMd.startsWith(v1Base)) {
      // Base matches — extract only the delta
      instructions = fullClaudeMd
        .slice(v1Base.length)
        .replace(/^\n*---\n*/, '\n')
        .trimStart();
    } else {
      // Fully rewritten — use entire file
      instructions = fullClaudeMd;
    }
  }

  // 3. Collect group files (skip repo clones and heavy dirs)
  const groupFiles = new Map<string, string>();
  function collectV1GroupFiles(dir: string, relPrefix: string): void {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return;
    }
    for (const entry of entries) {
      const abs = join(dir, entry);
      const rel = relPrefix ? `${relPrefix}/${entry}` : entry;
      let st: ReturnType<typeof statSync>;
      try {
        st = statSync(abs);
      } catch {
        continue;
      }
      if (st.isDirectory()) {
        if (V1_SKIP_GROUP_DIRS.test(entry)) continue;
        collectV1GroupFiles(abs, rel);
      } else if (st.isFile()) {
        if (entry === 'CLAUDE.md' || entry === '.claude-global.md') continue;
        if (st.size > MAX_SINGLE_FILE_SIZE) continue;
        groupFiles.set(rel, abs);
      }
    }
  }
  collectV1GroupFiles(v1GroupDir, '');
  stats.groupFiles = groupFiles.size;

  // 4. Collect .claude/ session state → remap to .claude-shared/ with -workspace-agent
  const claudeFiles = new Map<string, string>();
  const v1ClaudeDir = join(v1SessionDir, '.claude');
  if (existsSync(v1ClaudeDir)) {
    function collectClaudeV1(dir: string, relPrefix: string): void {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return;
      }
      for (const entry of entries) {
        const abs = join(dir, entry);
        let rel = relPrefix ? `${relPrefix}/${entry}` : entry;
        let st: ReturnType<typeof statSync>;
        try {
          st = statSync(abs);
        } catch {
          continue;
        }
        if (st.isDirectory()) {
          if (entry === 'agent-runner-src') continue; // Reinitialised at session start
          collectClaudeV1(abs, rel);
        } else if (st.isFile()) {
          if (st.size > MAX_SINGLE_FILE_SIZE) continue;
          // Path rename: -workspace-group → -workspace-agent
          rel = rel.replace(/-workspace-group/g, '-workspace-agent');
          claudeFiles.set(rel, abs);
        }
      }
    }
    collectClaudeV1(v1ClaudeDir, '');
  }
  stats.claudeFiles = claudeFiles.size;
  stats.tasks = v1Tasks.filter((t) => t.status === 'active').length;

  // 5. Build v4 manifest
  const jsYaml = await import('js-yaml');
  const manifest: Record<string, unknown> = {
    version: 4,
    archiveFormat: 'full',
    sourceFormat: 'v1',
    exportedAt: new Date().toISOString(),
    sourceInstance: v1Root,
    requires: null,
    agent: {
      name: agentName,
      folder,
      coworkerType: coworkerType || null,
      allowedMcpTools: allowedMcpTools ? JSON.parse(allowedMcpTools) : null,
      agentProvider: null,
      containerConfig: containerConfig ? JSON.parse(containerConfig) : null,
    },
    instructions: instructions || null,
    instructionTemplate: null,
    trigger: triggerPattern,
    destinations: null,
    sessions: v1SessionId ? [{ origId: `v1-${folder}`, status: 'active', v1SessionId }] : [],
    scheduledTasks: v1Tasks
      .filter((t) => t.status === 'active' || t.status === 'paused')
      .map((t) => ({
        origId: t.id,
        recurrence: t.schedule_type === 'cron' ? t.schedule_value : null,
        processAfter: toSqliteDatetime(t.next_run),
        content: JSON.stringify({ prompt: t.prompt, script: t.script || null }),
        importStatus: 'paused',
        v1ScheduleType: t.schedule_type,
        v1ScheduleValue: t.schedule_value,
      })),
    memory: null,
    // V1 chat messages from the central messages table — backfilled into
    // session DBs during import so the dashboard chat shows history.
    chatMessages: v1Messages.map((m) => ({
      id: m.id,
      content: m.content,
      timestamp: m.timestamp,
      isFromMe: m.is_from_me,
      isBotMessage: m.is_bot_message,
      sender: m.sender,
      senderName: m.sender_name,
    })),
  };

  // 6. Pack tar.gz
  const pack = tarStream.pack();
  const manifestYaml = jsYaml.dump(manifest, { lineWidth: 120, noRefs: true });
  pack.entry({ name: 'manifest.yaml' }, manifestYaml);

  // Instructions as .instructions.md in group-files
  if (instructions) {
    const instrBuf = Buffer.from(instructions, 'utf-8');
    pack.entry({ name: 'group-files/.instructions.md', size: instrBuf.length }, instrBuf);
  }

  for (const [rel, abs] of groupFiles) {
    const data = readFileSync(abs);
    pack.entry({ name: `group-files/${rel}`, size: data.length }, data);
  }

  for (const [rel, abs] of claudeFiles) {
    const data = readFileSync(abs);
    pack.entry({ name: `claude-shared/${rel}`, size: data.length }, data);
  }

  pack.finalize();

  // Collect into buffer
  const { createGzip: gz } = await import('zlib');
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    const gzip = gz();
    pack.pipe(gzip);
    gzip.on('data', (chunk: Buffer) => chunks.push(chunk));
    gzip.on('end', () => resolve({ buffer: Buffer.concat(chunks), agentName, stats }));
    gzip.on('error', (err: Error) => reject(err));
  });
}

/** Extract archive from gzipped tarball buffer. Validates security constraints.
 *  Returns manifest + files as Buffers keyed by archive-relative path. */
async function extractArchiveBuffer(buffer: Buffer): Promise<{ manifest: any; files: Map<string, Buffer> }> {
  const tarStream = await import('tar-stream');
  const { Readable, PassThrough } = await import('stream');
  const { createGunzip: gunzip } = await import('zlib');

  return new Promise((resolve, reject) => {
    const extract = tarStream.extract();
    const files = new Map<string, Buffer>();
    let manifest: any = null;
    let totalSize = 0;
    let entryCount = 0;

    extract.on('entry', (header: any, stream: any, next: () => void) => {
      entryCount++;
      if (entryCount > MAX_ARCHIVE_ENTRIES) {
        stream.resume();
        return reject(new Error(`Archive exceeds ${MAX_ARCHIVE_ENTRIES} entries`));
      }

      const name = header.name;
      // Security: reject path traversal, absolute paths, null bytes
      if (name.includes('..') || name.startsWith('/') || name.includes('\0')) {
        stream.resume();
        return reject(new Error(`Unsafe path in archive: ${name}`));
      }

      const chunks: Buffer[] = [];
      stream.on('data', (chunk: Buffer) => {
        totalSize += chunk.length;
        if (totalSize > MAX_EXTRACTED_SIZE) {
          return reject(new Error(`Archive exceeds ${MAX_EXTRACTED_SIZE} bytes when extracted`));
        }
        chunks.push(chunk);
      });
      stream.on('end', () => {
        const data = Buffer.concat(chunks);
        if (header.type === 'file') {
          // Normalize: strip leading ./ if present
          const normalized = name.replace(/^\.\//, '');
          if (normalized === 'manifest.yaml' || normalized === 'manifest.yml') {
            try {
              manifest = JSON.parse(data.toString('utf-8'));
            } catch {
              // Try YAML parse at the end
              manifest = data;
            }
          }
          files.set(normalized, data);
        }
        next();
      });
      stream.on('error', (err: Error) => reject(err));
    });

    extract.on('finish', async () => {
      // Parse manifest if it was YAML
      if (manifest instanceof Buffer) {
        try {
          const jsYaml = await import('js-yaml');
          manifest = jsYaml.load(manifest.toString('utf-8'));
        } catch {
          try {
            manifest = JSON.parse(manifest.toString('utf-8'));
          } catch {
            return reject(new Error('Failed to parse manifest'));
          }
        }
      }
      if (!manifest) return reject(new Error('Archive missing manifest.yaml'));
      resolve({ manifest, files });
    });

    extract.on('error', (err: Error) => reject(err));

    // Pipe: buffer → gunzip → tar extract
    const readable = Readable.from(buffer);
    const gunzipStream = gunzip();
    gunzipStream.on('error', (err: Error) => reject(new Error(`Gunzip failed: ${err.message}`)));
    readable.pipe(gunzipStream).pipe(extract);
  });
}

export interface DashboardRequestOptions {
  readOnly?: boolean;
}

/** Exported for testing — handles all HTTP requests. */
export async function handleRequest(
  req: import('http').IncomingMessage,
  res: import('http').ServerResponse,
  options: DashboardRequestOptions = {},
): Promise<void> {
  const url = new URL(req.url || '/', `http://localhost:${getDashboardPort()}`);

  if (options.readOnly && req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(403, {
      'Content-Type': 'application/json',
      Allow: 'GET, HEAD',
    });
    res.end('{"error":"read-only dashboard"}');
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/auth/status') {
    const secret = getDashboardSecret();
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        required: Boolean(secret),
        authenticated: isDashboardAuthenticated(req, secret),
      }),
    );
    return;
  }

  if (req.method === 'POST' && url.pathname === '/api/auth/session') {
    const configuredSecret = getDashboardSecret();
    if (!configuredSecret) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true,"required":false}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const parsed = JSON.parse(body) as { secret?: unknown };
      const submittedSecret = typeof parsed.secret === 'string' ? parsed.secret : '';
      if (submittedSecret !== configuredSecret) {
        res.writeHead(401, { 'Content-Type': 'application/json' });
        res.end('{"error":"invalid dashboard secret"}');
        return;
      }
      res.writeHead(200, {
        'Content-Type': 'application/json',
        'Set-Cookie': buildAuthCookie(configuredSecret),
      });
      res.end('{"ok":true}');
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"invalid json"}');
    }
    return;
  }

  if (req.method === 'DELETE' && url.pathname === '/api/auth/session') {
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Set-Cookie': buildAuthCookie('', true),
    });
    res.end('{"ok":true}');
    return;
  }

  // API: receive hook events from containers
  if (req.method === 'POST' && url.pathname === '/api/hook-event') {
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const raw = JSON.parse(body);
      // Per-session identity headers emitted by container-runner since the
      // sdk_session_routes migration. When present, the dashboard stamps
      // an exact SDK → NanoClaw route at intake — no guessing. When
      // absent (pre-upgrade containers, bespoke runners), routing falls
      // through to the query-time fallback order.
      const hookNanoSessId =
        typeof req.headers['x-nanoclaw-session-id'] === 'string'
          ? (req.headers['x-nanoclaw-session-id'] as string).trim()
          : '';
      // Normalize Claude Code's native HTTP hook payload into our HookEvent format.
      // HTTP hooks send the raw SDK JSON with different field names than our old
      // bash-script format. We accept both for backwards compatibility.
      const event: HookEvent = {
        group: raw.group || (req.headers['x-group-folder'] as string) || '',
        agent_group_id: undefined,
        event: raw.event || raw.hook_event_name || '',
        tool: raw.tool || raw.tool_name || undefined,
        message: raw.message || raw.notification || raw.prompt || undefined,
        tool_input:
          typeof raw.tool_input === 'string'
            ? raw.tool_input
            : raw.tool_input
              ? JSON.stringify(raw.tool_input)
              : undefined,
        tool_response:
          typeof raw.tool_response === 'string'
            ? raw.tool_response
            : typeof raw.tool_result === 'string'
              ? raw.tool_result
              : raw.tool_result
                ? JSON.stringify(raw.tool_result)
                : raw.tool_response
                  ? JSON.stringify(raw.tool_response)
                  : undefined,
        tool_use_id: raw.tool_use_id || undefined,
        session_id: raw.session_id || undefined,
        agent_id: raw.agent_id || undefined,
        agent_type: raw.agent_type || undefined,
        transcript_path: raw.transcript_path || raw.agent_transcript_path || undefined,
        cwd: raw.cwd || undefined,
        timestamp: Date.now(),
      } as HookEvent;
      // Pack additional fields into extra
      const extra: Record<string, any> = {};
      if (typeof raw.extra === 'object' && raw.extra !== null) {
        Object.assign(extra, raw.extra);
      } else if (typeof raw.extra === 'string') {
        try {
          Object.assign(extra, JSON.parse(raw.extra));
        } catch {
          /* ignore */
        }
      }
      // Capture event-specific fields that aren't in our core schema
      for (const key of [
        'source',
        'stop_hook_active',
        'files_modified',
        'error_message',
        'error_code',
        'error',
        'is_interrupt',
        'tool_count',
        'permission_mode',
        'model',
        'last_assistant_message',
        'compact_summary',
        'trigger',
        'custom_instructions',
        'teammate_name',
        'team_name',
        'task_id',
        'task_subject',
        'task_description',
        'file_path',
        'memory_type',
        'load_reason',
        'notification_type',
        'mcp_server_name',
        'permission_suggestions',
      ]) {
        if (raw[key] !== undefined && raw[key] !== null) extra[key] = raw[key];
      }
      event.extra = Object.keys(extra).length > 0 ? extra : undefined;

      // Persist to database
      const heDb = getHookEventsDb();
      if (heDb) {
        if (event.group) {
          try {
            const ag = heDb.prepare('SELECT id FROM agent_groups WHERE folder = ? LIMIT 1').get(event.group) as any;
            event.agent_group_id = ag?.id || undefined;
          } catch {
            /* agent_groups table absent in degraded fixtures */
          }
        }
        try {
          const insertResult = heDb
            .prepare(
              `INSERT INTO hook_events
            (group_folder, event, tool, tool_use_id, message, tool_input, tool_response,
             session_id, agent_id, agent_type, transcript_path, cwd, extra, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            )
            .run(
              event.group || '',
              event.event || '',
              event.tool || null,
              event.tool_use_id || null,
              event.message || null,
              event.tool_input || null,
              event.tool_response || null,
              event.session_id || null,
              event.agent_id || null,
              event.agent_type || null,
              event.transcript_path || null,
              event.cwd || null,
              event.extra ? JSON.stringify(event.extra) : null,
              event.timestamp,
            );
          event.id = Number(insertResult.lastInsertRowid);
          // Stamp sdk_session_routes when the container told us its nano
          // session id. We validate the claim before writing — the header
          // is attacker-addressable, so a bad/stale/custom hook must not
          // be able to corrupt another session's attribution. The
          // validated INSERT joins sessions → agent_groups and only
          // commits when the claimed session exists AND its agent
          // group's folder matches the event's X-Group-Folder.
          if (hookNanoSessId && event.session_id && event.group) {
            try {
              const row = heDb
                .prepare(
                  `SELECT s.id AS session_id, s.agent_group_id AS agent_group_id, ag.folder AS folder
                     FROM sessions s
                     JOIN agent_groups ag ON ag.id = s.agent_group_id
                    WHERE s.id = ?
                    LIMIT 1`,
                )
                .get(hookNanoSessId) as { session_id: string; agent_group_id: string; folder: string } | undefined;
              if (row && row.folder === event.group) {
                heDb
                  .prepare(
                    `INSERT OR IGNORE INTO sdk_session_routes
                       (sdk_session_id, nanoclaw_session_id, agent_group_id, group_folder,
                        first_seen_at, last_seen_at, source)
                     VALUES (?, ?, ?, ?, ?, ?, 'live')`,
                  )
                  .run(
                    event.session_id,
                    row.session_id,
                    row.agent_group_id,
                    row.folder,
                    event.timestamp,
                    event.timestamp,
                  );
                heDb
                  .prepare('UPDATE sdk_session_routes SET last_seen_at = ? WHERE sdk_session_id = ?')
                  .run(event.timestamp, event.session_id);

                // Derive a display title on the first UserPromptSubmit for
                // this nano session. Runs once per session: the WHERE clause
                // requires display_title IS NULL and title_source != 'manual'
                // so subsequent prompts don't churn the title, and an
                // operator-set title is always safe.
                if (event.event === 'UserPromptSubmit' && event.message) {
                  const newTitle = titleFromPrompt(event.message);
                  if (newTitle) {
                    try {
                      heDb
                        .prepare(
                          `UPDATE sessions
                              SET display_title = ?, title_source = 'heuristic', title_updated_at = ?
                            WHERE id = ?
                              AND (display_title IS NULL OR display_title = '')
                              AND COALESCE(title_source, '') != 'manual'`,
                        )
                        .run(newTitle, new Date().toISOString(), row.session_id);
                    } catch {
                      /* pre-migration-021 installs won't have the columns yet */
                    }
                  }
                }
              }
              // Silent skip when unknown_session or folder_mismatch —
              // log if we add structured audit later. The query-time
              // fallback will still bucket the event via heuristic.
            } catch {
              /* routes table may not exist pre-migration — non-fatal */
            }
          }
        } catch {
          /* DB write failure — non-fatal */
        }
      }

      // Update live state
      if (event.group) {
        hookEverSeen.add(event.group);
        const prev = liveHookState.get(event.group);
        const isStopEvent = event.event === 'Stop' || event.event === 'SessionEnd';
        const isActiveEvent = !isStopEvent && event.event !== 'Notification';
        const nextStatus = classifyEventStatus(event, prev?.status || 'working');
        liveHookState.set(event.group, {
          tool: isStopEvent ? undefined : event.tool || prev?.tool,
          notification: event.message || prev?.notification,
          status: nextStatus,
          ts: Date.now(),
          agentActive: isStopEvent ? false : isActiveEvent || prev?.agentActive || false,
        });
      }
      updateLiveSubagentState(event);

      const eventSummary = toHookEventSummary(event);
      hookEvents.push(eventSummary);
      if (hookEvents.length > MAX_HOOK_EVENTS) hookEvents.shift();
      invalidateStateCache();
      broadcastHookEvent(eventSummary, getLiveCoworkerPatch(event));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch {
      res.writeHead(400);
      res.end('{"error":"invalid json"}');
    }
    return;
  }

  // API: get current state
  if (url.pathname === '/api/state') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(fullStateJson());
    return;
  }

  // API: liveness + readiness probe. Unauthenticated — designed for external
  // uptime checks and K8s readiness/liveness. Reports build/version, db
  // reachability, and a simple `ok` boolean. Returns 200 if DB is reachable,
  // 503 otherwise.
  if (url.pathname === '/api/health') {
    let dbOk = false;
    let groupCount: number | null = null;
    try {
      const db = getWriteDb();
      if (db) {
        const row = db.prepare('SELECT COUNT(*) AS n FROM agent_groups').get() as { n: number };
        groupCount = row.n;
        dbOk = true;
      }
    } catch {
      /* dbOk stays false */
    }
    const pkg = (() => {
      try {
        return JSON.parse(readFileSync(join(getProjectRoot(), 'package.json'), 'utf-8')) as {
          version?: string;
        };
      } catch {
        return {};
      }
    })();
    const body = {
      ok: dbOk,
      version: pkg.version ?? null,
      uptimeSec: Math.round(process.uptime()),
      db: { reachable: dbOk, groupCount },
      pid: process.pid,
    };
    res.writeHead(dbOk ? 200 : 503, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(body));
    return;
  }

  // API: issue funnel — serves the cached snapshot written by
  // `scripts/funnel.ts --out reports/funnel.json` (host cron/manual refresh).
  // We never recompute here: the funnel makes ~180 GitHub calls and must stay
  // out of the request path. Returns 404 with a hint if no snapshot exists yet.
  if (url.pathname === '/api/funnel') {
    if (!requireAuth(req, res)) return;
    const funnelPath = join(getProjectRoot(), 'reports', 'funnel.json');
    if (!existsSync(funnelPath)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'no funnel snapshot',
          hint: 'run: pnpm exec tsx scripts/funnel.ts --out reports/funnel.json',
        }),
      );
      return;
    }
    try {
      const snap = JSON.parse(readFileSync(funnelPath, 'utf-8'));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snap));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'funnel snapshot unreadable' }));
    }
    return;
  }

  // API: nv-slang-bot contribution snapshot (commits/additions/deletions per repo),
  // written by scripts/bot-contributions.ts. Served alongside the funnel; never
  // recomputed inline (GitHub stats/contributors can 202 for seconds).
  // Regression quality — `scripts/regression-quality.py --json` (host cron; see
  // scripts/funnel-cron.sh). Served cached, never recomputed: it makes read-only
  // gh API calls that have no business in the request path.
  //
  // The snapshot carries `issues` and `unattributed`. Attribution coverage is
  // (issues - unattributed) / issues, and it is LOW — the bot/human split is a
  // FLOOR, not a total. The client renders that alongside the numbers.
  if (url.pathname === '/api/regression-quality') {
    if (!requireAuth(req, res)) return;
    const p = join(getProjectRoot(), 'reports', 'regression-quality.json');
    if (!existsSync(p)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          error: 'no snapshot',
          hint: 'run: python3 scripts/regression-quality.py --json reports/regression-quality.json',
        }),
      );
      return;
    }
    try {
      const snap = JSON.parse(readFileSync(p, 'utf-8'));
      // The producer writes no timestamp, so a cron that quietly stopped would
      // keep serving the same JSON with HTTP 200 forever and look current. Stamp
      // it from the file mtime so the client can show (and age) it.
      snap.snapshotMtime = statSync(p).mtime.toISOString();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(snap));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'snapshot unreadable' }));
    }
    return;
  }

  if (url.pathname === '/api/bot-contributions') {
    if (!requireAuth(req, res)) return;
    const p = join(getProjectRoot(), 'reports', 'bot-contributions.json');
    if (!existsSync(p)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'no snapshot', hint: 'run: pnpm exec tsx scripts/bot-contributions.ts' }));
      return;
    }
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(JSON.parse(readFileSync(p, 'utf-8'))));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'snapshot unreadable' }));
    }
    return;
  }

  // API: review-rounds snapshot — how many human CHANGES_REQUESTED rounds a PR
  // drew before merging, bot-authored vs human-authored, by merge week. Written
  // by scripts/review-rounds.py (host cron; see scripts/funnel-cron.sh). Served
  // cached, never recomputed inline: it makes read-only GitHub GraphQL calls
  // that have no business in the request path. Pass-through, exactly like
  // /api/bot-contributions above — the producer already fails closed
  // (complete:false + errors[] when its collection was incomplete), so this only
  // reads and forwards.
  if (url.pathname === '/api/review-rounds') {
    if (!requireAuth(req, res)) return;
    const p = join(getProjectRoot(), 'reports', 'review-rounds.json');
    if (!existsSync(p)) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({ error: 'no snapshot', hint: 'run: python3 scripts/review-rounds.py --json reports/review-rounds.json' }),
      );
      return;
    }
    try {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(JSON.parse(readFileSync(p, 'utf-8'))));
    } catch {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'snapshot unreadable' }));
    }
    return;
  }

  // API: recompute the bot-contributions snapshot in the background (a handful of
  // GitHub calls, ~seconds). Returns 202 and lets the client re-fetch shortly.
  if (req.method === 'POST' && url.pathname === '/api/bot-contributions/refresh') {
    if (!requireAuth(req, res)) return;
    try {
      const script = join(getProjectRoot(), 'scripts', 'bot-contributions.ts');
      const child = exec(
        `npx tsx ${JSON.stringify(script)}`,
        { cwd: getProjectRoot(), timeout: 2 * 60 * 1000, maxBuffer: 8 * 1024 * 1024 },
        () => {
          /* fire-and-forget; client re-fetches the snapshot shortly */
        },
      );
      child.unref?.();
      res.writeHead(202, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ started: true }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ started: false, error: String((err as Error)?.message || err) }));
    }
    return;
  }

  // API: kick off a funnel recompute. The recompute is ~180 GitHub calls / ~3
  // min, so this returns 202 immediately and the work runs in the background;
  // the client polls GET /api/funnel/status and re-fetches /api/funnel when it
  // sees running flip back to false. Re-entrant clicks are no-ops (409).
  if (req.method === 'POST' && url.pathname === '/api/funnel/refresh') {
    if (!requireAuth(req, res)) return;
    const { started } = startFunnelRefresh();
    res.writeHead(started ? 202 : 409, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ running: funnelRefresh.running, started }));
    return;
  }

  if (url.pathname === '/api/kb-health') {
    if (!requireAuth(req, res)) return;
    // Reads whatever the 05:45 cron last wrote. Never computes inline: the scan walks
    // every group's session transcripts and takes minutes, which would stall the request.
    const shared = join(getDataDir(), 'shared');
    const digestPath = join(shared, 'KB-HEALTH.md');
    const histPath = join(shared, '.kb-health.json');
    // Structured artifact written by scripts/kb-doctor.py (schema 1). The old
    // `.kb-doctor.txt` is deliberately NOT read as a fallback: nothing ever wrote
    // it, and falling back to it silently restores driftCount: 0 — the exact bug
    // this replaces. If the JSON is absent we report UNAVAILABLE, not clean.
    const doctorPath = join(shared, '.kb-doctor.json');
    let history: any[] = [];
    try {
      history = JSON.parse(readFileSync(histPath, 'utf-8'));
    } catch {
      history = [];
    }
    const latest = history.length ? history[history.length - 1] : null;
    let digest = '';
    try {
      digest = readFileSync(digestPath, 'utf-8');
    } catch {
      digest = '';
    }
    // Four states, and THREE of them are not "clean". The previous reader had
    // exactly one outcome — an empty array — for missing file, unreadable file,
    // and genuinely-no-drift alike, so a broken checker was indistinguishable
    // from a healthy repo.
    //
    // Note `complete: false` can coexist with `status: "drift"` — drift was found
    // AND something else could not run. `status` alone is worst-of and would hide
    // the second half, so both are surfaced.
    // Validated in full by dashboard/kb-doctor-artifact.ts. Checking only `schema`
    // and trusting the rest let a malformed or self-contradictory report render as
    // available, fresh and zero-drift — including `counts.drift: 0` beside a
    // non-empty drift array, which is the precise false zero the structured artifact
    // replaced. Anything we cannot fully understand is UNAVAILABLE with a reason.
    let doctor: KbDoctorView;
    try {
      doctor = readKbDoctorArtifact(JSON.parse(readFileSync(doctorPath, 'utf-8')));
    } catch (err) {
      doctor = kbDoctorUnavailable(
        (err as NodeJS.ErrnoException)?.code === 'ENOENT'
          ? 'no drift report'
          : `kb-doctor report unreadable: ${err instanceof Error ? err.message : String(err)}`,
      );
    }
    const drift = doctor.drift;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        available: Boolean(latest),
        generatedAt: latest?.generated_at ?? null,
        windowDays: latest?.window_days ?? null,
        cost: latest?.cost ?? null,
        value: latest?.value ?? null,
        shape: latest?.shape ?? null,
        atoms: latest?.atoms ?? null,
        topPages: latest?.top_pages ?? [],
        // Kept for existing consumers, but sourced from the producer's count —
        // null when unavailable, so "unknown" can never render as zero.
        driftCount: doctor.driftCount,
        drift,
        doctor,
        digest,
        trend: history.slice(-30).map((h: any) => ({
          date: h.date,
          tokens: h.cost?.tokens_total ?? 0,
          atoms: h.atoms?.total ?? 0,
          conceptBytes: h.shape?.concept_bytes ?? 0,
          overCap: h.shape?.pages_over_cap ?? 0,
        })),
      }),
    );
    return;
  }

  // API: funnel recompute status — polled by the client while a refresh runs.
  if (url.pathname === '/api/funnel/status') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        running: funnelRefresh.running,
        startedAt: funnelRefresh.startedAt,
        finishedAt: funnelRefresh.finishedAt,
        lastError: funnelRefresh.lastError,
      }),
    );
    return;
  }

  if (url.pathname === '/api/events') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 5000\n\n: connected\n\n');

    // Order matters: build the snapshot BEFORE joining the broadcast set.
    // fullStateEnvelope() → publishState() can itself emit a `state-delta` to
    // every registered client; if this connection were already registered it
    // would receive that delta ahead of its own snapshot, i.e. a patch against a
    // baseline it does not yet hold. Snapshot first, then join, so the client's
    // frame order is snapshot → (only) deltas that post-date it.
    //
    // `?snapshot=0` remains for debug/external consumers, but the built-in
    // clients no longer use it: a client that starts without a snapshot has no
    // epoch/rev baseline, so its first delta can only be rejected.
    const wantsSnapshot = url.searchParams.get('snapshot') !== '0';
    const snapshotFrame = wantsSnapshot ? `data: ${fullStateEnvelope()}\n\n` : null;
    sseClients.add(res);
    // Every post-handshake write goes through sendToClient() so a blocked socket
    // is tracked from its FIRST frame (see the WS upgrade handler).
    if (snapshotFrame) sendToClient(res, sseClients, snapshotFrame, false);

    const cursorValue =
      url.searchParams.get('after') ||
      (typeof req.headers['last-event-id'] === 'string' ? req.headers['last-event-id'] : '');
    const cursor = Number.parseInt(cursorValue, 10);
    if (Number.isFinite(cursor) && cursor >= 0) {
      const firstBufferedId = hookEvents.find((event) => event.id !== undefined)?.id;
      if (firstBufferedId !== undefined && cursor < firstBufferedId - 1) {
        sendToClient(res, sseClients, `data: ${JSON.stringify({ type: 'resync' })}\n\n`, false);
      } else {
        for (const event of hookEvents) {
          if (event.id === undefined || event.id <= cursor) continue;
          const payload = JSON.stringify({ type: 'hook-event', data: event });
          sendToClient(res, sseClients, `id: ${event.id}\ndata: ${payload}\n\n`, false);
        }
      }
    }

    // Capture the socket NOW: res.end() (SSE drain-recovery close) nulls
    // res.socket, so reading res.socket inside removeClient after a clean close
    // would skip the detach and leak a close/error handler per SSE request on the
    // reused keep-alive socket. res.socket is stable for the life of the request.
    const eventsSocket = res.socket;
    const removeClient = () => {
      sseClients.delete(res);
      clearBlockedTimer(res);
      clientBlockedSince.delete(res);
      staleClients.delete(res);
      // Detach the socket-level listeners: eventsSocket is reused across HTTP
      // keep-alive requests, so leaving them attached would accumulate one
      // close/error handler per SSE request on the same socket.
      eventsSocket?.off?.('close', removeClient);
      eventsSocket?.off?.('error', removeClient);
    };
    req.on('close', removeClient);
    eventsSocket?.on('close', removeClient);
    eventsSocket?.on('error', removeClient);
    return;
  }

  // API: get coworker types — return all types, let the user decide
  if (url.pathname === '/api/types') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(getCoworkerTypes()));
    return;
  }

  // API: list available overlays from container/overlays/*/OVERLAY.md
  //
  // Optional ?coworker=<folder> narrows the result set to overlays that apply
  // to that coworker's workflows — directly, via the multi-level extends
  // chain, or via a workflow trait/domain match. Each surviving overlay
  // includes `inheritedFrom` listing the workflow names that triggered the
  // match (so the editor can show "via /<workflow>" hints). Without the
  // query param we fall back to the legacy "return everything" behavior so
  // any other consumers stay intact.
  if (url.pathname === '/api/overlays') {
    if (!requireAuth(req, res)) return;
    try {
      const { readSkillCatalog } = await import('../src/claude-composer.js');
      const catalog = readSkillCatalog(getProjectRoot());
      const allOverlays = Object.values(catalog)
        .filter((entry: any) => entry.type === 'overlay' && entry.overlay)
        .map((entry: any) => ({
          name: entry.name,
          description: entry.description,
          appliesToWorkflows: entry.overlay.appliesToWorkflows || [],
          appliesToTraits: entry.overlay.appliesToTraits || [],
        }));

      const coworkerFolder = url.searchParams.get('coworker');
      if (!coworkerFolder) {
        // Legacy behavior: return every overlay in the catalog.
        const overlays = allOverlays.map((o) => ({
          name: o.name,
          description: o.description,
          appliesToWorkflows: o.appliesToWorkflows,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(overlays));
        return;
      }

      // Per-coworker filter: walk the workflow set (including the full
      // multi-level extendsWorkflow chain) and the workflows' trait
      // requirements, then keep only overlays whose appliesToWorkflows or
      // appliesToTraits hits something in that effective set.
      let coworkerType: string | null = null;
      try {
        if (db) {
          const row = db.prepare('SELECT coworker_type FROM agent_groups WHERE folder = ?').get(coworkerFolder) as
            | { coworker_type?: string }
            | undefined;
          coworkerType = row?.coworker_type || null;
        }
      } catch {
        coworkerType = null;
      }

      if (!coworkerType) {
        // Coworker isn't typed (legacy / untyped group) — fall back to all
        // overlays so the editor still works, but flag it for the UI.
        const overlays = allOverlays.map((o) => ({
          name: o.name,
          description: o.description,
          appliesToWorkflows: o.appliesToWorkflows,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ _warning: 'coworker has no type; returning all overlays', overlays }));
        return;
      }

      try {
        const { resolveCoworkerManifest, readCoworkerTypes } = await import('../src/claude-composer.js');
        const types = readCoworkerTypes(getProjectRoot());
        const manifest = resolveCoworkerManifest(types, coworkerType, catalog, getProjectRoot());
        const directWorkflows: string[] = (manifest.workflows || []).map((w: any) => w.name);

        // Walk the full multi-level extendsWorkflow chain for each workflow
        // (e.g. slang-fix-issue → fix-issue → implement). The effective set
        // is what overlays' appliesToWorkflows is matched against.
        const effectiveWorkflows = new Set<string>(directWorkflows);
        // Track the originating workflow for each ancestor so we can
        // attribute matches back to the coworker's actual workflow.
        const ancestorOrigin = new Map<string, string>();
        for (const wf of directWorkflows) {
          ancestorOrigin.set(wf, wf);
          let cursor: string | null = wf;
          const seen = new Set<string>();
          while (cursor && !seen.has(cursor)) {
            seen.add(cursor);
            const meta: any = catalog[cursor];
            const parent: string | null = meta?.extendsWorkflow || null;
            if (parent && !effectiveWorkflows.has(parent)) {
              effectiveWorkflows.add(parent);
              if (!ancestorOrigin.has(parent)) ancestorOrigin.set(parent, wf);
            }
            cursor = parent;
          }
        }

        // Trait/domain set across all of the coworker's workflows. Domains
        // are the prefix before the first dot (repo.pr → repo).
        const traitOrigin = new Map<string, string[]>();
        for (const wf of (manifest.workflows || []) as any[]) {
          for (const trait of wf.requires || []) {
            const domain = trait.split('.')[0];
            for (const key of [trait, domain]) {
              const list = traitOrigin.get(key) || [];
              if (!list.includes(wf.name)) list.push(wf.name);
              traitOrigin.set(key, list);
            }
          }
        }

        const filtered = allOverlays
          .map((o) => {
            const inheritedFrom = new Set<string>();
            for (const target of o.appliesToWorkflows) {
              if (effectiveWorkflows.has(target)) {
                inheritedFrom.add(ancestorOrigin.get(target) || target);
              }
            }
            for (const trait of o.appliesToTraits) {
              const origins = traitOrigin.get(trait);
              if (origins) for (const origin of origins) inheritedFrom.add(origin);
            }
            if (inheritedFrom.size > 0) {
              return {
                name: o.name,
                description: o.description,
                appliesToWorkflows: o.appliesToWorkflows,
                inheritedFrom: [...inheritedFrom],
              };
            }
            // Marker-only / opt-in overlays (empty applies-to) are activated
            // by listing them in agent_groups.overlays, not by workflow
            // matching. Surface them so the editor can toggle them.
            if (o.appliesToWorkflows.length === 0 && o.appliesToTraits.length === 0) {
              return {
                name: o.name,
                description: o.description,
                appliesToWorkflows: o.appliesToWorkflows,
                inheritedFrom: [],
                optInOnly: true,
              };
            }
            return null;
          })
          .filter((o): o is NonNullable<typeof o> => o !== null);

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(filtered));
        return;
      } catch (innerErr: any) {
        // Composer/resolver failed — surface a warning and fall back to the
        // unfiltered list rather than break the editor.
        const overlays = allOverlays.map((o) => ({
          name: o.name,
          description: o.description,
          appliesToWorkflows: o.appliesToWorkflows,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            _warning: `failed to resolve manifest for coworker "${coworkerFolder}" (type "${coworkerType}"): ${innerErr?.message || innerErr}`,
            overlays,
          }),
        );
        return;
      }
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: get coworker CLAUDE.md
  // Returns X-Readonly: true header for typed coworkers (CLAUDE.md rebuilt from templates)
  if (req.method === 'GET' && url.pathname.startsWith('/api/memory/')) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/memory/', ''));
    if (folder === null) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const raw = url.searchParams.get('raw') === '1';
    const groupDir = resolve(getGroupsDir(), folder);
    if (!isInsideDir(getGroupsDir(), groupDir)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    try {
      const headers: Record<string, string> = { 'Content-Type': 'text/plain' };
      let content: string;
      if (!raw) {
        // Default: live composed preview — compute on the fly for typed
        // coworkers; untyped coworkers ship .instructions.md verbatim.
        try {
          const { composeCoworkerSpine } = await import('../src/claude-composer.js');
          const rdb = db;
          let coworkerType: string | null = null;
          let disableOverlays = false;
          let overlays: string[] | undefined;
          if (rdb) {
            const row = rdb
              .prepare('SELECT coworker_type, disable_overlays, overlays FROM agent_groups WHERE folder = ?')
              .get(folder) as any;
            coworkerType = row?.coworker_type || null;
            disableOverlays = row?.disable_overlays === 1;
            overlays = row?.overlays ? JSON.parse(row.overlays) : undefined;
          }
          let extraInstructions: string | null = null;
          try {
            extraInstructions = readFileSync(join(groupDir, '.instructions.md'), 'utf-8');
          } catch {
            /* none */
          }
          if (coworkerType) {
            content = composeCoworkerSpine({ coworkerType, extraInstructions, disableOverlays, overlays });
          } else {
            content = readFileSync(join(groupDir, 'CLAUDE.md'), 'utf-8');
          }
        } catch {
          // Fallback to reading the file if compositor not available
          content = readFileSync(join(groupDir, 'CLAUDE.md'), 'utf-8');
        }
        headers['X-Readonly'] = 'true';
        headers['X-Readonly-Reason'] = 'System-composed (edit .instructions.md instead)';
      } else {
        // Return raw .instructions.md for editing
        try {
          content = readFileSync(join(groupDir, '.instructions.md'), 'utf-8');
        } catch {
          content = '';
        }
      }
      res.writeHead(200, headers);
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
    return;
  }

  // API: get hook events filtered by group
  if (url.pathname === '/api/hook-events') {
    if (!requireAuth(req, res)) return;
    const group = url.searchParams.get('group');
    const filtered = group ? hookEvents.filter((e) => e.group === group) : hookEvents;
    const requestedLimit = Number.parseInt(url.searchParams.get('limit') || `${RECENT_HOOK_EVENT_LIMIT}`, 10);
    const limit = Math.max(1, Math.min(requestedLimit || RECENT_HOOK_EVENT_LIMIT, 500));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered.slice(-limit)));
    return;
  }

  // API: paginated hook event history from DB
  if (url.pathname === '/api/hook-events/history') {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    if (!heDb) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }
    const group = url.searchParams.get('group');
    const sessionId = url.searchParams.get('session_id');
    const eventFilter = url.searchParams.get('event');
    const since = url.searchParams.get('since');
    const before = url.searchParams.get('before');
    // Cap raised from 500 → 5000 on 2026-05-29: an active install with bursty
    // a2a fan-outs (slang chains during a fix run) emits 700-900 events/hour.
    // The old 500 cap meant Timeline view truncated to ~30 min of history during
    // peaks, hiding webhooks that arrived 5+ hours back. 5000 ≈ 8 h on a busy
    // day at this pace — plenty for inspection. Frontend can paginate further
    // via `?before=<ts>` if needed.
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 5000);

    const conditions: string[] = [];
    const params: any[] = [];
    if (group) {
      conditions.push('group_folder = ?');
      params.push(group);
    }
    if (sessionId) {
      conditions.push('session_id = ?');
      params.push(sessionId);
    }
    if (eventFilter) {
      conditions.push('event = ?');
      params.push(eventFilter);
    }
    if (since) {
      conditions.push('timestamp >= ?');
      params.push(parseInt(since, 10));
    }
    if (before) {
      conditions.push('timestamp < ?');
      params.push(parseInt(before, 10));
    }

    const where = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';
    try {
      const rows = heDb
        .prepare(
          `SELECT id, group_folder, event, tool, tool_use_id,
                  substr(message, 1, ${HOOK_SUMMARY_MESSAGE_LIMIT}) AS message,
                  session_id, agent_id, agent_type, transcript_path, cwd,
                  CASE WHEN length(extra) <= 2048 THEN extra ELSE NULL END AS extra,
                  timestamp,
                  CASE WHEN tool_input IS NOT NULL
                          OR tool_response IS NOT NULL
                          OR length(message) > ${HOOK_SUMMARY_MESSAGE_LIMIT}
                          OR length(extra) > 2048
                       THEN 1 ELSE 0 END AS has_details
             FROM hook_events ${where}
            ORDER BY timestamp DESC LIMIT ?`,
        )
        .all(...params, limit) as any[];
      const summaries = rows.map((row) => {
        const summary = toHookEventSummary(
          {
            id: row.id,
            group: row.group_folder,
            event: row.event,
            tool: row.tool || undefined,
            tool_use_id: row.tool_use_id || undefined,
            message: row.message || undefined,
            session_id: row.session_id || undefined,
            agent_id: row.agent_id || undefined,
            agent_type: row.agent_type || undefined,
            transcript_path: row.transcript_path || undefined,
            cwd: row.cwd || undefined,
            extra: parseHookExtra(row.extra),
            timestamp: row.timestamp,
          },
          !!row.has_details,
        );
        return { ...summary, group_folder: row.group_folder };
      });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(summaries));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  const hookEventDetailMatch = url.pathname.match(/^\/api\/hook-events\/(\d+)$/);
  if (hookEventDetailMatch) {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    if (!heDb) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"hook event not found"}');
      return;
    }
    try {
      const row = heDb
        .prepare('SELECT id, message, tool_input, tool_response, extra FROM hook_events WHERE id = ?')
        .get(Number.parseInt(hookEventDetailMatch[1], 10)) as any;
      if (!row) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"hook event not found"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          id: row.id,
          message: row.message || null,
          tool_input: row.tool_input || null,
          tool_response: row.tool_response || null,
          extra: parseHookExtra(row.extra) || null,
        }),
      );
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: list sessions from hook_events, grouped by nanoclaw v2 session.
  //
  // Two session concepts are stacked in NanoClaw:
  //   1. nanoclaw v2 session — filesystem sandbox (sessions.id, sessions.status='active', etc.)
  //   2. Claude Agent SDK session — a single SDK conversation UUID in hook_events.session_id
  //
  // With `new_session: true` as the default (PR #108), a single nanoclaw session routinely
  // contains many SDK UUIDs (main long-running session + one per scheduled-task fire).
  // This endpoint returns nanoclaw sessions as top-level entries with SDK sub-sessions nested
  // underneath, so the UI can present the two layers distinctly.
  //
  // Response shape (default):
  //   [{ nanoclaw_session_id, group_folder, agent_group_id, container_status,
  //      last_active, created_at, event_count_total, sdk_subsessions: [...] }]
  //
  // Legacy flat shape (for backward-compat callers): ?flat=1 returns the old array of
  //   { session_id, group_folder, first_ts, last_ts, event_count }.
  if (url.pathname === '/api/hook-events/sessions') {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    if (!heDb) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
      return;
    }
    const group = url.searchParams.get('group');
    const flat = url.searchParams.get('flat') === '1';
    try {
      // Build flat per-SDK-session rows first — we need these either way.
      const flatQuery = group
        ? `SELECT session_id, group_folder, MIN(timestamp) as first_ts, MAX(timestamp) as last_ts,
                  COUNT(*) as event_count,
                  SUM(CASE WHEN event = 'UserPromptSubmit' THEN 1 ELSE 0 END) as user_prompt_count,
                  SUM(CASE WHEN event IN ('PostToolUse','PostToolUseFailure','SubagentStart','Notification') THEN 1 ELSE 0 END) as activity_count,
                  MAX(CASE WHEN event = 'SessionStart' THEN extra ELSE NULL END) as session_start_extra
             FROM hook_events
             WHERE session_id IS NOT NULL AND session_id != '' AND group_folder = ?
             GROUP BY session_id
             ORDER BY last_ts DESC
             LIMIT 200`
        : `SELECT session_id, group_folder, MIN(timestamp) as first_ts, MAX(timestamp) as last_ts,
                  COUNT(*) as event_count,
                  SUM(CASE WHEN event = 'UserPromptSubmit' THEN 1 ELSE 0 END) as user_prompt_count,
                  SUM(CASE WHEN event IN ('PostToolUse','PostToolUseFailure','SubagentStart','Notification') THEN 1 ELSE 0 END) as activity_count,
                  MAX(CASE WHEN event = 'SessionStart' THEN extra ELSE NULL END) as session_start_extra
             FROM hook_events
             WHERE session_id IS NOT NULL AND session_id != ''
             GROUP BY session_id
             ORDER BY last_ts DESC
             LIMIT 200`;
      const flatRows = (group ? heDb.prepare(flatQuery).all(group) : heDb.prepare(flatQuery).all()) as any[];

      if (flat) {
        // Legacy shape — strip the classification-helper columns.
        const legacy = flatRows.slice(0, 50).map((r) => ({
          session_id: r.session_id,
          group_folder: r.group_folder,
          first_ts: r.first_ts,
          last_ts: r.last_ts,
          event_count: r.event_count,
        }));
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(legacy));
        return;
      }

      // The session list is sourced from the `sessions` table, NOT from the
      // capped hook_events scan above. hook_events is bounded for event-volume
      // reasons (LIMIT 200 / 5000-event ring); deriving the session list from
      // it silently truncated low-volume coworkers (e.g. slang-reviewer: 36
      // active sessions but only ~2 survived once high-volume folders crowded
      // the global top-200). Sessions are cheap metadata — load ALL active ones
      // and treat hook_events purely as activity enrichment layered on top.
      //
      // Keep sessions per folder ordered ascending by created_at so the
      // query-time heuristic fallback can bracket unrouted SDK UUIDs correctly.
      type NanoSess = {
        id: string;
        agent_group_id: string;
        folder: string;
        thread_id: string | null;
        messaging_group_id: string | null;
        display_title: string | null;
        title_source: string | null;
        hidden_at: string | null;
        pinned_at: string | null;
        status: string;
        container_status: string;
        last_active: string | null;
        created_at: string;
      };
      const nanoSessionsByFolder = new Map<string, NanoSess[]>();
      {
        let nanoRows: any[] = [];
        try {
          const sessionCols = new Set(
            (heDb.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>).map((c) => c.name),
          );
          const titleSelect = sessionCols.has('display_title')
            ? 's.display_title AS display_title, s.title_source AS title_source,'
            : 'NULL AS display_title, NULL AS title_source,';
          const stateSelect = `${sessionCols.has('hidden_at') ? 's.hidden_at' : 'NULL'} AS hidden_at,
                      ${sessionCols.has('pinned_at') ? 's.pinned_at' : 'NULL'} AS pinned_at,`;
          // When `group` is set the list is folder-scoped; otherwise return every
          // active session across all folders. No global LIMIT — the frontend
          // renders the full list inside scroll containers.
          nanoRows = heDb
            .prepare(
              `SELECT s.id AS id, s.agent_group_id AS agent_group_id, ag.folder AS folder,
                      s.thread_id AS thread_id, s.messaging_group_id AS messaging_group_id,
                      ${titleSelect}
                      ${stateSelect}
                      s.status AS status, s.container_status AS container_status,
                      s.last_active AS last_active, s.created_at AS created_at
                 FROM sessions s
                 JOIN agent_groups ag ON ag.id = s.agent_group_id
                 WHERE s.status = 'active'${group ? ' AND ag.folder = ?' : ''}
                 ORDER BY ag.folder ASC, s.created_at ASC`,
            )
            .all(...(group ? [group] : [])) as any[];
        } catch {
          // sessions or agent_groups table may be missing in some environments — fall through with no nanoclaw data.
          nanoRows = [];
        }
        for (const n of nanoRows) {
          const list = nanoSessionsByFolder.get(n.folder) ?? [];
          list.push(n);
          nanoSessionsByFolder.set(n.folder, list);
        }
      }

      // Pre-fetch every sdk_session_routes row for the SDK UUIDs in flatRows
      // so query-time lookup is O(1) per SDK. Empty table if migration 018
      // hasn't run — routes stays empty and every SDK falls to fallback.
      const routeBySdk = new Map<string, { nanoclaw_session_id: string; source: string }>();
      try {
        if (flatRows.length > 0) {
          const sdkIds = flatRows.map((r) => r.session_id).filter(Boolean);
          if (sdkIds.length > 0) {
            const ph = sdkIds.map(() => '?').join(',');
            const routeRows = heDb
              .prepare(
                `SELECT sdk_session_id, nanoclaw_session_id, source FROM sdk_session_routes WHERE sdk_session_id IN (${ph})`,
              )
              .all(...sdkIds) as any[];
            for (const r of routeRows) {
              routeBySdk.set(r.sdk_session_id, { nanoclaw_session_id: r.nanoclaw_session_id, source: r.source });
            }
          }
        }
      } catch {
        /* routes table absent — treat all as unrouted */
      }

      // Classify each SDK sub-session.
      //  - "ghost": event_count <= 3 AND no UserPromptSubmit (i.e. only InstructionsLoaded / session bookkeeping)
      //  - "main" vs "task-fire": for "heavy" sessions (>= 40 events) — main has SessionStart.source=='startup',
      //                            task-fire has source=='resume' or any other non-startup source.
      //  - "session": default
      function classifyShape(r: any): string {
        const eventCount = Number(r.event_count) || 0;
        const userPromptCount = Number(r.user_prompt_count) || 0;
        if (eventCount <= 3 && userPromptCount === 0) return 'ghost';
        let source: string | null = null;
        if (r.session_start_extra) {
          try {
            const parsed = JSON.parse(r.session_start_extra);
            source = typeof parsed?.source === 'string' ? parsed.source : null;
          } catch {
            /* ignore */
          }
        }
        if (eventCount >= 40) {
          if (source === 'startup') return 'main';
          return 'task-fire';
        }
        return 'session';
      }

      // Group flat rows by their nanoclaw session id. Fallback order per
      // unrouted SDK UUID (needed for pre-routed historical data and for
      // hook events posted without X-NanoClaw-Session-Id):
      //   1. routed   — sdk_session_routes has a row → use it
      //   2. single-candidate shortcut — folder has exactly 1 active
      //      nanoclaw session → bucket under it (old-shared installs
      //      render correctly with no backfill)
      //   3. heuristic — multi-session folder: bracket by
      //      created_at ≤ first_ts < next_session.created_at
      //      marked attribution_source='heuristic' in response
      //   4. orphan   — no plausible nanoclaw session → synthetic parent
      //
      // Principle: unrouted is visible, not hidden. Better to show
      // best-effort attribution than disappear data.
      type Parent = {
        nanoclaw_session_id: string | null;
        thread_id: string | null;
        messaging_group_id: string | null;
        a2a_peer: string | null;
        display_title: string | null;
        title_source: string | null;
        hidden_at: string | null;
        pinned_at: string | null;
        session_key: string | null;
        group_folder: string;
        agent_group_id: string | null;
        container_status: string | null;
        last_active: string | null;
        created_at: string | null;
        event_count_total: number;
        sdk_subsessions: any[];
        /** Per-session activity state derived from the most recent hook
         *  event routed to this session. Lets the UI show idle/working/
         *  thinking chips per NanoClaw session instead of per folder —
         *  important once multiple concurrent sessions exist. */
        activity_status: 'idle' | 'thinking' | 'working' | 'error' | 'active' | null;
        /** Last few hook events on this session (most recent first),
         *  max 5. Used by the Coworker detail panel's per-session
         *  "Recent Events" block. */
        recent_events: Array<{ event: string; tool: string | null; timestamp: number; session_id: string }>;
        _last_ts_num: number; // for sorting
      };
      const parentByKey = new Map<string, Parent>();
      const resolveA2aPeer = (nano: NanoSess | null): string | null => {
        if (!nano?.messaging_group_id || !db) return null;
        try {
          const mg = db
            .prepare('SELECT platform_id FROM messaging_groups WHERE id = ?')
            .get(nano.messaging_group_id) as { platform_id: string } | undefined;
          if (!mg?.platform_id?.startsWith('agent:')) return null;
          const parts = mg.platform_id.split(':');
          const peerAgId = parts.find((p) => p.startsWith('ag-') && p !== nano.agent_group_id) || null;
          if (!peerAgId) return null;
          const peer = db.prepare('SELECT name, folder FROM agent_groups WHERE id = ?').get(peerAgId) as
            | { name: string; folder: string }
            | undefined;
          return peer?.name || peer?.folder || null;
        } catch {
          return null;
        }
      };
      const makeParent = (nano: NanoSess | null, folder: string): Parent => ({
        nanoclaw_session_id: nano ? nano.id : null,
        thread_id: nano ? nano.thread_id : null,
        messaging_group_id: nano ? nano.messaging_group_id : null,
        a2a_peer: resolveA2aPeer(nano),
        display_title: nano ? nano.display_title : null,
        title_source: nano ? nano.title_source : null,
        hidden_at: nano ? nano.hidden_at : null,
        pinned_at: nano ? nano.pinned_at : null,
        session_key: nano ? nano.id : null,
        group_folder: folder,
        agent_group_id: nano ? nano.agent_group_id : null,
        container_status: nano ? nano.container_status : null,
        last_active: nano ? nano.last_active : null,
        created_at: nano ? nano.created_at : null,
        event_count_total: 0,
        sdk_subsessions: [],
        activity_status: null,
        recent_events: [],
        _last_ts_num: 0,
      });

      const nanoById = new Map<string, NanoSess>();
      for (const list of nanoSessionsByFolder.values()) {
        for (const n of list) nanoById.set(n.id, n);
      }

      // Seed a parent for EVERY active nanoclaw session up front. The flatRows
      // pass below then only attaches SDK subsessions to these pre-seeded
      // parents (or creates synthetic __orphan__ parents for unattributable
      // SDK UUIDs). This guarantees every active session appears in the list,
      // including ones with no hook events yet (idle, empty recent_events).
      for (const [folder, list] of nanoSessionsByFolder) {
        for (const n of list) {
          if (!parentByKey.has(n.id)) parentByKey.set(n.id, makeParent(n, folder));
        }
      }

      for (const r of flatRows) {
        const folderSessions = nanoSessionsByFolder.get(r.group_folder) ?? [];
        let pickedNano: NanoSess | null = null;
        let attributionSource: 'live' | 'backfill' | 'single-candidate' | 'heuristic' | 'orphan' = 'orphan';

        // 1. routed (via sdk_session_routes)
        const route = routeBySdk.get(r.session_id);
        if (route) {
          const cand = nanoById.get(route.nanoclaw_session_id);
          if (cand) {
            pickedNano = cand;
            attributionSource = route.source === 'backfill' ? 'backfill' : 'live';
          }
        }
        // 2. single-candidate shortcut (works for old-shared installs
        //    and any coworker with exactly one active session)
        if (!pickedNano && folderSessions.length === 1) {
          pickedNano = folderSessions[0];
          attributionSource = 'single-candidate';
        }
        // 3. heuristic bracket (multi-candidate, unrouted). Prefer sessions
        //    that were plausibly ALIVE when the event fired: created before
        //    it, AND either still running or last-active at/after it. This
        //    avoids the failure where a stopped, stale session — the most
        //    recently created one before the event, but idle for hours —
        //    captures live events. That mislabel is exactly what put live
        //    events under a "container: stopped · 13h ago" separator in the
        //    timeline. folderSessions is sorted by created_at ASC, so the
        //    last candidate satisfying the predicate is the most-recently-
        //    created session that bracketed the event. Falls back to the
        //    original created_at-only bracket only when nothing was
        //    demonstrably alive, so unrouted events still attribute rather
        //    than orphan.
        if (!pickedNano && folderSessions.length > 1) {
          const firstTsNum = Number(r.first_ts) || 0;
          const aliveAt = (s: NanoSess): boolean => {
            if (Date.parse(s.created_at) > firstTsNum) return false;
            if (s.container_status === 'running') return true;
            const la = s.last_active ? Date.parse(s.last_active) : NaN;
            return Number.isFinite(la) && la >= firstTsNum;
          };
          let alive: NanoSess | null = null;
          for (const s of folderSessions) {
            if (Date.parse(s.created_at) > firstTsNum) break;
            if (aliveAt(s)) alive = s;
          }
          if (alive) {
            pickedNano = alive;
            attributionSource = 'heuristic';
          } else {
            for (let i = 0; i < folderSessions.length; i++) {
              const cur = folderSessions[i];
              if (Date.parse(cur.created_at) > firstTsNum) break;
              const next = folderSessions[i + 1];
              if (!next || Date.parse(next.created_at) > firstTsNum) {
                pickedNano = cur;
                attributionSource = 'heuristic';
                break;
              }
            }
          }
        }
        // 4. orphan — surface under synthetic parent keyed on folder
        const key = pickedNano ? pickedNano.id : `__orphan__${r.group_folder}`;
        let parent = parentByKey.get(key);
        if (!parent) {
          parent = makeParent(pickedNano, r.group_folder);
          parentByKey.set(key, parent);
        }
        parent.event_count_total += Number(r.event_count) || 0;
        const lastTsNum = Number(r.last_ts) || 0;
        if (lastTsNum > parent._last_ts_num) parent._last_ts_num = lastTsNum;
        parent.sdk_subsessions.push({
          session_id: r.session_id,
          first_ts: r.first_ts,
          last_ts: r.last_ts,
          event_count: r.event_count,
          user_prompt_count: Number(r.user_prompt_count) || 0,
          activity_count: Number(r.activity_count) || 0,
          shape: classifyShape(r),
          attribution_source: attributionSource,
        });
      }

      // (Active nanoclaw sessions with no SDK events yet are already present —
      // they were seeded into parentByKey before the flatRows pass above.)

      // Sort sub-sessions DESC by last_ts, then sort parents DESC by last_active (fall back to _last_ts_num).
      const parents = Array.from(parentByKey.values());
      for (const p of parents) {
        p.sdk_subsessions.sort((a, b) => (Number(b.last_ts) || 0) - (Number(a.last_ts) || 0));
      }

      // Per-session activity enrichment: pull the most recent hook events
      // for each parent's SDK UUIDs, derive an activity_status, and
      // stash the top 5 for a "Recent Events" block in the UI. Without
      // this, Pixel Office + Recent Events aggregate by folder only —
      // two concurrent sessions on the same coworker can't be told
      // apart visually. With it, the client can render one status chip
      // per session, per-session event feeds, and (future) one
      // Pixel Office character per session.
      for (const p of parents) {
        const sdkIds = p.sdk_subsessions.map((s) => s.session_id).filter(Boolean);
        // Zero-event seeded sessions (no SDK UUIDs yet) skip the event lookup
        // but still emit a sensible status + title below — they must remain
        // visible in the list, just idle with an empty recent_events feed.
        if (sdkIds.length > 0) {
          try {
            const ph = sdkIds.map(() => '?').join(',');
            const recent = heDb
              .prepare(
                `SELECT event, tool, message, timestamp, session_id
                   FROM hook_events
                  WHERE session_id IN (${ph})
                  ORDER BY timestamp DESC
                  LIMIT 5`,
              )
              .all(...sdkIds) as Array<{
              event: string;
              tool: string | null;
              message: string | null;
              timestamp: number;
              session_id: string;
            }>;
            p.recent_events = recent.map((r) => ({
              event: r.event,
              tool: r.tool,
              timestamp: r.timestamp,
              session_id: r.session_id,
            }));
            // Status rule: if container isn't running, force 'idle'. Otherwise
            // derive from the most-recent event via classifyEventStatus.
            if (p.container_status !== 'running') {
              p.activity_status = 'idle';
            } else if (recent.length > 0) {
              p.activity_status = classifyEventStatus({
                event: recent[0].event,
                tool: recent[0].tool,
                message: recent[0].message,
              });
            } else {
              p.activity_status = 'active';
            }
          } catch {
            /* hook_events may be unavailable in degraded fixtures */
          }
        } else {
          // No events: idle unless the container is currently running.
          p.activity_status = p.container_status === 'running' ? 'active' : 'idle';
        }

        // Read-only fallback for UI display. The authoritative title is
        // derived + written once in the hook-event intake path (see
        // `POST /api/hook-event` — on first UserPromptSubmit for a nano
        // session, the handler UPDATEs sessions.display_title). If an
        // old session exists without a title yet, surface a one-line
        // heuristic derived from its first prompt — without writing, so
        // this GET handler stays read-only and won't race with the
        // intake writer.
        if (!p.display_title) {
          const promptEvent = p.recent_events.find((e) => e.event === 'UserPromptSubmit');
          let promptTitle: string | null = null;
          if (promptEvent) {
            try {
              const promptRow = heDb
                .prepare(
                  'SELECT message FROM hook_events WHERE session_id = ? AND event = ? ORDER BY timestamp ASC LIMIT 1',
                )
                .get(promptEvent.session_id, 'UserPromptSubmit') as { message: string | null } | undefined;
              promptTitle = titleFromPrompt(promptRow?.message);
            } catch {
              /* ignore */
            }
          }
          p.display_title = promptTitle || (p.thread_id ? 'thread' : 'main');
          p.title_source = promptTitle ? 'heuristic' : 'auto';
          // Deliberately no UPDATE here — title writes live in the hook
          // intake path so this GET stays side-effect-free. The heuristic
          // value above is only for this response payload.
        }
      }

      parents.sort((a, b) => {
        const at = a.last_active ? new Date(a.last_active).getTime() : a._last_ts_num;
        const bt = b.last_active ? new Date(b.last_active).getTime() : b._last_ts_num;
        return bt - at;
      });
      // Strip the sort-helper field before emitting. No slice — every active
      // session is returned so the frontend can list and scroll them all.
      const out = parents.map(({ _last_ts_num, ...rest }) => rest);

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(out));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: structured session flow for an entire nanoclaw v2 session (all SDK sub-sessions combined).
  // Loads every hook event for the group whose timestamp >= sessions.created_at for the given nanoclaw_session_id,
  // then runs it through the same PreToolUse/PostToolUse pairing pipeline as /api/hook-events/session-flow.
  if (url.pathname === '/api/hook-events/nanoclaw-session-flow') {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    const agentGroupId = url.searchParams.get('agent_group_id');
    const nanoclawSessionId = url.searchParams.get('nanoclaw_session_id');
    if (!heDb || !agentGroupId || !nanoclawSessionId) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"entries":[]}');
      return;
    }
    try {
      // Resolve folder + created_at for the nanoclaw session.
      const nano = heDb
        .prepare(
          `SELECT ag.folder AS folder, s.created_at AS created_at
             FROM sessions s JOIN agent_groups ag ON ag.id = s.agent_group_id
             WHERE s.id = ? AND s.agent_group_id = ? LIMIT 1`,
        )
        .get(nanoclawSessionId, agentGroupId) as any;
      if (!nano) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"nanoclaw session not found"}');
        return;
      }
      // Exact attribution via sdk_session_routes PLUS a time-bracketed
      // fallback for unrouted rows, unioned in a single query. This way
      // a partial backfill (new live events routed, some historical
      // rows still lacking routes) doesn't silently hide the unrouted
      // ones — they fall through to the bracket filter instead.
      //
      // Bracket bounds:
      //   lower = this session's created_at
      //   upper = the next session's created_at for the same
      //           agent_group_id (or +inf when this is the latest)
      // Upper bound matters: without it, a thread session's "fallback
      // window" would run forever and swallow root events that ran AFTER
      // the thread was created.
      const createdAtMs = nano.created_at ? new Date(nano.created_at).getTime() : 0;
      let upperBoundMs = Number.MAX_SAFE_INTEGER;
      try {
        const nextRow = heDb
          .prepare(
            `SELECT created_at FROM sessions
              WHERE agent_group_id = (SELECT agent_group_id FROM sessions WHERE id = ?)
                AND created_at > (SELECT created_at FROM sessions WHERE id = ?)
              ORDER BY created_at ASC LIMIT 1`,
          )
          .get(nanoclawSessionId, nanoclawSessionId) as { created_at: string } | undefined;
        if (nextRow?.created_at) upperBoundMs = new Date(nextRow.created_at).getTime();
      } catch {
        /* sessions may be missing in degraded fixtures */
      }

      let rows: any[] = [];
      try {
        rows = heDb
          .prepare(
            `SELECT he.* FROM hook_events he
               LEFT JOIN sdk_session_routes r ON r.sdk_session_id = he.session_id
              WHERE he.group_folder = ?
                AND (
                      r.nanoclaw_session_id = ?
                   OR (
                      r.sdk_session_id IS NULL
                      AND he.timestamp >= ?
                      AND he.timestamp <  ?
                   )
                )
              ORDER BY he.timestamp ASC`,
          )
          .all(nano.folder, nanoclawSessionId, createdAtMs, upperBoundMs);
      } catch {
        // Routes table absent (pre-migration 018) — fall back to pure
        // time-bracket so old installs keep working.
        rows = heDb
          .prepare(
            `SELECT * FROM hook_events
              WHERE group_folder = ? AND timestamp >= ? AND timestamp < ?
              ORDER BY timestamp ASC`,
          )
          .all(nano.folder, createdAtMs, upperBoundMs);
      }

      // Same pipeline as /api/hook-events/session-flow but without per-session_id filtering.
      const entries: any[] = [];
      const preToolMap = new Map<string, any>();
      const subagentStack: any[] = [];
      for (const row of rows) {
        const extra = row.extra ? JSON.parse(row.extra) : {};
        if (row.event === 'SessionStart') {
          entries.push({ type: 'session_start', timestamp: row.timestamp, extra, session_id: row.session_id });
        } else if (row.event === 'UserPromptSubmit') {
          entries.push({
            type: 'user_prompt',
            timestamp: row.timestamp,
            message: row.message || '',
            session_id: row.session_id,
          });
        } else if (row.event === 'PreToolUse') {
          if (row.tool_use_id) preToolMap.set(row.tool_use_id, row);
        } else if (row.event === 'PostToolUse' || row.event === 'PostToolUseFailure') {
          const pre = row.tool_use_id ? preToolMap.get(row.tool_use_id) : null;
          const duration = pre ? row.timestamp - pre.timestamp : null;
          const entry: any = {
            type: 'tool_call',
            tool: row.tool,
            tool_use_id: row.tool_use_id,
            timestamp: row.timestamp,
            duration,
            tool_input: row.tool_input,
            tool_response: row.tool_response,
            failed: row.event === 'PostToolUseFailure',
            agent_id: row.agent_id,
            session_id: row.session_id,
          };
          if (subagentStack.length > 0) subagentStack[subagentStack.length - 1].children.push(entry);
          else entries.push(entry);
          if (row.tool_use_id) preToolMap.delete(row.tool_use_id);
        } else if (row.event === 'SubagentStart') {
          const block: any = {
            type: 'subagent_block',
            agent_id: row.agent_id,
            agent_type: row.agent_type,
            timestamp: row.timestamp,
            children: [],
          };
          subagentStack.push(block);
        } else if (row.event === 'SubagentStop') {
          const block = subagentStack.pop();
          if (block) {
            block.end_timestamp = row.timestamp;
            block.duration = row.timestamp - block.timestamp;
            if (subagentStack.length > 0) subagentStack[subagentStack.length - 1].children.push(block);
            else entries.push(block);
          }
        } else if (row.event === 'PreCompact') {
          entries.push({ type: 'compact', timestamp: row.timestamp });
        } else if (row.event === 'Notification') {
          entries.push({ type: 'notification', timestamp: row.timestamp, message: row.message || '' });
        } else if (row.event === 'Stop' || row.event === 'SessionEnd') {
          entries.push({ type: 'session_end', timestamp: row.timestamp, extra, session_id: row.session_id });
        }
      }
      while (subagentStack.length > 0) {
        const block = subagentStack.pop()!;
        if (subagentStack.length > 0) subagentStack[subagentStack.length - 1].children.push(block);
        else entries.push(block);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries, nanoclaw_session_id: nanoclawSessionId, group_folder: nano.folder }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: structured session flow — pairs Pre/PostToolUse, nests subagents
  if (url.pathname === '/api/hook-events/session-flow') {
    if (!requireAuth(req, res)) return;
    const heDb = getHookEventsDb();
    const group = url.searchParams.get('group');
    const sessionId = url.searchParams.get('session_id');
    if (!heDb || !sessionId) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"entries":[]}');
      return;
    }
    try {
      const conditions = ['session_id = ?'];
      const params: any[] = [sessionId];
      if (group) {
        conditions.push('group_folder = ?');
        params.push(group);
      }
      const rows: any[] = heDb
        .prepare(`SELECT * FROM hook_events WHERE ${conditions.join(' AND ')} ORDER BY timestamp ASC`)
        .all(...params);

      // Build structured flow entries
      const entries: any[] = [];
      const preToolMap = new Map<string, any>(); // tool_use_id -> PreToolUse row
      const subagentStack: any[] = []; // nested subagent tracking

      for (const row of rows) {
        const extra = row.extra ? JSON.parse(row.extra) : {};

        if (row.event === 'SessionStart') {
          entries.push({ type: 'session_start', timestamp: row.timestamp, extra });
        } else if (row.event === 'UserPromptSubmit') {
          entries.push({ type: 'user_prompt', timestamp: row.timestamp, message: row.message || '' });
        } else if (row.event === 'PreToolUse') {
          if (row.tool_use_id) preToolMap.set(row.tool_use_id, row);
        } else if (row.event === 'PostToolUse' || row.event === 'PostToolUseFailure') {
          const pre = row.tool_use_id ? preToolMap.get(row.tool_use_id) : null;
          const duration = pre ? row.timestamp - pre.timestamp : null;
          const entry: any = {
            type: 'tool_call',
            tool: row.tool,
            tool_use_id: row.tool_use_id,
            timestamp: row.timestamp,
            duration,
            tool_input: row.tool_input,
            tool_response: row.tool_response,
            failed: row.event === 'PostToolUseFailure',
            agent_id: row.agent_id,
          };
          if (subagentStack.length > 0) {
            subagentStack[subagentStack.length - 1].children.push(entry);
          } else {
            entries.push(entry);
          }
          if (row.tool_use_id) preToolMap.delete(row.tool_use_id);
        } else if (row.event === 'SubagentStart') {
          const block: any = {
            type: 'subagent_block',
            agent_id: row.agent_id,
            agent_type: row.agent_type,
            timestamp: row.timestamp,
            children: [],
          };
          subagentStack.push(block);
        } else if (row.event === 'SubagentStop') {
          const block = subagentStack.pop();
          if (block) {
            block.end_timestamp = row.timestamp;
            block.duration = row.timestamp - block.timestamp;
            if (subagentStack.length > 0) {
              subagentStack[subagentStack.length - 1].children.push(block);
            } else {
              entries.push(block);
            }
          }
        } else if (row.event === 'PreCompact') {
          entries.push({ type: 'compact', timestamp: row.timestamp });
        } else if (row.event === 'Notification') {
          entries.push({ type: 'notification', timestamp: row.timestamp, message: row.message || '' });
        } else if (row.event === 'Stop' || row.event === 'SessionEnd') {
          entries.push({ type: 'session_end', timestamp: row.timestamp, extra });
        }
      }

      // Flush any unclosed subagent blocks
      while (subagentStack.length > 0) {
        const block = subagentStack.pop()!;
        if (subagentStack.length > 0) {
          subagentStack[subagentStack.length - 1].children.push(block);
        } else {
          entries.push(block);
        }
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ entries }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: download an attachment from a delivered dashboard message
  if (req.method === 'GET' && url.pathname === '/api/messages/attachment') {
    if (!requireAuth(req, res)) return;
    const agentGroupId = url.searchParams.get('agentGroupId') || '';
    const sessionId = url.searchParams.get('sessionId') || '';
    const messageId = url.searchParams.get('messageId') || '';
    const fileName = url.searchParams.get('name') || '';
    if (!agentGroupId || !sessionId || !messageId || !fileName) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"agentGroupId, sessionId, messageId, and name are required"}');
      return;
    }

    const outboxDir = join(getDataDir(), 'v2-sessions', agentGroupId, sessionId, 'outbox', messageId);
    const inboxDir = join(getDataDir(), 'v2-sessions', agentGroupId, sessionId, 'inbox', messageId);
    const attachmentDir = existsSync(outboxDir) ? outboxDir : inboxDir;
    const fullPath = join(attachmentDir, fileName);
    if (!isInsideDir(attachmentDir, fullPath)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (!existsSync(fullPath) || statSync(fullPath).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }

    const mime = getMessageAttachmentMimeType(fileName);
    const isImage = mime.startsWith('image/');
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': isImage ? 'inline' : `attachment; filename="${fileName.replace(/["\r\n]/g, '_')}"`,
    });
    res.end(readFileSync(fullPath));
    return;
  }

  // API: get recent messages — v2 reads from per-session inbound/outbound DBs
  if (url.pathname === '/api/messages') {
    if (!requireAuth(req, res)) return;
    const group = url.searchParams.get('group');
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '200', 10), 500);
    // Slack-style thread filter. Absent → main view (root sessions only,
    // rows with thread_id IS NULL). Present → thread view (the single
    // per-thread session keyed on thread_id). `threadSummaries` is only
    // emitted in main view.
    const threadIdParam = url.searchParams.get('thread_id');
    const threadMode = threadIdParam !== null && threadIdParam.length > 0;
    const threadFilter = threadMode ? threadIdParam : null;
    // Swim-lane mode: a shared-thread view across EVERY coworker that has a
    // session on this thread_id (orch + triager + fixer + reviewer on one
    // gh-issue chain), not just the `group` in the URL. Each returned row is
    // already stamped with group_folder + session_id, so the client renders
    // one lane per coworker. Only meaningful together with thread_id.
    const laneMode = threadMode && url.searchParams.get('lane') === '1';
    // Session-direct mode: fetch messages from a specific session by ID,
    // bypassing messaging_group scoping. Used to view a2a-spawned sessions
    // that have messaging_group_id = NULL and thread_id = NULL.
    const sessionIdParam = url.searchParams.get('session_id');
    const sessionDirect = !!sessionIdParam;
    // Admin unified view: load ALL sessions across all channels and threads.
    const allSessions = url.searchParams.get('allSessions') === '1';
    // System/protocol traffic (CLAUDE.md refresh pings, agent-to-agent
    // acks) lives in the same inbound/outbound tables as real user chat and
    // clutters the channel view. Hidden by default for the single-coworker
    // view; pass ?includeSystem=1 to opt in (timeline/debug still shows all).
    const includeSystem = url.searchParams.get('includeSystem') === '1';
    // `before` is an ISO timestamp used by Admin → Messages for infinite
    // scroll. The per-session SQLite reads fetch newest-first; we
    // oversample and post-filter so the honest hasMore flag reflects
    // whether earlier rows exist beyond the returned page.
    const beforeParam = url.searchParams.get('before');
    const OVERSAMPLE = 3;
    // `cli-` / `cli-resp-` are ncl polling chatter (cli_request / cli_response,
    // kind=system) — pure host↔container machine traffic. The client already
    // hard-hides them, but only AFTER the fetch, so they consumed the LIMIT
    // window and pushed real messages (e.g. a large /supervise-issues table)
    // off the fetched page. Filtering them server-side here means the LIMIT
    // fills with messages a human actually sees. Still surfaced with
    // ?includeSystem=1 (timeline/debug).
    const SYSTEM_ID_PREFIXES = ['claudemd-refresh-', 'a2a-', 'sys-', 'cli-'];
    const isSystemId = (id: unknown) => typeof id === 'string' && SYSTEM_ID_PREFIXES.some((p) => id.startsWith(p));
    // Index all agent_groups by id so we can recognise when an a2a-* message is
    // a legit inter-coworker send (platform_id matches a real agent_group.id)
    // versus plumbing noise (e.g. session-boot pings that have no corresponding
    // sender coworker). The legit ones are tagged with sender/recipient kind
    // and surface in the channel view with a distinct bubble style.
    const coworkerNameById = new Map<string, string>();
    let messages: any[] = [];
    let hasMore = false;
    // Per-agent-group thread summaries: { [parentMessageId]: { replyCount, lastReplyTs } }.
    // Only populated in main view; the client uses it to render
    // "↳ N replies" stubs under parent messages.
    const threadSummaries: Record<
      string,
      { replyCount: number; lastReplyTs: string | null; sessionId: string | null }
    > = {};
    if (db) {
      try {
        try {
          const allAg = db.prepare('SELECT id, folder, name FROM agent_groups').all() as Array<{
            id: string;
            folder: string;
            name: string | null;
          }>;
          for (const row of allAg) {
            coworkerNameById.set(row.id, row.name || row.folder);
          }
        } catch {
          /* table may not exist in degraded test fixtures */
        }
        // Swim-lane: every coworker holding an active session on this thread_id
        // (not just the `group` in the URL). Falls back to the normal single-
        // group selection if the lookup turns up nothing.
        const laneAgRows = laneMode
          ? (db
              .prepare(
                `SELECT DISTINCT ag.id, ag.folder, ag.name
                   FROM sessions s JOIN agent_groups ag ON ag.id = s.agent_group_id
                  WHERE s.thread_id = ? AND s.status = 'active'`,
              )
              .all(threadFilter) as any[])
          : [];
        // When group is specified, load messages for that group only; otherwise load all groups
        const agRows =
          laneMode && laneAgRows.length
            ? laneAgRows
            : group
              ? [db.prepare('SELECT id, folder, name FROM agent_groups WHERE folder = ?').get(group) as any].filter(
                  Boolean,
                )
              : (db.prepare('SELECT id, folder, name FROM agent_groups').all() as any[]);
        // Oversample when the caller paginates via `before`. Admin →
        // Messages in particular depends on getting non-trivial coverage
        // below the cutoff so hasMore accurately reflects the DB state.
        // Lane mode gives each coworker the full limit (few participants, all
        // wanted) rather than dividing it across the whole install.
        const baseLimit = group || laneMode ? limit : Math.ceil(limit / Math.max(agRows.length, 1));
        const perGroupLimit = beforeParam ? baseLimit * OVERSAMPLE : baseLimit;
        for (const agRow of agRows) {
          // Scope all dashboard /api/messages queries to this coworker's
          // dashboard messaging_group. Without this, messages from other
          // channels (Slack, Discord, email) leak into the dashboard view,
          // because they share the same agent_group and can share
          // thread_id values (Slack's thread_ts, Discord's thread id).
          //
          // If we can't resolve a dashboard messaging group (test fixture
          // that predates dashboard wiring, misconfigured install), fall
          // back to the agent-scoped lookup so the endpoint still returns
          // results rather than going silent.
          const dashMgId = resolveDashboardMessagingGroupId(db, agRow.id, agRow.folder);

          let sessions: { id: string; thread_id: string | null }[];
          if (sessionDirect) {
            // Session-direct: look up the exact session by ID, scoped to this
            // agent group for security. Bypasses messaging_group/thread_id scoping
            // so a2a sessions (messaging_group_id = NULL, thread_id = NULL) are accessible.
            sessions = db
              .prepare("SELECT id, thread_id FROM sessions WHERE id = ? AND agent_group_id = ? AND status = 'active'")
              .all(sessionIdParam, agRow.id) as { id: string; thread_id: string | null }[];
          } else if (allSessions) {
            sessions = db
              .prepare("SELECT id, thread_id FROM sessions WHERE agent_group_id = ? AND status = 'active'")
              .all(agRow.id) as { id: string; thread_id: string | null }[];
          } else if (threadMode) {
            // Thread view: key on (agent_group, thread_id) WITHOUT scoping to the
            // dashboard messaging group. A per-thread session's messaging_group_id
            // reflects who spawned it — dashboard chat, a2a delegation (mg-a2a-*),
            // or another adapter. The user clicks 💬 on a SPECIFIC session slug
            // in the session block, and expects to see that exact conversation.
            // Scoping to dashMgId here hides a2a-spawned threads (e.g. orchestrator
            // receiving a delegation from implementer) and returns 0 messages.
            //
            // Slack/Discord thread_ids (thread_ts, platform-native ids) are
            // structurally distinct from NanoClaw's msg-* ids and won't collide
            // in practice within a single agent's thread namespace.
            sessions = db
              .prepare(
                "SELECT id, thread_id FROM sessions WHERE agent_group_id = ? AND status = 'active' AND thread_id = ?",
              )
              .all(agRow.id, threadFilter) as { id: string; thread_id: string | null }[];
          } else {
            sessions = dashMgId
              ? (db
                  .prepare(
                    "SELECT id, thread_id FROM sessions WHERE agent_group_id = ? AND messaging_group_id = ? AND status = 'active' AND thread_id IS NULL",
                  )
                  .all(agRow.id, dashMgId) as { id: string; thread_id: string | null }[])
              : (db
                  .prepare(
                    "SELECT id, thread_id FROM sessions WHERE agent_group_id = ? AND status = 'active' AND thread_id IS NULL",
                  )
                  .all(agRow.id) as { id: string; thread_id: string | null }[]);
          }
          const sessionsDir = join(getDataDir(), 'v2-sessions', agRow.id);

          // Main-view summaries: scan this coworker's per-thread sessions.
          // Include both the dashboard messaging group AND any a2a (agent-
          // to-agent) messaging group on the same coworker so sibling
          // threads spawned by self-loop or cross-coworker delegation get
          // clickable tiles in the sidebar. External channels (Slack,
          // Discord, gmail, telegram, …) stay filtered because their
          // channel_type is something other than 'dashboard'/'agent', and
          // their thread_ids (Slack thread_ts, Discord thread id) are
          // structurally distinct from NanoClaw's msg-* / user-named ids.
          //
          // Per-thread session DBs hold replies only — the parent message
          // lives in the root session. If we ever mirror parents into
          // thread DBs this count is off-by-one and needs WHERE id !=
          // parentId.
          if (!threadMode && !sessionDirect && dashMgId) {
            let threadSessions: Array<{ id: string; thread_id: string }> = [];
            try {
              threadSessions = db
                .prepare(
                  `SELECT s.id, s.thread_id
                     FROM sessions s
                     LEFT JOIN messaging_groups mg ON s.messaging_group_id = mg.id
                    WHERE s.agent_group_id = ?
                      AND s.status = 'active'
                      AND s.thread_id IS NOT NULL
                      AND (s.messaging_group_id = ? OR mg.channel_type = 'agent')`,
                )
                .all(agRow.id, dashMgId) as Array<{ id: string; thread_id: string }>;
            } catch {
              /* ignore */
            }
            for (const ts of threadSessions) {
              let count = 0;
              let lastTs: string | null = null;
              for (const file of ['inbound.db', 'outbound.db']) {
                const p = join(sessionsDir, ts.id, file);
                if (!existsSync(p)) continue;
                try {
                  const sdb = new Database(p, { readonly: true });
                  try {
                    const table = file === 'inbound.db' ? 'messages_in' : 'messages_out';
                    // Scope COUNT to rows belonging to this thread (matching
                    // thread_id, plus NULL — the messages endpoint shows NULL-
                    // thread rows in threadMode, so badge counts must match).
                    // Fallback to unscoped COUNT for legacy session DBs that
                    // pre-date the thread_id column.
                    let row: { n: number; ts: string | null };
                    try {
                      row = sdb
                        .prepare(
                          `SELECT COUNT(*) AS n, MAX(timestamp) AS ts FROM ${table} WHERE thread_id = ? OR thread_id IS NULL`,
                        )
                        .get(ts.thread_id) as { n: number; ts: string | null };
                    } catch {
                      row = sdb.prepare(`SELECT COUNT(*) AS n, MAX(timestamp) AS ts FROM ${table}`).get() as {
                        n: number;
                        ts: string | null;
                      };
                    }
                    count += row.n || 0;
                    if (row.ts && (!lastTs || row.ts > lastTs)) lastTs = row.ts;
                  } catch {
                    /* ignore */
                  }
                  sdb.close();
                } catch {
                  /* ignore */
                }
              }
              if (count > 0) {
                // Aggregate when multiple sessions share a thread_id (common
                // for cross-coworker threads or session forks). Without this,
                // the badge reflects only the last session iterated, which
                // hides large amounts of activity in plain sight.
                const existing = threadSummaries[ts.thread_id];
                if (!existing) {
                  threadSummaries[ts.thread_id] = { replyCount: count, lastReplyTs: lastTs, sessionId: ts.id };
                } else {
                  const newer = !!lastTs && (!existing.lastReplyTs || lastTs > existing.lastReplyTs);
                  threadSummaries[ts.thread_id] = {
                    replyCount: existing.replyCount + count,
                    lastReplyTs: newer ? lastTs : existing.lastReplyTs,
                    sessionId: newer ? ts.id : existing.sessionId,
                  };
                }
              }
            }
          }
          // Exclude ncl polling chatter (cli_request/response id `cli-…`,
          // claudemd-refresh-…) at the SQL level on the MAIN view only, so it
          // never consumes the LIMIT window. Declared at per-session scope so
          // BOTH the inbound and outbound query blocks below can see it —
          // declaring it inside the inbound block left it undefined in the
          // outbound query, which threw ReferenceError (swallowed by the
          // per-session catch) and silently dropped ALL outbound messages.
          // Gated on !threadMode too: the thread/debug view (and
          // ?includeSystem=1) must still surface plumbing rows.
          const hideChatterSql =
            !threadMode && !includeSystem ? "id NOT LIKE 'cli-%' AND id NOT LIKE 'claudemd-refresh-%'" : '';
          for (const sess of sessions) {
            const inDbPath = join(sessionsDir, sess.id, 'inbound.db');
            const outDbPath = join(sessionsDir, sess.id, 'outbound.db');
            let a2aSourceThread: string | null = null;
            try {
              const srcRow = db
                ?.prepare('SELECT source_thread_id FROM a2a_session_sources WHERE recipient_session_id = ? LIMIT 1')
                .get(sess.id) as { source_thread_id: string | null } | undefined;
              a2aSourceThread = srcRow?.source_thread_id ?? null;
            } catch {
              /* table may not exist */
            }
            try {
              const deliveredByMessageOutId = new Map<
                string,
                { platformMessageId: string | null; status: string | null }
              >();
              if (existsSync(inDbPath)) {
                const sdb = new Database(inDbPath, { readonly: true });
                try {
                  const deliveredRows = sdb
                    .prepare('SELECT message_out_id, platform_message_id, status FROM delivered')
                    .all() as Array<{
                    message_out_id: string;
                    platform_message_id: string | null;
                    status: string | null;
                  }>;
                  for (const row of deliveredRows) {
                    deliveredByMessageOutId.set(row.message_out_id, {
                      platformMessageId: row.platform_message_id ?? null,
                      status: row.status ?? null,
                    });
                  }
                } catch {
                  /* delivered table may not exist in older sessions */
                }
                let rows: any[];
                // Push `before` into SQL so LIMIT applies AFTER the timestamp
                // cut. Without this the query returns the newest N rows and
                // post-filter drops them all whenever beforeParam is recent —
                // which makes "Load older" hit a wall after the first ~N rows
                // even though the DB has months of history.
                // messages_in stores ISO (e.g. 2026-05-09T01:03:52.762Z), so
                // string compare against the ISO cursor is correct.
                const inConds = [beforeParam ? 'timestamp < ?' : '', hideChatterSql].filter(Boolean);
                const inWhere = inConds.length ? `WHERE ${inConds.join(' AND ')} ` : '';
                const inArgs: any[] = beforeParam ? [beforeParam, perGroupLimit] : [perGroupLimit];
                try {
                  // source_session_id distinguishes a true single-session echo
                  // (loop) from a cross-session a2a within the same agent
                  // group — see the isSelfEcho gate below.
                  rows = sdb
                    .prepare(
                      `SELECT id, kind, content, timestamp, channel_type, platform_id, thread_id, source_session_id FROM messages_in ${inWhere}ORDER BY timestamp DESC LIMIT ?`,
                    )
                    .all(...inArgs) as any[];
                } catch {
                  // Older session DBs without source_session_id — keep
                  // thread_id so threadMode filtering still works.
                  try {
                    rows = sdb
                      .prepare(
                        `SELECT id, kind, content, timestamp, channel_type, platform_id, thread_id FROM messages_in ${inWhere}ORDER BY timestamp DESC LIMIT ?`,
                      )
                      .all(...inArgs) as any[];
                  } catch {
                    // Older session DBs without thread_id — fall back but keep
                    // channel_type/platform_id so a2a detection still works.
                    try {
                      rows = sdb
                        .prepare(
                          `SELECT id, kind, content, timestamp, channel_type, platform_id FROM messages_in ${inWhere}ORDER BY timestamp DESC LIMIT ?`,
                        )
                        .all(...inArgs) as any[];
                    } catch {
                      rows = sdb
                        .prepare(
                          `SELECT id, kind, content, timestamp FROM messages_in ${inWhere}ORDER BY timestamp DESC LIMIT ?`,
                        )
                        .all(...inArgs) as any[];
                    }
                  }
                }
                for (const r of rows) {
                  // Row-level thread filter as correctness belt to the
                  // session-level filter above — defends against legacy rows
                  // in a session whose scope later changed.
                  if (!allSessions && !sessionDirect) {
                    if (threadMode) {
                      if (r.thread_id != null && r.thread_id !== threadFilter) continue;
                    } else {
                      if (r.thread_id != null) continue;
                    }
                  }
                  // Agent-to-agent: a2a-* with channel_type='agent' and a
                  // platform_id that resolves to a real agent_group is a legit
                  // inbound message from another coworker — show it with the
                  // coworker-styled bubble. Plumbing pings (no such resolution)
                  // stay filtered as system noise.
                  const isA2a = typeof r.id === 'string' && r.id.startsWith('a2a-');
                  // Resolve sender name; fall back to '(deleted)' for a2a messages from
                  // agents that have since been deleted — platform_id starts with 'ag-'.
                  // Without the fallback, deleted-agent messages are indistinguishable
                  // from plumbing pings and get silently dropped.
                  const senderCoworkerName =
                    isA2a && r.channel_type === 'agent' && typeof r.platform_id === 'string'
                      ? (coworkerNameById.get(r.platform_id) ??
                        (r.platform_id.startsWith('ag-') ? '(deleted)' : undefined))
                      : undefined;
                  // Hide on the noisy main view; show when the user explicitly
                  // opens the thread (threadMode) or asks for system rows.
                  if (!threadMode && !includeSystem && isSystemId(r.id) && !senderCoworkerName) continue;
                  // Self-referencing a2a: sender is this same agent group AND
                  // the source session is this same session — routing echo,
                  // not a real inbound message. A cross-session a2a within the
                  // same coworker (e.g. one slang-fixer chain handing off to
                  // another) is NOT echo and must be shown.
                  //
                  // source_session_id is NULL on a2a rows written before that
                  // column existed and on non-a2a rows; treat null as echo to
                  // preserve the pre-#465 behavior on legacy DBs (where we
                  // can't tell the two cases apart).
                  //
                  // Hide on the noisy main view; show when the user explicitly
                  // opens the thread (threadMode) or asks for system rows.
                  const isSelfEcho =
                    r.channel_type === 'agent' &&
                    r.platform_id === agRow.id &&
                    (r.source_session_id == null || r.source_session_id === sess.id);
                  if (!threadMode && !includeSystem && isSelfEcho) continue;
                  messages.push({
                    ...r,
                    direction: 'incoming',
                    agent_group_id: agRow.id,
                    group_folder: agRow.folder,
                    group_name: agRow.name || agRow.folder,
                    session_id: sess.id,
                    ...(senderCoworkerName
                      ? { senderKind: 'coworker', senderCoworkerName, ...(a2aSourceThread ? { a2aSourceThread } : {}) }
                      : {}),
                  });
                }
                sdb.close();
              }
              if (existsSync(outDbPath)) {
                const sdb = new Database(outDbPath, { readonly: true });
                let rows: any[];
                // messages_out stores SQLite datetime ("2026-06-02 08:28:22"),
                // NOT ISO — convert the ISO cursor before comparing or string
                // ordering would put "2026-06-02T..." after "2026-06-02 ..."
                // and the cutoff would skip a chunk of rows.
                const outBefore = beforeParam ? toSqliteDatetime(beforeParam) : null;
                const outConds = [outBefore ? 'timestamp < ?' : '', hideChatterSql].filter(Boolean);
                const outWhere = outConds.length ? `WHERE ${outConds.join(' AND ')} ` : '';
                const outArgs: any[] = outBefore ? [outBefore, perGroupLimit] : [perGroupLimit];
                try {
                  rows = sdb
                    .prepare(
                      `SELECT id, kind, content, timestamp, in_reply_to, channel_type, platform_id, thread_id FROM messages_out ${outWhere}ORDER BY timestamp DESC LIMIT ?`,
                    )
                    .all(...outArgs) as any[];
                } catch {
                  try {
                    rows = sdb
                      .prepare(
                        `SELECT id, kind, content, timestamp, in_reply_to, channel_type, platform_id FROM messages_out ${outWhere}ORDER BY timestamp DESC LIMIT ?`,
                      )
                      .all(...outArgs) as any[];
                  } catch {
                    rows = sdb
                      .prepare(
                        `SELECT id, kind, content, timestamp, in_reply_to FROM messages_out ${outWhere}ORDER BY timestamp DESC LIMIT ?`,
                      )
                      .all(...outArgs) as any[];
                  }
                }
                for (const r of rows) {
                  // Hide ncl polling chatter (cli_request, id `cli-`) on the
                  // main view so it doesn't consume the LIMIT window — mirrors
                  // the inbound isSystemId guard. Surfaced with ?includeSystem=1.
                  if (!threadMode && !includeSystem && isSystemId(r.id)) continue;
                  // Relay detection: outbound messages targeting the agent
                  // channel with thread_id=NULL are relay commands to another
                  // coworker. Tag (not filter) so the client can collapse them.
                  // Also catches system actions (create_agent etc.) with no channel_type.
                  const isRelayOut =
                    threadMode && r.thread_id == null && (r.channel_type === 'agent' || !r.channel_type);
                  if (!allSessions && !sessionDirect && !isRelayOut) {
                    if (threadMode) {
                      if (r.thread_id !== threadFilter) continue;
                    } else {
                      if (r.thread_id != null) continue;
                    }
                  }
                  // Outbound directed at another coworker: channel_type='agent'
                  // and platform_id resolves to a real agent_group. Mark with
                  // recipient info so the client can render a "→ @coworker"
                  // subscript. Ack replies to system pings (in_reply_to starts
                  // with claudemd-refresh-/a2a- AND no real recipient) stay
                  // filtered.
                  const rawRecipientName =
                    r.channel_type === 'agent' && typeof r.platform_id === 'string'
                      ? (coworkerNameById.get(r.platform_id) ??
                        (r.platform_id.startsWith('ag-') ? '(deleted)' : undefined))
                      : undefined;
                  // Suppress recipient name when it's the same agent group (self-echo)
                  const recipientCoworkerName = r.platform_id === agRow.id ? undefined : rawRecipientName;
                  // Same gate as the inbound self-echo above: hide on main view,
                  // show in explicit thread or includeSystem mode.
                  if (
                    !threadMode &&
                    !includeSystem &&
                    isSystemId(r.in_reply_to) &&
                    !recipientCoworkerName &&
                    !isRelayOut
                  )
                    continue;
                  const delivered = deliveredByMessageOutId.get(r.id);
                  messages.push({
                    ...r,
                    isRelay: isRelayOut || undefined,
                    direction: 'outgoing',
                    agent_group_id: agRow.id,
                    group_folder: agRow.folder,
                    group_name: agRow.name || agRow.folder,
                    session_id: sess.id,
                    body: r.content,
                    platformMessageId: delivered?.platformMessageId ?? null,
                    deliveryStatus: delivered?.status ?? null,
                    ...(recipientCoworkerName
                      ? { senderKind: 'self', recipientKind: 'coworker', recipientCoworkerName }
                      : {}),
                  });
                }
                sdb.close();
              }
            } catch {
              /* session DB may not exist or be locked */
            }
          }
        }
        // Normalize timestamps before sort. Session DBs have historically written
        // several shapes (SQLite datetime, ISO, numeric ms); funnel them all to
        // ISO UTC so the client and comparator see one format.
        for (const m of messages) {
          const ms = timestampToEpochMs(m.timestamp);
          if (!Number.isNaN(ms)) {
            m.timestamp = new Date(ms).toISOString();
          }
        }
        // Normalize content — extracts cardType, questionId, options, credentialId
        for (const m of messages) {
          normalizeMessageForDisplay(m);
          if (m.agent_group_id && m.session_id && Array.isArray(m.fileNames) && m.fileNames.length > 0) {
            m.attachments = buildMessageAttachments(m.agent_group_id, m.session_id, m.id, m.fileNames);
          }
          // Enrich with pending status so the client knows whether to show buttons
          if (m.cardType === 'ask_question' && m.questionId) {
            m.isPending = !!getPendingQuestionRow(m.questionId);
          } else if (m.cardType === 'credential_request' && m.credentialId) {
            m.isPending = !!getPendingCredentialRow(m.credentialId);
          }
        }
        messages = applyMessageOperations(messages);
        // Apply the `before` cutoff (ISO timestamp) for pagination. Post-
        // filter after the per-session oversample above — a few per-DB
        // queries don't expose a cheap "older than X" pagination hook, so
        // we do it in memory.
        if (beforeParam) {
          messages = messages.filter((m) => typeof m.timestamp === 'string' && m.timestamp < beforeParam);
        }
        // Sort descending (newest first).
        messages.sort(compareMessagesDescending);
        // Honest hasMore: true when total rows exceed the requested page.
        hasMore = messages.length > limit;
        messages = messages.slice(0, limit);
      } catch {
        /* ignore */
      }
    }
    // Swim-lane participants: stable, ordered list of the coworkers on this
    // thread so the client renders lanes deterministically (and can show an
    // empty lane for a participant whose rows fell outside the page). Ordered
    // by each coworker's earliest session on the thread — roughly the order
    // they joined the chain (orch first, then triager, fixer, reviewer…).
    let lanes: Array<{ folder: string; name: string; sessionIds: string[] }> | undefined;
    if (laneMode && db) {
      try {
        const rows = db
          .prepare(
            `SELECT ag.folder AS folder, COALESCE(ag.name, ag.folder) AS name, s.id AS session_id,
                    MIN(s.created_at) OVER (PARTITION BY ag.id) AS first_created
               FROM sessions s JOIN agent_groups ag ON ag.id = s.agent_group_id
              WHERE s.thread_id = ? AND s.status = 'active'
              ORDER BY first_created ASC, ag.folder ASC, s.created_at ASC`,
          )
          .all(threadFilter) as Array<{ folder: string; name: string; session_id: string }>;
        const byFolder = new Map<string, { folder: string; name: string; sessionIds: string[] }>();
        for (const r of rows) {
          const e = byFolder.get(r.folder) ?? { folder: r.folder, name: r.name, sessionIds: [] };
          e.sessionIds.push(r.session_id);
          byFolder.set(r.folder, e);
        }
        lanes = [...byFolder.values()];
      } catch {
        /* lanes optional */
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ messages, hasMore, threadSummaries, ...(lanes ? { lanes } : {}) }));
    return;
  }

  // API: a2a read-only session inspector. Option C from the thread-aware
  // a2a plan. Given a recipient agent_group_id and the sender's thread
  // (the bubble is rendered on the sender's side as "from @reviewer"),
  // resolve the recipient's per-thread session on the a2a messaging
  // group and return its joined inbound+outbound messages. No writes,
  // no composer — operator can peek into the other side of the
  // delegation without being able to post.
  if (url.pathname === '/api/a2a-session') {
    if (!requireAuth(req, res)) return;
    const recipientAg = url.searchParams.get('recipient_agent_group_id');
    const senderThreadRaw = url.searchParams.get('sender_thread');
    const senderThread = senderThreadRaw && senderThreadRaw.length > 0 ? senderThreadRaw : null;
    if (!recipientAg) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'recipient_agent_group_id required' }));
      return;
    }
    if (!db) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'database unavailable' }));
      return;
    }
    try {
      // Post-PR-#308 a2a model: per-source-recipient messaging groups with
      // platform_id 'agent:<source_ag>:<recipient_ag>'. The `a2a_session_sources`
      // table maps (recipient_session) → (source_session, source_thread_id, ...),
      // which is the authoritative way to find the recipient's session for a
      // given source thread — no need to guess via messaging-group naming.
      let sessRow: { id: string; thread_id: string | null; created_at: string | null } | undefined;
      if (senderThread !== null) {
        sessRow = db
          .prepare(
            `SELECT s.id, s.thread_id, s.created_at
             FROM a2a_session_sources src
             JOIN sessions s ON s.id = src.recipient_session_id
             WHERE src.recipient_agent_group_id = ?
               AND src.source_thread_id = ?
               AND s.status = 'active'
             ORDER BY src.created_at DESC LIMIT 1`,
          )
          .get(recipientAg, senderThread) as any;
      } else {
        // Root delegation (no sender thread) — pick the most recent active
        // a2a session for this recipient where source_thread_id is unset.
        // Tolerate both NULL and empty-string (data drift from older paths).
        sessRow = db
          .prepare(
            `SELECT s.id, s.thread_id, s.created_at
             FROM a2a_session_sources src
             JOIN sessions s ON s.id = src.recipient_session_id
             WHERE src.recipient_agent_group_id = ?
               AND (src.source_thread_id IS NULL OR src.source_thread_id = '')
               AND s.status = 'active'
             ORDER BY src.created_at DESC LIMIT 1`,
          )
          .get(recipientAg) as any;
      }
      if (!sessRow) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'no recipient session found for this thread' }));
        return;
      }
      const sessionsDir = join(getDataDir(), 'v2-sessions', recipientAg, sessRow.id);
      const msgs: Array<{
        id: string;
        direction: 'incoming' | 'outgoing';
        content: string | null;
        timestamp: string;
        thread_id?: string | null;
      }> = [];
      const inPath = join(sessionsDir, 'inbound.db');
      if (existsSync(inPath)) {
        try {
          const sdb = new Database(inPath, { readonly: true });
          try {
            const rows = sdb
              .prepare('SELECT id, content, timestamp, thread_id FROM messages_in ORDER BY timestamp DESC LIMIT 100')
              .all() as Array<{ id: string; content: string | null; timestamp: string; thread_id: string | null }>;
            for (const r of rows)
              msgs.push({
                id: r.id,
                direction: 'incoming',
                content: r.content,
                timestamp: r.timestamp,
                thread_id: r.thread_id,
              });
          } catch {
            /* older schema without thread_id */
            const rows = sdb
              .prepare('SELECT id, content, timestamp FROM messages_in ORDER BY timestamp DESC LIMIT 100')
              .all() as Array<{ id: string; content: string | null; timestamp: string }>;
            for (const r of rows)
              msgs.push({ id: r.id, direction: 'incoming', content: r.content, timestamp: r.timestamp });
          }
          sdb.close();
        } catch {
          /* ignore */
        }
      }
      const outPath = join(sessionsDir, 'outbound.db');
      if (existsSync(outPath)) {
        try {
          const sdb = new Database(outPath, { readonly: true });
          try {
            const rows = sdb
              .prepare('SELECT id, content, timestamp, thread_id FROM messages_out ORDER BY timestamp DESC LIMIT 100')
              .all() as Array<{ id: string; content: string | null; timestamp: string; thread_id: string | null }>;
            for (const r of rows)
              msgs.push({
                id: r.id,
                direction: 'outgoing',
                content: r.content,
                timestamp: r.timestamp,
                thread_id: r.thread_id,
              });
          } catch {
            const rows = sdb
              .prepare('SELECT id, content, timestamp FROM messages_out ORDER BY timestamp DESC LIMIT 100')
              .all() as Array<{ id: string; content: string | null; timestamp: string }>;
            for (const r of rows)
              msgs.push({ id: r.id, direction: 'outgoing', content: r.content, timestamp: r.timestamp });
          }
          sdb.close();
        } catch {
          /* ignore */
        }
      }
      // Sort descending by timestamp (string ISO compares lexicographically) — newest first, client reverses if desired.
      msgs.sort((a, b) => (b.timestamp || '').localeCompare(a.timestamp || ''));
      const limited = msgs.slice(0, 100);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          session: { id: sessRow.id, thread_id: sessRow.thread_id, created_at: sessRow.created_at },
          messages: limited,
        }),
      );
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String((err as Error).message || err) }));
    }
    return;
  }

  // API: dispatch-targets — given a (sessionId, threadId) emitting an outbound
  // <message to="X" thread_id="Y">, find the recipient session(s) so the
  // dashboard can open them in a split-view tile.
  //
  // Mechanism: when the host routes a fresh dispatch, it writes an inbound row
  // on the recipient session with `source_session_id = <sender>` and
  // `thread_id = <Y>`. We scan every agent group's per-session inbound.db for
  // rows matching (source_session_id=X AND thread_id=Y), dedupe by
  // recipient_session_id, and return them ordered by first-seen timestamp.
  //
  // Schema fallback: older sessions predate `source_session_id`. We probe the
  // column and skip sessions whose schema lacks it (their dispatches show up
  // anyway via the matching recipient session — the lookup just won't see them).
  if (url.pathname === '/api/dispatch-targets') {
    if (!requireAuth(req, res)) return;
    const fromSessionId = url.searchParams.get('fromSessionId');
    const threadId = url.searchParams.get('threadId');
    if (!fromSessionId || !threadId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'fromSessionId and threadId required' }));
      return;
    }
    if (!db) {
      res.writeHead(503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'database unavailable' }));
      return;
    }
    try {
      type Hit = {
        recipientSessionId: string;
        recipientAgentGroupId: string;
        recipientGroupName: string;
        recipientGroupFolder: string;
        firstMessageId: string;
        firstMessageAt: string;
      };
      const groups = db
        .prepare<[], { id: string; name: string; folder: string }>('SELECT id, name, folder FROM agent_groups')
        .all();
      const hits: Hit[] = [];
      const seen = new Set<string>();
      const sessionsRoot = join(getDataDir(), 'v2-sessions');
      for (const g of groups) {
        const groupDir = join(sessionsRoot, g.id);
        let sessionDirs: string[] = [];
        try {
          sessionDirs = readdirSync(groupDir).filter((d) => d.startsWith('sess-'));
        } catch {
          continue;
        }
        for (const sessId of sessionDirs) {
          if (sessId === fromSessionId) continue;
          const inboundPath = join(groupDir, sessId, 'inbound.db');
          if (!existsSync(inboundPath)) continue;
          let pdb: Database.Database | null = null;
          try {
            pdb = new Database(inboundPath, { readonly: true });
            // Probe column existence (older schemas may lack source_session_id)
            const cols = pdb.prepare('PRAGMA table_info(messages_in)').all() as Array<{ name: string }>;
            if (!cols.some((c) => c.name === 'source_session_id')) {
              pdb.close();
              continue;
            }
            const row = pdb
              .prepare<
                [string, string],
                { id: string; timestamp: string }
              >('SELECT id, timestamp FROM messages_in WHERE source_session_id = ? AND thread_id = ? ORDER BY timestamp ASC LIMIT 1')
              .get(fromSessionId, threadId);
            pdb.close();
            if (!row) continue;
            if (seen.has(sessId)) continue;
            seen.add(sessId);
            hits.push({
              recipientSessionId: sessId,
              recipientAgentGroupId: g.id,
              recipientGroupName: g.name,
              recipientGroupFolder: g.folder,
              firstMessageId: row.id,
              firstMessageAt: row.timestamp,
            });
          } catch {
            try {
              pdb?.close();
            } catch {
              /* ignore */
            }
            continue;
          }
        }
      }
      hits.sort((a, b) => (a.firstMessageAt || '').localeCompare(b.firstMessageAt || ''));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ targets: hits }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: String((err as Error).message || err) }));
    }
    return;
  }

  // API: admin overview stats
  if (url.pathname === '/api/overview') {
    if (!requireAuth(req, res)) return;
    const result: any = {
      uptime: process.uptime(),
      groups: { total: 0 },
      tasks: { active: 0, paused: 0, completed: 0 },
      messages: { total: 0 },
      sessions: 0,
    };
    if (db) {
      try {
        result.groups.total = (db.prepare('SELECT COUNT(*) as c FROM agent_groups').get() as any)?.c || 0;
        result.messages.total = (db.prepare('SELECT COUNT(*) as c FROM hook_events').get() as any)?.c || 0;
        result.sessions = (db.prepare('SELECT COUNT(*) as c FROM sessions').get() as any)?.c || 0;
        // Task counts come from the background-refreshed per-group snapshot
        // (getGroupTaskSummary), so this default landing panel no longer opens
        // every session's inbound.db inline on each request — the O(N-sessions)
        // synchronous DB-open storm that made the cold page load slow.
        const groups = db.prepare('SELECT id FROM agent_groups').all() as any[];
        for (const g of groups) {
          const summary = getGroupTaskSummary(g.id);
          result.tasks.active += summary.active;
          result.tasks.paused += summary.paused;
          result.tasks.completed += summary.completed;
        }
      } catch {
        /* ignore */
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: token metrics via ccusage (supports ?period=1d|7d|30d|all)
  if (url.pathname === '/api/token-metrics') {
    if (!requireAuth(req, res)) return;
    const period = (url.searchParams.get('period') || 'all') as keyof typeof ccusageCache;
    const periodData = ccusageCache[period] || ccusageCache.all || emptyCcusagePeriod;
    // `period` is typed over ccusageCache's keys (which include 'lastRefresh');
    // narrow to a real Context period, defaulting anything else to 'all'.
    const ctxPeriod: ContextPeriod = CONTEXT_PERIODS.includes(period as ContextPeriod)
      ? (period as ContextPeriod)
      : 'all';
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        daily: periodData.combined,
        byCoworker: periodData.byGroup.map((g) => {
          const rec = contextStatsCache.get(g.groupId);
          return { ...g, contextStats: rec ? (rec[ctxPeriod] ?? rec.all ?? null) : null };
        }),
        period,
        lastRefresh: ccusageCache.lastRefresh,
        unavailable: ccusageUnavailable(),
      }),
    );
    return;
  }

  // API: 24h message activity
  if (url.pathname === '/api/activity') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(activityDataCache || []));
    return;
  }

  // API: signal Admin > Infra screen visibility (start/stop ccusage refresh)
  if (url.pathname === '/api/admin-infra-visible') {
    if (!requireAuth(req, res)) return;
    const isVisible = url.searchParams.get('visible') === 'true';
    if (isVisible) {
      startCcusageRefresh(req.socket);
    } else {
      stopCcusageRefresh(req.socket);
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  // API: 30-day cost history (combined across all coworkers, per-day rows).
  if (url.pathname === '/api/cost-history') {
    if (!requireAuth(req, res)) return;
    const dailyCosts = (ccusageCache['30d']?.combined || []).map((d) => ({
      date: d.date,
      totalCost: d.totalCost,
      totalTokens: d.totalTokens,
    }));
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(JSON.stringify({ dailyCosts, lastRefresh: ccusageCache.lastRefresh, unavailable: ccusageUnavailable() }));
    return;
  }

  // API: unit cost — what one opened PR costs in triager+fixer+reviewer spend.
  //
  // The cost side is NOT recomputed here; it reads the same ccusageCache the
  // rest of the cost UI reads, so the two can never disagree. Only the six
  // coworker groups count, and only prod PRs form the denominator.
  if (url.pathname === '/api/unit-cost') {
    if (!requireAuth(req, res)) return;
    const weeksWanted = Math.min(Math.max(Number(url.searchParams.get('weeks')) || 4, 1), 26);
    const unavailable = ccusageUnavailable();
    let payload: Record<string, unknown>;
    if (unavailable) {
      // Say why, and emit NO weeks — a caller must not be able to read this as
      // "four weeks that each cost nothing".
      payload = { weeks: [], groupsMatched: [], groupsMissing: UNIT_COST_GROUPS, unavailable, prSource: null };
    } else {
      // Denominator: prod PR→session mappings, intersected with the funnel's
      // own row set so we count the same PRs the rest of the board counts.
      const prWeeks = new Map<string, number>();
      let mapped = 0;
      let unparseableSessionIds = 0;
      let notInFunnel = 0;
      let funnelKeys: Set<string> | null = null;
      try {
        const raw = readFileSync(join(getProjectRoot(), 'reports', 'funnel.json'), 'utf8');
        const rows = (JSON.parse(raw)?.rows ?? []) as Array<{ repo?: string; pr?: number; instance?: string }>;
        funnelKeys = new Set(rows.filter((r) => r.instance === 'prod' && r.pr).map((r) => `${r.repo}#${r.pr}`));
      } catch {
        // Leave null — see the guard below. An unreadable funnel must not
        // silently degrade to "no PRs", which would zero every denominator and
        // render as null cost-per-PR across the board with no explanation.
        funnelKeys = null;
      }
      // `db` is opened lazily (see the `if (!db) db = openDb()` further down);
      // a route that only reads it can therefore run while it is still null and
      // report "central DB unavailable" on a perfectly healthy box. Observed on
      // prod the first time this route was hit.
      if (!db) db = openDb();
      if (!funnelKeys || !db) {
        payload = {
          weeks: [],
          groupsMatched: [],
          groupsMissing: UNIT_COST_GROUPS,
          unavailable: !db
            ? 'central DB unavailable'
            : 'reports/funnel.json unreadable — cannot resolve the PR denominator',
          prSource: null,
        };
      } else {
        const maps = db
          .prepare(
            `SELECT repo, pr_number, session_id, created_at FROM pr_session_mappings WHERE owner_instance = 'prod'`,
          )
          .all() as Array<{ repo: string; pr_number: number; session_id: string; created_at: string }>;
        const seen = new Set<string>();
        for (const m of maps) {
          const key = `${m.repo}#${m.pr_number}`;
          if (!funnelKeys.has(key)) {
            notInFunnel++;
            continue;
          }
          if (seen.has(key)) continue; // one PR counts once, however many sessions touched it
          // Prefer the epoch-ms in the session id: it is unambiguously UTC.
          // created_at is stored naive ("YYYY-MM-DD HH:MM:SS") and new Date()
          // reads that as LOCAL time, which can shift a row across a week
          // boundary. Fall back to it only when the id shape is unrecognised.
          const ms = sessionIdMs(m.session_id);
          let week: string;
          if (ms !== null) {
            week = isoWeekStartFromMs(ms);
          } else if (m.created_at) {
            unparseableSessionIds++;
            week = isoWeekStart(m.created_at.slice(0, 10));
          } else {
            unparseableSessionIds++;
            continue;
          }
          seen.add(key);
          mapped++;
          prWeeks.set(week, (prWeeks.get(week) ?? 0) + 1);
        }
        // The ccusage cache keys byGroup on the agent-group DIRECTORY id, and
        // its `groupName` falls back to that id when no display name resolves —
        // on prod every entry is literally `ag-1776713211742-1w6l4e`. Matching
        // the six coworkers by name against that never hits, which is how this
        // route first shipped reporting "no cost data" on a box with 5194
        // transcripts.
        //
        // Resolve id -> folder and match on FOLDER. For the six that count,
        // folder equals name exactly; every decoy differs (`Slang Fixer` is
        // folder `dashboard_slang-fixer`, `Slang-Reviewer` is
        // `legacy_slang-reviewer`), so folder is the unambiguous key.
        const folderById = new Map<string, string>();
        for (const g of db.prepare('SELECT id, folder FROM agent_groups').all() as Array<{
          id: string;
          folder: string;
        }>) {
          folderById.set(g.id, g.folder);
        }
        const byGroupFoldered = (ccusageCache.all?.byGroup ?? []).map((g) => ({
          groupName: folderById.get(g.groupId) ?? g.groupName,
          daily: g.daily,
        }));
        const result = unitCostByWeek(byGroupFoldered, prWeeks, weeksWanted);
        payload = {
          ...result,
          prSource: {
            prodMappings: maps.length,
            countedPrs: mapped,
            droppedNotInFunnel: notInFunnel,
            fellBackToCreatedAt: unparseableSessionIds,
          },
          lastRefresh: ccusageCache.lastRefresh,
        };
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    res.end(JSON.stringify(payload));
    return;
  }

  // API: users with privilege hierarchy
  if (url.pathname === '/api/users') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(collectUsersData()));
    return;
  }

  // API: channel status
  if (url.pathname === '/api/channel-status') {
    if (!requireAuth(req, res)) return;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(collectChannelStatus()));
    return;
  }

  // API: tasks — v2 does not have a central scheduled_tasks table
  if (url.pathname === '/api/tasks') {
    if (!requireAuth(req, res)) return;
    const allTasks: any[] = [];
    if (db) {
      try {
        const groups = db.prepare('SELECT id, folder, name FROM agent_groups').all() as any[];
        for (const g of groups) {
          const { sessionIds } = collectSessionDbFiles(g.id);
          const tasks = extractScheduledTasks(g.id, sessionIds);
          for (const t of tasks) {
            // Parse content JSON to extract prompt
            let prompt = '';
            try {
              prompt = JSON.parse(t.content)?.prompt || '';
            } catch {
              prompt = t.content || '';
            }
            // Map v2 status to frontend expected values
            const status = t.status === 'pending' ? 'active' : t.status;
            allTasks.push({
              id: t.origId,
              group_folder: g.folder,
              group_name: g.name,
              prompt,
              schedule_type: t.recurrence ? 'cron' : 'once',
              schedule_value: t.recurrence || t.processAfter || '',
              status,
              last_run: null,
              sessionId: t.sessionId,
              agentGroupId: g.id,
            });
          }
        }
      } catch {
        /* ignore */
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(allTasks));
    return;
  }

  // API: pause/resume task
  if (req.method === 'POST' && /^\/api\/tasks\/[^/]+\/(pause|resume)$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const parts = url.pathname.split('/');
    const action = parts.pop()!;
    const taskId = safeDecode(parts.pop()!);
    if (!taskId) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const newStatus = action === 'pause' ? 'paused' : 'pending';
    let found = false;
    if (db) {
      try {
        const groups = db.prepare('SELECT id FROM agent_groups').all() as any[];
        for (const g of groups) {
          if (found) break;
          const agDir = join(getDataDir(), 'v2-sessions', g.id);
          let entries: string[];
          try {
            entries = readdirSync(agDir);
          } catch {
            continue;
          }
          for (const entry of entries) {
            if (!entry.startsWith('sess-')) continue;
            const dbPath = join(agDir, entry, 'inbound.db');
            if (!existsSync(dbPath)) continue;
            let sdb: Database.Database | null = null;
            try {
              sdb = new Database(dbPath);
              sdb.pragma('busy_timeout = 3000');
              const result = sdb
                .prepare("UPDATE messages_in SET status = ? WHERE id = ? AND kind = 'task'")
                .run(newStatus, taskId);
              if (result.changes > 0) {
                found = true;
                // Reflect this task mutation immediately in the memoized snapshot
                // that getState / /api/overview read, else the count lags up to
                // one refresh interval. /api/tasks re-reads live (mtime-gated), so
                // the write's mtime bump already makes its rows fresh.
                groupTaskCache.delete(g.id);
                break;
              }
            } catch {
              /* */
            } finally {
              try {
                sdb?.close();
              } catch {
                /* */
              }
            }
          }
        }
      } catch {
        /* */
      }
    }
    res.writeHead(found ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(found ? { ok: true, status: newStatus } : { error: 'task not found' }));
    return;
  }

  // API: delete task
  if (req.method === 'DELETE' && /^\/api\/tasks\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const taskId = safeDecode(url.pathname.replace('/api/tasks/', ''));
    if (!taskId) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    let found = false;
    if (db) {
      try {
        const groups = db.prepare('SELECT id FROM agent_groups').all() as any[];
        for (const g of groups) {
          if (found) break;
          const agDir = join(getDataDir(), 'v2-sessions', g.id);
          let entries: string[];
          try {
            entries = readdirSync(agDir);
          } catch {
            continue;
          }
          for (const entry of entries) {
            if (!entry.startsWith('sess-')) continue;
            const dbPath = join(agDir, entry, 'inbound.db');
            if (!existsSync(dbPath)) continue;
            let sdb: Database.Database | null = null;
            try {
              sdb = new Database(dbPath);
              sdb.pragma('busy_timeout = 3000');
              const result = sdb.prepare("DELETE FROM messages_in WHERE id = ? AND kind = 'task'").run(taskId);
              if (result.changes > 0) {
                found = true;
                // Reflect this task mutation immediately in the memoized snapshot
                // that getState / /api/overview read, else the count lags up to
                // one refresh interval. /api/tasks re-reads live (mtime-gated), so
                // the write's mtime bump already makes its rows fresh.
                groupTaskCache.delete(g.id);
                break;
              }
            } catch {
              /* */
            } finally {
              try {
                sdb?.close();
              } catch {
                /* */
              }
            }
          }
        }
      } catch {
        /* */
      }
    }
    res.writeHead(found ? 200 : 404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(found ? { ok: true } : { error: 'task not found' }));
    return;
  }

  // API: toggle hidden/pinned state on a session. Non-destructive — flips a
  // timestamp column on the sessions row. Dashboard uses these to filter and
  // sort the Other Sessions list without touching on-disk session data.
  // Path: /api/sessions/<nanoclaw_session_id>/<hidden|pinned>  Body: {on: boolean}
  if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/(hidden|pinned)$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const parts = url.pathname.split('/');
    const sid = safeDecode(parts[3] || '');
    const field = parts[4] === 'hidden' ? 'hidden_at' : 'pinned_at';
    if (!sid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"bad session id"}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    let parsed: { on?: unknown };
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"invalid json"}');
      return;
    }
    const on = parsed.on === true;
    const wdb = getWriteDb();
    if (!wdb) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
      return;
    }
    try {
      // Check that the column exists before attempting the UPDATE — migration
      // 022 may not have run yet (the read path already handles this defensively).
      const sessionCols = new Set(
        (wdb.prepare('PRAGMA table_info(sessions)').all() as Array<{ name: string }>).map((c) => c.name),
      );
      if (!sessionCols.has(field)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `column ${field} not available — migration pending` }));
        return;
      }
      const value = on ? new Date().toISOString() : null;
      const r = wdb.prepare(`UPDATE sessions SET ${field} = ? WHERE id = ?`).run(value, sid);
      if (r.changes === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"session not found"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, [field]: value }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: set a manual display title on a session (operator rename from the UI).
  // Path: /api/sessions/<nanoclaw_session_id>/title  Body: {title: string}
  // Uses title_source='manual' so background heuristics won't overwrite it.
  if (req.method === 'POST' && /^\/api\/sessions\/[^/]+\/title$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const sid = safeDecode(url.pathname.replace('/api/sessions/', '').replace('/title', ''));
    if (!sid) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"bad session id"}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    let parsed: { title?: unknown };
    try {
      parsed = JSON.parse(body);
    } catch {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"invalid json"}');
      return;
    }
    const title = typeof parsed.title === 'string' ? parsed.title.trim() : '';
    if (!title) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"title required"}');
      return;
    }
    if (title.length > 200) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"title too long (max 200 chars)"}');
      return;
    }
    const wdb = getWriteDb();
    if (!wdb) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
      return;
    }
    try {
      const now = new Date().toISOString();
      const r = wdb
        .prepare(`UPDATE sessions SET display_title = ?, title_source = 'manual', title_updated_at = ? WHERE id = ?`)
        .run(title, now, sid);
      if (r.changes === 0) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"session not found"}');
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, title }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: list sessions
  if (req.method === 'GET' && url.pathname === '/api/sessions') {
    if (!requireAuth(req, res)) return;
    let sessions: any[] = [];
    if (db) {
      try {
        sessions = db
          .prepare(
            'SELECT s.id as session_id, s.agent_group_id, s.thread_id, s.status, s.container_status, s.last_active, ag.name as group_name, ag.folder as group_folder FROM sessions s LEFT JOIN agent_groups ag ON s.agent_group_id = ag.id',
          )
          .all();
      } catch {
        /* ignore */
      }
    }
    // GitHub PR/issue association, when one exists — two independent, optional
    // fields per row (many sessions, e.g. orchestrator loops or non-GitHub
    // channels, have neither):
    //   - repo/number/kind: prefer `pr_session_mappings` (session_id -> repo,
    //     pr_number) — the authoritative "this PR's webhooks route here" claim
    //     (src/modules/pr-mapping, nv-main). Falls back to parsing thread_id's
    //     canonical `gh-issue-<repo>-<num>` / `gh-pr-<repo>-<num>` form
    //     (src/webhook-github.ts) — every coworker on a GitHub chain shares
    //     that thread_id verbatim (docs/thread-vs-session.md), so this also
    //     covers triager/fixer/reviewer sessions and plain issue triage
    //     (issues have no PR number, so no pr_session_mappings row).
    //   - author: who filed the ORIGINATING issue/PR, from `gh_thread_origin`
    //     (src/db/gh-thread-origin.ts, nv-main), keyed on the session's own
    //     thread_id regardless of which source resolved repo/number above —
    //     a fixer session working PR #500 that a triaged issue #480 spawned
    //     shows author=whoever filed #480, which is the point ("who filed the
    //     thing that spawned this session's work").
    // Both tables are nv-main-owned and may not exist yet on an install that
    // hasn't migrated (or in this branch's own isolated test DB, which has no
    // pr-mapping module at all) — each query is independently try/catched so
    // a lookup failure here degrades to "no badge for any row", never a
    // broken /api/sessions response.
    const prMapBySession = new Map<string, { repo: string; number: number }>();
    if (db) {
      try {
        for (const m of db.prepare('SELECT repo, pr_number, session_id FROM pr_session_mappings').all() as Array<{
          repo: string;
          pr_number: number;
          session_id: string;
        }>) {
          if (m.session_id) prMapBySession.set(m.session_id, { repo: m.repo, number: m.pr_number });
        }
      } catch {
        /* pr_session_mappings not migrated yet — no PR badges from this source */
      }
    }
    const ghOriginByThread = new Map<string, { author: string }>();
    if (db) {
      try {
        for (const o of db.prepare('SELECT thread_id, author FROM gh_thread_origin').all() as Array<{
          thread_id: string;
          author: string;
        }>) {
          if (o.thread_id) ghOriginByThread.set(o.thread_id, { author: o.author });
        }
      } catch {
        /* gh_thread_origin not migrated yet — no author badges */
      }
    }
    // Matches the canonical thread_id shape webhook-github.ts mints:
    // gh-issue-<owner>/<repo>-<num> / gh-pr-<owner>/<repo>-<num>, optionally
    // followed by a documented `/<sub-task>` append-only suffix (which still
    // names the same underlying issue/PR).
    const GH_THREAD_RE = /^gh-(issue|pr)-(.+)-(\d+)(?:\/.+)?$/;
    // Latest cost-ceiling adjustment per session (dash-1 set-ceiling-v2), when
    // the paired host+runner PR (separate branch — see docs/set-ceiling-v2 in
    // this repo's PR history) has landed and migrated. `cost_escalation_episodes`
    // rows with target_ceiling_usd set are 'set_ceiling' operations — that
    // column is the table's own documented operation discriminator, so a plain
    // continue/stop episode never matches this query. One query for the whole
    // page (not per-row), same batching as prMapBySession/ghOriginByThread
    // above. The table (or its set_ceiling columns) may not exist yet on a host
    // that hasn't deployed the paired PR — fails soft to "no adjustment badge
    // for any row", exactly like those maps do for their own not-yet-migrated
    // tables.
    const latestAdjustmentBySession = new Map<string, LatestCostAdjustment>();
    if (db) {
      try {
        const cols = db.prepare('PRAGMA table_info(cost_escalation_episodes)').all() as Array<{ name: string }>;
        if (cols.some((c) => c.name === 'target_ceiling_usd')) {
          const rows = db
            .prepare(
              `SELECT episode_id, session_id, decision_state, effect_state, target_ceiling_usd, created_at
                 FROM cost_escalation_episodes
                WHERE target_ceiling_usd IS NOT NULL
                ORDER BY created_at DESC`,
            )
            .all() as CostEpisodeLikeRow[];
          for (const row of rows) {
            // ORDER BY created_at DESC → the first row seen per session_id is the latest.
            if (latestAdjustmentBySession.has(row.session_id)) continue;
            const mapped = mapEpisodeToLatestAdjustment(row);
            if (mapped) latestAdjustmentBySession.set(row.session_id, mapped);
          }
        }
      } catch {
        /* cost_escalation_episodes not migrated (or set_ceiling columns absent) yet — no adjustment badges */
      }
    }
    // Cost column: join the per-session cost cache for the requested period
    // (default 30d). Every row gets `cost`/`tokens`/`costUnpriced`; a session
    // with no priced activity in the window is 0. `?sort=cost` ranks desc so
    // the fat tail (the few sessions that drive most spend) is at the top.
    // `unavailable` (from the shared ccusage resolution) tells the UI to show
    // "n/a" instead of a confident $0 when pricing is genuinely absent.
    const periodParam = url.searchParams.get('period') || '30d';
    const period: ContextPeriod = CONTEXT_PERIODS.includes(periodParam as ContextPeriod)
      ? (periodParam as ContextPeriod)
      : '30d';
    const costByNano = sessionCostCache[period] || new Map<string, SessionCostEntry>();
    // p99-relative color signal for the Sessions pill (see computeCostP99ByGroup) —
    // scoped to the SAME period the request already selected, so it matches
    // whatever window (Today/7d/30d) the user is looking at. Cheap: reuses the
    // in-memory cache, no disk I/O, no dependency on the runner's cap tracking.
    const { fleetP99, perGroupP99 } = computeCostP99ByGroup(costByNano);
    // Base URL of the flat claude-trace archive (scripts/refresh-claude-trace-www.sh,
    // served separately). When set, each priced row links to its session-precise
    // trace file `<base>/<folder>__session-<id>*.html`. Resolved once outside the
    // loop; empty on installs without the archive → no trace link rendered.
    const traceBase = process.env.CLAUDE_TRACE_BASE_URL || readProjectEnvValue('CLAUDE_TRACE_BASE_URL') || '';
    for (const s of sessions) {
      const c = s.session_id ? costByNano.get(s.session_id) : undefined;
      s.cost = c ? c.cost : 0;
      // Provider split of the SAME number. `cost` stays the total (every existing
      // consumer keeps working); these let the UI show what drove it. Codex spend
      // is the `codex-critique` MCP tool's own model cost, which is invisible to
      // the Claude transcript walk — see codex-costs.ts / issue #1327.
      s.claudeUsd = c ? c.claudeUsd : 0;
      s.codexUsd = c ? c.codexUsd : 0;
      s.costTokens = c ? c.tokens : 0;
      s.costUnpriced = c ? c.unpriced : false;
      // p99 threshold this row is judged against for pill color — the group's own
      // (statistically meaningful sample) or the fleet's. Independent of the cap
      // read below: a non-Claude-provider session (no cost_cap row at all) still
      // gets a meaningful color from its raw priced spend.
      if (s.cost > 0) {
        const p99 = (s.group_folder && perGroupP99.get(s.group_folder)) ?? fleetP99;
        if (p99 != null && p99 > 0) s.costP99 = p99;
      }
      // Cost-cap/ceiling state, published by the runner into outbound.db
      // session_state and mirrored into sessionCostCapsMap by the scan worker /
      // main-thread fallback (see above). Joined for EVERY session — NOT gated
      // on s.cost>0 — because this is requirement (a) of dash-1
      // set-ceiling-v2: a session's live ceiling must stay visible regardless
      // of which day-window (Today/7d/30d) the priced-cost column above is
      // scoped to. This is an in-memory Map lookup, not a per-row DB open (the
      // old s.cost>0 gate existed specifically to avoid opening ~3000 mostly-
      // idle sessions' SQLite files per request — that cost is now paid once,
      // continuously, in the background, not per-request), so it's cheap
      // unconditionally. Absent (older runner / no accrual yet) → every field
      // below stays undefined and JSON.stringify omits it, same degradation as
      // before.
      const capEntry = s.session_id ? sessionCostCapsMap.get(s.session_id) : undefined;
      const latestAdjustment = s.session_id ? latestAdjustmentBySession.get(s.session_id) : undefined;
      Object.assign(s, buildSessionCostFields(capEntry, latestAdjustment));
      // Session-precise trace deep-link. Sessions live under
      // data/v2-sessions/<agent_group_id>/… but traces live under
      // groups/<folder>/.claude-trace/session-<session_id>*.html, so map via the
      // group folder (already joined as s.group_folder). Bounded + fail-soft;
      // skip idle rows (s.cost<=0) to stay as cheap as the cap read above.
      if (traceBase && s.cost > 0 && s.group_folder && s.session_id) {
        try {
          // Warm path: no filesystem calls — the group's trace-dir listing is
          // cached (TTL) and reused across rows and requests. Same selection as
          // before: newest `session-<id>*.html` by mtime.
          const traceDir = join(getGroupsDir(), s.group_folder, '.claude-trace');
          const listing = getTraceDirListing(traceDir);
          const prefix = `session-${s.session_id}`;
          let newest = '';
          let newestMs = -1;
          for (const f of listing) {
            if (!f.name.startsWith(prefix)) continue;
            if (f.mtimeMs >= newestMs) {
              newestMs = f.mtimeMs;
              newest = f.name;
            }
          }
          if (newest) s.traceUrl = `${traceBase}/${s.group_folder}__${newest}`;
        } catch {
          /* fail-soft: no trace link for this row */
        }
      }
      // GitHub PR/issue badge — see the map-building comment above for the
      // repo/number/author resolution order. No filesystem I/O and no
      // per-row DB open (unlike costCap/traceUrl above): both maps were
      // built once, outside this loop, so this is a plain in-memory lookup
      // and doesn't need the s.cost>0 gate those use to stay cheap.
      try {
        const mapped = s.session_id ? prMapBySession.get(s.session_id) : undefined;
        const threadMatch = typeof s.thread_id === 'string' ? GH_THREAD_RE.exec(s.thread_id) : null;
        if (mapped) {
          s.ghRepo = mapped.repo;
          s.ghNumber = mapped.number;
          s.ghKind = 'pr';
        } else if (threadMatch) {
          s.ghKind = threadMatch[1] === 'issue' ? 'issue' : 'pr';
          s.ghRepo = threadMatch[2];
          s.ghNumber = Number(threadMatch[3]);
        }
        if (s.ghNumber && s.ghRepo) {
          s.ghUrl = `https://github.com/${s.ghRepo}/${s.ghKind === 'issue' ? 'issues' : 'pull'}/${s.ghNumber}`;
        }
        const origin = typeof s.thread_id === 'string' ? ghOriginByThread.get(s.thread_id) : undefined;
        if (origin?.author) s.ghAuthor = origin.author;
      } catch {
        /* fail-soft: no GitHub badge for this row */
      }
    }
    if (url.searchParams.get('sort') === 'cost') {
      sessions.sort((a, b) => (b.cost || 0) - (a.cost || 0));
    }
    res.writeHead(200, {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
    });
    res.end(
      JSON.stringify({
        sessions,
        period,
        costUnavailable: ccusageUnavailable(),
        // Base URL of the per-session transcript archive (build-transcripts-archive.ts,
        // served separately). When set, the Sessions tab links each row to
        // `<base>/<group-folder>/<session-id>/index.html`. Install-specific, so it's
        // env-configured (empty on installs without the archive → no link rendered).
        transcriptsBase: process.env.TRANSCRIPTS_BASE_URL || readProjectEnvValue('TRANSCRIPTS_BASE_URL') || '',
        // Base URL of the flat claude-trace archive; per-row deep-links are on
        // s.traceUrl (resolved above). Exposed for parity with transcriptsBase.
        traceBase,
      }),
    );
    return;
  }

  // API: delete sessions for a group folder
  if (req.method === 'DELETE' && /^\/api\/sessions\//.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/sessions/', ''));
    if (folder === null) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const wdb = getWriteDb();
    if (wdb) {
      try {
        wdb.prepare('DELETE FROM sessions WHERE group_folder=?').run(folder);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
    } else {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
    }
    return;
  }

  // API: list skills
  // API: list available instruction overlay templates
  if (req.method === 'GET' && url.pathname === '/api/instruction-templates') {
    if (!requireAuth(req, res)) return;
    const templatesDir = join(getGroupsDir(), 'templates', 'instructions');
    const templates: { name: string; content: string }[] = [];
    try {
      if (existsSync(templatesDir)) {
        for (const file of readdirSync(templatesDir).sort()) {
          if (!file.endsWith('.md')) continue;
          const name = file.replace(/\.md$/, '');
          try {
            const content = readFileSync(join(templatesDir, file), 'utf-8');
            templates.push({ name, content });
          } catch {
            /* unreadable */
          }
        }
      }
    } catch {
      /* dir missing */
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(templates));
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/skills') {
    if (!requireAuth(req, res)) return;
    const skills: any[] = [];
    try {
      if (existsSync(getSkillsDir())) {
        for (const name of readdirSync(getSkillsDir())) {
          const skillDir = join(getSkillsDir(), name);
          if (!statSync(skillDir).isDirectory()) continue;
          const info: any = { name, enabled: !existsSync(join(skillDir, '.disabled')), files: [] };
          const skillMd = join(skillDir, 'SKILL.md');
          if (existsSync(skillMd)) {
            const content = readFileSync(skillMd, 'utf-8');
            const titleMatch = content.match(/^#\s+(.+)/m);
            info.title = titleMatch ? titleMatch[1] : name;
            info.description =
              content
                .split('\n')
                .find((l: string) => l.trim() && !l.startsWith('#'))
                ?.trim() || '';
          }
          info.files = readdirSync(skillDir).filter((f: string) => !f.startsWith('.'));
          skills.push(info);
        }
      }
    } catch {
      /* ignore */
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(skills));
    return;
  }

  // API: toggle skill enabled/disabled
  if (req.method === 'POST' && /^\/api\/skills\/[^/]+\/toggle$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.match(/\/api\/skills\/([^/]+)\/toggle/)![1]);
    if (name === null) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const skillDir = resolve(getSkillsDir(), name);
    if (!isInsideDir(getSkillsDir(), skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const disabledFile = join(skillDir, '.disabled');
    let enabled: boolean;
    try {
      if (existsSync(disabledFile)) {
        unlinkSync(disabledFile);
        enabled = true;
      } else {
        writeFileSync(disabledFile, '');
        enabled = false;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ enabled }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: group details
  if (req.method === 'GET' && url.pathname === '/api/groups/detail') {
    if (!requireAuth(req, res)) return;
    let groups: any[] = [];
    if (db) {
      try {
        groups = db.prepare('SELECT * FROM agent_groups').all() as any[];
        // ag-id → friendly name, for resolving a2a destination channels (whose
        // messaging group is `agent:<from-ag>:<to-ag>`) to "From → To (a2a)".
        const agNameMap = new Map<string, string>(groups.map((x: any) => [x.id, x.name || x.folder]));
        for (const g of groups) {
          // Count sessions — total, plus the a2a-delegation split (usually the
          // large majority) and the most recent activity so the UI can flag
          // stale/duplicate groups. "real" = non-a2a (webhook/dashboard) sessions.
          g.sessionCount =
            (db.prepare('SELECT COUNT(*) as c FROM sessions WHERE agent_group_id = ?').get(g.id) as any)?.c || 0;
          g.sessionCountA2a =
            (
              db
                .prepare(
                  "SELECT COUNT(*) as c FROM sessions WHERE agent_group_id = ? AND messaging_group_id LIKE 'mg-a2a-%'",
                )
                .get(g.id) as any
            )?.c || 0;
          g.sessionCountReal = g.sessionCount - g.sessionCountA2a;
          g.lastActive =
            (db.prepare('SELECT MAX(last_active) as m FROM sessions WHERE agent_group_id = ?').get(g.id) as any)?.m ||
            null;
          // Enrich with the coworker's @mention handle + jid from its wirings.
          // A coworker typically has TWO non-a2a wirings: `always` on its own
          // channel (alias) and `pattern` on the shared Orchestrator channel
          // (the actual @mention dispatch). Prefer the pattern wiring's handle,
          // fall back to any wiring that carries a pattern, and strip regex
          // artifacts (\b, ^, $) so the card reads "@slang-fixer", not
          // "@slang-fixer\b". The stored regex is left untouched.
          try {
            const wirings = db
              .prepare(
                `SELECT mga.engage_mode, mga.engage_pattern, mg.platform_id
               FROM messaging_group_agents mga
               JOIN messaging_groups mg ON mg.id = mga.messaging_group_id
               WHERE mga.agent_group_id = ?`,
              )
              .all(g.id) as any[];
            if (wirings.length) g.jid = wirings[0].platform_id || null;
            const withPattern = wirings.filter((w) => w.engage_pattern);
            const chosen = withPattern.find((w) => w.engage_mode === 'pattern') || withPattern[0];
            if (chosen) {
              g.engageMode = chosen.engage_mode;
              g.mentionHandle = String(chosen.engage_pattern)
                .replace(/\\[bB]/g, '')
                .replace(/^\^/, '')
                .replace(/\$$/, '')
                .trim();
              // Keep trigger_pattern populated only when the coworker is actually
              // gated (pattern mode), for any consumer that relied on the old field.
              g.trigger_pattern = chosen.engage_mode === 'pattern' ? chosen.engage_pattern : null;
            }
          } catch {
            /* ignore */
          }
          // Read composed CLAUDE.md for preview (typed coworkers only;
          // untyped fall back to the on-disk file).
          try {
            const { composeCoworkerSpine } = await import('../src/claude-composer.js');
            let coworkerType: string | null = null;
            let disableOverlays = false;
            let overlays: string[] | undefined;
            try {
              const row = db
                .prepare('SELECT coworker_type, disable_overlays, overlays FROM agent_groups WHERE folder = ?')
                .get(g.folder) as any;
              coworkerType = row?.coworker_type || null;
              disableOverlays = row?.disable_overlays === 1;
              overlays = row?.overlays ? JSON.parse(row.overlays) : undefined;
            } catch {
              /* ignore */
            }
            if (coworkerType) {
              let extraInstructions: string | null = null;
              try {
                extraInstructions = readFileSync(join(getGroupsDir(), g.folder, '.instructions.md'), 'utf-8');
              } catch {
                /* none */
              }
              g.memory = composeCoworkerSpine({ coworkerType, extraInstructions, disableOverlays, overlays });
            } else {
              g.memory = readFileSync(join(getGroupsDir(), g.folder, 'CLAUDE.md'), 'utf-8');
            }
          } catch {
            const mdPath = join(getGroupsDir(), g.folder, 'CLAUDE.md');
            try {
              g.memory = readFileSync(mdPath, 'utf-8');
            } catch {
              g.memory = null;
            }
          }
          // Read raw .instructions.md for editor
          try {
            g.rawMemory = readFileSync(join(getGroupsDir(), g.folder, '.instructions.md'), 'utf-8');
          } catch {
            g.rawMemory = '';
          }
          // Check for running container (from async cache)
          g.containerRunning = hasRunningContainer(g.folder);
          // Include destinations for peer/channel visibility
          try {
            g.destinations = (
              db
                .prepare('SELECT local_name, target_type, target_id FROM agent_destinations WHERE agent_group_id = ?')
                .all(g.id) as any[]
            ).map((d) => {
              // Resolve a2a channel destinations (opaque `agent-mg-a2a-N` aliases)
              // to a readable "From → To (a2a)" using the messaging group's
              // platform_id. Leaves non-a2a destinations untouched.
              if (d.target_type === 'channel' && typeof d.target_id === 'string') {
                try {
                  const mg = db
                    .prepare('SELECT platform_id, name FROM messaging_groups WHERE id = ?')
                    .get(d.target_id) as any;
                  if (mg) {
                    const m = /^agent:(ag-[^:]+):(ag-[^:]+)$/.exec(mg.platform_id || '');
                    if (m) {
                      const from = agNameMap.get(m[1]) || m[1];
                      const to = agNameMap.get(m[2]) || m[2];
                      d.display = from === to ? `${from} ⟳ self (a2a)` : `${from} → ${to} (a2a)`;
                      d.isA2a = true;
                    } else if (mg.name) {
                      d.display = mg.name;
                    }
                  }
                } catch {
                  /* leave d.local_name as-is */
                }
              }
              return d;
            });
          } catch {
            g.destinations = [];
          }
        }
      } catch {
        /* ignore */
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(groups));
    return;
  }

  // API: list coworkers. RESTful counterpart to the POST — returns the same
  // projection the UI consumes via /api/state.coworkers, so external callers
  // (CI probes, monitoring scripts) can enumerate coworkers without pulling
  // the whole state blob. Optional `?type=<coworker-type>` narrows by type
  // (e.g. `?type=main` for the admin coworker).
  if (req.method === 'GET' && url.pathname === '/api/coworkers') {
    if (!requireAuth(req, res)) return;
    const coworkers = getState().coworkers;
    const typeFilter = url.searchParams.get('type');
    const filtered = typeFilter ? coworkers.filter((c) => c.type === typeFilter) : coworkers;
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(filtered));
    return;
  }

  // API: create coworker
  if (req.method === 'POST' && url.pathname === '/api/coworkers') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const {
        name,
        folder,
        types,
        type,
        trigger,
        instructions,
        instructionTemplate,
        agentProvider,
        routing: routingParam,
        overlays: overlaysParam,
        group: groupParam,
      } = JSON.parse(body);
      const routing: 'direct' | 'internal' = routingParam === 'internal' ? 'internal' : 'direct';
      // Sidebar group: 'prod' (or empty) → shared prod group (stored as null);
      // any other value is a user id the coworker is grouped under.
      const sidebarGroup: string | null =
        typeof groupParam === 'string' && groupParam && groupParam !== 'prod' ? groupParam : null;
      if (!name || !folder) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"name and folder required"}');
        return;
      }
      if (!/^[A-Za-z0-9][A-Za-z0-9_-]{0,63}$/.test(folder)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"invalid folder name (alphanumeric, hyphens, underscores, 1-64 chars)"}');
        return;
      }
      // Reserved folders that collide with system namespaces. 'main' is reserved
      // except for the first-admin bootstrap (when no admin exists yet).
      // Mirrors RESERVED_FOLDERS + ADMIN_ONLY_FOLDERS in src/group-folder.ts —
      // dashboard can't cross the tsc boundary, so the authoritative list is
      // duplicated here and in sanitizeImportedFolder().
      {
        const hasAdmin = getWriteDb()?.prepare('SELECT 1 FROM agent_groups WHERE is_admin = 1 LIMIT 1').get();
        const lower = folder.toLowerCase();
        const reserved = new Set(['global', 'shared', 'templates']);
        if (reserved.has(lower) || (lower === 'main' && hasAdmin)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"reserved folder name"}');
          return;
        }
      }
      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"db unavailable"}');
        return;
      }
      const existing = wdb.prepare('SELECT id FROM agent_groups WHERE folder = ?').get(folder);
      if (existing) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end('{"error":"coworker already exists with this folder or JID"}');
        return;
      }

      // Resolve coworkerType: single type, or composite (`a+b`) from multiple.
      // The lego composer splits on `+` natively in resolveCoworkerManifest
      // (src/claude-composer/resolve.ts), so a composite is just a type-name
      // string — no need to persist a synthetic entry. The pre-lego path
      // here used to write a legacy template/focusFiles/extends dict to
      // coworker-types.json, which the composer never read — dead write
      // that could leave the dashboard display out of sync with what the
      // runner actually composed.
      const selectedTypes: string[] = types || (type ? [type] : []);
      let coworkerType: string | null = null;
      if (selectedTypes.length >= 1) {
        coworkerType = selectedTypes.join('+');
      }

      const groupDir = join(getGroupsDir(), folder);
      mkdirSync(groupDir, { recursive: true });
      const triggerCandidate = trigger || `@${name.replace(/\s+/g, '')}`;
      const triggerPattern = getUniqueTrigger(wdb, triggerCandidate);
      const now = new Date().toISOString();
      // Resolve MCP tools from coworker type
      const allTypesNow = getCoworkerTypes();
      const resolvedMcpTools =
        coworkerType && allTypesNow[coworkerType]?.allowedMcpTools
          ? JSON.stringify(allTypesNow[coworkerType].allowedMcpTools)
          : null;
      const agId = `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const hasAdmin = wdb.prepare('SELECT 1 FROM agent_groups WHERE is_admin = 1 LIMIT 1').get();
      const isAdmin = hasAdmin ? 0 : 1;
      if (!coworkerType) coworkerType = isAdmin ? 'main' : 'default';
      // Privilege guard: coworker_type='main' must never be assigned to a
      // non-admin group. Admin = the one-per-install orchestrator row;
      // non-admin groups that claim 'main' would trigger Main-only runtime
      // privileges in container-runner.
      if (coworkerType === 'main' && !isAdmin) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"coworker_type=main is reserved for the admin orchestrator"}');
        return;
      }
      let resolvedOverlays: string | null = null;
      if (Array.isArray(overlaysParam) && overlaysParam.length > 0) {
        const { readSkillCatalog } = await import('../src/claude-composer.js');
        const catalog = readSkillCatalog(getProjectRoot());
        const invalid = overlaysParam.filter((n: string) => {
          const entry = catalog[n];
          return !entry || entry.type !== 'overlay';
        });
        if (invalid.length > 0) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Unknown overlay(s): ${invalid.join(', ')}` }));
          return;
        }
        resolvedOverlays = JSON.stringify(overlaysParam);
      }
      wdb
        .prepare(
          'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, overlays, routing, created_at, sidebar_group) VALUES (?, ?, ?, ?, ?, NULL, ?, ?, ?, ?, ?, ?)',
        )
        .run(
          agId,
          name,
          folder,
          isAdmin,
          agentProvider || null,
          coworkerType,
          resolvedMcpTools,
          resolvedOverlays,
          routing,
          now,
          sidebarGroup,
        );

      // Look up admin's dashboard messaging group up-front (no insert yet —
      // ensureDashboardChatWiring's fallback path looks for "any dashboard
      // mg this agent is already a member of," and inserting into the admin
      // mg first would make it pick that up instead of creating an own tab).
      const adminMg = wdb
        .prepare(
          `SELECT mg.id FROM messaging_groups mg
           JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id
           JOIN agent_groups ag ON mga.agent_group_id = ag.id
           WHERE ag.is_admin = 1 AND mg.channel_type = 'dashboard' LIMIT 1`,
        )
        .get() as { id: string } | undefined;

      if (routing === 'direct') {
        const { messagingGroupId } = ensureDashboardChatWiring(wdb, { id: agId, folder, name }, triggerPattern, now);
        bootstrapEagerSession(wdb, agId, messagingGroupId, now);
      }

      // Admin-group binding: every new non-admin coworker is reachable from
      // the admin (orchestrator) via @<name> mention. Without this, the admin
      // can't discover the new coworker as a destination — `direct` routing
      // alone gives the coworker its own dashboard tab but leaves it invisible
      // to peers, breaking handoff flows like Triager → Fixer → Reviewer.
      // Both `direct` and `internal` routings get the admin binding; only
      // `direct` additionally gets its own dashboard tab (handled above).
      if (adminMg && !isAdmin) {
        const existingMga = wdb
          .prepare('SELECT 1 FROM messaging_group_agents WHERE messaging_group_id = ? AND agent_group_id = ? LIMIT 1')
          .get(adminMg.id, agId);
        if (!existingMga) {
          wdb
            .prepare(
              "INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, session_mode, priority, created_at) VALUES (?, ?, ?, 'pattern', ?, 'all', 'shared', 0, ?)",
            )
            .run(
              `mga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
              adminMg.id,
              agId,
              `@${normalizeDestinationName(name)}\\b`,
              now,
            );
        }
        if (routing !== 'direct') {
          // Internal routing: no own dashboard tab, session lives in admin mg.
          bootstrapEagerSession(wdb, agId, adminMg.id, now);
        }
      }

      // Grant dashboard-admin the owner role so strict sender policy works
      if (isAdmin) {
        const dashUserId = 'dashboard:dashboard-admin';
        try {
          wdb
            .prepare(
              "INSERT OR IGNORE INTO users (id, kind, display_name, created_at) VALUES ('system', 'system', 'System', ?)",
            )
            .run(now);
          wdb
            .prepare(
              "INSERT OR IGNORE INTO users (id, kind, display_name, created_at) VALUES (?, 'dashboard', 'Dashboard Admin', ?)",
            )
            .run(dashUserId, now);
          wdb
            .prepare(
              "INSERT OR IGNORE INTO user_roles (user_id, role, agent_group_id, granted_by, granted_at) VALUES (?, 'owner', NULL, 'system', ?)",
            )
            .run(dashUserId, now);
        } catch {
          /* tables may not exist if permissions module not installed */
        }
      }

      // Wire parent↔child agent destinations (same as delivery.ts create_agent)
      const adminGroup = wdb.prepare('SELECT id, name, folder FROM agent_groups WHERE is_admin = 1 LIMIT 1').get() as
        | { id: string; name: string; folder: string }
        | undefined;
      if (adminGroup) {
        const localName = normalizeDestinationName(name);
        const existingAdminDest = wdb
          .prepare(
            "SELECT 1 FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'agent' AND target_id = ? LIMIT 1",
          )
          .get(adminGroup.id, agId);
        if (!existingAdminDest) {
          const destName = allocateDestinationNameDb(wdb, adminGroup.id, localName);
          wdb
            .prepare(
              "INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id, created_at) VALUES (?, ?, 'agent', ?, ?)",
            )
            .run(adminGroup.id, destName, agId, now);
        }
        const existingParentDest = wdb
          .prepare(
            "SELECT 1 FROM agent_destinations WHERE agent_group_id = ? AND target_type = 'agent' AND target_id = ? LIMIT 1",
          )
          .get(agId, adminGroup.id);
        if (!existingParentDest) {
          const parentName = allocateDestinationNameDb(wdb, agId, 'parent');
          wdb
            .prepare(
              "INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id, created_at) VALUES (?, ?, 'agent', ?, ?)",
            )
            .run(agId, parentName, adminGroup.id, now);
        }

        // Project the new destinations into any already-running parent
        // container's inbound.db so the orchestrator sees the new coworker
        // without a restart. See invariant in db/agent-destinations.ts.
        refreshRunningSessions(adminGroup.id);
        refreshRunningSessions(agId);
      }

      // Write .instructions.md if provided (CLAUDE.md is system-composed on wake)
      if (instructions && typeof instructions === 'string' && instructions.trim()) {
        mkdirSync(groupDir, { recursive: true });
        writeFileSync(join(groupDir, '.instructions.md'), instructions.trim() + '\n');
      }
      // Preserve which instruction overlay was used (for export portability)
      if (instructionTemplate && typeof instructionTemplate === 'string') {
        mkdirSync(groupDir, { recursive: true });
        writeFileSync(join(groupDir, '.instruction-meta.json'), JSON.stringify({ template: instructionTemplate }));
      }
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, id: agId, folder, name, trigger: triggerPattern }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: update coworker
  if (req.method === 'PUT' && /^\/api\/coworkers\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', ''));
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const updates = JSON.parse(body);
      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"db unavailable"}');
        return;
      }
      const existing = wdb.prepare('SELECT * FROM agent_groups WHERE folder = ?').get(folder) as any;
      if (!existing) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"coworker not found"}');
        return;
      }
      if (updates.name) {
        wdb.prepare('UPDATE agent_groups SET name = ? WHERE folder = ?').run(updates.name, folder);
      }
      // v2: trigger_pattern is in messaging_group_agents.engage_pattern, not agent_groups
      // Updating triggers from dashboard is deferred — use the host's manage-channels flow
      if (updates.container_config !== undefined) {
        wdb
          .prepare('UPDATE agent_groups SET container_config = ? WHERE folder = ?')
          .run(updates.container_config ? JSON.stringify(updates.container_config) : null, folder);
      }
      if (updates.overlays !== undefined) {
        if (Array.isArray(updates.overlays)) {
          // Validate overlay names against catalog
          const { readSkillCatalog } = await import('../src/claude-composer.js');
          const catalog = readSkillCatalog(getProjectRoot());
          const invalid = updates.overlays.filter((n: string) => {
            const entry = catalog[n];
            return !entry || entry.type !== 'overlay';
          });
          if (invalid.length > 0) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: `Unknown overlay(s): ${invalid.join(', ')}` }));
            return;
          }
        }
        const val =
          Array.isArray(updates.overlays) && updates.overlays.length > 0 ? JSON.stringify(updates.overlays) : null;
        wdb.prepare('UPDATE agent_groups SET overlays = ? WHERE folder = ?').run(val, folder);
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: get container name for shell exec.
  //
  // Accepts optional `?thread_id=<id>` to scope to a specific session when
  // the coworker has multiple concurrent sessions (root + Slack-style
  // threads). Empty / missing `thread_id` resolves to the coworker's root
  // session. Missing / empty thread_id keeps the legacy folder-only fallback
  // for pre-threading installs. A non-empty thread_id fails closed when it
  // cannot resolve an exact session/container, so Shell never lands in the
  // root or another thread by accident.
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/container$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/container', ''));
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }
    const threadIdRaw = url.searchParams.get('thread_id');
    const threadId = threadIdRaw && threadIdRaw.trim() !== '' ? threadIdRaw.trim() : null;
    const hasExplicitThread = threadId !== null;
    const sessDb = getHookEventsDb();
    const sessionId = sessDb ? sessionIdForThread(sessDb, folder, threadId) : null;
    const found = findRunningContainerForRequest(folder, sessionId, hasExplicitThread);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({
        running: !!found,
        container: found,
        session_id: sessionId,
        thread_id: threadId,
        execCommand: found ? `docker exec -it ${found} bash` : null,
      }),
    );
    return;
  }

  // API: execute command in container.
  // Guarded by requireAuth (not strict): open on localhost when no
  // DASHBOARD_SECRET is set, secret-gated otherwise. Mirrors every other
  // dashboard endpoint — operator picks the posture via the env var rather
  // than having exec permanently blocked behind a mandatory secret.
  if (req.method === 'POST' && /^\/api\/coworkers\/[^/]+\/exec$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/exec', ''));
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const parsedBody = JSON.parse(body) as { command?: unknown; thread_id?: unknown };
      const { command, thread_id: threadIdRaw } = parsedBody;
      if (!command || typeof command !== 'string') {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"command required"}');
        return;
      }
      // Session-aware exec: optional `thread_id` in the POST body picks the
      // session whose container to exec into. Default (null / missing) =
      // root session. A non-empty thread_id fails closed if it cannot resolve
      // an exact running container; do not fall back to the folder-level match
      // because that can exec into root or a different thread.
      const threadId = typeof threadIdRaw === 'string' && threadIdRaw.trim() !== '' ? threadIdRaw.trim() : null;
      const hasExplicitThread = threadId !== null;
      const sessDb = getHookEventsDb();
      const sessionId = sessDb ? sessionIdForThread(sessDb, folder, threadId) : null;
      const found = findRunningContainerForRequest(folder, sessionId, hasExplicitThread);
      if (!found) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: sessionId || hasExplicitThread ? 'session has no running container' : 'no running container',
            action: sessionId || hasExplicitThread ? 'send_message_to_wake' : undefined,
            session_id: sessionId,
            thread_id: threadId,
          }),
        );
        return;
      }
      // Execute command (timeout 10s, max 64KB output)
      execFile(
        CONTAINER_RUNTIME_BIN,
        containerExecArgs(found, command),
        { timeout: 10000, maxBuffer: 65536, encoding: 'utf8' },
        (err, stdout, stderr) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(
            JSON.stringify({
              exitCode: err?.code || 0,
              stdout: stdout?.slice(0, 32768) || '',
              stderr: stderr?.slice(0, 8192) || '',
            }),
          );
        },
      );
    } catch (e: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: export coworker as YAML bundle
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/export$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/export', ''));
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }
    const rdb = getHookEventsDb();
    if (!rdb) {
      res.writeHead(500);
      res.end('{"error":"db unavailable"}');
      return;
    }

    const group = rdb.prepare('SELECT * FROM agent_groups WHERE folder = ?').get(folder) as any;
    if (!group) {
      res.writeHead(404);
      res.end('{"error":"coworker not found"}');
      return;
    }

    // Export mode: lightweight | standard | full
    //   lightweight — metadata only (version, agent, requires, trigger, destinations,
    //                 instructionTemplate). New instance rehydrates identity/invariants/
    //                 context/workflows/skills from its coworker type. Smallest bundle.
    //   standard    — lightweight + .instructions.md + memory snapshot. Preserves
    //                 user-specific overlay and agent memory. Default.
    //   full        — standard + full tar.gz archive of group dir, claude-shared, and
    //                 session DBs. Used for cross-instance migration/backup.
    // Backwards-compat: ?full=true maps to mode=full.
    const rawMode = url.searchParams.get('mode');
    const mode: 'lightweight' | 'standard' | 'full' =
      rawMode === 'lightweight' || rawMode === 'standard' || rawMode === 'full'
        ? rawMode
        : url.searchParams.get('full') === 'true'
          ? 'full'
          : 'standard';
    const includeInstructions = mode !== 'lightweight';
    const includeMemory = mode !== 'lightweight';

    // .instructions.md (user-owned instructions) — only read if needed
    let instructions = '';
    if (includeInstructions) {
      try {
        instructions = readFileSync(join(getGroupsDir(), folder, '.instructions.md'), 'utf-8');
      } catch {
        /* none */
      }
    }

    // Resolve trigger from messaging_group_agents
    let trigger = `@${group.name.replace(/\s+/g, '')}`;
    try {
      const mgaRow = rdb
        .prepare(
          'SELECT mga.engage_mode, mga.engage_pattern FROM messaging_group_agents mga JOIN messaging_groups mg ON mg.id = mga.messaging_group_id WHERE mga.agent_group_id = ? LIMIT 1',
        )
        .get(group.id) as any;
      if (mgaRow?.engage_mode === 'pattern' && mgaRow?.engage_pattern) {
        trigger = mgaRow.engage_pattern;
      }
    } catch {
      /* use default */
    }

    // Destinations
    const destinations: {
      name: string;
      type: string;
      targetFolder?: string;
      channelType?: string;
      platformId?: string;
    }[] = [];
    try {
      const destRows = rdb.prepare('SELECT * FROM agent_destinations WHERE agent_group_id = ?').all(group.id) as any[];
      for (const d of destRows) {
        if (d.target_type === 'agent') {
          const targetAg = rdb.prepare('SELECT folder FROM agent_groups WHERE id = ?').get(d.target_id) as any;
          destinations.push({ name: d.local_name, type: 'agent', targetFolder: targetAg?.folder || d.target_id });
        } else if (d.target_type === 'channel') {
          const mg = rdb
            .prepare('SELECT channel_type, platform_id FROM messaging_groups WHERE id = ?')
            .get(d.target_id) as any;
          destinations.push({
            name: d.local_name,
            type: 'channel',
            channelType: mg?.channel_type,
            platformId: mg?.platform_id,
          });
        }
      }
    } catch {
      /* no destinations */
    }

    // Export only config files needed to reconstruct the coworker.
    // Runtime artifacts (cloned repos, compiled binaries, installed tools) are
    // rebuilt by the agent after import — they don't belong in the export.
    const groupDir = join(getGroupsDir(), folder);

    // Collect compatibility requirements so the target instance can validate
    const requires: Record<string, unknown> = {};
    if (group.coworker_type) {
      const rootTypes = group.coworker_type
        .split('+')
        .map((t: string) => t.trim())
        .filter(Boolean);
      const typesData = readLegoCoworkerTypes();
      const allRequired = new Set<string>();
      const walk = (name: string | undefined): void => {
        if (!name || allRequired.has(name)) return;
        allRequired.add(name);
        const ext = typesData[name]?.extends;
        if (Array.isArray(ext)) ext.forEach(walk);
        else walk(ext);
      };
      rootTypes.forEach(walk);
      requires.coworkerTypes = allRequired.size > 0 ? [...allRequired] : rootTypes;
    }

    // Agent memory files — read from group-level memory dir (persists across sessions)
    // and fall back to Claude Code auto-memory in the session dir.
    const memoryFiles: Record<string, string> = {};
    if (includeMemory) {
      const memDirs = [
        join(getGroupsDir(), folder, 'memory'),
        join(getDataDir(), 'v2-sessions', group.id, '.claude-shared', 'projects', '-workspace-agent', 'memory'),
      ];
      for (const memDir of memDirs) {
        try {
          for (const f of readdirSync(memDir)) {
            if (!f.endsWith('.md') || memoryFiles[f]) continue;
            memoryFiles[f] = readFileSync(join(memDir, f), 'utf-8');
          }
        } catch {
          /* no memory dir or files */
        }
      }
    }

    // Shared agent metadata for both lightweight and full-archive exports
    const agentMeta = {
      name: group.name,
      folder: group.folder,
      coworkerType: group.coworker_type || null,
      routing: group.routing || 'direct',
      allowedMcpTools: group.allowed_mcp_tools ? JSON.parse(group.allowed_mcp_tools) : null,
      agentProvider: group.agent_provider || null,
      containerConfig: group.container_config ? JSON.parse(group.container_config) : null,
    };
    const instructionTemplate = (() => {
      try {
        const meta = JSON.parse(readFileSync(join(getGroupsDir(), folder, '.instruction-meta.json'), 'utf-8'));
        return meta.template || null;
      } catch {
        return null;
      }
    })();

    // ---- Full-archive export (mode=full) ----
    if (mode === 'full') {
      try {
        const tarStream = await import('tar-stream');
        const pack = tarStream.pack();

        // Collect all files
        const groupFiles = collectGroupFiles(groupDir);
        const claudeSharedFiles = collectClaudeShared(group.id);
        const { files: sessionDbFiles, sessionIds } = collectSessionDbFiles(group.id);
        const scheduledTasks = extractScheduledTasks(group.id, sessionIds);

        // Session rows from v2.db
        const sessionRows = rdb.prepare('SELECT * FROM sessions WHERE agent_group_id = ?').all(group.id) as any[];

        // Build v4 manifest
        const manifest: Record<string, unknown> = {
          version: 4,
          archiveFormat: 'full',
          exportedAt: new Date().toISOString(),
          sourceInstance: process.env.CONTAINER_PREFIX || 'unknown',
          requires: Object.keys(requires).length > 0 ? requires : null,
          agent: agentMeta,
          instructions: instructions || null,
          instructionTemplate,
          trigger,
          destinations: destinations.length > 0 ? destinations : null,
          sessions: sessionRows.map((s: any) => ({
            origId: s.id,
            status: s.status,
            agentProvider: s.agent_provider || null,
          })),
          scheduledTasks: scheduledTasks.map((t) => ({
            origId: t.origId,
            sessionId: t.sessionId,
            recurrence: t.recurrence,
            processAfter: t.processAfter,
            content: t.content,
            importStatus: 'paused',
          })),
          memory: Object.keys(memoryFiles).length > 0 ? memoryFiles : null,
        };

        // Write manifest
        const jsYaml = await import('js-yaml');
        const manifestYaml = jsYaml.dump(manifest, { lineWidth: 120, noRefs: true });
        pack.entry({ name: 'manifest.yaml' }, manifestYaml);

        // Write group-files/
        for (const [rel, abs] of groupFiles) {
          const data = readFileSync(abs);
          pack.entry({ name: `group-files/${rel}`, size: data.length }, data);
        }

        // Write claude-shared/
        for (const [rel, abs] of claudeSharedFiles) {
          const data = readFileSync(abs);
          pack.entry({ name: `claude-shared/${rel}`, size: data.length }, data);
        }

        // Write sessions/
        for (const [rel, abs] of sessionDbFiles) {
          const data = readFileSync(abs);
          pack.entry({ name: rel, size: data.length }, data);
        }

        pack.finalize();

        // Collect the gzipped archive into a buffer and write to disk
        const gzip = createGzip();
        const chunks: Buffer[] = [];
        await new Promise<void>((resolve, reject) => {
          pack
            .pipe(gzip)
            .on('data', (chunk: Buffer) => chunks.push(chunk))
            .on('end', resolve)
            .on('error', reject);
        });
        const archiveData = Buffer.concat(chunks);

        const exportsDir = join(getDataDir(), 'exports');
        mkdirSync(exportsDir, { recursive: true });
        const filename = `agent-${folder}-${new Date().toISOString().split('T')[0]}-full.tar.gz`;
        const exportPath = join(exportsDir, filename);
        writeFileSync(exportPath, archiveData);

        // Optionally pause source tasks
        let pausedTasks = false;
        let pausedChanges = 0;
        if (url.searchParams.get('pauseTasks') === 'true') {
          for (const sessId of sessionIds) {
            const dbPath = join(getDataDir(), 'v2-sessions', group.id, sessId, 'inbound.db');
            if (!existsSync(dbPath)) continue;
            let sdb: Database | null = null;
            try {
              sdb = new Database(dbPath);
              sdb.pragma('journal_mode = DELETE');
              sdb.pragma('busy_timeout = 5000');
              const info = sdb
                .prepare("UPDATE messages_in SET status = 'paused' WHERE kind = 'task' AND status = 'pending'")
                .run();
              pausedChanges += info.changes;
              pausedTasks = true;
            } catch {
              /* best-effort */
            } finally {
              try {
                sdb?.close();
              } catch {
                /* */
              }
            }
          }
          // Any newly-paused row invalidates this group's memoized task snapshot
          // so getState / /api/overview stop reporting the paused tasks as active
          // until the next background refresh; the state cache is bumped too so
          // live consumers repaint promptly.
          if (pausedChanges > 0) {
            groupTaskCache.delete(group.id);
            invalidateStateCache();
          }
        }

        // Also generate YAML bundle pointing at the archive and write to coworkers/
        const yamlBundle: Record<string, unknown> = {
          version: 3,
          exportedAt: new Date().toISOString(),
          requires: Object.keys(requires).length > 0 ? requires : null,
          agent: agentMeta,
          instructions: instructions || null,
          instructionTemplate,
          trigger,
          destinations: destinations.length > 0 ? destinations : null,
          memory: Object.keys(memoryFiles).length > 0 ? memoryFiles : null,
          archive: exportPath,
        };
        let yamlPath: string | undefined;
        try {
          const jsYaml2 = await import('js-yaml');
          const yamlContent = jsYaml2.dump(yamlBundle, { lineWidth: 120, noRefs: true });
          const coworkersDir = join(getProjectRoot(), 'coworkers');
          mkdirSync(coworkersDir, { recursive: true });
          yamlPath = join(coworkersDir, `${folder}.yaml`);
          writeFileSync(yamlPath, yamlContent);
        } catch {
          /* best-effort */
        }

        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, path: exportPath, yamlPath, size: archiveData.length, pausedTasks }));
      } catch (archiveErr: any) {
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Full archive export failed: ${archiveErr.message}` }));
        }
      }
      return;
    }

    // ---- YAML export (lightweight / standard) ----
    // lightweight: metadata only — re-instantiates from the local lego registry.
    // standard:    lightweight + .instructions.md overlay + agent memory snapshot.
    const { sessionIds: lightSessionIds } = collectSessionDbFiles(group.id);
    const lightScheduledTasks = extractScheduledTasks(group.id, lightSessionIds);
    const bundle: Record<string, unknown> = {
      version: 3,
      exportedAt: new Date().toISOString(),
      mode,
      requires: Object.keys(requires).length > 0 ? requires : null,
      agent: agentMeta,
      instructionTemplate,
      trigger,
      destinations: destinations.length > 0 ? destinations : null,
      scheduledTasks:
        lightScheduledTasks.length > 0
          ? lightScheduledTasks.map((t) => ({
              recurrence: t.recurrence,
              processAfter: t.processAfter,
              content: t.content,
            }))
          : null,
    };
    if (includeInstructions) bundle.instructions = instructions || null;
    if (includeMemory) bundle.memory = Object.keys(memoryFiles).length > 0 ? memoryFiles : null;

    // Use js-yaml for YAML output
    let yamlContent: string;
    try {
      const jsYaml = await import('js-yaml');
      yamlContent = jsYaml.dump(bundle, { lineWidth: 120, noRefs: true });
    } catch {
      // Fallback to JSON if js-yaml not available
      yamlContent = JSON.stringify(bundle, null, 2);
    }

    // Write to both data/exports/ and coworkers/
    const exportsDir = join(getDataDir(), 'exports');
    mkdirSync(exportsDir, { recursive: true });
    const filename = `agent-${folder}-${new Date().toISOString().split('T')[0]}.yaml`;
    const exportPath = join(exportsDir, filename);
    writeFileSync(exportPath, yamlContent);

    const coworkersDir = join(getProjectRoot(), 'coworkers');
    mkdirSync(coworkersDir, { recursive: true });
    const coworkerYamlPath = join(coworkersDir, `${folder}.yaml`);
    writeFileSync(coworkerYamlPath, yamlContent);

    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(
      JSON.stringify({ ok: true, path: exportPath, yamlPath: coworkerYamlPath, size: Buffer.byteLength(yamlContent) }),
    );
    return;
  }

  // API: import coworker from YAML, JSON, or full archive (transactional)
  if (req.method === 'POST' && url.pathname === '/api/coworkers/import') {
    if (!requireAuth(req, res)) return;

    // Detect binary archive by content-type
    const ct = req.headers['content-type'] || '';
    const isBinaryArchive =
      ct.includes('application/gzip') || ct.includes('application/x-gzip') || ct.includes('application/octet-stream');

    if (isBinaryArchive) {
      // ---- Full-archive import ----
      const archiveBuf = await readBodyBinary(req, res);
      if (!archiveBuf) return;
      try {
        const { manifest, files } = await extractArchiveBuffer(archiveBuf);

        if (manifest.version !== 4 || manifest.archiveFormat !== 'full') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"Expected v4 full-archive manifest"}');
          return;
        }

        const agent = manifest.agent;
        if (!agent?.name || !agent?.folder) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"invalid archive — missing agent name/folder"}');
          return;
        }

        const wdb = getWriteDb();
        if (!wdb) {
          res.writeHead(500);
          res.end('{"error":"db unavailable"}');
          return;
        }

        const warnings: string[] = [];

        // Compatibility check: warn if required types are missing from the local lego registry
        if (manifest.requires?.coworkerTypes) {
          const localTypes = readLegoCoworkerTypes();
          for (const t of manifest.requires.coworkerTypes) {
            if (!localTypes[t])
              warnings.push(
                `Missing coworker type: "${t}" — install its provider skill before this agent will compose correctly`,
              );
          }
        }

        const triggerCandidate = manifest.trigger || `@${agent.name.replace(/\s+/g, '')}`;
        const trigger = getUniqueTrigger(wdb, triggerCandidate);
        let folder = sanitizeImportedFolder(agent.folder);
        {
          // Unique folder allocator
          const baseFolder = folder;
          let suffix = 2;
          while (wdb.prepare('SELECT 1 FROM agent_groups WHERE folder = ?').get(folder)) {
            folder = `${baseFolder}-${suffix}`;
            suffix++;
          }
        }

        const now = new Date().toISOString();
        const newAgId = `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

        // Build session ID map
        const sessionMap = new Map<string, string>(); // origId → newId
        const manifestSessions: any[] = manifest.sessions || [];
        for (const s of manifestSessions) {
          const newSessId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          sessionMap.set(s.origId, newSessId);
        }

        // 1. Back up target v2.db before merge
        const dbPath = getDbPath();
        const backupPath = `${dbPath}.backup-${Date.now()}`;
        try {
          copyFileSync(dbPath, backupPath);
        } catch (e: any) {
          warnings.push(`DB backup failed: ${e.message} — proceeding without backup`);
        }

        // 2. Stage group-files
        const groupDir = join(getGroupsDir(), folder);
        const stagingDir = join(getDataDir(), 'v2-import-staging', newAgId);
        try {
          mkdirSync(stagingDir, { recursive: true });
          for (const [archivePath, buf] of files) {
            if (!archivePath.startsWith('group-files/')) continue;
            const rel = archivePath.slice('group-files/'.length);
            if (!rel) continue;
            // Defense in depth: reject absolute paths, `..`, and anything
            // that normalizes to a destination outside stagingDir. A bare
            // `.includes('..')` missed things like `foo/../../etc/passwd`
            // after join resolves the segments.
            const dst = join(stagingDir, rel);
            if (isAbsolute(rel) || !isInsideDir(stagingDir, dst)) {
              warnings.push(`rejected archive entry escaping staging dir: ${archivePath}`);
              continue;
            }
            mkdirSync(dirname(dst), { recursive: true });
            writeFileSync(dst, buf);
          }
        } catch (fsErr: any) {
          try {
            rmSync(stagingDir, { recursive: true, force: true });
          } catch {
            /* */
          }
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Import staging failed: ${fsErr.message}` }));
          return;
        }

        // 3. Copy claude-shared
        const claudeSharedDir = join(getDataDir(), 'v2-sessions', newAgId, '.claude-shared');
        try {
          for (const [archivePath, buf] of files) {
            if (!archivePath.startsWith('claude-shared/')) continue;
            const rel = archivePath.slice('claude-shared/'.length);
            if (!rel) continue;
            const dst = join(claudeSharedDir, rel);
            if (isAbsolute(rel) || !isInsideDir(claudeSharedDir, dst)) {
              warnings.push(`rejected archive entry escaping claude-shared dir: ${archivePath}`);
              continue;
            }
            mkdirSync(dirname(dst), { recursive: true });
            writeFileSync(dst, buf);
          }
        } catch (csErr: any) {
          warnings.push(`Claude shared restore partial: ${csErr.message}`);
        }

        // 4. Copy session DBs with ID remapping + patch tasks to paused
        const isV1Source = manifest.sourceFormat === 'v1';
        let sessionsRestored = 0;
        let tasksImported = 0;

        if (isV1Source) {
          // V1 → V2: bootstrap session DBs from scratch
          for (const [origId, newId] of sessionMap) {
            const sessDir = join(getDataDir(), 'v2-sessions', newAgId, newId);
            mkdirSync(sessDir, { recursive: true });

            const ms = manifestSessions.find((s: any) => s.origId === origId);
            const v1SessionId = ms?.v1SessionId || null;

            // Create inbound.db with schema
            const inDbPath = join(sessDir, 'inbound.db');
            let inDb: Database | null = null;
            try {
              inDb = new Database(inDbPath);
              inDb.pragma('journal_mode = DELETE');
              inDb.exec(V2_INBOUND_SCHEMA);

              // Insert v1 scheduled tasks as messages_in rows (paused)
              if (Array.isArray(manifest.scheduledTasks)) {
                let seq = 2; // even seq for host-written
                for (const task of manifest.scheduledTasks) {
                  inDb
                    .prepare(
                      `INSERT INTO messages_in (id, seq, kind, timestamp, status, process_after, recurrence, content)
                     VALUES (?, ?, 'task', ?, 'paused', ?, ?, ?)`,
                    )
                    .run(
                      task.origId,
                      seq,
                      now,
                      toSqliteDatetime(task.processAfter),
                      task.recurrence || null,
                      typeof task.content === 'string' ? task.content : JSON.stringify(task.content),
                    );
                  seq += 2;
                  tasksImported++;
                }
              }
            } catch {
              /* best effort */
            } finally {
              try {
                inDb?.close();
              } catch {
                /* */
              }
            }

            // Create outbound.db with schema + session_state (for session resume)
            const outDbPath = join(sessDir, 'outbound.db');
            let outDb: Database | null = null;
            try {
              outDb = new Database(outDbPath);
              outDb.pragma('journal_mode = DELETE');
              outDb.exec(V2_OUTBOUND_SCHEMA);

              if (v1SessionId) {
                outDb
                  .prepare("INSERT INTO session_state (key, value, updated_at) VALUES ('claude_sdk_session_id', ?, ?)")
                  .run(v1SessionId, now);
              }
            } catch {
              /* best effort */
            } finally {
              try {
                outDb?.close();
              } catch {
                /* */
              }
            }

            // Backfill v1 chat messages from the central messages table.
            // This is the canonical source — v1 stores all chat history in
            // store/messages.db, keyed by chat_jid.
            const chatMsgs = Array.isArray(manifest.chatMessages) ? manifest.chatMessages : [];
            if (chatMsgs.length > 0) {
              const chatIn = chatMsgs.filter((m: any) => m.isFromMe === 0 && !m.isBotMessage);
              const chatOut = chatMsgs.filter((m: any) => m.isFromMe === 1 || m.isBotMessage === 1);
              let inDb2: Database | null = null;
              let outDb2: Database | null = null;
              try {
                inDb2 = new Database(inDbPath);
                inDb2.pragma('busy_timeout = 3000');
                const maxSeq = (inDb2.prepare('SELECT MAX(seq) as m FROM messages_in').get() as any)?.m || 0;
                let inSeq = maxSeq + 2;
                const inStmt = inDb2.prepare(
                  `INSERT OR IGNORE INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, 'chat', ?, 'completed', ?)`,
                );
                for (const msg of chatIn) {
                  const content = JSON.stringify({
                    text: msg.content,
                    sender: msg.sender || 'dashboard',
                    senderId: msg.sender || 'v1-import',
                  });
                  inStmt.run(msg.id, inSeq, msg.timestamp, content);
                  inSeq += 2;
                }
              } catch {
                /* best effort */
              } finally {
                try {
                  inDb2?.close();
                } catch {
                  /* */
                }
              }
              try {
                outDb2 = new Database(outDbPath);
                outDb2.pragma('busy_timeout = 3000');
                let outSeq = 1;
                const outStmt = outDb2.prepare(
                  `INSERT OR IGNORE INTO messages_out (id, seq, kind, timestamp, content) VALUES (?, ?, 'chat', ?, ?)`,
                );
                for (const msg of chatOut) {
                  outStmt.run(msg.id, outSeq, msg.timestamp, JSON.stringify({ text: msg.content }));
                  outSeq += 2;
                }
              } catch {
                /* best effort */
              } finally {
                try {
                  outDb2?.close();
                } catch {
                  /* */
                }
              }
            }

            sessionsRestored++;
          }
        } else {
          // V2 → V2: copy existing session DBs as-is
          for (const [origId, newId] of sessionMap) {
            const sessDir = join(getDataDir(), 'v2-sessions', newAgId, newId);
            mkdirSync(sessDir, { recursive: true });
            for (const dbFile of ['inbound.db', 'outbound.db']) {
              const archiveKey = `sessions/${origId}/${dbFile}`;
              const buf = files.get(archiveKey);
              if (buf) {
                writeFileSync(join(sessDir, dbFile), buf);
              }
            }
            // Patch tasks to paused in inbound.db
            const inDbPath = join(sessDir, 'inbound.db');
            if (existsSync(inDbPath)) {
              let sdb: Database | null = null;
              try {
                sdb = new Database(inDbPath);
                sdb.pragma('journal_mode = DELETE');
                sdb.pragma('busy_timeout = 5000');
                const taskCount = (
                  sdb
                    .prepare(
                      "SELECT COUNT(*) as c FROM messages_in WHERE kind = 'task' AND status IN ('pending', 'paused')",
                    )
                    .get() as any
                ).c;
                tasksImported += taskCount;
                sdb
                  .prepare("UPDATE messages_in SET status = 'paused' WHERE kind = 'task' AND status = 'pending'")
                  .run();
              } catch {
                /* DB may not have schema yet */
              } finally {
                try {
                  sdb?.close();
                } catch {
                  /* */
                }
              }
            }
            sessionsRestored++;
          }
        }

        // 5. DB transaction — insert agent group + sessions + wiring
        let destsCreated = 0;
        const unresolvedDests: string[] = [];
        const resolvedDests: { name: string; type: string; resolvedTo: string }[] = [];
        try {
          wdb.exec('BEGIN TRANSACTION');
          const importRouting: 'direct' | 'internal' = agent.routing === 'internal' ? 'internal' : 'direct';
          // Privilege guard: never import a non-admin group with coworker_type='main'.
          const importedType = agent.coworkerType === 'main' ? null : agent.coworkerType;
          wdb
            .prepare(
              'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, routing, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)',
            )
            .run(
              newAgId,
              agent.name,
              folder,
              agent.agentProvider || null,
              agent.containerConfig ? JSON.stringify(agent.containerConfig) : null,
              importedType || null,
              agent.allowedMcpTools ? JSON.stringify(agent.allowedMcpTools) : null,
              importRouting,
              now,
            );

          // Insert session rows
          for (const ms of manifestSessions) {
            const newSessId = sessionMap.get(ms.origId)!;
            wdb
              .prepare(
                'INSERT INTO sessions (id, agent_group_id, status, agent_provider, container_status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
              )
              .run(
                newSessId,
                newAgId,
                ms.status || 'active',
                ms.agentProvider || agent.agentProvider || null,
                'stopped',
                now,
              );
          }

          let importedMgId: string;
          if (importRouting === 'direct') {
            ({ messagingGroupId: importedMgId } = ensureDashboardChatWiring(
              wdb,
              { id: newAgId, folder, name: agent.name },
              trigger,
              now,
            ));
          } else {
            // Internal: wire into admin's channel
            const adminMgRow = wdb
              .prepare(
                `SELECT mg.id FROM messaging_groups mg JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id JOIN agent_groups ag ON mga.agent_group_id = ag.id WHERE ag.is_admin = 1 AND mg.channel_type = 'dashboard' LIMIT 1`,
              )
              .get() as { id: string } | undefined;
            importedMgId = adminMgRow?.id || '';
            if (adminMgRow) {
              const existingMga = wdb
                .prepare(
                  'SELECT 1 FROM messaging_group_agents WHERE messaging_group_id = ? AND agent_group_id = ? LIMIT 1',
                )
                .get(adminMgRow.id, newAgId);
              if (!existingMga) {
                wdb
                  .prepare(
                    "INSERT INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, session_mode, priority, created_at) VALUES (?, ?, ?, 'pattern', ?, 'all', 'shared', 0, ?)",
                  )
                  .run(
                    `mga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                    adminMgRow.id,
                    newAgId,
                    `@${normalizeDestinationName(agent.name)}\\b`,
                    now,
                  );
              }
            }
          }

          // Link restored sessions to the dashboard messaging group so they route correctly
          wdb
            .prepare(
              'UPDATE sessions SET messaging_group_id = ? WHERE agent_group_id = ? AND messaging_group_id IS NULL',
            )
            .run(importedMgId, newAgId);

          // Destinations — resolve by folder name
          if (Array.isArray(manifest.destinations)) {
            for (const dest of manifest.destinations) {
              if (!dest.name || !dest.type) continue;
              let targetId: string | null = null;
              let resolvedLabel = '';
              if (dest.type === 'agent' && dest.targetFolder) {
                const targetAg = wdb
                  .prepare('SELECT id, name FROM agent_groups WHERE folder = ?')
                  .get(dest.targetFolder) as any;
                targetId = targetAg?.id || null;
                if (targetAg) resolvedLabel = `${dest.targetFolder} (${targetAg.id})`;
              } else if (dest.type === 'channel' && dest.channelType && dest.platformId) {
                const mg = wdb
                  .prepare('SELECT id FROM messaging_groups WHERE channel_type = ? AND platform_id = ?')
                  .get(dest.channelType, dest.platformId) as any;
                targetId = mg?.id || null;
                if (mg) resolvedLabel = `${dest.channelType}:${dest.platformId}`;
              }
              if (targetId) {
                const existingByName = getDestinationByLocalNameDb(wdb, newAgId, dest.name);
                if (!existingByName) {
                  wdb
                    .prepare(
                      'INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)',
                    )
                    .run(newAgId, dest.name, dest.type, targetId, now);
                  destsCreated++;
                  resolvedDests.push({ name: dest.name, type: dest.type, resolvedTo: resolvedLabel });
                }
              } else {
                unresolvedDests.push(`${dest.name} (${dest.type}: ${dest.targetFolder || dest.platformId || '?'})`);
              }
            }
          }

          wdb.exec('COMMIT');
        } catch (dbErr: any) {
          try {
            wdb.exec('ROLLBACK');
          } catch {
            /* */
          }
          try {
            rmSync(stagingDir, { recursive: true, force: true });
          } catch {
            /* */
          }
          res.writeHead(500, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: `Import failed (DB): ${dbErr.message}` }));
          return;
        }

        // Project the imported destinations into any already-running
        // sessions of the newly-restored agent. See invariant in
        // db/agent-destinations.ts.
        refreshRunningSessions(newAgId);

        // 6. Move staged group-files to final location
        try {
          mkdirSync(groupDir, { recursive: true });
          const copyRecursive = (src: string, dst: string) => {
            for (const entry of readdirSync(src)) {
              const srcPath = join(src, entry);
              const dstPath = join(dst, entry);
              if (statSync(srcPath).isDirectory()) {
                mkdirSync(dstPath, { recursive: true });
                copyRecursive(srcPath, dstPath);
              } else {
                writeFileSync(dstPath, readFileSync(srcPath));
              }
            }
          };
          copyRecursive(stagingDir, groupDir);
          rmSync(stagingDir, { recursive: true, force: true });
        } catch (copyErr: any) {
          warnings.push(`File copy partial: ${copyErr.message}`);
        }

        postImportGroupInit(newAgId, folder, warnings, agent.containerConfig);

        for (const u of unresolvedDests) {
          warnings.push(`Unresolved destination: ${u}`);
        }

        res.writeHead(201, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            ok: true,
            folder,
            name: agent.name,
            id: newAgId,
            backupPath: existsSync(backupPath) ? backupPath : undefined,
            sessionsRestored,
            tasksImported,
            tasksPaused: true,
            destsCreated,
            resolvedDests: resolvedDests.length > 0 ? resolvedDests : undefined,
            warnings: warnings.length > 0 ? warnings : undefined,
          }),
        );
      } catch (e: any) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }

    // ---- Lightweight YAML/JSON import ----
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      let data: any;
      try {
        const jsYaml = await import('js-yaml');
        data = jsYaml.load(body);
      } catch {
        data = JSON.parse(body);
      }

      const isV3 = data.version === 3 && data.agent;
      const agent = isV3 ? data.agent : data.coworker;
      if (!agent?.name || !agent?.folder) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"invalid bundle — missing agent name/folder"}');
        return;
      }

      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500);
        res.end('{"error":"db unavailable"}');
        return;
      }

      // Compatibility check: warn if required types are missing from the local lego registry
      const warnings: string[] = [];
      if (isV3 && data.requires?.coworkerTypes) {
        const localTypes = readLegoCoworkerTypes();
        for (const t of data.requires.coworkerTypes) {
          if (!localTypes[t])
            warnings.push(
              `Missing coworker type: "${t}" — install its provider skill before this agent will compose correctly`,
            );
        }
      }

      const triggerCandidate = isV3
        ? data.trigger || `@${agent.name.replace(/\s+/g, '')}`
        : agent.trigger || `@${agent.name.replace(/\s+/g, '')}`;
      const trigger = getUniqueTrigger(wdb, triggerCandidate);
      let folder = sanitizeImportedFolder(agent.folder);
      // Unique folder allocator — suffix with -2, -3, etc. on collision
      {
        const baseFolder = folder;
        let suffix = 2;
        while (wdb.prepare('SELECT 1 FROM agent_groups WHERE folder = ?').get(folder)) {
          folder = `${baseFolder}-${suffix}`;
          suffix++;
        }
      }

      const now = new Date().toISOString();
      const agId = `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      const groupDir = join(getGroupsDir(), folder);
      let filesWritten = 0;
      let destsCreated = 0;
      const unresolvedDests: string[] = [];
      const resolvedDests: { name: string; type: string; resolvedTo: string }[] = [];

      // 4. Stage filesystem writes to temp dir BEFORE committing DB
      const stagingDir = join(getDataDir(), 'v2-import-staging', agId);
      try {
        mkdirSync(join(stagingDir, 'logs'), { recursive: true });

        // Write .instructions.md
        if (isV3 && data.instructions) {
          writeFileSync(join(stagingDir, '.instructions.md'), data.instructions);
        } else if (!isV3 && data.claudeMd && !agent.coworkerType) {
          writeFileSync(join(stagingDir, '.instructions.md'), data.claudeMd);
        }

        // Fix 2: Save legacy typed claudeMd as artifact for manual review
        if (!isV3 && data.claudeMd && agent.coworkerType) {
          writeFileSync(join(stagingDir, '.legacy-claude.md'), data.claudeMd);
          warnings.push('Legacy typed import: original CLAUDE.md saved as .legacy-claude.md for manual review');
        }

        // Fix 6: Save instruction template metadata if present
        if (isV3 && data.instructionTemplate) {
          writeFileSync(
            join(stagingDir, '.instruction-meta.json'),
            JSON.stringify({ template: data.instructionTemplate }),
          );
        }

        // Write files — reject any hidden path component (starts with .)
        const bundleFiles = data.files || {};
        for (const [relPath, content] of Object.entries(bundleFiles)) {
          if (!relPath) continue;
          // Reject any path component that starts with . (hidden files/dirs)
          const hasHiddenComponent = relPath.split('/').some((part) => part.startsWith('.'));
          if (hasHiddenComponent) {
            warnings.push(`Blocked file: "${relPath}" (hidden path component)`);
            continue;
          }
          const fullPath = join(stagingDir, relPath);
          // Normalize + contain within stagingDir. A bare `.includes('..')`
          // is both over- and under-broad: blocks valid filenames like
          // `release-notes-vs-..-prev.md` and misses `foo/../../escape`
          // after join() resolves segments.
          if (isAbsolute(relPath) || !isInsideDir(stagingDir, fullPath)) {
            warnings.push(`Blocked file: "${relPath}" (escapes staging dir)`);
            continue;
          }
          mkdirSync(join(fullPath, '..'), { recursive: true });
          writeFileSync(fullPath, content as string);
          filesWritten++;
        }
      } catch (fsErr: any) {
        // Staging failed → cleanup temp, return error (no DB changes yet)
        try {
          rmSync(stagingDir, { recursive: true, force: true });
        } catch {
          /* cleanup best-effort */
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Import failed (filesystem staging): ${fsErr.message}` }));
        return;
      }

      // 5. Staging succeeded → now commit DB transactionally
      try {
        wdb.exec('BEGIN TRANSACTION');
        const stdRouting: 'direct' | 'internal' = agent.routing === 'internal' ? 'internal' : 'direct';
        // Privilege guard: never import a non-admin group with coworker_type='main'.
        const safeType = agent.coworkerType === 'main' ? null : agent.coworkerType;
        wdb
          .prepare(
            'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, routing, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?, ?)',
          )
          .run(
            agId,
            agent.name,
            folder,
            agent.agentProvider || null,
            agent.containerConfig ? JSON.stringify(agent.containerConfig) : null,
            safeType || null,
            agent.allowedMcpTools ? JSON.stringify(agent.allowedMcpTools) : null,
            stdRouting,
            now,
          );
        if (stdRouting === 'direct') {
          ensureDashboardChatWiring(wdb, { id: agId, folder, name: agent.name }, trigger, now);
        } else {
          const adminMgRow = wdb
            .prepare(
              `SELECT mg.id FROM messaging_groups mg JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id JOIN agent_groups ag ON mga.agent_group_id = ag.id WHERE ag.is_admin = 1 AND mg.channel_type = 'dashboard' LIMIT 1`,
            )
            .get() as { id: string } | undefined;
          if (adminMgRow) {
            wdb
              .prepare(
                "INSERT OR IGNORE INTO messaging_group_agents (id, messaging_group_id, agent_group_id, engage_mode, engage_pattern, sender_scope, session_mode, priority, created_at) VALUES (?, ?, ?, 'pattern', ?, 'all', 'shared', 0, ?)",
              )
              .run(
                `mga-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
                adminMgRow.id,
                agId,
                `@${normalizeDestinationName(agent.name)}\\b`,
                now,
              );
          }
        }

        // Destinations
        if (isV3 && Array.isArray(data.destinations)) {
          for (const dest of data.destinations) {
            if (!dest.name || !dest.type) continue;
            let targetId: string | null = null;
            let resolvedLabel = '';
            if (dest.type === 'agent' && dest.targetFolder) {
              const targetAg = wdb
                .prepare('SELECT id, name FROM agent_groups WHERE folder = ?')
                .get(dest.targetFolder) as any;
              targetId = targetAg?.id || null;
              if (targetAg) resolvedLabel = `${dest.targetFolder} (${targetAg.id})`;
            } else if (dest.type === 'channel' && dest.channelType && dest.platformId) {
              const mg = wdb
                .prepare('SELECT id FROM messaging_groups WHERE channel_type = ? AND platform_id = ?')
                .get(dest.channelType, dest.platformId) as any;
              targetId = mg?.id || null;
              if (mg) resolvedLabel = `${dest.channelType}:${dest.platformId}`;
            }
            if (targetId) {
              const existingByName = getDestinationByLocalNameDb(wdb, agId, dest.name);
              if (existingByName) {
                if (existingByName.target_type === dest.type && existingByName.target_id === targetId) {
                  resolvedDests.push({ name: dest.name, type: dest.type, resolvedTo: resolvedLabel });
                } else {
                  const allocatedName = allocateDestinationNameDb(wdb, agId, dest.name);
                  wdb
                    .prepare(
                      'INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)',
                    )
                    .run(agId, allocatedName, dest.type, targetId, now);
                  destsCreated++;
                  resolvedDests.push({ name: allocatedName, type: dest.type, resolvedTo: resolvedLabel });
                  warnings.push(`Destination "${dest.name}" renamed to "${allocatedName}" to avoid name collision`);
                }
              } else {
                wdb
                  .prepare(
                    'INSERT INTO agent_destinations (agent_group_id, local_name, target_type, target_id, created_at) VALUES (?, ?, ?, ?, ?)',
                  )
                  .run(agId, dest.name, dest.type, targetId, now);
                destsCreated++;
                resolvedDests.push({ name: dest.name, type: dest.type, resolvedTo: resolvedLabel });
              }
            } else {
              unresolvedDests.push(`${dest.name} (${dest.type}: ${dest.targetFolder || dest.platformId || '?'})`);
            }
          }
        }

        wdb.exec('COMMIT');
      } catch (dbErr: any) {
        try {
          wdb.exec('ROLLBACK');
        } catch {
          /* already rolled back */
        }
        try {
          rmSync(stagingDir, { recursive: true, force: true });
        } catch {
          /* cleanup staged files */
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Import failed (DB): ${dbErr.message}` }));
        return;
      }

      // Project the imported destinations into any already-running
      // sessions of the newly-restored agent. See invariant in
      // db/agent-destinations.ts.
      refreshRunningSessions(agId);

      // 6. DB committed + files staged → copy to final location
      //    If copy fails, rollback DB rows and return error.
      try {
        mkdirSync(groupDir, { recursive: true });
        const copyRecursive = (src: string, dst: string) => {
          for (const entry of readdirSync(src)) {
            const srcPath = join(src, entry);
            const dstPath = join(dst, entry);
            if (statSync(srcPath).isDirectory()) {
              mkdirSync(dstPath, { recursive: true });
              copyRecursive(srcPath, dstPath);
            } else {
              writeFileSync(dstPath, readFileSync(srcPath));
            }
          }
        };
        copyRecursive(stagingDir, groupDir);
        rmSync(stagingDir, { recursive: true, force: true });
      } catch (copyErr: any) {
        // Copy failed → rollback DB rows so we don't leave a broken agent
        try {
          wdb.prepare('DELETE FROM agent_destinations WHERE agent_group_id = ?').run(agId);
          wdb.prepare('DELETE FROM messaging_group_agents WHERE agent_group_id = ?').run(agId);
          wdb
            .prepare("DELETE FROM messaging_groups WHERE channel_type = 'dashboard' AND platform_id = ?")
            .run(`dashboard:${folder}`);
          wdb.prepare('DELETE FROM agent_groups WHERE id = ?').run(agId);
        } catch {
          /* best-effort cleanup */
        }
        try {
          rmSync(stagingDir, { recursive: true, force: true });
        } catch {
          /* cleanup */
        }
        try {
          rmSync(groupDir, { recursive: true, force: true });
        } catch {
          /* cleanup */
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Import failed (file copy): ${copyErr.message}` }));
        return;
      }

      postImportGroupInit(agId, folder, warnings, agent.containerConfig);

      // 7. Restore agent memory files if present in the bundle
      let memoriesRestored = 0;
      if (isV3 && data.memory && typeof data.memory === 'object') {
        try {
          const memDir = join(
            getDataDir(),
            'v2-sessions',
            agId,
            '.claude-shared',
            'projects',
            '-workspace-agent',
            'memory',
          );
          mkdirSync(memDir, { recursive: true });
          for (const [filename, content] of Object.entries(data.memory)) {
            if (!filename.endsWith('.md') || filename.includes('..') || filename.includes('/')) continue;
            writeFileSync(join(memDir, filename), content as string);
            memoriesRestored++;
          }
        } catch (memErr: any) {
          warnings.push(`Memory restore partial: ${memErr.message}`);
        }
      }

      // 8. Restore scheduled tasks if present in the bundle
      let tasksImported = 0;
      if (isV3 && Array.isArray(data.scheduledTasks) && data.scheduledTasks.length > 0) {
        try {
          const sessId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
          const sessDir = join(getDataDir(), 'v2-sessions', agId, sessId);
          mkdirSync(sessDir, { recursive: true });
          const inDbPath = join(sessDir, 'inbound.db');
          const inDb = new Database(inDbPath);
          inDb.pragma('journal_mode = DELETE');
          inDb.pragma('busy_timeout = 5000');
          inDb.exec(V2_INBOUND_SCHEMA);
          const taskNow = new Date().toISOString();
          let seq = 2;
          for (const task of data.scheduledTasks) {
            if (!task.content) continue;
            const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
            inDb
              .prepare(
                `INSERT INTO messages_in (id, seq, kind, timestamp, status, process_after, recurrence, content)
               VALUES (?, ?, 'task', ?, 'paused', ?, ?, ?)`,
              )
              .run(
                taskId,
                seq,
                taskNow,
                toSqliteDatetime(task.processAfter),
                task.recurrence || null,
                typeof task.content === 'string' ? task.content : JSON.stringify(task.content),
              );
            seq += 2;
            tasksImported++;
          }
          inDb.close();
          // Register session in central DB
          const wdb2 = getWriteDb();
          if (wdb2) {
            wdb2
              .prepare('INSERT OR IGNORE INTO sessions (id, agent_group_id, status, created_at) VALUES (?, ?, ?, ?)')
              .run(sessId, agId, 'active', taskNow);
          }
        } catch (taskErr: any) {
          warnings.push(`Scheduled tasks restore partial: ${taskErr.message}`);
        }
      }

      for (const u of unresolvedDests) {
        warnings.push(`Unresolved destination: ${u}`);
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          folder,
          name: agent.name,
          id: agId,
          filesWritten,
          destsCreated,
          memoriesRestored: memoriesRestored > 0 ? memoriesRestored : undefined,
          resolvedDests: resolvedDests.length > 0 ? resolvedDests : undefined,
          warnings: warnings.length > 0 ? warnings : undefined,
        }),
      );
    } catch (e: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: import coworker from a v1 NanoClaw instance (reads v1 data directly)
  if (req.method === 'POST' && url.pathname === '/api/coworkers/import-v1') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { v1Path, folder, coworkerType: requestedType } = JSON.parse(body);
      if (!v1Path || !folder) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"v1Path and folder are required"}');
        return;
      }
      const resolvedV1Path = resolve(v1Path);
      const allowedV1ImportRoot = getAllowedV1ImportRoot();
      const withinAllowedV1Root =
        resolvedV1Path === allowedV1ImportRoot || isInsideDir(allowedV1ImportRoot, resolvedV1Path);
      // Security: v1Path must be an absolute path within the configured import root.
      if (!isAbsolute(v1Path) || !withinAllowedV1Root || v1Path.includes('..')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `v1Path must be an absolute path under ${allowedV1ImportRoot}` }));
        return;
      }
      if (!existsSync(join(resolvedV1Path, 'groups', folder))) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `V1 group not found: ${join(resolvedV1Path, 'groups', folder)}` }));
        return;
      }

      // Package v1 data into v4 archive
      const { buffer: archiveBuf, agentName, stats } = await packageV1Archive(resolvedV1Path, folder);

      // Feed into existing full-archive import flow
      const { manifest, files } = await extractArchiveBuffer(archiveBuf);

      // Re-use the import logic by simulating an internal request
      // Instead of duplicating, we'll inline the core import here
      const agent = manifest.agent;
      // Allow caller to override coworkerType (e.g. typed import from dashboard)
      if (requestedType) agent.coworkerType = requestedType;
      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500);
        res.end('{"error":"db unavailable"}');
        return;
      }

      const warnings: string[] = [];
      const triggerCandidate = manifest.trigger || `@${agent.name.replace(/\s+/g, '')}`;
      const trigger = getUniqueTrigger(wdb, triggerCandidate);
      let importFolder = sanitizeImportedFolder(agent.folder);
      {
        // Unique folder allocator
        const baseFolder = importFolder;
        let suffix = 2;
        while (wdb.prepare('SELECT 1 FROM agent_groups WHERE folder = ?').get(importFolder)) {
          importFolder = `${baseFolder}-${suffix}`;
          suffix++;
        }
      }

      const now = new Date().toISOString();
      const newAgId = `ag-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      // Session ID map
      const sessionMap = new Map<string, string>();
      const manifestSessions: any[] = manifest.sessions || [];
      for (const s of manifestSessions) {
        const newSessId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        sessionMap.set(s.origId, newSessId);
      }

      // Backup v2.db
      const dbPath = getDbPath();
      const backupPath = `${dbPath}.backup-${Date.now()}`;
      try {
        copyFileSync(dbPath, backupPath);
      } catch (e: any) {
        warnings.push(`DB backup failed: ${e.message}`);
      }

      // Stage group-files
      const groupDir = join(getGroupsDir(), importFolder);
      const stagingDir = join(getDataDir(), 'v2-import-staging', newAgId);
      try {
        mkdirSync(stagingDir, { recursive: true });
        for (const [archivePath, buf] of files) {
          if (!archivePath.startsWith('group-files/')) continue;
          const rel = archivePath.slice('group-files/'.length);
          if (!rel) continue;
          const dst = join(stagingDir, rel);
          if (isAbsolute(rel) || !isInsideDir(stagingDir, dst)) {
            warnings.push(`rejected archive entry escaping staging dir: ${archivePath}`);
            continue;
          }
          mkdirSync(dirname(dst), { recursive: true });
          writeFileSync(dst, buf);
        }
      } catch (fsErr: any) {
        try {
          rmSync(stagingDir, { recursive: true, force: true });
        } catch {
          /* */
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Import staging failed: ${fsErr.message}` }));
        return;
      }

      // Strip lego spine content from .instructions.md for typed coworkers
      if (agent.coworkerType) {
        const instrPath = join(stagingDir, '.instructions.md');
        if (existsSync(instrPath)) {
          try {
            const original = readFileSync(instrPath, 'utf-8');
            writeFileSync(join(stagingDir, '.legacy-claude.md'), original);
            const stripped = stripLegoSpineContent(original, agent.coworkerType);
            if (stripped) {
              writeFileSync(instrPath, stripped + '\n');
            } else {
              unlinkSync(instrPath);
            }
          } catch {
            /* best effort */
          }
        }
      }

      // Copy claude-shared
      const claudeSharedDir = join(getDataDir(), 'v2-sessions', newAgId, '.claude-shared');
      try {
        for (const [archivePath, buf] of files) {
          if (!archivePath.startsWith('claude-shared/')) continue;
          const rel = archivePath.slice('claude-shared/'.length);
          if (!rel) continue;
          const dst = join(claudeSharedDir, rel);
          if (isAbsolute(rel) || !isInsideDir(claudeSharedDir, dst)) {
            warnings.push(`rejected archive entry escaping claude-shared dir: ${archivePath}`);
            continue;
          }
          mkdirSync(dirname(dst), { recursive: true });
          writeFileSync(dst, buf);
        }
      } catch (csErr: any) {
        warnings.push(`Claude shared restore partial: ${csErr.message}`);
      }

      // V1 session bootstrap: create inbound.db + outbound.db from scratch
      let sessionsRestored = 0;
      let tasksImported = 0;
      for (const [origId, newId] of sessionMap) {
        const sessDir = join(getDataDir(), 'v2-sessions', newAgId, newId);
        mkdirSync(sessDir, { recursive: true });

        const ms = manifestSessions.find((s: any) => s.origId === origId);
        const v1SessionId = ms?.v1SessionId || null;

        // Create inbound.db
        const inDbPath = join(sessDir, 'inbound.db');
        let inDb: Database | null = null;
        try {
          inDb = new Database(inDbPath);
          inDb.pragma('journal_mode = DELETE');
          inDb.exec(V2_INBOUND_SCHEMA);
          if (Array.isArray(manifest.scheduledTasks)) {
            let seq = 2;
            for (const task of manifest.scheduledTasks) {
              inDb
                .prepare(
                  `INSERT INTO messages_in (id, seq, kind, timestamp, status, process_after, recurrence, content)
                 VALUES (?, ?, 'task', ?, 'paused', ?, ?, ?)`,
                )
                .run(
                  task.origId,
                  seq,
                  now,
                  toSqliteDatetime(task.processAfter),
                  task.recurrence || null,
                  typeof task.content === 'string' ? task.content : JSON.stringify(task.content),
                );
              seq += 2;
              tasksImported++;
            }
          }
        } catch {
          /* best effort */
        } finally {
          try {
            inDb?.close();
          } catch {
            /* */
          }
        }

        // Create outbound.db with session_state
        const outDbPath = join(sessDir, 'outbound.db');
        let outDb: Database | null = null;
        try {
          outDb = new Database(outDbPath);
          outDb.pragma('journal_mode = DELETE');
          outDb.exec(V2_OUTBOUND_SCHEMA);
          if (v1SessionId) {
            outDb
              .prepare("INSERT INTO session_state (key, value, updated_at) VALUES ('claude_sdk_session_id', ?, ?)")
              .run(v1SessionId, now);
          }
        } catch {
          /* best effort */
        } finally {
          try {
            outDb?.close();
          } catch {
            /* */
          }
        }

        // Backfill v1 chat messages into session DBs
        const chatMsgs = Array.isArray(manifest.chatMessages) ? manifest.chatMessages : [];
        if (chatMsgs.length > 0) {
          const chatIn = chatMsgs.filter((m: any) => m.isFromMe === 0 && !m.isBotMessage);
          const chatOut = chatMsgs.filter((m: any) => m.isFromMe === 1 || m.isBotMessage === 1);
          let inDb2: Database | null = null;
          let outDb2: Database | null = null;
          try {
            inDb2 = new Database(inDbPath);
            inDb2.pragma('busy_timeout = 3000');
            const maxSeq = (inDb2.prepare('SELECT MAX(seq) as m FROM messages_in').get() as any)?.m || 0;
            let inSeq = maxSeq + 2;
            const inStmt = inDb2.prepare(
              `INSERT OR IGNORE INTO messages_in (id, seq, kind, timestamp, status, content) VALUES (?, ?, 'chat', ?, 'completed', ?)`,
            );
            for (const msg of chatIn) {
              const content = JSON.stringify({
                text: msg.content,
                sender: msg.sender || 'dashboard',
                senderId: msg.sender || 'v1-import',
              });
              inStmt.run(msg.id, inSeq, msg.timestamp, content);
              inSeq += 2;
            }
          } catch {
            /* best effort */
          } finally {
            try {
              inDb2?.close();
            } catch {
              /* */
            }
          }
          try {
            outDb2 = new Database(outDbPath);
            outDb2.pragma('busy_timeout = 3000');
            let outSeq = 1;
            const outStmt = outDb2.prepare(
              `INSERT OR IGNORE INTO messages_out (id, seq, kind, timestamp, content) VALUES (?, ?, 'chat', ?, ?)`,
            );
            for (const msg of chatOut) {
              outStmt.run(msg.id, outSeq, msg.timestamp, JSON.stringify({ text: msg.content }));
              outSeq += 2;
            }
          } catch {
            /* best effort */
          } finally {
            try {
              outDb2?.close();
            } catch {
              /* */
            }
          }
        }

        sessionsRestored++;
      }

      // DB transaction
      let destsCreated = 0;
      try {
        wdb.exec('BEGIN TRANSACTION');
        // Privilege guard: never import a non-admin group with coworker_type='main'.
        const legacyImportedType = agent.coworkerType === 'main' ? null : agent.coworkerType;
        wdb
          .prepare(
            'INSERT INTO agent_groups (id, name, folder, is_admin, agent_provider, container_config, coworker_type, allowed_mcp_tools, created_at) VALUES (?, ?, ?, 0, ?, ?, ?, ?, ?)',
          )
          .run(
            newAgId,
            agent.name,
            importFolder,
            agent.agentProvider || null,
            agent.containerConfig ? JSON.stringify(agent.containerConfig) : null,
            legacyImportedType || null,
            agent.allowedMcpTools ? JSON.stringify(agent.allowedMcpTools) : null,
            now,
          );

        for (const ms of manifestSessions) {
          const newSessId = sessionMap.get(ms.origId)!;
          wdb
            .prepare(
              'INSERT INTO sessions (id, agent_group_id, status, agent_provider, container_status, created_at) VALUES (?, ?, ?, ?, ?, ?)',
            )
            .run(newSessId, newAgId, 'active', agent.agentProvider || null, 'stopped', now);
        }

        const { messagingGroupId: yamlImportMgId } = ensureDashboardChatWiring(
          wdb,
          { id: newAgId, folder: importFolder, name: agent.name },
          trigger,
          now,
        );

        // Link restored sessions to the dashboard messaging group so they route correctly
        wdb
          .prepare('UPDATE sessions SET messaging_group_id = ? WHERE agent_group_id = ? AND messaging_group_id IS NULL')
          .run(yamlImportMgId, newAgId);

        wdb.exec('COMMIT');
      } catch (dbErr: any) {
        try {
          wdb.exec('ROLLBACK');
        } catch {
          /* */
        }
        try {
          rmSync(stagingDir, { recursive: true, force: true });
        } catch {
          /* */
        }
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: `Import failed (DB): ${dbErr.message}` }));
        return;
      }

      // Move staged files to final location
      try {
        mkdirSync(groupDir, { recursive: true });
        const copyRecursive = (src: string, dst: string) => {
          for (const entry of readdirSync(src)) {
            const srcPath = join(src, entry);
            const dstPath = join(dst, entry);
            if (statSync(srcPath).isDirectory()) {
              mkdirSync(dstPath, { recursive: true });
              copyRecursive(srcPath, dstPath);
            } else {
              writeFileSync(dstPath, readFileSync(srcPath));
            }
          }
        };
        copyRecursive(stagingDir, groupDir);
        rmSync(stagingDir, { recursive: true, force: true });
      } catch (copyErr: any) {
        warnings.push(`File copy partial: ${copyErr.message}`);
      }

      postImportGroupInit(newAgId, importFolder, warnings, agent.containerConfig);

      // Migrate V1 global learnings → V2 data/shared/learnings/
      try {
        const v1LearningsDir = join(resolvedV1Path, 'groups', 'global', 'learnings');
        if (existsSync(v1LearningsDir)) {
          const v2LearningsDir = join(getDataDir(), 'shared', 'learnings');
          mkdirSync(v2LearningsDir, { recursive: true });
          let copied = 0;
          for (const f of readdirSync(v1LearningsDir)) {
            if (f === 'INDEX.md') continue; // rebuild below
            const dst = join(v2LearningsDir, f);
            if (!existsSync(dst)) {
              cpSync(join(v1LearningsDir, f), dst);
              copied++;
            }
          }
          // Rebuild INDEX.md from all learning files
          if (copied > 0) {
            const files = readdirSync(v2LearningsDir)
              .filter((f) => f.endsWith('.md') && f !== 'INDEX.md')
              .sort();
            const indexLines = ['# Shared Learnings Index\n'];
            for (const f of files) {
              const content = readFileSync(join(v2LearningsDir, f), 'utf-8');
              const title = content.match(/^#\s+(.+)$/m)?.[1] || f.replace(/\.md$/, '');
              indexLines.push(`- [${title}](${f})`);
            }
            writeFileSync(join(v2LearningsDir, 'INDEX.md'), indexLines.join('\n') + '\n');
          }
        }
      } catch (learnErr: any) {
        warnings.push(`Learnings migration: ${learnErr.message}`);
      }

      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          folder: importFolder,
          name: agentName,
          id: newAgId,
          sourceFormat: 'v1',
          backupPath: existsSync(backupPath) ? backupPath : undefined,
          sessionsRestored,
          tasksImported,
          tasksPaused: true,
          destsCreated,
          stats,
          warnings: warnings.length > 0 ? warnings : undefined,
        }),
      );
    } catch (e: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: spawn interactive container (resume session without sending a message)
  if (req.method === 'POST' && /^\/api\/coworkers\/[^/]+\/spawn-interactive$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/spawn-interactive', ''));
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }

    const found = findRunningContainer(folder);
    if (found) {
      res.writeHead(409, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'container already running', container: found }));
      return;
    }

    const controlDir = join(getDataDir(), 'ipc', folder, 'control');
    mkdirSync(controlDir, { recursive: true });
    writeFileSync(
      join(controlDir, 'spawn-interactive.json'),
      JSON.stringify({ type: 'spawn_interactive', timestamp: new Date().toISOString() }),
    );

    res.writeHead(202, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, message: 'interactive spawn requested' }));
    return;
  }

  // API: delete coworker
  if (req.method === 'DELETE' && /^\/api\/coworkers\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', ''));
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }
    const wdb = getWriteDb();
    if (!wdb) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end('{"error":"db unavailable"}');
      return;
    }
    const existing = wdb.prepare('SELECT * FROM agent_groups WHERE folder = ?').get(folder) as any;
    if (!existing) {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end('{"error":"coworker not found"}');
      return;
    }
    // Don't allow deleting the main group
    if (existing.is_admin) {
      res.writeHead(403, { 'Content-Type': 'application/json' });
      res.end('{"error":"cannot delete the main group"}');
      return;
    }
    const agId = existing.id;
    const deleteData = url.searchParams.has('deleteData');
    // Stop any running container for this group, then clean up
    const folderHyphenated = folder.replace(/_/g, '-');
    const doCleanup = async () => {
      // Collect messaging_group ids this agent owned (non-dashboard channels
      // like telegram/slack/github keep their own messaging_groups rows —
      // we need to drop those too if no other agent references them).
      const ownedMgIds = wdb
        .prepare('SELECT DISTINCT messaging_group_id FROM messaging_group_agents WHERE agent_group_id = ?')
        .all(agId) as { messaging_group_id: string }[];

      // v2 cascade: delete children before parents
      wdb.prepare('DELETE FROM messaging_group_agents WHERE agent_group_id = ?').run(agId);
      // Outbound destinations owned BY this agent.
      wdb.prepare('DELETE FROM agent_destinations WHERE agent_group_id = ?').run(agId);
      // Bidirectional: destinations from OTHER agents pointing AT this one.
      // Without this, parent agents keep stale `target_id` pointers.
      wdb.prepare("DELETE FROM agent_destinations WHERE target_type = 'agent' AND target_id = ?").run(agId);
      wdb.prepare('DELETE FROM sessions WHERE agent_group_id = ?').run(agId);
      // Drop the dashboard messaging group for this agent.
      wdb
        .prepare("DELETE FROM messaging_groups WHERE channel_type = 'dashboard' AND platform_id = ?")
        .run(`dashboard:${folder}`);
      // Drop a2a messaging groups that involve this agent (platform_id = 'agent:<id1>:<id2>').
      // Must cascade child rows (sessions FK, messaging_group_agents FK) before deleting the group.
      const a2aMgSubquery =
        "SELECT id FROM messaging_groups WHERE channel_type = 'agent' AND (platform_id LIKE 'agent:' || @agId || ':%' OR platform_id LIKE 'agent:%:' || @agId)";
      wdb
        .prepare(`UPDATE sessions SET messaging_group_id = NULL WHERE messaging_group_id IN (${a2aMgSubquery})`)
        .run({ agId });
      wdb.prepare(`DELETE FROM messaging_group_agents WHERE messaging_group_id IN (${a2aMgSubquery})`).run({ agId });
      wdb
        .prepare(
          `DELETE FROM messaging_groups WHERE channel_type = 'agent' AND (platform_id LIKE 'agent:' || ? || ':%' OR platform_id LIKE 'agent:%:' || ?)`,
        )
        .run(agId, agId);
      // Drop non-dashboard messaging_groups that are now orphaned (no agent
      // references them after the cascade above).
      for (const { messaging_group_id } of ownedMgIds) {
        const stillUsed = wdb
          .prepare('SELECT 1 FROM messaging_group_agents WHERE messaging_group_id = ? LIMIT 1')
          .get(messaging_group_id);
        if (!stillUsed) {
          wdb.prepare('DELETE FROM messaging_groups WHERE id = ?').run(messaging_group_id);
        }
      }
      wdb.prepare('DELETE FROM agent_groups WHERE id = ?').run(agId);
      // Clean session files
      const sessionDir = join(getDataDir(), 'v2-sessions', agId);
      try {
        rmSync(sessionDir, { recursive: true, force: true });
      } catch {
        /* ok */
      }
      // Only delete group folder/artifacts when explicitly requested. Default
      // preserves work-in-progress artifacts (plans, reports, critiques).
      if (deleteData) {
        const groupDir = join(getGroupsDir(), folder);
        try {
          rmSync(groupDir, { recursive: true, force: true });
        } catch {
          /* best-effort cleanup */
        }
      }

      // Deregister the agent from OneCLI (port 10256). OneCLI tracks agents
      // by `identifier` which NanoClaw sets to the agent_group id on
      // ensureAgent (container-runner.ts). If OneCLI is unreachable or the
      // agent isn't there, swallow the error — the DB cleanup still succeeds
      // and OneCLI accumulating stale entries is non-fatal (already common
      // today). Log the outcome for observability.
      let onecliRemoved: 'ok' | 'not-found' | 'skipped' | 'error' = 'skipped';
      try {
        const listRes = await fetch('http://localhost:10256/api/agents', {
          signal: AbortSignal.timeout(2000),
        });
        if (listRes.ok) {
          const list = (await listRes.json()) as { id: string; identifier: string | null }[];
          const match = list.find((a) => a.identifier === agId);
          if (match) {
            const delRes = await fetch(`http://localhost:10256/api/agents/${match.id}`, {
              method: 'DELETE',
              signal: AbortSignal.timeout(2000),
            });
            onecliRemoved = delRes.ok ? 'ok' : 'error';
          } else {
            onecliRemoved = 'not-found';
          }
        }
      } catch {
        /* OneCLI unreachable — non-fatal */
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(
        JSON.stringify({
          ok: true,
          dataDeleted: deleteData,
          cleaned: {
            destinationsRemovedIncludingReverse: true,
            orphanMessagingGroupsRemoved: ownedMgIds.length,
            sessionDirRemoved: true,
            onecli: onecliRemoved,
          },
        }),
      );
    };
    exec(
      `docker ps --filter name=${getContainerNameFilter()}${folderHyphenated}- --format '{{.Names}}'`,
      (_err, stdout) => {
        const containers = (stdout || '').trim().split('\n').filter(Boolean);
        if (containers.length === 0) {
          doCleanup().catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'cleanup failed', detail: String(err) }));
          });
          return;
        }
        exec(`docker stop ${containers.join(' ')}`, () => {
          doCleanup().catch((err) => {
            res.writeHead(500, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify({ error: 'cleanup failed', detail: String(err) }));
          });
        });
      },
    );
    return;
  }

  // API: list files in a coworker's group folder (artifacts)
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/files$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/files', ''));
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }
    const groupDir = join(getGroupsDir(), folder);
    if (!isInsideDir(getGroupsDir(), groupDir) && groupDir !== getGroupsDir()) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    try {
      const files: { name: string; size: number; modified: string; isDir: boolean }[] = [];
      const entries = readdirSync(groupDir);
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        try {
          const st = statSync(join(groupDir, name));
          files.push({
            name,
            size: st.size,
            modified: st.mtime.toISOString(),
            isDir: st.isDirectory(),
          });
        } catch {
          /* skip unreadable */
        }
      }
      files.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // API: browse files in subdirectory (recursive navigation)
  // GET /api/coworkers/:folder/browse?path=reports
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/browse$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/browse', ''));
    const subpath = url.searchParams.get('path') || '';
    if (!folder) {
      res.writeHead(400);
      res.end('{"error":"invalid folder"}');
      return;
    }
    const groupDir = join(getGroupsDir(), folder);
    if (!isInsideDir(getGroupsDir(), groupDir) && groupDir !== resolve(getGroupsDir())) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const targetDir = join(groupDir, subpath);
    if (!isInsideDir(groupDir, targetDir) && targetDir !== groupDir) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    try {
      const entries = readdirSync(targetDir);
      const files: { name: string; path: string; size: number; modified: string; isDir: boolean }[] = [];
      for (const name of entries) {
        if (name.startsWith('.')) continue;
        try {
          const st = statSync(join(targetDir, name));
          files.push({
            name,
            path: subpath ? `${subpath}/${name}` : name,
            size: st.size,
            modified: st.mtime.toISOString(),
            isDir: st.isDirectory(),
          });
        } catch {
          /* skip */
        }
      }
      files.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('[]');
    }
    return;
  }

  // API: read file content inline (for work view)
  // GET /api/coworkers/:folder/read?path=reports/issue-10695.md
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/read$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/coworkers/', '').replace('/read', ''));
    const filePath = url.searchParams.get('path') || '';
    if (!folder || !filePath) {
      res.writeHead(400);
      res.end('{"error":"missing path"}');
      return;
    }
    const groupDir = join(getGroupsDir(), folder);
    if (!isInsideDir(getGroupsDir(), groupDir) && groupDir !== resolve(getGroupsDir())) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const fullPath = join(groupDir, filePath);
    if (!isInsideDir(groupDir, fullPath)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    try {
      const st = statSync(fullPath);
      if (st.isDirectory()) {
        res.writeHead(400);
        res.end('{"error":"is directory"}');
        return;
      }
      if (st.size > 1048576) {
        res.writeHead(413);
        res.end('{"error":"file too large (>1MB)"}');
        return;
      }
      const content = readFileSync(fullPath, 'utf-8');
      const ext = extname(filePath).slice(1);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ path: filePath, ext, size: st.size, content }));
    } catch {
      res.writeHead(404);
      res.end('{"error":"not found"}');
      return;
    }
    return;
  }

  // API: download a file from coworker's group folder
  if (req.method === 'GET' && /^\/api\/coworkers\/[^/]+\/download\//.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const parts = url.pathname.replace('/api/coworkers/', '').split('/download/');
    const folder = safeDecode(parts[0]);
    const filePath = safeDecode(parts.slice(1).join('/download/'));
    if (!folder || !filePath) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const fullPath = join(getGroupsDir(), folder, filePath);
    // Security: must be inside the group dir
    if (!isInsideDir(join(getGroupsDir(), folder), fullPath)) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    if (!existsSync(fullPath) || statSync(fullPath).isDirectory()) {
      res.writeHead(404);
      res.end('not found');
      return;
    }
    const content = readFileSync(fullPath);
    const ext = filePath.split('.').pop() || '';
    const mimeTypes: Record<string, string> = {
      md: 'text/markdown',
      txt: 'text/plain',
      json: 'application/json',
      slang: 'text/plain',
      cpp: 'text/plain',
      h: 'text/plain',
      py: 'text/plain',
      png: 'image/png',
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      gif: 'image/gif',
      svg: 'image/svg+xml',
      webp: 'image/webp',
      ico: 'image/x-icon',
      bmp: 'image/bmp',
    };
    const mime = mimeTypes[ext] || 'application/octet-stream';
    const isImage = mime.startsWith('image/');
    res.writeHead(200, {
      'Content-Type': mime,
      'Content-Disposition': isImage
        ? 'inline'
        : `attachment; filename="${(filePath.split('/').pop() || 'file').replace(/["\r\n]/g, '_')}"`,
    });
    res.end(content);
    return;
  }

  if (req.method === 'GET' && url.pathname === '/api/debug') {
    if (!requireAuth(req, res)) return;
    const mem = process.memoryUsage();
    const result: any = {
      pid: process.pid,
      uptime: process.uptime(),
      memory: {
        rss: mem.rss,
        heapUsed: mem.heapUsed,
        heapTotal: mem.heapTotal,
        external: mem.external,
      },
      dbPath: getDbPath(),
      dbAvailable: !!db,
      rowCounts: {} as Record<string, number>,
      wsClients: wsClients.size,
      sseClients: sseClients.size,
      hookEventsBuffered: hookEvents.length,
      // dash-perf round 2 acceptance-gate instrumentation: delta-vs-full frame
      // counts + bytes, backpressure activity, publish churn, and scan-worker
      // health (files tracked, stats/opens per interval, last tick ms).
      perf: {
        stateRev: publishedRev,
        ...perfCounters,
        scanWorker: workerStats,
      },
    };
    if (db) {
      try {
        for (const table of [
          'agent_groups',
          'messaging_groups',
          'messaging_group_agents',
          'sessions',
          'agent_destinations',
          'hook_events',
        ]) {
          result.rowCounts[table] = (db.prepare(`SELECT COUNT(*) as c FROM ${table}`).get() as any)?.c || 0;
        }
      } catch {
        /* ignore */
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: infrastructure health — MCP proxy, auth, network, OneCLI
  if (req.method === 'GET' && url.pathname === '/api/infrastructure') {
    if (!requireAuth(req, res)) return;
    const checks: Record<string, any> = {};

    // MCP auth proxy reachable?
    // Read MCP port from .env or process env (dashboard runs as a separate process)
    let mcpPort = process.env.MCP_PROXY_PORT || '8808';
    try {
      const envContent = readFileSync(join(resolve('.'), '.env'), 'utf-8');
      const match = envContent.match(/^MCP_PROXY_PORT=(\d+)/m);
      if (match) mcpPort = match[1];
    } catch {
      /* use default */
    }
    const mcpToken = getMcpManagementToken();
    const mcpHeaders: Record<string, string> = {};
    if (mcpToken) mcpHeaders['Authorization'] = `Bearer ${mcpToken}`;
    fetch(`http://172.17.0.1:${mcpPort}/tools`, { signal: AbortSignal.timeout(3000), headers: mcpHeaders })
      .catch(() =>
        fetch(`http://127.0.0.1:${mcpPort}/tools`, { signal: AbortSignal.timeout(3000), headers: mcpHeaders }),
      )
      .then(async (r) => {
        // A 401 from the proxy returns `{"error":"Unauthorized"}` — if we parsed that
        // as a tools map the UI rendered a phantom server named "error" with
        // "12 tools" (Object.keys → ["error"], then "Unauthorized".length = 12 through
        // the reduce). Guard status + per-value array-shape before treating as a
        // tools registry.
        if (!r.ok) {
          checks.mcpAuthProxy = { status: 'unauthorized', statusCode: r.status };
          return;
        }
        const tools = (await r.json()) as Record<string, unknown>;
        const serverEntries = Object.entries(tools).filter((e): e is [string, string[]] => Array.isArray(e[1]));
        // Per-server counts so the MCP Servers table can show the right number per row.
        // The flat `toolCount` is kept for the top "Discovered Tools" stat card.
        const servers = Object.fromEntries(serverEntries.map(([k, v]) => [k, v.length]));
        const toolCount = serverEntries.reduce((sum, [, t]) => sum + t.length, 0);
        checks.mcpAuthProxy = { status: 'running', servers, toolCount };
      })
      .catch(() => {
        checks.mcpAuthProxy = { status: 'unreachable' };
      })
      .finally(() => {
        // OneCLI gateway reachable?
        const onecliUrl = process.env.ONECLI_URL || 'http://127.0.0.1:10254';
        fetch(`${onecliUrl}/api/health`, { signal: AbortSignal.timeout(3000) })
          .then((r) => {
            checks.onecli = { status: r.ok ? 'running' : 'error', statusCode: r.status };
          })
          .catch(() => {
            checks.onecli = { status: 'unreachable' };
          })
          .finally(() => {
            // Docker network
            try {
              const netInfo = execSync('docker network inspect nanoclaw-agents --format "{{.Options}}"', {
                stdio: 'pipe',
                encoding: 'utf-8',
                timeout: 5000,
              }).trim();
              checks.network = { status: 'active', name: 'nanoclaw-agents', options: netInfo };
            } catch {
              checks.network = { status: 'not_found', name: 'nanoclaw-agents' };
            }

            // Running containers
            try {
              const raw = execSync(
                `docker ps --filter name=${getContainerNameFilter()} --format "{{.Names}}|{{.Status}}|{{.Networks}}"`,
                { stdio: 'pipe', encoding: 'utf-8', timeout: 5000 },
              ).trim();
              const containers = raw
                ? raw
                    .split('\n')
                    .filter(Boolean)
                    .map((line: string) => {
                      const [name, status, networks] = line.split('|');
                      return { name, status, networks };
                    })
                : [];
              checks.containers = { count: containers.length, list: containers };
            } catch {
              checks.containers = { count: 0, list: [] };
            }

            // Host disk usage. We report the root FS and /ephemeral (the docker
            // data-root disk, a separate device that has filled before and broken
            // per-group image rebuilds). statfsSync is a cheap in-process syscall —
            // no df shell-out — so it's safe to compute on every infra fetch.
            // bsize*blocks = total, bsize*bfree = free-to-root, bsize*bavail =
            // free-to-unprivileged; we use bavail for "available" to match df.
            const DISK_MOUNTS = ['/', '/ephemeral'];
            checks.disk = DISK_MOUNTS.flatMap((mount) => {
              try {
                if (!existsSync(mount)) return [];
                const s = statfsSync(mount);
                const total = s.blocks * s.bsize;
                const avail = s.bavail * s.bsize;
                const used = total - s.bfree * s.bsize;
                return [
                  {
                    mount,
                    total,
                    used,
                    avail,
                    usedPercent: total > 0 ? Math.round((used / total) * 100) : 0,
                  },
                ];
              } catch {
                return [];
              }
            });

            res.writeHead(200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(checks, null, 2));
          });
      });
    return;
  }

  // API: write .instructions.md for a group (admin panel)
  // CLAUDE.md is system-composed — all edits go to .instructions.md
  if (req.method === 'PUT' && url.pathname.startsWith('/api/memory/')) {
    if (!requireAuth(req, res)) return;
    const folder = safeDecode(url.pathname.replace('/api/memory/', ''));
    if (folder === null) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const instructionsPath = resolve(getGroupsDir(), folder, '.instructions.md');
    if (!isInsideDir(getGroupsDir(), instructionsPath)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      mkdirSync(resolve(getGroupsDir(), folder), { recursive: true });
      writeFileSync(instructionsPath, body, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: delete a task — v2 tasks are in session DBs
  if (req.method === 'DELETE' && /^\/api\/tasks\/(\d+)$/.test(url.pathname)) {
    res.writeHead(501, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Task deletion not yet implemented for v2 session-based tasks' }));
    return;
  }

  // API: get config values
  if (req.method === 'GET' && url.pathname === '/api/config') {
    if (!requireAuth(req, res)) return;
    const configKeys = [
      { key: 'ASSISTANT_NAME', env: 'ASSISTANT_NAME', description: 'Name of the assistant' },
      { key: 'CONTAINER_IMAGE', env: 'CONTAINER_IMAGE', description: 'Docker image for agent containers' },
      { key: 'CONTAINER_TIMEOUT', env: 'CONTAINER_TIMEOUT', description: 'Max container run time (ms)' },
      { key: 'MAX_CONCURRENT_CONTAINERS', env: 'MAX_CONCURRENT_CONTAINERS', description: 'Max parallel containers' },
      { key: 'IDLE_TIMEOUT', env: 'IDLE_TIMEOUT', description: 'Idle shutdown timeout (ms)' },
      { key: 'TIMEZONE', env: 'TZ', description: 'System timezone' },
      { key: 'DASHBOARD_PORT', env: 'DASHBOARD_PORT', description: 'Dashboard server port' },
      { key: 'ANTHROPIC_MODEL', env: 'ANTHROPIC_MODEL', description: 'Claude model identifier' },
      { key: 'LOG_LEVEL', env: 'LOG_LEVEL', description: 'Logging verbosity' },
    ];
    const result = configKeys.map((c) => ({
      ...c,
      value: process.env[c.env] || '',
    }));
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(result));
    return;
  }

  // API: read/write root CLAUDE.md
  if (url.pathname === '/api/config/claude-md') {
    if (!requireAuth(req, res)) return;
    const mdPath = join(getProjectRoot(), 'CLAUDE.md');
    if (req.method === 'GET') {
      try {
        const content = readFileSync(mdPath, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'text/plain' });
        res.end(content);
      } catch {
        res.writeHead(404);
        res.end('not found');
      }
      return;
    }
    if (req.method === 'PUT') {
      if (!requireAuth(req, res)) return;
      const body = await readBody(req, res);
      if (body === null) return;
      try {
        writeFileSync(mdPath, body, 'utf-8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end('{"ok":true}');
      } catch (e: any) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: e.message }));
      }
      return;
    }
  }

  // API: list channels
  if (req.method === 'GET' && url.pathname === '/api/channels') {
    if (!requireAuth(req, res)) return;
    const channels: any[] = [];
    try {
      if (existsSync(getChannelsDir())) {
        // Helper modules colocated under src/channels/ that don't register
        // adapters. Add to this set when introducing new helpers.
        const exclude = new Set([
          'index.ts',
          'registry.ts',
          'registry.test.ts',
          'adapter.ts',
          'channel-registry.ts',
          'chat-sdk-bridge.ts',
          'ask-question.ts',
        ]);
        const helperSuffixes = ['-pairing.ts', '-markdown-sanitize.ts', '-bridge.ts'];
        for (const file of readdirSync(getChannelsDir())) {
          if (!file.endsWith('.ts') || exclude.has(file) || file.includes('.test.')) continue;
          if (helperSuffixes.some((s) => file.endsWith(s))) continue;
          const name = file.replace('.ts', '');
          const groups: any[] = [];
          if (db) {
            try {
              const rows = db
                .prepare(
                  'SELECT ag.name, ag.folder, ag.id FROM agent_groups ag JOIN messaging_groups mg ON mg.channel_type = ? JOIN messaging_group_agents mga ON mga.messaging_group_id = mg.id AND mga.agent_group_id = ag.id',
                )
                .all(name) as any[];
              for (const r of rows) groups.push({ name: r.name, folder: r.folder });
            } catch {
              /* ignore */
            }
          }
          channels.push({ name, type: name, configured: groups.length > 0, groups });
        }
      }
    } catch {
      /* ignore */
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(channels));
    return;
  }

  // API: get logs
  if (req.method === 'GET' && url.pathname === '/api/logs') {
    if (!requireAuth(req, res)) return;
    const source = url.searchParams.get('source') || 'app';
    const group = url.searchParams.get('group') || '';
    const search = url.searchParams.get('search') || '';
    const limit = Math.min(parseInt(url.searchParams.get('limit') || '500', 10), 2000);

    let logFile = '';
    if (source === 'app') {
      logFile = join(getLogsDir(), 'nanoclaw.log');
    } else if (source === 'error') {
      logFile = join(getLogsDir(), 'nanoclaw.error.log');
    } else if (source === 'dashboard') {
      logFile = join(getLogsDir(), 'nanoclaw-dashboard.log');
    } else if (source === 'dashboard-error') {
      logFile = join(getLogsDir(), 'nanoclaw-dashboard.error.log');
    } else if (source === 'container' && group) {
      // Find most recent container log for this group
      const groupLogDir = join(getGroupsDir(), group, 'logs');
      // Prevent path traversal (e.g. group = "../../etc")
      if (!groupLogDir.startsWith(getGroupsDir() + '/')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid group name' }));
        return;
      }
      if (existsSync(groupLogDir)) {
        const logFiles = readdirSync(groupLogDir)
          .filter((f) => f.startsWith('container-') && f.endsWith('.log'))
          .sort()
          .reverse();
        if (logFiles.length > 0) logFile = join(groupLogDir, logFiles[0]);
      }
    }

    if (!logFile || !existsSync(logFile)) {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ lines: [], file: logFile || 'none' }));
      return;
    }

    try {
      let content = readFileSync(logFile, 'utf-8');
      // Strip ANSI codes
      content = content.replace(/\x1b\[[0-9;]*m/g, '');
      let lines = content.split('\n').filter((l) => l.trim());
      if (search) {
        const lowerSearch = search.toLowerCase();
        lines = lines.filter((l) => l.toLowerCase().includes(lowerSearch));
      }
      // Return last N lines
      lines = lines.slice(-limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ lines, file: logFile }));
    } catch {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ lines: [], file: logFile }));
    }
    return;
  }

  // API: get single skill content
  if (req.method === 'GET' && /^\/api\/skills\/[^/]+$/.test(url.pathname) && url.pathname !== '/api/skills') {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.replace('/api/skills/', ''));
    if (name === null) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const skillDir = resolve(getSkillsDir(), name);
    if (!isInsideDir(getSkillsDir(), skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const skillMd = join(skillDir, 'SKILL.md');
    try {
      const content = readFileSync(skillMd, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(content);
    } catch {
      res.writeHead(404);
      res.end('not found');
    }
    return;
  }

  // API: create skill
  if (
    req.method === 'POST' &&
    url.pathname === '/api/skills' &&
    req.headers['content-type']?.includes('application/json')
  ) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { name, content } = JSON.parse(body);
      if (!name || !/^[a-z0-9-]+$/.test(name)) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"Invalid skill name (use lowercase alphanumeric and hyphens)"}');
        return;
      }
      const skillDir = resolve(getSkillsDir(), name);
      if (!isInsideDir(getSkillsDir(), skillDir)) {
        res.writeHead(403);
        res.end('{"error":"forbidden"}');
        return;
      }
      if (existsSync(skillDir)) {
        res.writeHead(409, { 'Content-Type': 'application/json' });
        res.end('{"error":"Skill already exists"}');
        return;
      }
      mkdirSync(skillDir, { recursive: true });
      writeFileSync(join(skillDir, 'SKILL.md'), content || `# ${name}\n\nNew skill.\n`, 'utf-8');
      res.writeHead(201, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true, name }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: update skill
  if (req.method === 'PUT' && /^\/api\/skills\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.replace('/api/skills/', ''));
    if (name === null) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    const skillDir = resolve(getSkillsDir(), name);
    if (!isInsideDir(getSkillsDir(), skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      writeFileSync(join(skillDir, 'SKILL.md'), body, 'utf-8');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: delete skill
  if (req.method === 'DELETE' && /^\/api\/skills\/[^/]+$/.test(url.pathname)) {
    if (!requireAuth(req, res)) return;
    const name = safeDecode(url.pathname.replace('/api/skills/', ''));
    if (name === null) {
      res.writeHead(400);
      res.end('bad request');
      return;
    }
    if (url.searchParams.get('confirm') !== 'true') {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end('{"error":"Add ?confirm=true to delete"}');
      return;
    }
    const skillDir = resolve(getSkillsDir(), name);
    if (!isInsideDir(getSkillsDir(), skillDir)) {
      res.writeHead(403);
      res.end('{"error":"forbidden"}');
      return;
    }
    try {
      rmSync(skillDir, { recursive: true });
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: send chat message
  if (req.method === 'POST' && url.pathname === '/api/chat/send') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { group, content, thread_id, parent_message } = JSON.parse(body);
      if (!group || !content) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"group and content required"}');
        return;
      }
      // Pass-through validation: ingress does the authoritative check,
      // but we fail fast here so the public dashboard endpoint rejects
      // garbage before the host bridge round-trip. Rules mirror ingress:
      //   string or null/undefined; trim; empty → null; cap at 200 chars.
      let threadIdOut: string | null = null;
      if (thread_id !== undefined && thread_id !== null) {
        if (typeof thread_id !== 'string') {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"thread_id must be a string"}');
          return;
        }
        const trimmed = thread_id.trim();
        if (trimmed.length > 200) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"thread_id too long (max 200 chars)"}');
          return;
        }
        threadIdOut = trimmed.length > 0 ? trimmed : null;
      }

      // parent_message is optional context that the host seeds into a
      // brand-new per-thread session's inbound.db before the user's own
      // message, so the agent has the conversation's immediate parent.
      // Shape is re-validated in the ingress; here we just forward.
      let parentMessageOut: unknown = undefined;
      if (parent_message !== undefined && parent_message !== null) {
        if (typeof parent_message !== 'object' || Array.isArray(parent_message)) {
          res.writeHead(400, { 'Content-Type': 'application/json' });
          res.end('{"error":"parent_message must be an object"}');
          return;
        }
        parentMessageOut = parent_message;
      }

      const wdb = getWriteDb();
      if (!wdb) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end('{"error":"db unavailable"}');
        return;
      }
      const groupRow = wdb.prepare('SELECT id, name, folder FROM agent_groups WHERE folder = ?').get(group) as
        | { id: string; name: string; folder: string }
        | undefined;
      if (!groupRow) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end('{"error":"coworker not found"}');
        return;
      }
      ensureDashboardChatWiring(wdb, groupRow, `@${groupRow.name.replace(/\s+/g, '')}`);

      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = getDashboardSecret();
      if (secret) headers.Authorization = `Bearer ${secret}`;

      try {
        const forwardBody: Record<string, unknown> = { group, content, thread_id: threadIdOut };
        if (parentMessageOut !== undefined) forwardBody.parent_message = parentMessageOut;
        const upstream = await fetch(`${getDashboardIngressBaseUrl()}/api/dashboard/inbound`, {
          method: 'POST',
          headers,
          body: JSON.stringify(forwardBody),
          signal: AbortSignal.timeout(5000),
        });
        const upstreamText = await upstream.text();
        if (!upstream.ok) {
          let error = upstreamText || 'Dashboard host bridge request failed';
          try {
            const parsed = JSON.parse(upstreamText);
            error = parsed.error || error;
          } catch {
            /* text body */
          }
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error }));
          return;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Dashboard host bridge unreachable. Ensure NanoClaw host is running.';
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
        return;
      }

      lastMessageTsCache.set(group, new Date().toISOString());
      invalidateStateCache(); // reflect the just-sent message in the next publish
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/chat/send-to-session — admin reply into a specific a2a session.
  // Bypasses messaging-group routing; forwards to host /api/dashboard/inbound-session
  // which writes directly to the session's inbound.db. Used by the dashboard
  // when admin opens an a2a session (sessionDirect mode) and the normal
  // /api/chat/send path would misroute (because routing keys on (channel,
  // platform, thread) and root a2a sessions have thread_id=null).
  if (req.method === 'POST' && url.pathname === '/api/chat/send-to-session') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { session_id, content, parent_message } = JSON.parse(body);
      if (typeof session_id !== 'string' || !session_id.trim() || typeof content !== 'string' || !content.trim()) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"session_id and content required"}');
        return;
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = getDashboardSecret();
      if (secret) headers.Authorization = `Bearer ${secret}`;
      const forwardBody: Record<string, unknown> = { session_id: session_id.trim(), content: content.trim() };
      if (parent_message && typeof parent_message === 'object' && !Array.isArray(parent_message)) {
        forwardBody.parent_message = parent_message;
      }
      try {
        const upstream = await fetch(`${getDashboardIngressBaseUrl()}/api/dashboard/inbound-session`, {
          method: 'POST',
          headers,
          body: JSON.stringify(forwardBody),
          signal: AbortSignal.timeout(5000),
        });
        const upstreamText = await upstream.text();
        if (!upstream.ok) {
          let error = upstreamText || 'Dashboard host bridge request failed';
          try {
            const parsed = JSON.parse(upstreamText);
            error = parsed.error || error;
          } catch {
            /* text body */
          }
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error }));
          return;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Dashboard host bridge unreachable. Ensure NanoClaw host is running.';
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/cost-override — a human decision on a per-session cost cap, sent
  // WITHOUT an epoch (the pill's manual path, distinct from the epoch-fenced
  // cost_decision approval card — see renderCostCapCell in app.js). The WRITE
  // (into the session's inbound.db as a kind='cost_override' message + container
  // wake) lives on the HOST; the dashboard is a separate process, so it proxies
  // to the host ingress /api/dashboard/cost-override with the Bearer secret,
  // exactly like send-to-session. Decisions: 'continue' on a session actually at
  // its ceiling raises the ceiling by one allotment and resumes (the pill only
  // offers this when costStatus==='stopped'); 'stop' quiesces a running,
  // non-immortal session (a genuine manual kill switch — recorded-only for
  // immortal, which never quiesces). This dashboard is SSO-protected (no
  // DASHBOARD_SECRET by design), so the override intentionally does NOT
  // fail-closed when the secret is unset.
  if (req.method === 'POST' && url.pathname === '/api/cost-override') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { sessionId, decision } = JSON.parse(body);
      if (typeof sessionId !== 'string' || !sessionId.trim() || (decision !== 'continue' && decision !== 'stop')) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"sessionId and decision (continue|stop) required"}');
        return;
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = getDashboardSecret();
      if (secret) headers.Authorization = `Bearer ${secret}`;
      try {
        const upstream = await fetch(`${getDashboardIngressBaseUrl()}/api/dashboard/cost-override`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ session_id: sessionId.trim(), decision }),
          signal: AbortSignal.timeout(5000),
        });
        const upstreamText = await upstream.text();
        if (!upstream.ok) {
          let error = upstreamText || 'Dashboard host bridge request failed';
          try {
            const parsed = JSON.parse(upstreamText);
            error = parsed.error || error;
          } catch {
            /* text body */
          }
          res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error }));
          return;
        }
      } catch (err) {
        const message =
          err instanceof Error ? err.message : 'Dashboard host bridge unreachable. Ensure NanoClaw host is running.';
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
        return;
      }
      // Cost-cap state may change after the runner wakes. Unlike the old
      // request-scoped TTL cache (which needed an explicit invalidation here to
      // avoid a stale read), sessionCostCapsMap is kept continuously fresh by
      // the scan worker / main-thread fallback's mtime-gated poll (~1s for a
      // recently-active file — see pickLatestMessageTs/scan-worker.mjs), so
      // there's nothing to invalidate here: the next /api/sessions read picks
      // up the change on its own once the runner actually writes it.
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // POST /api/sessions/:sessionId/cost-ceiling — live, exact-value per-session
  // cost-ceiling control (dash-1 set-ceiling-v2). Distinct from
  // /api/cost-override above (fixed-bump continue / stop only): this lets an
  // admin set an EXACT target ceiling, in integer cents, guarded by an
  // optimistic-concurrency precondition (expectedEpochKey/expectedCeilingCents)
  // so a second admin's concurrent change — or the runner's own automatic
  // state — can't be silently clobbered. Works whether the session is already
  // stopped (raise it, with a visible target instead of the old hidden fixed
  // bump) or still healthy (proactive raise or lower).
  //
  // Same bridge pattern as /api/cost-override: this dashboard process has no
  // direct write path into a session's inbound.db, so it proxies to the host
  // ingress with the Bearer secret and forwards the upstream status/body back
  // to the browser — the HOST is the actual arbiter of accept / conflict /
  // reject (202/200/400/404/409/422/426/503, see the PR description for the
  // full fixed wire contract shared with the paired host+runner PR), this
  // endpoint is a thin, faithful bridge. `targetCeilingCents` is bounds-checked
  // here too (validateCeilingRequest) BEFORE anything is forwarded — belt and
  // suspenders with the host's own independent enforcement, and it means a
  // manipulated/bypassed browser request that skips the UI's own bound is
  // still rejected without ever reaching the host.
  const CEILING_PATH_RE = /^\/api\/sessions\/([^/]+)\/cost-ceiling$/;
  const ceilingMatch = req.method === 'POST' ? CEILING_PATH_RE.exec(url.pathname) : null;
  if (ceilingMatch) {
    if (!requireAuth(req, res)) return;
    const sessionId = safeDecode(ceilingMatch[1]);
    const body = await readBody(req, res);
    if (body === null) return;
    if (!sessionId || !sessionId.trim()) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: 'invalid session id' }));
      return;
    }
    try {
      let parsedBody: unknown;
      try {
        parsedBody = JSON.parse(body);
      } catch {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'invalid json' }));
        return;
      }
      const validated = validateCeilingRequest(parsedBody);
      if (!validated.ok) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: validated.error }));
        return;
      }
      const { requestId, targetCeilingCents, expectedEpochKey, expectedCeilingCents } = validated.value;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = getDashboardSecret();
      if (secret) headers.Authorization = `Bearer ${secret}`;
      try {
        const upstream = await fetch(`${getDashboardIngressBaseUrl()}/api/dashboard/session-cost-ceiling`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            sessionId: sessionId.trim(),
            requestId,
            targetCeilingCents,
            expectedEpochKey,
            expectedCeilingCents,
            protocolVersion: 2,
          }),
          signal: AbortSignal.timeout(5000),
        });
        const upstreamText = await upstream.text();
        // Forward the upstream body through as-is (it's the source of truth for
        // the browser's state machine — id/state/targetCeilingCents/etc. on
        // success, a reason on 409/422/426), only filling in a generic `error`
        // when the upstream didn't send JSON at all so the browser never has to
        // guess at a non-ok response with an empty body.
        let upstreamBody: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(upstreamText);
          if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) upstreamBody = parsed;
        } catch {
          /* non-JSON upstream body */
        }
        if (!upstream.ok && typeof upstreamBody.error !== 'string') {
          upstreamBody.error = upstreamText || `Dashboard host bridge request failed (${upstream.status})`;
        }
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(upstreamBody));
      } catch (err) {
        // The host itself is unreachable (not the same as the host replying
        // 503 "runner couldn't be readied in time" — that case is handled by
        // the upstream.ok branch above and forwarded verbatim); both surface as
        // 503 to the browser, distinguished only by message text, matching how
        // /api/cost-override already treats this failure mode.
        const message =
          err instanceof Error ? err.message : 'Dashboard host bridge unreachable. Ensure NanoClaw host is running.';
        res.writeHead(503, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: message }));
      }
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: list pending approvals for a specific admin group folder.
  if (req.method === 'GET' && url.pathname === '/api/approvals') {
    if (!requireAuth(req, res)) return;
    const group = url.searchParams.get('group') || '';
    let approvals: any[] = [];
    if (db && group) {
      try {
        const agRow = db.prepare('SELECT id, is_admin FROM agent_groups WHERE folder = ?').get(group) as any;
        if (agRow?.is_admin) {
          const rows = db
            .prepare(
              `SELECT pa.*, ag.folder AS coworker_folder, ag.name AS coworker_name
               FROM pending_approvals pa
               LEFT JOIN agent_groups ag ON ag.id = pa.agent_group_id
               WHERE pa.status = 'pending'
               ORDER BY pa.created_at DESC
               LIMIT 50`,
            )
            .all() as any[];
          // Resolve an agent group id → display name (falls back to the id).
          const groupName = (id: string | undefined): string => {
            if (!id) return '';
            try {
              const r = db!.prepare('SELECT name FROM agent_groups WHERE id = ?').get(id) as any;
              return r?.name || id;
            } catch {
              return id;
            }
          };
          // Turn an a2a wiring id into a human edge label, e.g.
          // "PerfHound → PerfHound (self-edge)" or "Orchestrator → PerfHound".
          const wiringLabel = (wiringId: string | undefined): string | null => {
            if (!wiringId) return null;
            try {
              const w = db!
                .prepare('SELECT messaging_group_id FROM messaging_group_agents WHERE id = ?')
                .get(wiringId) as any;
              if (!w?.messaging_group_id) return null;
              const mg = db!
                .prepare('SELECT platform_id FROM messaging_groups WHERE id = ?')
                .get(w.messaging_group_id) as any;
              const pid: string = mg?.platform_id || '';
              const m = pid.match(/^agent:([^:]+):(.+)$/);
              if (!m) return null;
              const src = groupName(m[1]);
              const dst = groupName(m[2]);
              return m[1] === m[2] ? `${src} → ${dst} (self-edge)` : `${src} → ${dst}`;
            } catch {
              return null;
            }
          };
          approvals = rows.map((row: any) => {
            let payload: any = {};
            try {
              payload = JSON.parse(row.payload || '{}');
            } catch {}
            const packages = (payload.apt || []).concat(payload.npm || []).filter(Boolean);

            // For cli_command approvals, surface the actual command line and,
            // where we can, a human label for the target the command acts on.
            // Without this the card would only show the bare action string
            // ("cli_command"), giving the admin nothing to decide on.
            let commandLine: string | null = null;
            let targetLabel: string | null = null;
            const frame = payload.frame;
            if (row.action === 'cli_command' && frame && typeof frame.command === 'string') {
              const args = frame.args && typeof frame.args === 'object' ? frame.args : {};
              const argStr = Object.entries(args)
                .map(([k, v]) => `--${k} ${v}`)
                .join(' ');
              commandLine = `ncl ${frame.command}${argStr ? ' ' + argStr : ''}`;
              if (frame.command === 'wirings-delete') {
                const label = wiringLabel(args.id);
                if (label) targetLabel = `Deletes wiring: ${label}`;
              } else if (frame.command === 'groups-restart') {
                targetLabel = `Restarts: ${groupName(args.id)}`;
              }
            }

            return {
              approvalId: row.approval_id,
              action: row.action,
              title: row.title || null,
              reason: payload.reason || null,
              packages,
              createdAt: row.created_at,
              status: row.status,
              coworkerFolder: row.coworker_folder || null,
              coworkerName: row.coworker_name || null,
              host: payload.host || null,
              method: payload.method || null,
              path: payload.path || null,
              mcpServer: payload.name || payload.server || null,
              commandLine,
              targetLabel,
              // The card body the requesting module authored. It was delivered
              // to chat but never surfaced here, so the dashboard could only
              // ever render the one-line title. `question` is absent on
              // pre-migration-021 rows, hence the null fallback.
              question: row.question || null,
              // Identity. These were parsed out of the payload and then
              // dropped on the floor, which is why a critique-gate card could
              // name a session id and nothing an operator could act on.
              sessionId: payload.sessionId || row.session_id || null,
              hit: payload.hit || null,
              repo: payload.repo || null,
              prNumber: typeof payload.prNumber === 'number' ? payload.prNumber : null,
              prUrl: payload.prUrl || null,
              escalationClass: payload.class || null,
              denials: typeof payload.denials === 'number' ? payload.denials : null,
              selfHealAttempts: typeof payload.selfHealAttempts === 'number' ? payload.selfHealAttempts : null,
              // Cost the runaway card carries so the approver sees "$spent of
              // $cap" without opening the session. Absent on cost-disabled
              // groups and every pre-enrichment row → null, and the card falls
              // back to its old shape.
              spentUsd: typeof payload.spentUsd === 'number' ? payload.spentUsd : null,
              capUsd: typeof payload.capUsd === 'number' ? payload.capUsd : null,
            };
          });
        }
      } catch {
        /* table may not exist */
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(approvals));
    return;
  }

  // API: critique-gate escalation metrics.
  //
  // Answers "how often does the gate escalate, from which coworker, and how
  // often is enforcement released" — questions that previously required
  // grepping a 64 MB time-only multi-day log and decoding epoch-ms out of
  // approval ids, because a resolved approval row is deleted on decision.
  // Backed by critique_escalation_events (host migration 932); returns an
  // empty summary when that table is absent so an older host still works.
  if (req.method === 'GET' && url.pathname === '/api/approvals/escalations') {
    if (!requireAuth(req, res)) return;
    const days = Math.min(Math.max(Number(url.searchParams.get('days')) || 14, 1), 90);
    const since = new Date(Date.now() - days * 86_400_000).toISOString();
    let byDay: unknown[] = [];
    let totals: unknown[] = [];
    if (db) {
      try {
        const present = db
          .prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name='critique_escalation_events'")
          .get();
        if (present) {
          byDay = db
            .prepare(
              `SELECT substr(e.created_at, 1, 10) AS day, ag.name AS coworker,
                      e.event AS event, e.class AS class, COUNT(*) AS n
                 FROM critique_escalation_events e
                 LEFT JOIN agent_groups ag ON ag.id = e.agent_group_id
                WHERE e.created_at >= ?
                GROUP BY day, coworker, event, class
                ORDER BY day DESC, coworker, event`,
            )
            .all(since);
          totals = db
            .prepare(
              `SELECT e.event AS event, COUNT(*) AS n
                 FROM critique_escalation_events e
                WHERE e.created_at >= ?
                GROUP BY e.event
                ORDER BY n DESC`,
            )
            .all(since);
        }
      } catch {
        /* table may not exist on an older host */
      }
    }
    res.writeHead(200, { 'Content-Type': 'application/json' });
    // `released` is the number that matters: an approved bypass or a
    // container-side fail-open both admitted a delivery with the requirement
    // unmet. Surfaced separately so it is never buried in a total.
    const released = (totals as Array<{ event: string; n: number }>)
      .filter((t) => t.event === 'approved' || t.event === 'failed_open')
      .reduce((a, t) => a + t.n, 0);
    res.end(JSON.stringify({ sinceIso: since, days, totals, byDay, released }));
    return;
  }

  // API: handle approval action (approve/reject buttons)
  if (req.method === 'POST' && (url.pathname === '/api/approvals/action' || url.pathname === '/api/chat/action')) {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const parsed = JSON.parse(body);
      const approvalId = parsed.approvalId;
      const actionDecision = parsed.decision || parsed.response;
      if (!approvalId || !actionDecision) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"approvalId and decision required"}');
        return;
      }
      const canonical = canonicalizeDecision(actionDecision);
      if (!canonical) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: `Invalid decision "${actionDecision}". Must be one of: ${[...CANONICAL_DECISIONS].join(', ')}`,
          }),
        );
        return;
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = getDashboardSecret();
      if (secret) headers.Authorization = `Bearer ${secret}`;

      // AP03: upstream handler does the approval state transition + may call
      // a registered action handler. With wakeContainer now fire-and-forget
      // on the ingress side, this should return in ms; the 30s ceiling is
      // defense-in-depth for legitimately-slow handlers (image pulls, long
      // install_packages, etc.) so the browser doesn't see a 500 while the
      // approval has in fact been applied. If you ever see this timeout
      // actually fire, the fix is in the handler — not here.
      let upstream: Response;
      try {
        upstream = await fetch(`${getDashboardIngressBaseUrl()}/api/dashboard/action`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ approvalId, decision: canonical }),
          signal: AbortSignal.timeout(30000),
        });
      } catch (fetchErr: any) {
        // Timeout / network. The ingress may or may not have applied the
        // approval — surface that ambiguity to the client instead of a bare
        // 500 so the UI can refetch /api/approvals to reconcile state.
        res.writeHead(504, { 'Content-Type': 'application/json' });
        res.end(
          JSON.stringify({
            error: `Upstream timed out or was unreachable: ${fetchErr?.message ?? String(fetchErr)}`,
            hint: 'Refetch /api/approvals to confirm whether the action was applied before retrying.',
          }),
        );
        return;
      }
      if (!upstream.ok) {
        const errText = await upstream.text();
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(errText);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // API: respond to ask_user_question card (arbitrary options, no VALID_DECISIONS gate)
  if (req.method === 'POST' && url.pathname === '/api/questions/respond') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const parsed = JSON.parse(body);
      const questionId = typeof parsed.questionId === 'string' ? parsed.questionId.trim() : '';
      const selectedOption = typeof parsed.selectedOption === 'string' ? parsed.selectedOption.trim() : '';
      if (!questionId || !selectedOption) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end('{"error":"questionId and selectedOption required"}');
        return;
      }
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const secret = getDashboardSecret();
      if (secret) headers.Authorization = `Bearer ${secret}`;
      const upstream = await fetch(`${getDashboardIngressBaseUrl()}/api/dashboard/question-response`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ questionId, selectedOption }),
        signal: AbortSignal.timeout(5000),
      });
      if (!upstream.ok) {
        const errText = await upstream.text();
        res.writeHead(upstream.status, { 'Content-Type': 'application/json' });
        res.end(errText);
        return;
      }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end('{"ok":true}');
    } catch (e: any) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── MCP server control (proxy to auth proxy on NanoClaw process) ────────
  if (req.method === 'POST' && url.pathname === '/api/mcp-control') {
    if (!requireAuth(req, res)) return;
    const body = await readBody(req, res);
    if (body === null) return;
    try {
      const { action, name } = JSON.parse(body);
      // Read MCP port from env first, then optional project .env fallback.
      let mcpPort = process.env.MCP_PROXY_PORT || '8808';
      try {
        const envContent = readFileSync(join(resolve('.'), '.env'), 'utf-8');
        const match = envContent.match(/^MCP_PROXY_PORT=(\d+)/m);
        if (!process.env.MCP_PROXY_PORT && match) mcpPort = match[1];
      } catch {
        /* use default */
      }

      const endpoint = action === 'stop' ? 'stop' : 'restart';
      const proxyUrl = `http://172.17.0.1:${mcpPort}/servers/${endpoint}?name=${encodeURIComponent(name)}`;

      // Read management token: env var first, then runtime file written by mcp-auth-proxy
      let mcpToken = process.env.MCP_MANAGEMENT_TOKEN || '';
      if (!mcpToken) {
        try {
          mcpToken = getMcpManagementToken() || '';
        } catch {
          /* token file not available */
        }
      }
      const fetchHeaders: Record<string, string> = {};
      if (mcpToken) fetchHeaders['Authorization'] = `Bearer ${mcpToken}`;
      fetch(proxyUrl, { method: 'POST', headers: fetchHeaders, signal: AbortSignal.timeout(10000) })
        .then((r) => r.json())
        .then((j) => {
          res.writeHead(200, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify(j));
        })
        .catch((e: Error) => {
          res.writeHead(502, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'MCP proxy unreachable: ' + e.message }));
        });
    } catch (e: any) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ error: e.message }));
    }
    return;
  }

  // ── Remote MCP server management ────────────────────────────────────────

  // Static files
  const decodedPath = safeDecode(url.pathname);
  if (decodedPath === null) {
    res.writeHead(400);
    res.end('bad request');
    return;
  }
  const isMobileUA = /Android|iPhone|iPod|Mobile/i.test(req.headers['user-agent'] || '');
  const forceDesktop = url.searchParams.get('desktop') === '1';
  const forceMobile = url.searchParams.get('mobile') === '1';
  const serveMobile = !forceDesktop && (forceMobile || isMobileUA);
  const isCoworkerSpaRoute =
    decodedPath === '/coworkers' ||
    decodedPath.startsWith('/coworkers/') ||
    decodedPath === '/cw' ||
    decodedPath.startsWith('/cw/');
  let filePath =
    decodedPath === '/' || isCoworkerSpaRoute ? (serveMobile ? '/mobile.html' : '/index.html') : decodedPath;
  filePath = resolve(getPublicDir(), '.' + filePath);
  if (!isInsideDir(getPublicDir(), filePath)) {
    res.writeHead(403);
    res.end('forbidden');
    return;
  }

  try {
    let content = readFileSync(filePath);
    const ext = extname(filePath);
    const headers: Record<string, string> = { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' };
    if (ext === '.html') {
      content = injectAssetVersions(content);
      content = injectTimezone(content);
      content = injectDashboardMode(content, Boolean(options.readOnly));
    }
    // Prevent proxy caching of mutable assets (JS, HTML) so code updates are picked up immediately
    if (ext === '.js' || ext === '.html' || ext === '.css') {
      headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
      headers['Pragma'] = 'no-cache';
    }
    res.writeHead(200, headers);
    res.end(content);
  } catch {
    res.writeHead(404);
    res.end('not found');
  }
}

function createDashboardHttpServer(options: DashboardRequestOptions = {}): import('http').Server {
  const server = createServer((req, res) => {
    void handleRequest(req, res, options);
  });

  // WebSockets are server-push only. The read-only listener can therefore
  // share the same live-state channel without exposing a mutation surface.
  server.on('upgrade', (req, socket, head) => {
    const key = req.headers['sec-websocket-key'];
    if (!key) {
      socket.destroy();
      return;
    }

    const acceptKey = computeAcceptKey(key);
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\n' +
        'Upgrade: websocket\r\n' +
        'Connection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${acceptKey}\r\n` +
        '\r\n',
    );

    // Snapshot BEFORE joining the broadcast set — see the SSE handler: building
    // the envelope can broadcast a delta, which an already-registered client
    // would receive before its own baseline.
    //
    // Written through sendToClient() like every other post-upgrade frame: a raw
    // socket.write() that returns false (a large snapshot to a slow reader)
    // armed no blocked-timer, so an otherwise idle fleet produced no further
    // frame to notice it with and the socket was pinned for good.
    const snapshotFrame = createWsFrame(Buffer.from(fullStateEnvelope()));
    wsClients.add(socket);
    sendToClient(socket, wsClients, snapshotFrame, true);

    let buffer = head.length > 0 ? Buffer.from(head) : Buffer.alloc(0);
    socket.on('data', (data: Buffer) => {
      buffer = Buffer.concat([buffer, data]);
      while (true) {
        const frame = parseWsFrame(buffer);
        if (!frame) break;
        buffer = buffer.subarray(frame.consumed);
        if (frame.opcode === 0x8) {
          // Close: reply with close and terminate socket.
          try {
            socket.write(createWsFrame(frame.payload, 0x8));
          } finally {
            socket.end();
          }
          return;
        }
        if (frame.opcode === 0x9) {
          // Ping: keep browser connections alive by replying with pong.
          socket.write(createWsFrame(frame.payload, 0xa));
          continue;
        }
      }
    });

    const dropWsClient = (): void => {
      wsClients.delete(socket);
      clearBlockedTimer(socket);
      clientBlockedSince.delete(socket);
      staleClients.delete(socket);
    };
    socket.on('close', dropWsClient);
    socket.on('error', dropWsClient);
  });

  return server;
}

/** Start the dashboard server (binds port, sets up WebSocket, timers). */
export function startServer(port = getDashboardPort(), host = getDashboardHost()): import('http').Server {
  // Background boot side effects — the eager MCP inventory scan + 5-min refresh
  // timer, and the one-shot ccusage warm-up — spawn subprocesses and add memory.
  // Skip them under VITEST: the composed CI boots this server per test, and the
  // parallel MCP/ccusage spawns push the ~7GB runner toward OOM. The express
  // routes below still serve, so endpoint tests are unaffected.
  let stopWatchingMcpToken: (() => void) | null = null;
  let mcpRefreshTimer: ReturnType<typeof setInterval> | undefined;
  let groupTaskTimer: ReturnType<typeof setInterval> | undefined;
  if (!process.env.VITEST) {
    // Load MCP tool inventory eagerly and refresh when the auth proxy rotates the token.
    void refreshMcpTools();
    stopWatchingMcpToken = watchMcpManagementToken(() => {
      void refreshMcpTools();
    });
    mcpRefreshTimer = setInterval(() => {
      void refreshMcpTools();
    }, 300_000);
    mcpRefreshTimer.unref?.();

    // Warm the ccusage cache once at boot so Admin > Overview has a non-zero
    // snapshot the moment a user lands on the page (one-shot; the on-demand
    // visibility-signal refresh continues while the panel is open).
    void refreshCcusageCache().catch(() => {
      /* swallow — non-fatal; on-demand refresh will retry */
    });
  }

  const server = createDashboardHttpServer();

  // Hook events are streamed as compact deltas. The slower core snapshot
  // catches changes from DB/filesystem-backed caches without rebuilding state
  // on every tool call or for every connected browser.
  const broadcastTimer = setInterval(() => {
    broadcastState();
  }, STATE_REFRESH_MS);
  broadcastTimer.unref?.();

  const heartbeatTimer = setInterval(() => {
    for (const client of sseClients) {
      if (isClientBlocked(client)) {
        markStaleClient(client, sseClients, false);
        continue;
      }
      try {
        if (!client.write(': keepalive\n\n')) markStaleClient(client, sseClients, false);
      } catch {
        sseClients.delete(client);
        clearBlockedTimer(client);
        clientBlockedSince.delete(client);
        staleClients.delete(client);
      }
    }
  }, 20_000);
  heartbeatTimer.unref?.();

  // Expire stale hook state (>30s old)
  const expireTimer = setInterval(() => {
    const now = Date.now();
    let changed = false;
    for (const [key, val] of liveHookState) {
      if (now - val.ts > 30000) {
        liveHookState.delete(key);
        changed = true;
      }
    }
    for (const [group, subagents] of liveSubagentState) {
      for (const [agentId, subagent] of subagents) {
        const isExpiredLeaving = subagent.phase === 'leaving' && subagent.exitAt !== null && now > subagent.exitAt;
        const isExpiredActive = subagent.phase !== 'leaving' && now - subagent.lastActivity > SUBAGENT_STALE_MS;
        if (isExpiredLeaving || isExpiredActive) {
          subagents.delete(agentId);
          changed = true;
        }
      }
      if (subagents.size === 0) liveSubagentState.delete(group);
    }
    if (changed) invalidateStateCache();
  }, 5000);
  expireTimer.unref?.();

  // Retention cleanup: delete hook_events older than HOOK_RETENTION_DAYS (default 7).
  const retentionDays = parseInt(process.env.HOOK_RETENTION_DAYS || '7', 10);
  // Reliability-lab telemetry from the slang-pr-review pipeline lands in
  // hook_events under these group folders (e.g. `slang-reviewer`); retain it
  // past the default window so longitudinal reviewer-reliability analysis
  // survives the 7-day prune. Both the prefix list and the longer window are
  // env-overridable; set HOOK_REVIEW_KEEP_PREFIXES="" to restore the flat prune.
  const reviewKeepPrefixes = (process.env.HOOK_REVIEW_KEEP_PREFIXES ?? 'slang-reviewer')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const reviewRetentionDays = parseInt(process.env.HOOK_REVIEW_RETENTION_DAYS || '90', 10);
  const retentionTimer = setInterval(() => {
    const heDb = getHookEventsDb();
    if (heDb) {
      try {
        const cutoff = Date.now() - retentionDays * 86400000;
        if (reviewKeepPrefixes.length > 0) {
          const likeParams = reviewKeepPrefixes.map((p) => `${p}%`);
          const notLike = reviewKeepPrefixes.map(() => 'group_folder NOT LIKE ?').join(' AND ');
          const isLike = reviewKeepPrefixes.map(() => 'group_folder LIKE ?').join(' OR ');
          // Never prune review telemetry MORE aggressively than the default.
          const reviewCutoff = Math.min(cutoff, Date.now() - reviewRetentionDays * 86400000);
          heDb.prepare(`DELETE FROM hook_events WHERE timestamp < ? AND (${notLike})`).run(cutoff, ...likeParams);
          heDb.prepare(`DELETE FROM hook_events WHERE timestamp < ? AND (${isLike})`).run(reviewCutoff, ...likeParams);
        } else {
          heDb.prepare('DELETE FROM hook_events WHERE timestamp < ?').run(cutoff);
        }
      } catch {
        /* non-fatal */
      }
    }
  }, 3600000); // every hour
  retentionTimer.unref?.();

  server.on('close', () => {
    stopWatchingMcpToken?.();
    clearInterval(mcpRefreshTimer);
    clearInterval(groupTaskTimer);
    clearInterval(broadcastTimer);
    clearInterval(heartbeatTimer);
    clearInterval(expireTimer);
    clearInterval(retentionTimer);
    for (const client of sseClients) {
      try {
        client.end();
      } catch {
        /* ignore */
      }
    }
    sseClients.clear();
  });

  server.listen(port, host, () => {
    console.log(`\n  NVIDIA Coworker Dashboard`);
    console.log(`  http://${host}:${port}\n`);
    console.log(`  Tab 1: Pixel Art Office (real-time)`);
    console.log(`  Tab 2: Timeline (all-time metrics)`);
    if (getDashboardSecret()) console.log(`  Auth: dashboard secret required for browser/admin access`);
    console.log();

    // Prime the scheduled-task snapshot only AFTER the port is bound, so the
    // fleet scan never delays the listener coming up / readiness probes on a
    // cold restart. The scan yields between groups (refreshGroupTaskCache), so
    // neither the prime nor the 15s refresh monopolizes the event loop. Skipped
    // under VITEST — the test server uses the live (mtime-cached) fallback path.
    if (!process.env.VITEST) {
      void refreshGroupTaskCache().catch(() => {
        /* non-fatal; the interval retries */
      });
      groupTaskTimer = setInterval(() => {
        void refreshGroupTaskCache().catch(() => {
          /* non-fatal; next tick retries */
        });
      }, 15000);
      groupTaskTimer.unref?.();
    }
  });

  return server;
}

/**
 * Start the view-only listener. It shares every in-memory cache, SSE client
 * set, WebSocket client set, and database handle with the interactive server,
 * but rejects all request bodies and mutation methods before route dispatch.
 */
export function startReadOnlyServer(
  port = getDashboardReadOnlyPort(),
  host = getDashboardHost(),
): import('http').Server {
  const server = createDashboardHttpServer({ readOnly: true });
  server.listen(port, host, () => {
    console.log(`  Read-only dashboard: http://${host}:${port}`);
  });
  return server;
}

// Auto-start when run directly (not imported by tests)
if (!process.env.VITEST) {
  const interactivePort = getDashboardPort();
  const readOnlyPort = getDashboardReadOnlyPort();
  startServer(interactivePort);
  if (readOnlyPort === interactivePort) {
    console.error('[dashboard] DASHBOARD_READONLY_PORT must differ from DASHBOARD_PORT; read-only listener disabled');
  } else {
    startReadOnlyServer(readOnlyPort);
  }
}
