/**
 * Behavioral tests for scripts/check-task-snapshots.sh, run under the host vitest
 * suite so the shell logic is CI-protected (it is not otherwise covered by
 * typecheck/lint) — same rationale as nv-owned-drift.test.ts.
 *
 * The script is the CI wiring for `dump-scheduled-tasks.py --check`, and the whole
 * point of wiring it is that a torn or hand-edited snapshot turns a build red. So the
 * cases that matter are the ones where a weaker script would still exit 0: a tampered
 * id, a missing Markdown half, a second snapshot the loop never reached, and — the
 * quietest of all — a tree with no snapshots at all, where "nothing to check" and
 * "everything checks out" are indistinguishable unless the script says which it is.
 */
import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'check-task-snapshots.sh');
const DUMP = path.join(HERE, 'dump-scheduled-tasks.py');

/**
 * A throwaway tree with `docs/scheduled-tasks.<slug>.{json,md}` published by the real
 * dumper — hand-writing the pair would mean re-deriving the snapshot hash in JS, and a
 * fixture that computes the id its own way could agree with a broken script.
 */
function publish(root: string, slug: string, ids: string[]): { json: string; md: string } {
  const repo = path.join(root, `src-${slug}`);
  const fx = path.join(repo, 'fixtures');
  fs.mkdirSync(path.join(repo, 'bin'), { recursive: true });
  fs.mkdirSync(fx, { recursive: true });
  fs.writeFileSync(
    path.join(fx, 'list.json'),
    JSON.stringify({ ok: true, data: ids.map((series_id) => ({ series_id })) }),
  );
  for (const id of ids) {
    fs.writeFileSync(
      path.join(fx, `get-${id}.json`),
      JSON.stringify({
        ok: true,
        data: { series_id: id, prompt: `do the ${id} thing`, recurrence: '0 5 * * *', agent_group_id: 'grp' },
      }),
    );
  }
  fs.writeFileSync(
    path.join(repo, 'bin', 'ncl'),
    [
      '#!/usr/bin/env bash',
      'set -u',
      `FX=${JSON.stringify(fx)}`,
      'if [ "${1:-}" = "tasks" ] && [ "${2:-}" = "list" ]; then cat "$FX/list.json"; exit 0; fi',
      'if [ "${1:-}" = "tasks" ] && [ "${2:-}" = "get" ]; then cat "$FX/get-${4:-}.json"; exit 0; fi',
      'exit 1',
    ].join('\n'),
    { mode: 0o755 },
  );

  const json = path.join(root, 'docs', `scheduled-tasks.${slug}.json`);
  const md = path.join(root, 'docs', `scheduled-tasks.${slug}.md`);
  const r = spawnSync('python3', [DUMP, '--repo', repo, '--out', json, '--md', md], {
    encoding: 'utf-8',
    env: { ...process.env, INSTANCE_SLUG: slug },
  });
  if (r.status !== 0) throw new Error(`fixture dump failed: ${r.stderr}`);
  return { json, md };
}

/** Rewrite the JSON's `snapshot_id` while leaving every task definition untouched. */
function tamperId(jsonPath: string): void {
  const snap = JSON.parse(fs.readFileSync(jsonPath, 'utf-8'));
  snap.snapshot_id = 'd'.repeat(64);
  fs.writeFileSync(jsonPath, JSON.stringify(snap, null, 2) + '\n');
}

function makeRoot(): string {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'cts-'));
  fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
  return root;
}

function check(root: string) {
  const r = spawnSync('bash', [SCRIPT, root], { encoding: 'utf-8' });
  return { ...r, output: `${r.stdout}${r.stderr}` };
}

describe('scripts/check-task-snapshots.sh', () => {
  it('passes a pair the dumper just published', () => {
    const root = makeRoot();
    publish(root, 'inst-a', ['task-a', 'task-b']);
    const r = check(root);
    expect(r.status).toBe(0);
    // Naming the file it verified is what separates a real pass from a loop that
    // matched nothing and fell through to `exit 0`.
    expect(r.output).toContain('scheduled-tasks.inst-a.json');
  });

  it('FAILS when a snapshot_id is tampered with and the contents are left alone', () => {
    // The forgery this check exists for: edit a task definition in the committed
    // JSON, then edit the id to whatever you like. Either half alone is caught by
    // recomputing the hash, so a tamperer has to change both — and then the id no
    // longer matches the contents it claims to summarize.
    const root = makeRoot();
    const { json } = publish(root, 'inst-a', ['task-a']);
    expect(check(root).status).toBe(0);

    tamperId(json);
    const r = check(root);
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('scheduled-tasks.inst-a.json');
    expect(r.output).toContain('does not match its own contents');
  });

  it('FAILS when the Markdown half is missing, rather than checking the JSON alone', () => {
    // `--check` only cross-checks the pair when it is given both paths, so a script
    // that passed `--md` only when the file happened to exist would silently downgrade
    // to half a check exactly when a publish had gone wrong.
    const root = makeRoot();
    const { md } = publish(root, 'inst-a', ['task-a']);
    fs.rmSync(md);
    const r = check(root);
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('scheduled-tasks.inst-a.md');
  });

  it('FAILS on a bad SECOND snapshot — every snapshot is checked, not just the first', () => {
    const root = makeRoot();
    publish(root, 'inst-a', ['task-a']);
    const { json } = publish(root, 'inst-b', ['task-b']);
    expect(check(root).status).toBe(0);

    tamperId(json);
    const r = check(root);
    expect(r.status).not.toBe(0);
    expect(r.output).toContain('scheduled-tasks.inst-b.json');
  });

  it('says out loud that it verified NOTHING when there are no snapshots', () => {
    // A glob that matches nothing exits 0 through an empty loop, which reads in the
    // CI log exactly like a passing check. Deleting the snapshot would then turn the
    // drift alarm off and take the build green with it.
    const root = makeRoot();
    const r = check(root);
    expect(r.output).toContain('no docs/scheduled-tasks.*.json');
    // A GitHub annotation, so it surfaces on the PR rather than only in the log body.
    expect(r.output).toContain('::warning::');
    expect(r.output).not.toMatch(/\bOK\b/);
  });

  it('is read-only — a run leaves every byte of the pair unchanged', () => {
    const root = makeRoot();
    const { json, md } = publish(root, 'inst-a', ['task-a']);
    const before = [fs.readFileSync(json, 'utf-8'), fs.readFileSync(md, 'utf-8')];
    expect(check(root).status).toBe(0);
    expect([fs.readFileSync(json, 'utf-8'), fs.readFileSync(md, 'utf-8')]).toEqual(before);
    expect(fs.readdirSync(path.join(root, 'docs')).sort()).toEqual([
      'scheduled-tasks.inst-a.json',
      'scheduled-tasks.inst-a.md',
    ]);
  });
});
