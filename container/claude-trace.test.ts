/**
 * Guards the vendored claude-trace build in container/claude-trace/.
 *
 * The build is committed on purpose so a deploy needs no node build. But the
 * repo's blanket `dist/` .gitignore rule swallowed it on the first attempt, and
 * that failure is INVISIBLE at runtime: resolveClaudeTraceDir() finds no
 * dist/cli.js, returns null, and tracing is silently off on every box. Nothing
 * errors, no trace is written, and the first symptom is an empty directory
 * somebody notices weeks later.
 *
 * So: assert the files a checkout must actually contain.
 */
import { spawnSync } from 'node:child_process';
import {
  chmodSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

const DIR = path.join(__dirname, 'claude-trace');

describe('vendored claude-trace', () => {
  it('ships dist/cli.js — the file the whole feature gates on', () => {
    expect(existsSync(path.join(DIR, 'dist', 'cli.js'))).toBe(true);
  });

  it('ships the frontend assets used to render the .html viewer', () => {
    expect(existsSync(path.join(DIR, 'frontend', 'dist', 'index.global.js'))).toBe(true);
    expect(existsSync(path.join(DIR, 'frontend', 'template.html'))).toBe(true);
  });

  it('ships the wrapper CLAUDE_CODE_EXECUTABLE points at', () => {
    const wrapper = path.join(DIR, 'claude-trace-wrapper.sh');
    expect(existsSync(wrapper)).toBe(true);
    // It must invoke the MOUNTED dist, not a global claude-trace — the whole
    // point is that the patched build runs, not the stock npm one.
    expect(readFileSync(wrapper, 'utf-8')).toContain('dist/cli.js');
  });

  it('keeps the patch as the source of truth for the fork', () => {
    expect(existsSync(path.join(DIR, '0001-nvidia-bedrock-interception.patch'))).toBe(true);
  });

  it('is the PATCHED build, not stock upstream', () => {
    // Stock claude-trace only intercepts anthropic.com, so it silently records
    // nothing against inference-api.nvidia.com. If this fails, someone has
    // replaced the build with the npm package and every trace will be empty.
    const files = ['dist/cli.js', 'dist/interceptor.js']
      .map((f) => path.join(DIR, f))
      .filter((f) => existsSync(f))
      .map((f) => readFileSync(f, 'utf-8'));
    expect(files.join('\n')).toContain('nvidia.com');
  });
});

/**
 * The wrapper runs claude-trace, which creates <cwd>/.claude-trace/<name>.jsonl
 * before the real binary starts. Consider a group folder whose .claude-trace was
 * created by root: claude-trace fails with EACCES, the child exits, and every
 * turn of that group ends in the generic failure notice. These tests run the
 * wrapper with a fake claude-trace (prints TRACED) and a fake real binary
 * (prints UNTRACED) and check that an unwritable trace path never stops the run.
 */
describe('claude-trace wrapper with an unwritable trace path', () => {
  const asRoot = typeof process.getuid === 'function' && process.getuid() === 0;
  const tmpDirs: string[] = [];

  function setup(): { cwd: string; env: NodeJS.ProcessEnv } {
    const root = mkdtempSync(path.join(os.tmpdir(), 'claude-trace-wrapper-'));
    tmpDirs.push(root);
    const traceDir = path.join(root, 'opt');
    mkdirSync(path.join(traceDir, 'dist'), { recursive: true });
    writeFileSync(
      path.join(traceDir, 'dist', 'cli.js'),
      "process.stdout.write('TRACED ' + process.argv.slice(2).join(' '));\n",
    );
    const realBin = path.join(root, 'claude');
    writeFileSync(realBin, '#!/bin/bash\necho -n "UNTRACED $*"\n');
    chmodSync(realBin, 0o755);
    const cwd = path.join(root, 'agent');
    mkdirSync(cwd);
    return {
      cwd,
      env: {
        PATH: `${path.dirname(process.execPath)}:/usr/bin:/bin`,
        CLAUDE_TRACE_DIR: traceDir,
        CLAUDE_TRACE_REAL_BIN: realBin,
        NANOCLAW_SESSION_ID: 'sess-1',
      },
    };
  }

  function run(cwd: string, env: NodeJS.ProcessEnv) {
    return spawnSync('bash', [path.join(DIR, 'claude-trace-wrapper.sh'), '--print', 'hi'], {
      cwd,
      env,
      encoding: 'utf-8',
    });
  }

  afterEach(() => {
    for (const d of tmpDirs.splice(0)) {
      spawnSync('chmod', ['-R', 'u+rwx', d]);
      rmSync(d, { recursive: true, force: true });
    }
  });

  it('traces normally when the trace folder is writable', () => {
    const { cwd, env } = setup();
    const r = run(cwd, env);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('TRACED');
    expect(r.stdout).toContain('--log session-sess-1');
    expect(r.stdout).toContain('--run-with --print hi');
    expect(existsSync(path.join(cwd, '.claude-trace'))).toBe(true);
  });

  it.skipIf(asRoot)('moves an unwritable trace folder aside and traces into a fresh one', () => {
    const { cwd, env } = setup();
    const out = path.join(cwd, '.claude-trace');
    mkdirSync(out);
    writeFileSync(path.join(out, 'old.jsonl'), '{}\n');
    chmodSync(out, 0o555);
    const r = run(cwd, env);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('TRACED');
    expect(r.stderr).toContain('was not writable; moved it to');
    const aside = readdirSync(cwd).filter((n) => n.startsWith('.claude-trace.unwritable-'));
    expect(aside).toHaveLength(1);
    expect(existsSync(path.join(cwd, aside[0], 'old.jsonl'))).toBe(true);
    expect(statSync(out).mode & 0o200).toBe(0o200);
  });

  it.skipIf(asRoot)('moves an unwritable session log aside', () => {
    const { cwd, env } = setup();
    const out = path.join(cwd, '.claude-trace');
    mkdirSync(out);
    const log = path.join(out, 'session-sess-1.jsonl');
    writeFileSync(log, '');
    chmodSync(log, 0o444);
    const r = run(cwd, env);
    expect(r.status).toBe(0);
    expect(r.stdout).toContain('TRACED');
    expect(existsSync(log)).toBe(false);
    expect(readdirSync(out).some((n) => n.startsWith('session-sess-1.jsonl.unwritable-'))).toBe(true);
  });

  it.skipIf(asRoot)('runs claude without tracing when the folder cannot be moved', () => {
    const { cwd, env } = setup();
    mkdirSync(path.join(cwd, '.claude-trace'), { mode: 0o555 });
    chmodSync(path.join(cwd, '.claude-trace'), 0o555);
    chmodSync(cwd, 0o555);
    const r = run(cwd, env);
    expect(r.status).toBe(0);
    expect(r.stdout).toBe('UNTRACED --print hi');
    expect(r.stderr).toContain('running claude without tracing');
  });
});
