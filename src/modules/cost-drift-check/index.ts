/**
 * Daily cost-ledger vs gateway drift check (host side).
 *
 * The runner's `cost_events` ledger is what the cost cap enforces. For weeks it
 * kept ~1% of each call's output tokens (#1329, fixed by #2013) and nothing
 * noticed. This runs `scripts/verify-cost-ledger-vs-gateway.py --fleet` once a
 * day over the sessions active in the last 24 h — every ledger call joined to
 * the OneCLI gateway's own record of it — and DMs the operator when the two
 * disagree (or when the check cannot run: a check that silently stops running
 * is the failure it exists to prevent). A PASS is logged, not sent.
 *
 * Opt-in: `NANOCLAW_COST_DRIFT_CHECK=true` (process env or .env). The script
 * reaches the gateway's Postgres through `docker exec` (ONECLI_PG_CONTAINER,
 * default onecli-postgres-1), which only some installs have.
 *
 * Read-only against every DB. The only write is this module's own state file
 * (`data/cost-drift-check.json`: last run time + last verdict), stamped BEFORE
 * the run so a crash or a host restart mid-run does not re-run it every tick.
 *
 * Driven by the host sweep's `singleton:cost-drift-check` duty, once per tick;
 * the run itself is detached (never holds a sweep tick open) and single-flight.
 */
import { execFile } from 'child_process';
import fs from 'fs';
import path from 'path';

import { DATA_DIR } from '../../config.js';
import { getDeliveryAdapter } from '../../delivery.js';
import { readEnvFile } from '../../env.js';
import { log } from '../../log.js';
import { pickApprovalDelivery, pickApprover } from '../approvals/primitive.js';

export const DRIFT_CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000;
const RUN_TIMEOUT_MS = 15 * 60 * 1000;
const MAX_ALERT_LINES = 10;

export interface DriftCheckState {
  lastRunAt: string;
  lastVerdict?: 'PASS' | 'FAIL' | 'ERROR';
  lastFinishedAt?: string;
  alerts?: string[];
  unmatchedGatewayByGroup?: Record<string, unknown>;
}

export interface DriftRunResult {
  code: number | null;
  stdout: string;
  stderr: string;
}

export interface DriftCheckDeps {
  enabled(): boolean;
  now(): number;
  readState(): DriftCheckState | null;
  writeState(state: DriftCheckState): void;
  runCheck(): Promise<DriftRunResult>;
  /** DM the operator; false when nobody is reachable. */
  notifyOperator(text: string): Promise<boolean>;
}

interface FleetReport {
  verdict?: string;
  error?: string;
  since?: string;
  until?: string;
  sessions_checked?: number;
  ledger_calls?: number;
  matched?: number;
  alerts?: string[];
  usd_matched?: { ledger: number; gateway_priced: number; drift: number; drift_pct: number };
  unmatched_gateway_by_group?: Record<
    string,
    { gateway_calls: number; unmatched_gateway_calls: number; unmatched_gateway_usd: number }
  >;
}

const STATE_PATH = path.join(DATA_DIR, 'cost-drift-check.json');
const SCRIPT_PATH = path.resolve(process.cwd(), 'scripts', 'verify-cost-ledger-vs-gateway.py');

export const defaultDriftCheckDeps: DriftCheckDeps = {
  enabled() {
    const v =
      process.env.NANOCLAW_COST_DRIFT_CHECK ?? readEnvFile(['NANOCLAW_COST_DRIFT_CHECK']).NANOCLAW_COST_DRIFT_CHECK;
    return ['1', 'true'].includes((v ?? '').trim().toLowerCase());
  },
  now: () => Date.now(),
  readState() {
    /* eslint-disable no-catch-all/no-catch-all -- absent or torn state file = never run: run now */
    try {
      return JSON.parse(fs.readFileSync(STATE_PATH, 'utf-8')) as DriftCheckState;
    } catch {
      return null;
    }
    /* eslint-enable no-catch-all/no-catch-all */
  },
  writeState(state) {
    const tmp = `${STATE_PATH}.${process.pid}.tmp`;
    fs.writeFileSync(tmp, JSON.stringify(state, null, 1));
    fs.renameSync(tmp, STATE_PATH);
  },
  runCheck() {
    return new Promise((resolve) => {
      execFile(
        'python3',
        [SCRIPT_PATH, '--fleet', '--hours', '24', '--json', '--checkout', process.cwd()],
        { timeout: RUN_TIMEOUT_MS, maxBuffer: 64 * 1024 * 1024 },
        (err, stdout, stderr) => {
          const code = err ? (typeof err.code === 'number' ? err.code : null) : 0;
          resolve({ code, stdout: String(stdout), stderr: String(stderr || (err && !stdout ? err.message : '')) });
        },
      );
    });
  },
  async notifyOperator(text) {
    const approvers = await pickApprover(null);
    const target = await pickApprovalDelivery(approvers, '');
    const adapter = getDeliveryAdapter();
    if (!target || !adapter) return false;
    await adapter.deliver(
      target.messagingGroup.channel_type,
      target.messagingGroup.platform_id,
      null,
      'chat',
      JSON.stringify({ text }),
    );
    return true;
  },
};

let inFlight: Promise<void> | null = null;

/**
 * Sweep entry point: start the daily run when it is due. Returns at once; the
 * run continues detached. The returned string is for logs and tests.
 */
export function maybeStartCostDriftCheck(
  deps: DriftCheckDeps = defaultDriftCheckDeps,
): 'disabled' | 'in-flight' | 'not-due' | 'started' {
  if (!deps.enabled()) return 'disabled';
  if (inFlight) return 'in-flight';
  const last = deps.readState();
  const lastMs = last?.lastRunAt ? Date.parse(last.lastRunAt) : NaN;
  const now = deps.now();
  if (Number.isFinite(lastMs) && now - lastMs < DRIFT_CHECK_INTERVAL_MS && lastMs <= now) return 'not-due';
  // Stamp first: a run that crashes the host must not restart every tick.
  deps.writeState({ ...(last ?? {}), lastRunAt: new Date(now).toISOString() });
  inFlight = runCostDriftCheck(deps)
    .catch((err) => log.error('Cost drift check failed', { err }))
    .finally(() => {
      inFlight = null;
    });
  return 'started';
}

/** One run: execute the script, record the verdict, DM the operator unless PASS. */
export async function runCostDriftCheck(deps: DriftCheckDeps = defaultDriftCheckDeps): Promise<void> {
  const res = await deps.runCheck();
  let report: FleetReport | null = null;
  /* eslint-disable no-catch-all/no-catch-all -- unparseable output is an ERROR verdict, alerted below */
  try {
    report = JSON.parse(res.stdout) as FleetReport;
  } catch {
    report = null;
  }
  /* eslint-enable no-catch-all/no-catch-all */
  const verdict: 'PASS' | 'FAIL' | 'ERROR' =
    res.code === 0 && report?.verdict === 'PASS'
      ? 'PASS'
      : res.code === 2 && report?.verdict === 'FAIL'
        ? 'FAIL'
        : 'ERROR';

  const prev = deps.readState();
  deps.writeState({
    lastRunAt: prev?.lastRunAt ?? new Date(deps.now()).toISOString(),
    lastFinishedAt: new Date(deps.now()).toISOString(),
    lastVerdict: verdict,
    alerts: report?.alerts ?? [],
    unmatchedGatewayByGroup: report?.unmatched_gateway_by_group ?? {},
  });

  if (verdict === 'PASS') {
    log.info('Cost drift check PASS', {
      sessions: report?.sessions_checked,
      matched: report?.matched,
      ledgerCalls: report?.ledger_calls,
      usd: report?.usd_matched,
      unmatchedGatewayByGroup: report?.unmatched_gateway_by_group,
    });
    return;
  }

  const text = verdict === 'FAIL' && report ? formatFailure(report) : formatError(res, report);
  log.warn(`Cost drift check ${verdict}`, { alerts: report?.alerts, code: res.code, error: report?.error });
  if (!(await deps.notifyOperator(text))) {
    log.error('Cost drift check: no operator reachable for the alert', { verdict });
  }
}

export function formatFailure(r: FleetReport): string {
  const alerts = r.alerts ?? [];
  const lines = [
    '⚠️  Cost ledger drift — the cost cap is not counting what the gateway saw',
    `Window ${r.since} → ${r.until} · ${r.sessions_checked ?? 0} sessions · ${r.matched ?? 0}/${r.ledger_calls ?? 0} ledger calls matched`,
  ];
  if (r.usd_matched) {
    lines.push(
      `Matched $: ledger $${r.usd_matched.ledger.toFixed(2)} vs gateway $${r.usd_matched.gateway_priced.toFixed(2)} (${r.usd_matched.drift_pct.toFixed(2)}%)`,
    );
  }
  for (const a of alerts.slice(0, MAX_ALERT_LINES)) lines.push(`• ${a}`);
  if (alerts.length > MAX_ALERT_LINES) lines.push(`• …and ${alerts.length - MAX_ALERT_LINES} more`);
  const nested = formatUnmatched(r);
  if (nested) lines.push(nested);
  lines.push(`Details: python3 scripts/verify-cost-ledger-vs-gateway.py --fleet --since ${r.since}`);
  return lines.join('\n');
}

function formatUnmatched(r: FleetReport): string {
  const parts = Object.entries(r.unmatched_gateway_by_group ?? {})
    .filter(([, g]) => g.unmatched_gateway_calls > 0)
    .map(([group, g]) => `${group} ${g.unmatched_gateway_calls} calls $${g.unmatched_gateway_usd.toFixed(2)}`);
  return parts.length ? `Not counted by design (nested CLI runs, info only): ${parts.join(', ')}` : '';
}

function formatError(res: DriftRunResult, r: FleetReport | null): string {
  const why = r?.error || res.stderr.trim().split('\n').slice(-3).join(' ') || `exit ${res.code}`;
  return [
    '⚠️  Cost ledger drift check could not run — drift is going unchecked',
    why.slice(0, 500),
    'Run: python3 scripts/verify-cost-ledger-vs-gateway.py --fleet --hours 24',
  ].join('\n');
}

/** @internal tests only */
export function _resetCostDriftCheckForTesting(): void {
  inFlight = null;
}

/** @internal tests only */
export function _costDriftInFlight(): Promise<void> | null {
  return inFlight;
}
