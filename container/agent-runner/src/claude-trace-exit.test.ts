/**
 * The claude-trace wrapper (container/claude-trace/dist/cli.js) must exit once
 * the claude it wraps has exited.
 *
 * CLAUDE_CODE_EXECUTABLE points the SDK at the wrapper, which spawns the real
 * binary with stdio "inherit". Both processes hold the SDK's stdout pipe, so
 * the SDK gets EOF only when both are gone. Prod: claude had exited, but the
 * wrapper's event loop stayed alive (a lingering socket), so the runner's
 * `for await (query.events)` never ended. These tests run the real wrapper
 * under node with /bin/bash as the "native claude".
 */
import { afterAll, afterEach, beforeAll, describe, expect, it } from 'bun:test';
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

const TRACE_SRC = path.resolve(import.meta.dir, '../../claude-trace');
const BASH = '/bin/bash';
const hasNode = spawnSync('node', ['--version']).status === 0;
const runnable = hasNode && fs.existsSync(BASH) && fs.existsSync(path.join(TRACE_SRC, 'dist', 'cli.js'));

// Run a copy laid out like the /opt/claude-trace mount: in-repo, the root
// package.json's "type": "module" would make node load the CommonJS dist as ESM.
let traceDir = '';
let CLI = '';
beforeAll(() => {
  traceDir = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-trace-dist-'));
  for (const sub of ['dist', 'frontend']) {
    fs.cpSync(path.join(TRACE_SRC, sub), path.join(traceDir, sub), { recursive: true });
  }
  CLI = path.join(traceDir, 'dist', 'cli.js');
});
afterAll(() => fs.rmSync(traceDir, { recursive: true, force: true }));

// A request that is still being sent keeps the proxy's server open after
// server.close(); this models the wrapper's lingering event loop. The holder
// runs detached from stdout so only the wrapper itself can hold the pipe.
const HOLD_REQUEST_OPEN = `
port="\${ANTHROPIC_BASE_URL##*:}"
( exec 3<>"/dev/tcp/127.0.0.1/$port"
  printf 'POST /v1/messages HTTP/1.1\\r\\nHost: x\\r\\nContent-Length: 100\\r\\n\\r\\n{' >&3
  touch "$TRACE_TEST_MARK"
  sleep "$TRACE_TEST_HOLD" ) </dev/null >/dev/null 2>&1 &
echo $! > "$TRACE_TEST_PIDFILE"
while [ ! -f "$TRACE_TEST_MARK" ]; do sleep 0.02; done
sleep 0.3
exit 3
`;

type Run = { code: number | null; ms: number; tmp: string };

const tmpDirs: string[] = [];
afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    const pidFile = path.join(dir, 'holder.pid');
    if (fs.existsSync(pidFile)) {
      try {
        process.kill(Number(fs.readFileSync(pidFile, 'utf8').trim()));
      } catch {
        // already gone
      }
    }
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

/** Run the wrapper like the SDK does and time it until its stdout reaches EOF. */
function runWrapper(script: string, holdSeconds = 0, maxMs = 20_000): Promise<Run> {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'claude-trace-exit-'));
  tmpDirs.push(tmp);
  const env: Record<string, string | undefined> = {
    ...process.env,
    ANTHROPIC_BASE_URL: 'https://127.0.0.1:9',
    TRACE_TEST_MARK: path.join(tmp, 'connected'),
    TRACE_TEST_PIDFILE: path.join(tmp, 'holder.pid'),
    TRACE_TEST_HOLD: String(holdSeconds),
  };
  for (const key of ['HTTPS_PROXY', 'https_proxy', 'HTTP_PROXY', 'http_proxy']) delete env[key];
  const started = Date.now();
  const child = spawn(
    'node',
    [
      CLI,
      '--no-open',
      '--include-all-requests',
      '--log',
      'exit-test',
      '--claude-path',
      BASH,
      '--run-with',
      '-c',
      script,
    ],
    { cwd: tmp, env, stdio: ['pipe', 'pipe', 'pipe'] },
  );
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`wrapper still running after ${maxMs}ms (the SDK would never see EOF)`));
    }, maxMs);
    child.stdout.resume();
    child.stderr.resume();
    // 'close' = exited AND stdio closed: what the SDK waits for.
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, ms: Date.now() - started, tmp });
    });
  });
}

describe.skipIf(!runnable)('claude-trace wrapper exits after the wrapped claude', () => {
  it('propagates the exit code and keeps the trace file', async () => {
    const run = await runWrapper('exit 3');
    expect(run.code).toBe(3);
    expect(fs.existsSync(path.join(run.tmp, '.claude-trace', 'exit-test.jsonl'))).toBe(true);
  });

  it('waits for in-flight proxy work to finish before exiting', async () => {
    const run = await runWrapper(HOLD_REQUEST_OPEN, 1);
    expect(run.code).toBe(3);
    expect(run.ms).toBeGreaterThanOrEqual(1_000); // did not cut the open request short
    expect(run.ms).toBeLessThan(8_000);
  }, 25_000);

  it('exits within the drain bound even when a connection never closes', async () => {
    const run = await runWrapper(HOLD_REQUEST_OPEN, 120);
    expect(run.code).toBe(3);
    expect(run.ms).toBeLessThan(15_000);
  }, 25_000);

  it('reports a signal-killed claude as a failure', async () => {
    const run = await runWrapper('kill -TERM $$');
    expect(run.code).toBe(1);
  });
});
