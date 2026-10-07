import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'sync-agent-runtime.sh');
const IMAGE = 'nanoclaw-agent-test:latest';
const AGENT = 'unix:///run/podman/podman.sock';

let tmp: string;

/**
 * A stand-in for the docker CLI with two engines, keyed on DOCKER_HOST. The
 * build engine has IMAGE with layers [a,b]. `load` into the agent engine names
 * the result the way podman does for an OCI archive (localhost/latest:latest).
 */
function fakeRuntime(agentLayersAfterLoad = '["a","b"]'): string {
  const bin = path.join(tmp, 'fake-docker');
  fs.writeFileSync(
    bin,
    `#!/bin/bash
state="${tmp}"
echo "\${DOCKER_HOST:-build} $*" >> "$state/calls.log"
engine="\${DOCKER_HOST:-build}"
case "$1" in
  image)
    if [ "$engine" = build ]; then echo '["a","b"]'; exit 0; fi
    [ -f "$state/agent-tagged" ] && { cat "$state/agent-layers"; exit 0; }
    exit 1 ;;
  save) echo archive ;;
  load) cat > /dev/null; echo '${agentLayersAfterLoad}' > "$state/agent-layers"; echo "Loaded image: localhost/latest:latest" ;;
  tag) touch "$state/agent-tagged" ;;
esac
exit 0
`,
    { mode: 0o755 },
  );
  return bin;
}

function run(env: Record<string, string>, runtime = fakeRuntime()) {
  return spawnSync('bash', [SCRIPT, IMAGE], {
    encoding: 'utf-8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NANOCLAW_ENV_FILE: path.join(tmp, 'absent.env'),
      CONTAINER_RUNTIME: runtime,
      ...env,
    },
  });
}

function calls(): string {
  const file = path.join(tmp, 'calls.log');
  return fs.existsSync(file) ? fs.readFileSync(file, 'utf-8') : '';
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'sync-agent-runtime-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('container/sync-agent-runtime.sh', () => {
  it('is a no-op when NANOCLAW_AGENT_DOCKER_HOST is unset', () => {
    const res = run({});
    expect(res.status).toBe(0);
    expect(calls()).toBe('');
  });

  it('is a no-op when agents already use the build engine', () => {
    const res = run({ NANOCLAW_AGENT_DOCKER_HOST: AGENT, DOCKER_HOST: AGENT });
    expect(res.status).toBe(0);
    expect(calls()).toBe('');
  });

  it('loads the image into the agent engine and restores its name', () => {
    const res = run({ NANOCLAW_AGENT_DOCKER_HOST: AGENT });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain(`Agent runtime has ${IMAGE}`);
    const log = calls();
    expect(log).toContain(`build save ${IMAGE}\n`);
    expect(log).toContain(`${AGENT} load\n`);
    expect(log).toContain(`${AGENT} tag localhost/latest:latest ${IMAGE}\n`);
    expect(log).toContain(`${AGENT} rmi localhost/latest:latest\n`);
  });

  it('skips the copy when the agent engine already has the same layers', () => {
    fs.writeFileSync(path.join(tmp, 'agent-layers'), '["a","b"]\n');
    fs.writeFileSync(path.join(tmp, 'agent-tagged'), '');
    const res = run({ NANOCLAW_AGENT_DOCKER_HOST: AGENT });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('already has');
    expect(calls()).not.toContain('save');
  });

  it('fails when the agent engine ends up with different layers', () => {
    const res = run({ NANOCLAW_AGENT_DOCKER_HOST: AGENT }, fakeRuntime('["a","x"]'));
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('different layers');
  });

  it('reads the setting from .env', () => {
    const envFile = path.join(tmp, '.env');
    fs.writeFileSync(envFile, `NANOCLAW_AGENT_DOCKER_HOST=${AGENT}\n`);
    const res = run({ NANOCLAW_ENV_FILE: envFile });
    expect(res.status).toBe(0);
    expect(calls()).toContain(`${AGENT} load\n`);
  });
});
