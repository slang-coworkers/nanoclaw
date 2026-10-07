import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SCRIPT = path.join(HERE, 'build-prep.sh');
const STAGE = path.join(HERE, 'extra-ca');
const PEM = '-----BEGIN CERTIFICATE-----\nMIIBfake\n-----END CERTIFICATE-----\n';

let tmp: string;
let calls: string;

/** A stand-in for the docker CLI: records every call, knows no local images. */
function fakeRuntime(): string {
  const bin = path.join(tmp, 'fake-docker');
  fs.writeFileSync(bin, `#!/bin/bash\necho "$*" >> "${calls}"\n[ "$1 $2" = "image inspect" ] && exit 1\nexit 0\n`, {
    mode: 0o755,
  });
  return bin;
}

function run(env: Record<string, string>) {
  return spawnSync('bash', [SCRIPT], {
    encoding: 'utf-8',
    env: {
      PATH: process.env.PATH,
      HOME: process.env.HOME,
      NANOCLAW_ENV_FILE: path.join(tmp, 'absent.env'),
      CONTAINER_RUNTIME: fakeRuntime(),
      ...env,
    },
  });
}

function staged(): string[] {
  return fs.readdirSync(STAGE).filter((f) => f !== 'README.md');
}

function cleanStage(): void {
  for (const f of staged()) fs.rmSync(path.join(STAGE, f));
}

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'build-prep-'));
  calls = path.join(tmp, 'calls.log');
  cleanStage();
});

afterEach(() => {
  cleanStage();
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('container/build-prep.sh', () => {
  it('does nothing when no setting is configured', () => {
    const res = run({});
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
    expect(staged()).toEqual([]);
    expect(fs.existsSync(calls)).toBe(false);
  });

  it('stages CA certificates and passes the build-time trust args', () => {
    const caDir = path.join(tmp, 'ca');
    fs.mkdirSync(caDir);
    fs.writeFileSync(path.join(caDir, 'corp-root.crt'), PEM);
    fs.writeFileSync(path.join(caDir, 'proxy.pem'), PEM);
    fs.writeFileSync(path.join(caDir, 'notes.crt'), 'not a certificate\n');

    const res = run({ NANOCLAW_EXTRA_CA_DIR: caDir });
    expect(res.status).toBe(0);
    expect(staged().sort()).toEqual(['corp-root.crt', 'proxy.crt']);
    expect(res.stdout.split('\n').filter(Boolean)).toEqual([
      '--build-arg',
      'NODE_EXTRA_CA_CERTS=/etc/ssl/certs/ca-certificates.crt',
      '--build-arg',
      'PIP_CERT=/etc/ssl/certs/ca-certificates.crt',
      '--build-arg',
      'UV_NATIVE_TLS=true',
    ]);
  });

  it('clears certificates an earlier build staged once the setting is removed', () => {
    fs.writeFileSync(path.join(STAGE, 'stale.crt'), PEM);
    expect(run({}).status).toBe(0);
    expect(staged()).toEqual([]);
  });

  it('fails rather than building without a configured CA', () => {
    const empty = path.join(tmp, 'empty');
    fs.mkdirSync(empty);
    expect(run({ NANOCLAW_EXTRA_CA_DIR: empty }).status).toBe(1);
    expect(run({ NANOCLAW_EXTRA_CA_DIR: path.join(tmp, 'missing') }).status).toBe(1);
  });

  it('passes the GitHub releases mirror without a trailing slash', () => {
    const res = run({ NANOCLAW_GITHUB_RELEASES_MIRROR: 'https://mirror.example/gh-remote/' });
    expect(res.status).toBe(0);
    expect(res.stdout).toContain('GITHUB_RELEASES_MIRROR=https://mirror.example/gh-remote\n');
    expect(res.stdout).toContain(
      'npm_config_better_sqlite3_binary_host_mirror=https://mirror.example/gh-remote/WiseLibs/better-sqlite3/releases/download\n',
    );
  });

  it('passes the Debian mirror, and rejects one that is not a URL', () => {
    const res = run({ NANOCLAW_DEBIAN_MIRROR: 'https://deb.debian.org/' });
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('--build-arg\nDEBIAN_MIRROR=https://deb.debian.org\n');
    // The slim base has no CA certificates yet, so apt gets the host's bundle.
    expect(staged()).toEqual(['host-ca-bundle.pem']);
    expect(fs.readFileSync(path.join(STAGE, 'host-ca-bundle.pem'), 'utf-8')).toContain('BEGIN CERTIFICATE');
    expect(run({ NANOCLAW_DEBIAN_MIRROR: 'deb.debian.org' }).status).toBe(1);
  });

  it('stages no host bundle for a plain-HTTP Debian mirror', () => {
    expect(run({ NANOCLAW_DEBIAN_MIRROR: 'http://mirror.example/debian-root' }).status).toBe(0);
    expect(staged()).toEqual([]);
  });

  it('rejects a GitHub mirror that is not a URL', () => {
    expect(run({ NANOCLAW_GITHUB_RELEASES_MIRROR: 'mirror.example' }).status).toBe(1);
  });

  it('pulls missing Docker Hub base images through the mirror under their own names', () => {
    const res = run({ NANOCLAW_DOCKERHUB_MIRROR: 'registry.example/hub/' });
    expect(res.status).toBe(0);
    const log = fs.readFileSync(calls, 'utf-8');
    expect(log).toContain('pull -q registry.example/hub/library/node:22-slim\n');
    expect(log).toContain('tag registry.example/hub/library/node:22-slim node:22-slim\n');
    // The pinned syntax frontend: pulled by digest, tagged without it.
    expect(log).toMatch(/pull -q registry\.example\/hub\/docker\/dockerfile:[\d.]+@sha256:[0-9a-f]{64}\n/);
    expect(log).toMatch(
      /tag registry\.example\/hub\/docker\/dockerfile:[\d.]+@sha256:[0-9a-f]{64} docker\/dockerfile:[\d.]+\n/,
    );
  });

  it('reads settings from .env when the environment does not set them', () => {
    const envFile = path.join(tmp, '.env');
    fs.writeFileSync(envFile, 'NANOCLAW_GITHUB_RELEASES_MIRROR="https://mirror.example/gh"\n');
    const res = run({ NANOCLAW_ENV_FILE: envFile });
    expect(res.stdout).toContain('GITHUB_RELEASES_MIRROR=https://mirror.example/gh\n');
  });
});
