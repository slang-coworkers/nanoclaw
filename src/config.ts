import os from 'os';
import path from 'path';

import { readEnvFile } from './env.js';
import { getContainerImageBase, getDefaultContainerImage, getInstallSlug } from './install-slug.js';
import { isValidTimezone } from './timezone.js';

// Read config values from .env (falls back to process.env).
const envConfig = readEnvFile([
  'ASSISTANT_NAME',
  'ASSISTANT_HAS_OWN_NUMBER',
  'ONECLI_URL',
  'ONECLI_API_KEY',
  'TZ',
  'DASHBOARD_PORT',
  'DASHBOARD_SECRET',
  'DASHBOARD_INGRESS_PORT',
  'MCP_PROXY_PORT',
  'CONTAINER_IMAGE',
  'CONTAINER_PREFIX',
  'GITHUB_WEBHOOK_SECRET',
  'GITHUB_WEBHOOK_PORT',
  'GITHUB_WEBHOOK_BOT_MENTION',
  'INSTANCE_SLUG',
  'PR_MAPPINGS_LOCAL',
  'INTERNAL_REGISTER_URL',
  'INTERNAL_REGISTER_SECRET',
  'INSTANCE_FORWARD_TARGETS',
  'ROUTE_ISSUES_TO',
  'ROUTE_READY_PRS_TO',
  'APPROVER_CI_GATE',
  'APPROVAL_LEDGER_WRITERS',
  'CI_GATE_REQUIRED_SUITE',
  'CI_GATE_REQUIRED_CHECK_RUN',
  'DEFAULT_AGENT_PROVIDER',
  'CONTAINER_CPU_LIMIT',
  'CONTAINER_MEMORY_LIMIT',
  'CONTAINER_PIDS_LIMIT',
  'NANOCLAW_EGRESS_LOCKDOWN',
  'NANOCLAW_EGRESS_NETWORK',
  'ONECLI_GATEWAY_CONTAINER',
]);

/**
 * @deprecated WhatsApp adapter copies now read the ASSISTANT_NAME .env key
 * directly. Re-export retained one release for stale adapter copies
 * (origin/channels whatsapp.ts:42 imports it); scheduled for deletion.
 */
export const ASSISTANT_NAME = process.env.ASSISTANT_NAME || envConfig.ASSISTANT_NAME || 'Andy';

// Instance-wide default agent provider for newly created groups. `claude` (the
// built-in provider) when unset, so existing installs are unaffected on upgrade.
// Applied only at group-creation time (stamped onto the config row) — never in
// provider resolution — so existing groups are never retroactively flipped.
// Per-group `ncl groups config update --provider` still overrides it.
export const DEFAULT_AGENT_PROVIDER = (
  process.env.DEFAULT_AGENT_PROVIDER ||
  envConfig.DEFAULT_AGENT_PROVIDER ||
  'claude'
).toLowerCase();

/**
 * @deprecated WhatsApp adapter copies now read the ASSISTANT_HAS_OWN_NUMBER
 * .env key directly. Re-export retained one release for stale adapter copies
 * (origin/channels whatsapp.ts:42 imports it); scheduled for deletion.
 */
export const ASSISTANT_HAS_OWN_NUMBER =
  (process.env.ASSISTANT_HAS_OWN_NUMBER || envConfig.ASSISTANT_HAS_OWN_NUMBER) === 'true';
export const POLL_INTERVAL = 2000;
export const SCHEDULER_POLL_INTERVAL = 60000;

// Absolute paths needed for container mounts
const PROJECT_ROOT = process.cwd();
const HOME_DIR = process.env.HOME || os.homedir();

// Mount security: allowlist stored OUTSIDE project root, never mounted into containers
export const MOUNT_ALLOWLIST_PATH = path.join(HOME_DIR, '.config', 'nanoclaw', 'mount-allowlist.json');
export const SENDER_ALLOWLIST_PATH = path.join(HOME_DIR, '.config', 'nanoclaw', 'sender-allowlist.json');
export const STORE_DIR = path.resolve(PROJECT_ROOT, 'store');
export const GROUPS_DIR = path.resolve(PROJECT_ROOT, 'groups');
export const DATA_DIR = path.resolve(PROJECT_ROOT, 'data');
export const SHARED_DIR = path.resolve(DATA_DIR, 'shared');
export const CENTRAL_DB_PATH = path.join(DATA_DIR, 'v2.db');
// Local agent-template library. Committed but ships empty (+ README). Resolved
// once at load. Override to another LOCAL path via NANOCLAW_TEMPLATES_DIR; never
// a remote URL, never an ncl flag, never runtime-mutable.
export const TEMPLATES_DIR = process.env.NANOCLAW_TEMPLATES_DIR
  ? path.resolve(process.env.NANOCLAW_TEMPLATES_DIR)
  : path.resolve(PROJECT_ROOT, 'templates');

// Per-checkout image tag so two installs on the same host don't share
// `nanoclaw-agent:latest` and clobber each other on rebuild.
export const CONTAINER_IMAGE_BASE = process.env.CONTAINER_IMAGE_BASE || getContainerImageBase(PROJECT_ROOT);
export const CONTAINER_IMAGE = process.env.CONTAINER_IMAGE || getDefaultContainerImage(PROJECT_ROOT);
export const CONTAINER_PREFIX = process.env.CONTAINER_PREFIX || envConfig.CONTAINER_PREFIX || 'nanoclaw';
// Install slug — the session key's install component, stamped onto every
// runtime object via the canonical `nanoclaw-install` label so adoption and
// reaping only ever see this install's sessions, not a peer's.
export const INSTALL_SLUG = getInstallSlug(PROJECT_ROOT);
export const CONTAINER_INSTALL_LABEL = `nanoclaw-install=${INSTALL_SLUG}`;
export const CONTAINER_TIMEOUT = parseInt(process.env.CONTAINER_TIMEOUT || '1800000', 10);
export const ONECLI_URL = process.env.ONECLI_URL || envConfig.ONECLI_URL;
export const ONECLI_API_KEY = process.env.ONECLI_API_KEY || envConfig.ONECLI_API_KEY;
export const MAX_MESSAGES_PER_PROMPT = Math.max(1, parseInt(process.env.MAX_MESSAGES_PER_PROMPT || '10', 10) || 10);

// Runaway detector (non-blocking): surface an admin card when a session
// processes many turns in a window while producing almost no output — the
// "stuck in an echo loop emitting 'Ignored.'" signature. NEVER auto-stops;
// only a human clicking the card's Stop button kills the session.
export const RUNAWAY_WINDOW_S = Math.max(60, parseInt(process.env.RUNAWAY_WINDOW_S || '600', 10) || 600);
export const RUNAWAY_TURNS = Math.max(2, parseInt(process.env.RUNAWAY_TURNS || '40', 10) || 40);
// Total new messages_out content (bytes) over the window below which output is
// considered "near-zero". A genuinely busy session easily clears this.
export const RUNAWAY_MAX_OUTPUT_BYTES = Math.max(
  0,
  parseInt(process.env.RUNAWAY_MAX_OUTPUT_BYTES || '2000', 10) || 2000,
);

export const IPC_POLL_INTERVAL = 1000;
// Idle grace period. Default is 25% below CONTAINER_TIMEOUT so the idle
// sweeper always has a window before the hard kill, even when operators
// tune CONTAINER_TIMEOUT without also thinking about IDLE_TIMEOUT. If an
// explicit env var is set and violates the invariant, resolveIdleTimeout()
// clamps it with a loud warning.
const IDLE_HEADROOM_MS = 300_000; // 5 min cushion before hard ceiling
function resolveIdleTimeout(): number {
  const raw = process.env.IDLE_TIMEOUT;
  const fallback = Math.max(60_000, CONTAINER_TIMEOUT - IDLE_HEADROOM_MS);
  if (!raw) return Math.min(fallback, CONTAINER_TIMEOUT - 1);
  const parsed = parseInt(raw, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return Math.min(fallback, CONTAINER_TIMEOUT - 1);
  if (parsed >= CONTAINER_TIMEOUT) {
    const clamped = Math.max(60_000, CONTAINER_TIMEOUT - IDLE_HEADROOM_MS);
    console.warn(
      `[config] IDLE_TIMEOUT (${parsed}ms) >= CONTAINER_TIMEOUT (${CONTAINER_TIMEOUT}ms); clamping to ${clamped}ms. ` +
        `Set IDLE_TIMEOUT strictly less than CONTAINER_TIMEOUT to silence this.`,
    );
    return clamped;
  }
  return parsed;
}
export const IDLE_TIMEOUT = resolveIdleTimeout();

// Lifecycle invariant (regression guard for issue #2): IDLE_TIMEOUT is the
// grace period after the last agent reply; CONTAINER_TIMEOUT is the hard
// ceiling on total container lifetime. If idle >= ceiling, the idle sweeper
// will never cull before the hard kill — producing orphaned containers and
// misleading watchdog logs. resolveIdleTimeout() clamps bad operator config
// so the runtime is always safe; this validator is kept for tests that
// exercise the raw contract.
export function validateContainerTimeouts(
  idle = IDLE_TIMEOUT,
  ceiling = CONTAINER_TIMEOUT,
): { ok: boolean; warning?: string } {
  if (idle >= ceiling) {
    return {
      ok: false,
      warning:
        `[config] IDLE_TIMEOUT (${idle}ms) >= CONTAINER_TIMEOUT (${ceiling}ms) — ` +
        `idle sweep will never fire before the hard kill. Set IDLE_TIMEOUT strictly less than CONTAINER_TIMEOUT.`,
    };
  }
  return { ok: true };
}
export const MAX_CONCURRENT_CONTAINERS = Math.max(1, parseInt(process.env.MAX_CONCURRENT_CONTAINERS || '5', 10) || 5);
// Per-container resource caps, passed through to `docker run`. Default empty =
// no flag added = today's unbounded behavior (don't OOM existing OSS workloads).
// Operators opt in: CONTAINER_CPU_LIMIT=2, CONTAINER_MEMORY_LIMIT=8g.
export const CONTAINER_CPU_LIMIT = process.env.CONTAINER_CPU_LIMIT || envConfig.CONTAINER_CPU_LIMIT || '';
export const CONTAINER_MEMORY_LIMIT = process.env.CONTAINER_MEMORY_LIMIT || envConfig.CONTAINER_MEMORY_LIMIT || '';

// Fork-bomb backstop. cgroups v2 counts THREADS, not processes, and Chromium is
// thread-hungry — a browsing agent with several tabs open runs into the high
// hundreds. Keep well above that; too low a cap kills the container mid-turn or
// blocks it from spawning subprocesses, and neither is reported as a PID limit.
// Empty = no cap.
export const CONTAINER_PIDS_LIMIT = process.env.CONTAINER_PIDS_LIMIT ?? envConfig.CONTAINER_PIDS_LIMIT ?? '2048';

// Egress lockdown — force all agent traffic through the OneCLI gateway on a
// no-internet Docker network. Off by default; consumed by src/egress-lockdown.ts.
export const EGRESS_LOCKDOWN = (process.env.NANOCLAW_EGRESS_LOCKDOWN || envConfig.NANOCLAW_EGRESS_LOCKDOWN) === 'true';
export const EGRESS_NETWORK =
  process.env.NANOCLAW_EGRESS_NETWORK || envConfig.NANOCLAW_EGRESS_NETWORK || 'nanoclaw-egress';
export const ONECLI_GATEWAY_CONTAINER =
  process.env.ONECLI_GATEWAY_CONTAINER || envConfig.ONECLI_GATEWAY_CONTAINER || 'onecli';

// MCP proxy
export const MCP_PROXY_PORT = parseInt(process.env.MCP_PROXY_PORT || envConfig.MCP_PROXY_PORT || '3100', 10);
export const PROXY_BIND_HOST = os.platform() === 'linux' ? '0.0.0.0' : '127.0.0.1';

// Dashboard host/server configuration
export const DASHBOARD_PORT = parseInt(process.env.DASHBOARD_PORT || envConfig.DASHBOARD_PORT || '3737', 10);
export const DASHBOARD_SECRET = process.env.DASHBOARD_SECRET || envConfig.DASHBOARD_SECRET || '';

// Dashboard chat ingress (host-only bridge used by the standalone dashboard server)
export const DASHBOARD_INGRESS_PORT = parseInt(
  process.env.DASHBOARD_INGRESS_PORT || envConfig.DASHBOARD_INGRESS_PORT || '3738',
  10,
);
export const DASHBOARD_INGRESS_HOST = '127.0.0.1';

// GitHub webhook receiver (separate port, publicly exposed)
export const GITHUB_WEBHOOK_SECRET = process.env.GITHUB_WEBHOOK_SECRET || envConfig.GITHUB_WEBHOOK_SECRET || '';
export const GITHUB_WEBHOOK_PORT = parseInt(
  process.env.GITHUB_WEBHOOK_PORT || envConfig.GITHUB_WEBHOOK_PORT || '3841',
  10,
);
export const GITHUB_WEBHOOK_BOT_MENTION =
  process.env.GITHUB_WEBHOOK_BOT_MENTION || envConfig.GITHUB_WEBHOOK_BOT_MENTION || '@nv-slang-bot';

// Cross-instance PR routing identifiers.
//
// `INSTANCE_SLUG` is the human-readable name of this NanoClaw install
// ('prod', 'lego', etc.). It identifies which instance owns a PR mapping
// in the central pr_session_mappings table. Allow-listed below to fail
// loud on misconfig — a typo'd slug would silently corrupt routing.
//
// Distinct from INSTALL_SLUG, which is sha1(projectRoot) and used for
// container/image namespacing. The two have different lifecycles: an
// install's directory may move (slug changes), but its identity in the
// cross-instance routing topology should not.
export const VALID_INSTANCE_SLUGS = ['prod', 'lego'] as const;
export type InstanceSlug = (typeof VALID_INSTANCE_SLUGS)[number];
function resolveInstanceSlug(): InstanceSlug | undefined {
  const raw = (process.env.INSTANCE_SLUG || envConfig.INSTANCE_SLUG || '').trim();
  if (!raw) return undefined;
  if ((VALID_INSTANCE_SLUGS as readonly string[]).includes(raw)) return raw as InstanceSlug;
  console.warn(
    `[config] INSTANCE_SLUG='${raw}' is not in the allow-list (${VALID_INSTANCE_SLUGS.join(', ')}). ` +
      `PR-mapping registrations will be skipped until this is fixed.`,
  );
  return undefined;
}
export const INSTANCE_SLUG = resolveInstanceSlug();

// Whether this instance maintains a local pr_session_mappings table.
// Defaults true on prod (canonical store) and should be set to '0' on
// non-canonical instances (lego) so registrations only flow to the
// canonical store via INTERNAL_REGISTER_URL. Without an explicit setting
// we keep the local table to avoid breaking single-instance installs.
export const PR_MAPPINGS_LOCAL = (process.env.PR_MAPPINGS_LOCAL || envConfig.PR_MAPPINGS_LOCAL || '1') !== '0';

// HMAC-signed cross-instance trust channel. INTERNAL_REGISTER_SECRET is
// shared between peer instances and used for two flows:
//
//   1. POST /internal/register-pr  — non-canonical instance writes a
//                                    mapping into the canonical store.
//   2. POST /webhook/github        — canonical router forwards a webhook
//                                    to the owning peer with the
//                                    X-Webhook-Trust=pre-validated header
//                                    (the receiver skips its filters).
//
// Distinct from GITHUB_WEBHOOK_SECRET so a leaked webhook secret cannot
// write mappings or impersonate a trusted peer. INTERNAL_REGISTER_URL
// names the canonical store endpoint when this is a non-canonical
// instance; empty otherwise.
export const INTERNAL_REGISTER_URL = process.env.INTERNAL_REGISTER_URL || envConfig.INTERNAL_REGISTER_URL || '';
export const INTERNAL_REGISTER_SECRET =
  process.env.INTERNAL_REGISTER_SECRET || envConfig.INTERNAL_REGISTER_SECRET || '';

// Map of instance_slug -> forward URL. Set on the canonical router so
// webhooks for foreign-owned PRs reach the right peer. Format:
// "lego=https://lego-host/webhook/github,other=https://...".
// Empty = forwarding disabled.
function parseForwardTargets(raw: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const entry of raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)) {
    const eq = entry.indexOf('=');
    if (eq <= 0) continue;
    const slug = entry.slice(0, eq).trim();
    const url = entry.slice(eq + 1).trim();
    if (slug && url) out[slug] = url;
  }
  return out;
}
export const INSTANCE_FORWARD_TARGETS = parseForwardTargets(
  process.env.INSTANCE_FORWARD_TARGETS || envConfig.INSTANCE_FORWARD_TARGETS || '',
);

// Dev-routing: forward every `issues` event (action=opened) to a peer
// instance instead of handling locally. Used while the issue-triage
// orchestrator path is still being shaped — we want issues to land in
// the dev install (lego) for testing, not in prod's orchestrator.
//
// Set the env var to a slug that ALSO appears in INSTANCE_FORWARD_TARGETS
// (so the forwarder knows where to send it). Empty/unset = local handling
// (issues go to this instance's orchestrator). PR-comment events are
// unaffected — only `issues` flows through this gate.
//
// Example on prod:
//   INSTANCE_FORWARD_TARGETS=lego=http://127.0.0.1:3843/webhook/github
//   ROUTE_ISSUES_TO=lego
//
// On lego (or any non-canonical instance), leave unset.
export const ROUTE_ISSUES_TO = (process.env.ROUTE_ISSUES_TO || envConfig.ROUTE_ISSUES_TO || '').trim();

// Dev-route PR `ready_for_review` (draft→ready) events to a peer instance,
// which hands them to a PR-approver coworker. Same trust-channel mechanism as
// ROUTE_ISSUES_TO: set to a slug that ALSO appears in INSTANCE_FORWARD_TARGETS.
// Empty/unset = handle locally (deliver to the local slang-pr-approver group,
// or warn-and-drop if that group is absent).
//
// Example on prod:
//   INSTANCE_FORWARD_TARGETS=lego=http://127.0.0.1:3843/webhook/github
//   ROUTE_READY_PRS_TO=lego
//
// On lego (the consumer), leave unset so it delivers locally.
export const ROUTE_READY_PRS_TO = (process.env.ROUTE_READY_PRS_TO || envConfig.ROUTE_READY_PRS_TO || '').trim();

// Host-side CI gate for PR-approver delivery. When on, a reviewable PR
// (ready_for_review / opened / synchronize) is PARKED (pending_reviewable_prs)
// instead of immediately minting an approver session; it is released only when
// a required CI check_suite reports success for the parked head. This both
// debounces synchronize bursts (one decision on the settled head) and defers
// the (expensive) approver run until CI is actually green — replacing the
// in-session `ci_green_on_sha` self-check that was blind to Actions check-runs.
// Default OFF so existing installs are unaffected until explicitly enabled.
export const APPROVER_CI_GATE = /^(1|true|yes|on)$/i.test(
  (process.env.APPROVER_CI_GATE || envConfig.APPROVER_CI_GATE || '').trim(),
);

/**
 * Cost-cap escalation APPROVAL CARD (NanoClaw #1 cost cap, Option 2) — staged rollout.
 * OFF (default): S1 — episodes are recorded (`cost_escalation_episodes`) and rendered
 * read-only, but NO card is delivered, NO decision is actioned, and `maxBudgetUsd` is
 * not enforced. Behavior is byte-for-byte the pre-card cost cap. ON: S2 — the full
 * card + compare-and-set resolver + effect/receipt reconciler + expiry + native
 * ceiling bound activate together, acting only on episodes created after activation.
 * Default OFF so existing installs are unaffected until explicitly enabled.
 */
export const COST_APPROVAL_CARD = /^(1|true|yes|on)$/i.test(
  (process.env.COST_APPROVAL_CARD || envConfig.COST_APPROVAL_CARD || '').trim(),
);

/**
 * Agent groups permitted to append to the approval-decision ledger — the
 * `record_decision` capability, enforced at the host boundary by
 * `approval_ledger.record_decision` (src/modules/approval-ledger/guard.ts).
 *
 * Comma-separated agent-group ids and/or folders (folders match
 * case-insensitively), e.g. `slang-pr-approver,slangpy-pr-approver`.
 *
 * UNSET MEANS NO CONTAINER MAY WRITE. That is deliberate: the ledger is the
 * evidence humans use to calibrate how far to trust the approver bots, so
 * "who may write to it" is an operator decision, not something a container can
 * assert about itself. `coworker_type` is NOT accepted as the signal — the
 * same reasoning container-runner.ts already applies to the shared-bucket
 * mount ("trust ONLY is_admin, not coworker_type": an import that sets
 * coworker_type must not confer privilege).
 *
 * A denial is logged at error level naming this variable, so an install that
 * upgrades without setting it sees exactly why the ledger stopped filling.
 *
 * Read through `approvalLedgerWriters()` rather than captured at import, so a
 * value supplied via the process environment is honoured without a restart
 * ordering dependency (and so tests can set it).
 */
export function approvalLedgerWriters(): string[] {
  return (process.env.APPROVAL_LEDGER_WRITERS || envConfig.APPROVAL_LEDGER_WRITERS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

// Which check_suite must be green to RELEASE a parked PR. Matches the suite's
// GitHub App slug (check_suite.app.slug) or, as a fallback, a substring of the
// app name — case-insensitive. This guards against the documented false-safe
// where a trivial suite (CLA/lint/CodeRabbit) goes green while the real build
// never dispatched: only the named build suite counts as "CI passed". When
// unset, ANY successful check_suite releases (loosest; not recommended for a
// repo with multiple suites). Example: CI_GATE_REQUIRED_SUITE=github-actions
export const CI_GATE_REQUIRED_SUITE = (process.env.CI_GATE_REQUIRED_SUITE || envConfig.CI_GATE_REQUIRED_SUITE || '')
  .trim()
  .toLowerCase();

// Optional precise gate: a PER-REPO check-RUN name that must be green before a
// parked PR for that repo releases (e.g. slang's `check-ci` aggregate build/test
// roll-up). The check_suite=success webhook wakes the host, but on repos where
// every Actions workflow shares one app slug, the suite alone can't distinguish
// the real build from a trivial green; check_run events aren't delivered (only
// check_suite is). So for a listed repo the host queries `gh` for the named
// check-run's conclusion at the head and releases only if it's green.
//
// Format: comma-separated `owner/repo=check-name` pairs (check names are
// case-exact and repo-specific — slang uses `check-ci`, nanoclaw uses `ci`).
// A repo NOT listed here falls back to the suite-slug gate (CI_GATE_REQUIRED_SUITE)
// — so leaving a repo out never wedges its PRs. Requires the host's `gh` CLI to
// be authenticated (read-only). Unset = suite-slug gate for all repos.
// Example: CI_GATE_REQUIRED_CHECK_RUN=shader-slang/slang=check-ci
export const CI_GATE_REQUIRED_CHECK_RUN: Record<string, string> = Object.fromEntries(
  (process.env.CI_GATE_REQUIRED_CHECK_RUN || envConfig.CI_GATE_REQUIRED_CHECK_RUN || '')
    .split(',')
    .map((pair) => pair.trim())
    .filter(Boolean)
    .map((pair) => {
      const i = pair.indexOf('=');
      return i > 0 ? [pair.slice(0, i).trim(), pair.slice(i + 1).trim()] : ['', ''];
    })
    .filter(([repo, name]) => repo && name),
);

// Timezone for scheduled tasks, message formatting, etc.
// Validates each candidate is a real IANA identifier before accepting.
function resolveConfigTimezone(): string {
  const candidates = [process.env.TZ, envConfig.TZ, Intl.DateTimeFormat().resolvedOptions().timeZone];
  for (const tz of candidates) {
    if (tz && isValidTimezone(tz)) return tz;
  }
  return 'UTC';
}
export const TIMEZONE = resolveConfigTimezone();
