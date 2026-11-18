import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

/**
 * The swap script edits the gateway's compose file with a Python program embedded in the shell
 * script. These tests run that program on the shapes real compose files have, so a change to the
 * script cannot break the edit unnoticed.
 */
const SCRIPT = path.join(__dirname, 'onecli-gateway-swap.sh');

function embeddedEditor(): string {
  const match = /python3 - "\$COMPOSE" "\$SERVICE" "\$1" <<'PY'\n([\s\S]*?)\nPY\n/.exec(
    fs.readFileSync(SCRIPT, 'utf8'),
  );
  if (!match) throw new Error('the edit program is not in the script');
  return match[1];
}

/** Run the edit program on a compose file whose gateway service has the given ports block. */
function editCompose(extra: string): { status: number | null; text: string; stdout: string } {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swap-'));
  const file = path.join(dir, 'docker-compose.yml');
  fs.writeFileSync(file, `services:\n  onecli:\n    image: onecli-cost:v3\n${extra}`);
  const run = spawnSync('python3', ['-c', embeddedEditor(), file, 'onecli', 'onecli-cost:v5'], { encoding: 'utf8' });
  const text = fs.readFileSync(file, 'utf8');
  fs.rmSync(dir, { recursive: true, force: true });
  return { status: run.status, text, stdout: run.stdout.trim() };
}

describe('onecli-gateway-swap compose edit', () => {
  it('has bash syntax that parses', () => {
    expect(() => execFileSync('bash', ['-n', SCRIPT])).not.toThrow();
  });

  it('binds a literal 0.0.0.0 mapping to loopback and leaves the proxy port alone', () => {
    const out = editCompose('    ports:\n      - "0.0.0.0:10254:10254"\n      - "0.0.0.0:10255:10255"\n');
    expect(out.status).toBe(0);
    expect(out.stdout).toBe('10254');
    expect(out.text).toContain('- "127.0.0.1:10254:10254"');
    expect(out.text).toContain('- "0.0.0.0:10255:10255"');
    expect(out.text).toContain('image: onecli-cost:v5');
  });

  it('binds a mapping whose host is a compose variable, and leaves a URL value alone', () => {
    const out = editCompose(
      '    ports:\n      - "${ONECLI_BIND_HOST:-127.0.0.1}:10254:10254"\n      - "${ONECLI_BIND_HOST:-127.0.0.1}:10255:10255"\n' +
        '    environment:\n      APP_URL: http://${ONECLI_BIND_HOST:-127.0.0.1}:10254\n',
    );
    expect(out.status).toBe(0);
    expect(out.text).toContain('- "127.0.0.1:10254:10254"');
    expect(out.text).toContain('- "${ONECLI_BIND_HOST:-127.0.0.1}:10255:10255"');
    expect(out.text).toContain('APP_URL: http://${ONECLI_BIND_HOST:-127.0.0.1}:10254');
  });

  it('binds a mapping that names no host', () => {
    const out = editCompose('    ports:\n      - 10254:10254\n');
    expect(out.status).toBe(0);
    expect(out.text).toContain('- 127.0.0.1:10254:10254');
  });

  it('stops when the service publishes no management port', () => {
    const out = editCompose('    ports:\n      - "10255:10255"\n');
    expect(out.status).not.toBe(0);
  });
});

/**
 * After a swap only 127.0.0.1 answers on the management port, so a host script that still calls the API on
 * the bridge address fails. The prod GitHub token refresh did, silently, for three hours. `check-callers`
 * must name such scripts and leave loopback calls and the proxy port alone.
 */
describe('onecli-gateway-swap check-callers', () => {
  function run(files: Record<string, string>, crontab: string): { status: number | null; stdout: string } {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'swap-callers-'));
    for (const [name, body] of Object.entries(files)) {
      fs.mkdirSync(path.dirname(path.join(dir, name)), { recursive: true });
      fs.writeFileSync(path.join(dir, name), body);
    }
    const tab = path.join(dir, 'crontab');
    fs.writeFileSync(tab, crontab.replaceAll('$DIR', dir));
    const r = spawnSync('bash', [SCRIPT, 'check-callers', '10254'], {
      encoding: 'utf8',
      env: { ...process.env, ONECLI_SCAN_DIRS: path.join(dir, 'cfg'), ONECLI_SCAN_CRONTAB_FILE: tab },
    });
    fs.rmSync(dir, { recursive: true, force: true });
    return { status: r.status, stdout: r.stdout };
  }

  it('names a script that calls the API on the bridge address, from the scan folder and from crontab', () => {
    const out = run(
      {
        'cfg/refresh.sh': 'ONECLI_API_HOST=http://172.17.0.1:10254 onecli secrets update --id x\n',
        'bin/job.sh': 'curl -s http://0.0.0.0:10254/v1/health\n',
      },
      '*/30 * * * * $DIR/bin/job.sh >> /tmp/job.log 2>&1\n',
    );
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('cfg/refresh.sh calls the OneCLI management API');
    expect(out.stdout).toContain('bin/job.sh calls the OneCLI management API');
  });

  it('leaves loopback calls, the proxy port and commented crontab lines alone', () => {
    const out = run(
      {
        'cfg/ok.sh': 'curl http://127.0.0.1:10254/api/x\n',
        'cfg/ok.py': 'URL = "http://localhost:10254/v1"\n',
        'cfg/proxy.sh': 'HTTPS_PROXY=http://172.17.0.1:10255\n',
        'bin/old.sh': 'curl http://172.17.0.1:10254/v1/health\n',
      },
      '# */30 * * * * $DIR/bin/old.sh\n',
    );
    expect(out.status).toBe(0);
    expect(out.stdout).toContain('none call the management API off loopback');
    expect(out.stdout).not.toContain('WARNING');
  });
});
