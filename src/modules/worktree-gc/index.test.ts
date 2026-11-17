import fs from 'fs';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const TEST_ROOT = '/tmp/nanoclaw-worktree-gc-coverage-test';
const GROUPS_DIR = path.join(TEST_ROOT, 'groups');
const DATA_DIR = path.join(TEST_ROOT, 'data');

vi.mock('../../config.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../config.js')>()),
  GROUPS_DIR: '/tmp/nanoclaw-worktree-gc-coverage-test/groups',
  DATA_DIR: '/tmp/nanoclaw-worktree-gc-coverage-test/data',
}));

vi.mock('../../log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { closeDb, initTestDb, runMigrations } from '../../db/index.js';
import { createAgentGroup, updateAgentGroup } from '../../db/agent-groups.js';
import { ensureContainerConfig } from '../../db/container-configs.js';
import { createScheduledTask, prepareScheduledTask } from '../scheduling/create.js';
import { findTaskSeriesBySlug } from '../scheduling/series.js';
import { withExistingMailboxSession } from '../../session-manager.js';
import {
  _resetWorktreeGcCoverageForTesting,
  COVERAGE_INTERVAL_MS,
  groupHoldsGcWork,
  loadWorktreeGcTask,
  reconcileWorktreeGcCoverage,
  REPORT_STALE_MS,
  type FleetCoverage,
} from './index.js';

const NOW = Date.parse('2026-11-17T08:00:00Z');

async function group(folder: string, opts: { paused?: boolean } = {}): Promise<string> {
  const id = `ag-${folder}`;
  await createAgentGroup({ id, name: folder, folder, created_at: new Date(NOW).toISOString() });
  await ensureContainerConfig(id);
  if (opts.paused) await updateAgentGroup(id, { paused: 1 });
  fs.mkdirSync(path.join(GROUPS_DIR, folder), { recursive: true });
  return id;
}

/** A top-level checkout in a group directory: a `.git` directory is all the coverage test reads. */
function checkout(folder: string, name: string): void {
  fs.mkdirSync(path.join(GROUPS_DIR, folder, name, '.git'), { recursive: true });
}

function report(folder: string, body: Record<string, unknown>, ageMs = 0): void {
  const dir = path.join(GROUPS_DIR, folder, '.worktree-gc');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'last-run.json');
  fs.writeFileSync(file, JSON.stringify({ at: new Date(NOW - ageMs).toISOString(), errors: [], skipped: [], ...body }));
  const t = (NOW - ageMs) / 1000;
  fs.utimesSync(file, t, t);
}

function fleetFile(): FleetCoverage {
  return JSON.parse(
    fs.readFileSync(path.join(DATA_DIR, 'shared', 'worktree-gc', 'coverage.json'), 'utf8'),
  ) as FleetCoverage;
}

function coverageOf(fleet: FleetCoverage | null, folder: string) {
  return fleet?.groups.find((g) => g.folder === folder);
}

async function liveSeries(groupId: string) {
  return findTaskSeriesBySlug(groupId, 'worktree-gc');
}

beforeEach(async () => {
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
  fs.mkdirSync(path.join(DATA_DIR, 'shared'), { recursive: true });
  fs.mkdirSync(GROUPS_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  _resetWorktreeGcCoverageForTesting();
});

afterEach(async () => {
  await closeDb();
  fs.rmSync(TEST_ROOT, { recursive: true, force: true });
});

describe('the canonical task definition', () => {
  it('parses from the supervise-issues skill', () => {
    const task = loadWorktreeGcTask();
    expect(task).toMatchObject({ name: 'worktree-gc', schedule: '7 * * * *' });
    expect(task?.script).toContain('/app/skills/supervise-issues/scripts/worktree-gc-run.sh --gate');
  });
});

describe('groupHoldsGcWork', () => {
  it('counts wt-* entries, any top-level git repository, bare included, and a non-empty runs/', () => {
    const root = path.join(GROUPS_DIR, 'g');
    const holds = (setup: (dir: string) => void): boolean => {
      fs.rmSync(root, { recursive: true, force: true });
      fs.mkdirSync(root, { recursive: true });
      setup(root);
      return groupHoldsGcWork(root);
    };
    expect(holds(() => {})).toBe(false);
    expect(holds((d) => fs.mkdirSync(path.join(d, 'memory')))).toBe(false);
    expect(holds((d) => fs.mkdirSync(path.join(d, 'runs')))).toBe(false);
    expect(holds((d) => fs.mkdirSync(path.join(d, 'runs', 'A-14412-r1'), { recursive: true }))).toBe(true);
    expect(holds((d) => fs.writeFileSync(path.join(d, 'wt-12249-build.log'), 'log'))).toBe(true);
    expect(holds((d) => fs.mkdirSync(path.join(d, 'spec', '.git'), { recursive: true }))).toBe(true);
    expect(
      holds((d) => {
        fs.mkdirSync(path.join(d, 'slang-13742-pr'));
        fs.writeFileSync(path.join(d, 'slang-13742-pr', '.git'), 'gitdir: /gone\n');
      }),
    ).toBe(true);
    expect(
      holds((d) => {
        for (const sub of ['objects', 'refs']) fs.mkdirSync(path.join(d, 'r0-origin.git', sub), { recursive: true });
        fs.writeFileSync(path.join(d, 'r0-origin.git', 'HEAD'), 'ref: refs/heads/master\n');
      }),
    ).toBe(true);
  });

  it('never counts hidden entries or symlinks', () => {
    const root = path.join(GROUPS_DIR, 'g');
    fs.mkdirSync(path.join(root, '.cache', '.git'), { recursive: true });
    const outside = path.join(TEST_ROOT, 'outside');
    fs.mkdirSync(path.join(outside, '.git'), { recursive: true });
    fs.symlinkSync(outside, path.join(root, 'linked'));
    fs.symlinkSync(outside, path.join(root, 'wt-linked'));
    expect(groupHoldsGcWork(root)).toBe(false);
  });
});

describe('reconcileWorktreeGcCoverage', () => {
  it('gives a group that holds checkouts the canonical task, then reports it until the first run', async () => {
    const id = await group('main');
    checkout('main', 'wt-13401');
    await group('empty');

    const fleet = await reconcileWorktreeGcCoverage({ now: NOW });
    const series = await liveSeries(id);
    const canonical = loadWorktreeGcTask()!;
    expect(series).toMatchObject({ live: true, status: 'pending', recurrence: canonical.schedule });
    expect(series?.prompt).toBe(canonical.prompt);
    expect(series?.script).toBe(canonical.script);
    expect(coverageOf(fleet, 'main')).toMatchObject({ status: 'first-run-pending', action: 'created' });
    expect(coverageOf(fleet, 'empty')).toBeUndefined();
    expect(await liveSeries(`ag-empty`)).toBeUndefined();
    expect(fleetFile()).toEqual(fleet);
    expect(fleet?.gaps).toEqual([]);
  });

  it('flags a group whose task exists but never reports, and keeps a single series', async () => {
    const id = await group('slang-pr-approver');
    checkout('slang-pr-approver', 'slang');
    await reconcileWorktreeGcCoverage({ now: NOW });
    const later = await reconcileWorktreeGcCoverage({ now: NOW + COVERAGE_INTERVAL_MS });
    expect(coverageOf(later, 'slang-pr-approver')).toMatchObject({ status: 'not-firing', action: 'unchanged' });
    expect(later?.gaps).toEqual(['slang-pr-approver']);
    const sessions = await import('../../db/sessions.js');
    expect(await sessions.findTaskSessions(id)).toHaveLength(1);
  });

  it('repairs a series that drifted from the definition and keeps its pause', async () => {
    const id = await group('slang-fixer');
    checkout('slang-fixer', 'slang');
    const { row } = await createScheduledTask(
      id,
      prepareScheduledTask({
        name: 'worktree-gc',
        prompt: 'old prompt',
        recurrence: '7 */2 * * *',
        script: 'exec bash /old/worktree-gc-run.sh --gate',
      }),
      { status: 'paused' },
    );

    const fleet = await reconcileWorktreeGcCoverage({ now: NOW });
    const canonical = loadWorktreeGcTask()!;
    const series = await liveSeries(id);
    expect(series).toMatchObject({ seriesId: row.seriesId, status: 'paused', recurrence: canonical.schedule });
    expect(series?.prompt).toBe(canonical.prompt);
    expect(series?.script).toBe(canonical.script);
    expect(coverageOf(fleet, 'slang-fixer')).toMatchObject({ status: 'task-paused', action: 'updated' });
    expect(fleet?.gaps).toEqual(['slang-fixer']);
  });

  it('reads a fresh clean report as ok without rescanning, and recreates a deleted task once its report goes stale', async () => {
    const id = await group('slang-triager');
    checkout('slang-triager', 'slang');
    await reconcileWorktreeGcCoverage({ now: NOW });
    report('slang-triager', { free_gb_after: 725, skipped: ['wt-1: 300 MB of untracked files'] });

    const fresh = await reconcileWorktreeGcCoverage({ now: NOW + COVERAGE_INTERVAL_MS });
    expect(coverageOf(fresh, 'slang-triager')).toMatchObject({
      status: 'ok',
      action: 'verified',
      free_gb: 725,
      report_errors: 0,
      report_skipped: 1,
    });

    // Someone deletes the task. The next stale report sends the pass back to the
    // mailboxes, which finds the series gone and creates it again.
    const series = (await liveSeries(id))!;
    await withExistingMailboxSession(id, series.sessionId, (mailbox) => mailbox.deleteTask(series.seriesId));
    report('slang-triager', {}, REPORT_STALE_MS + 60_000);
    const healed = await reconcileWorktreeGcCoverage({ now: NOW + 2 * COVERAGE_INTERVAL_MS });
    expect(coverageOf(healed, 'slang-triager')).toMatchObject({ status: 'first-run-pending', action: 'created' });
    expect((await liveSeries(id))?.live).toBe(true);
  });

  it('copies the reported reference clones and lists the large dormant ones', async () => {
    await group('slang-release-regression-check');
    checkout('slang-release-regression-check', 'slang-bump');
    await reconcileWorktreeGcCoverage({ now: NOW });
    report('slang-release-regression-check', {
      references: [
        { name: 'slang-bump', shape: 'clone', size_gb: 41.5, idle_days: 159, dormant_large: true },
        { name: 'spec', shape: 'clone', size_gb: 0.2, idle_days: 84, dormant_large: false },
        { shape: 'clone', size_gb: 1 },
      ],
    });
    const fleet = await reconcileWorktreeGcCoverage({ now: NOW + COVERAGE_INTERVAL_MS });
    expect(coverageOf(fleet, 'slang-release-regression-check')?.references).toEqual([
      { name: 'slang-bump', size_gb: 41.5, idle_days: 159, dormant_large: true },
      { name: 'spec', size_gb: 0.2, idle_days: 84, dormant_large: false },
    ]);
    expect(fleet?.dormant_references).toEqual(['slang-release-regression-check/slang-bump']);
    expect(fleet?.gaps).toEqual([]);
  });

  it('flags a report with errors and a stale report', async () => {
    await group('slangpy-fixer');
    checkout('slangpy-fixer', 'slangpy');
    await group('slang-reviewer');
    checkout('slang-reviewer', 'slang');
    await reconcileWorktreeGcCoverage({ now: NOW });
    report('slangpy-fixer', { errors: ['save failed: wt-1 (worktree)'] });
    report('slang-reviewer', {}, REPORT_STALE_MS + 60_000);

    const fleet = await reconcileWorktreeGcCoverage({ now: NOW + COVERAGE_INTERVAL_MS });
    expect(coverageOf(fleet, 'slangpy-fixer')).toMatchObject({ status: 'errors', report_errors: 1 });
    expect(coverageOf(fleet, 'slang-reviewer')).toMatchObject({ status: 'not-firing' });
    expect(fleet?.gaps.sort()).toEqual(['slang-reviewer', 'slangpy-fixer']);
  });

  it('gives a paused group no task and reports it as paused, not as a gap', async () => {
    const id = await group('slangpy-pr-approver', { paused: true });
    checkout('slangpy-pr-approver', 'wt-1179-review');
    const fleet = await reconcileWorktreeGcCoverage({ now: NOW });
    expect(await liveSeries(id)).toBeUndefined();
    expect(coverageOf(fleet, 'slangpy-pr-approver')).toMatchObject({ status: 'paused', action: 'group-paused' });
    expect(fleet?.gaps).toEqual([]);
  });

  it('lists a deleted group directory that still holds checkouts as residue', async () => {
    fs.mkdirSync(path.join(GROUPS_DIR, 'bravo'), { recursive: true });
    checkout('bravo', 'slang-bump');
    fs.mkdirSync(path.join(GROUPS_DIR, 'test-group'), { recursive: true });
    fs.mkdirSync(path.join(GROUPS_DIR, 'templates'), { recursive: true });
    checkout('templates', 'lego');
    const fleet = await reconcileWorktreeGcCoverage({ now: NOW });
    expect(fleet?.residue).toEqual(['bravo']);
  });

  it('runs at most once per interval unless forced', async () => {
    await group('main');
    checkout('main', 'wt-1');
    expect(await reconcileWorktreeGcCoverage({ now: NOW })).not.toBeNull();
    expect(await reconcileWorktreeGcCoverage({ now: NOW + COVERAGE_INTERVAL_MS - 1 })).toBeNull();
    expect(await reconcileWorktreeGcCoverage({ now: NOW + 1, force: true })).not.toBeNull();
    expect(await reconcileWorktreeGcCoverage({ now: NOW + 1 + COVERAGE_INTERVAL_MS })).not.toBeNull();
  });

  it('writes no fleet file on an install without data/shared', async () => {
    fs.rmSync(path.join(DATA_DIR, 'shared'), { recursive: true, force: true });
    await group('main');
    checkout('main', 'wt-1');
    const fleet = await reconcileWorktreeGcCoverage({ now: NOW });
    expect(coverageOf(fleet, 'main')?.status).toBe('first-run-pending');
    expect(fs.existsSync(path.join(DATA_DIR, 'shared'))).toBe(false);
  });
});
