/**
 * Behavioral tests for scripts/dump-scheduled-tasks.py, run under the host vitest
 * suite so the Python logic is CI-protected (it is not otherwise covered by
 * typecheck/lint) — same rationale as nv-owned-drift.test.ts.
 *
 * The snapshot's whole value is that a SHORTER file means "a task was deleted".
 * That only holds if a partial read can never be committed, so most of these cases
 * are failure paths: a `tasks get` that fails mid-list, a `tasks list` that fails
 * outright, and an empty result. In every one the previous snapshot must survive
 * byte-identical and the exit code must be non-zero.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'dump-scheduled-tasks.py');

interface Fixture {
  /** series ids `ncl tasks list` reports. */
  ids: string[];
  /** ids whose `ncl tasks get` succeeds; the rest exit 1 like a locked DB. */
  gettable?: string[];
  /** make `ncl tasks list` itself fail. */
  listFails?: boolean;
  /** extra fields merged into each task definition. */
  extra?: Record<string, unknown>;
}

/**
 * A throwaway "repo" whose bin/ncl is a stub that answers from `fx`. Mirrors the
 * real CLI's shape: `tasks list` prints {data:[{series_id}]}, `tasks get --id X
 * --json` prints {data:{...}} or exits non-zero.
 */
function makeRepo(fx: Fixture): string {
  const repo = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'dst-')), 'repo');
  fs.mkdirSync(path.join(repo, 'bin'), { recursive: true });
  fs.mkdirSync(path.join(repo, 'fixtures'), { recursive: true });
  const fxDir = path.join(repo, 'fixtures');

  fs.writeFileSync(
    path.join(fxDir, 'list.json'),
    JSON.stringify({ ok: true, data: fx.ids.map((series_id) => ({ series_id })) }),
  );
  for (const id of fx.gettable ?? fx.ids) {
    fs.writeFileSync(
      path.join(fxDir, `get-${id}.json`),
      JSON.stringify({
        ok: true,
        data: {
          series_id: id,
          prompt: `do the ${id} thing`,
          recurrence: '0 5 * * *',
          agent_group_id: 'grp',
          // Volatile runtime state the dump must drop.
          row_id: 41,
          tries: 3,
          status: 'pending',
          recent_log: 'ran at 05:00',
          ...(fx.extra ?? {}),
        },
      }),
    );
  }

  fs.writeFileSync(
    path.join(repo, 'bin', 'ncl'),
    [
      '#!/usr/bin/env bash',
      'set -u',
      `FX=${JSON.stringify(fxDir)}`,
      'if [ "${1:-}" = "tasks" ] && [ "${2:-}" = "list" ]; then',
      fx.listFails ? '  echo "Error: database is locked" >&2; exit 1' : '  cat "$FX/list.json"; exit 0',
      'fi',
      'if [ "${1:-}" = "tasks" ] && [ "${2:-}" = "get" ]; then',
      '  f="$FX/get-${4:-}.json"',
      '  if [ -f "$f" ]; then cat "$f"; exit 0; fi',
      '  echo "Error: sqlite database is locked" >&2; exit 1',
      'fi',
      'echo "unknown command" >&2; exit 1',
    ].join('\n'),
    { mode: 0o755 },
  );
  return repo;
}

function dump(repo: string, extraArgs: string[] = []) {
  const out = path.join(repo, 'docs', 'snap.json');
  const md = path.join(repo, 'docs', 'snap.md');
  const r = spawnSync('python3', [SCRIPT, '--repo', repo, '--out', out, '--md', md, ...extraArgs], {
    cwd: repo,
    encoding: 'utf-8',
    env: { ...process.env, INSTANCE_SLUG: 'testinst' },
  });
  return { ...r, out, md };
}

/** Every file the dump could have staged or replaced, so leftovers are visible. */
function docsListing(repo: string): string[] {
  const d = path.join(repo, 'docs');
  return fs.existsSync(d) ? fs.readdirSync(d).sort() : [];
}

describe('scripts/dump-scheduled-tasks.py', () => {
  it('writes a complete snapshot and records its own completeness', () => {
    const repo = makeRepo({ ids: ['task-b', 'task-a'] });
    const r = dump(repo);
    expect(r.status).toBe(0);

    const snap = JSON.parse(fs.readFileSync(r.out, 'utf-8'));
    expect(snap.complete).toBe(true);
    // listed_count is what `tasks list` reported; task_count is what we actually
    // read. A reader can confirm the file is whole without trusting the run.
    expect(snap.listed_count).toBe(2);
    expect(snap.task_count).toBe(2);
    expect(snap.tasks.map((t: { series_id: string }) => t.series_id)).toEqual(['task-a', 'task-b']);
    // Volatile runtime state stays out so the diff is a definition-drift alarm.
    expect(Object.keys(snap.tasks[0])).not.toContain('row_id');
    expect(Object.keys(snap.tasks[0])).not.toContain('recent_log');
  });

  it('is byte-identical across runs when nothing changed', () => {
    // No timestamp in the artifact: a daily dump that rewrote its own header would
    // make `git diff` noisy and stop being a drift alarm.
    const repo = makeRepo({ ids: ['task-a'] });
    expect(dump(repo).status).toBe(0);
    const first = fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8');
    expect(dump(repo).status).toBe(0);
    expect(fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8')).toBe(first);
  });

  it('a fetch that fails mid-list exits non-zero and leaves the prior snapshot intact', () => {
    // The finding's exact scenario: three tasks listed, a transient DB error on
    // one. The old behaviour warned, wrote two, and exited 0 — which reads in git
    // as a deliberate task deletion.
    const repo = makeRepo({ ids: ['task-a', 'task-b', 'task-c'] });
    expect(dump(repo).status).toBe(0);
    const good = fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8');
    const goodMd = fs.readFileSync(path.join(repo, 'docs', 'snap.md'), 'utf-8');

    // Same three ids listed, but task-b is now unreadable.
    fs.rmSync(path.join(repo, 'fixtures', 'get-task-b.json'));
    const r = dump(repo);

    expect(r.status).toBe(1);
    expect(r.stderr).toContain('task-b');
    expect(r.stderr).toContain('Refusing to write a partial snapshot');
    expect(fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8')).toBe(good);
    expect(fs.readFileSync(path.join(repo, 'docs', 'snap.md'), 'utf-8')).toBe(goodMd);
    // …and no half-written temp file survives to be committed by mistake.
    expect(docsListing(repo)).toEqual(['snap.json', 'snap.md']);
  });

  it('a failed `tasks list` exits 2 without replacing the snapshot', () => {
    const repo = makeRepo({ ids: ['task-a'] });
    expect(dump(repo).status).toBe(0);
    const good = fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8');

    fs.writeFileSync(
      path.join(repo, 'bin', 'ncl'),
      '#!/usr/bin/env bash\necho "Error: host not running" >&2\nexit 1\n',
      { mode: 0o755 },
    );
    const r = dump(repo);
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('Refusing to touch the existing snapshot');
    expect(fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8')).toBe(good);
  });

  it('an empty task list exits 2 rather than emptying the snapshot', () => {
    const repo = makeRepo({ ids: ['task-a'] });
    expect(dump(repo).status).toBe(0);
    const good = fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8');

    fs.writeFileSync(path.join(repo, 'fixtures', 'list.json'), JSON.stringify({ ok: true, data: [] }));
    const r = dump(repo);
    expect(r.status).toBe(2);
    expect(fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8')).toBe(good);
  });

  it('never emits trailing whitespace, even when a prompt carries it', () => {
    // The committed snapshot picked this up from prompt bodies; it fails whitespace
    // lint and produces diff noise unrelated to any definition change.
    const repo = makeRepo({
      ids: ['task-a'],
      extra: { prompt: 'STEP 1 — do this:   \nSTEP 2 — then that\t\n' },
    });
    expect(dump(repo).status).toBe(0);
    const md = fs.readFileSync(path.join(repo, 'docs', 'snap.md'), 'utf-8');
    expect(md.split('\n').filter((l) => /[ \t]+$/.test(l))).toEqual([]);
    // The JSON keeps the prompt byte-exact — it, not the markdown, is the restore
    // source, so stripping there would corrupt what gets fed back to `ncl`.
    const snap = JSON.parse(fs.readFileSync(path.join(repo, 'docs', 'snap.json'), 'utf-8'));
    expect(snap.tasks[0].prompt).toBe('STEP 1 — do this:   \nSTEP 2 — then that\t\n');
  });
});
