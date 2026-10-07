import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath } from 'url';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const LIB = path.join(path.dirname(fileURLToPath(import.meta.url)), 'host-profile.sh');

let tmp: string;
let vendorFile: string;
let caFile: string;

function sh(script: string, env: Record<string, string> = {}) {
  return spawnSync('bash', ['-c', `source "${LIB}"; ${script}`], {
    encoding: 'utf-8',
    env: {
      PATH: process.env.PATH,
      NANOCLAW_DMI_VENDOR_FILE: vendorFile,
      NANOCLAW_SANDBOX_CA_FILE: caFile,
      ...env,
    },
  });
}

const detect = (env: Record<string, string> = {}) => sh('nanoclaw_detect_host_profile', env).stdout.trim();
const onLinux = os.platform() === 'linux';

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'host-profile-'));
  vendorFile = path.join(tmp, 'sys_vendor');
  caFile = path.join(tmp, 'sandbox-egress-ca.crt');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('nanoclaw_detect_host_profile', () => {
  it('matches nothing on an ordinary host', () => {
    fs.writeFileSync(vendorFile, 'QEMU\n');
    expect(detect()).toBe('');
  });

  it('needs both the KubeVirt vendor and the sandbox CA', () => {
    fs.writeFileSync(vendorFile, 'KubeVirt\n');
    expect(detect()).toBe('');
    fs.rmSync(vendorFile);
    fs.writeFileSync(caFile, 'cert');
    expect(detect()).toBe('');
  });

  it.runIf(onLinux)('recognises an NVIDIA agent sandbox VM', () => {
    fs.writeFileSync(vendorFile, 'KubeVirt\n');
    fs.writeFileSync(caFile, 'cert');
    expect(detect()).toBe('agent-sandbox');
  });

  it.skipIf(onLinux)('never matches off Linux', () => {
    fs.writeFileSync(vendorFile, 'KubeVirt\n');
    fs.writeFileSync(caFile, 'cert');
    expect(detect()).toBe('');
  });

  it('NANOCLAW_HOST_PROFILE=none disables detection', () => {
    fs.writeFileSync(vendorFile, 'KubeVirt\n');
    fs.writeFileSync(caFile, 'cert');
    expect(detect({ NANOCLAW_HOST_PROFILE: 'none' })).toBe('');
  });

  it('NANOCLAW_HOST_PROFILE forces a profile, and rejects path-like names', () => {
    expect(detect({ NANOCLAW_HOST_PROFILE: 'agent-sandbox' })).toBe('agent-sandbox');
    const res = sh('nanoclaw_detect_host_profile', { NANOCLAW_HOST_PROFILE: '../evil' });
    expect(res.stdout.trim()).toBe('');
    expect(res.stderr).toContain('Ignoring invalid');
  });
});

describe('nanoclaw_apply_host_profile', () => {
  it('is a no-op when no profile applies', () => {
    const res = sh(`nanoclaw_apply_host_profile "${tmp}"`);
    expect(res.status).toBe(0);
    expect(res.stdout).toBe('');
  });

  it("runs the profile's prep.sh and returns its status", () => {
    const dir = path.join(tmp, 'setup', 'host-profiles', 'demo');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'prep.sh'), 'echo prepared; exit 3\n');
    const res = sh(`nanoclaw_apply_host_profile "${tmp}"`, { NANOCLAW_HOST_PROFILE: 'demo' });
    expect(res.stdout).toContain('prepared');
    expect(res.status).toBe(3);
  });

  it('fails on a forced profile that does not exist', () => {
    const res = sh(`nanoclaw_apply_host_profile "${tmp}"`, { NANOCLAW_HOST_PROFILE: 'missing' });
    expect(res.status).toBe(1);
    expect(res.stderr).toContain('Unknown host profile');
  });
});

describe('agent-sandbox profile', () => {
  const dir = path.join(path.dirname(LIB), 'host-profiles', 'agent-sandbox');

  it('ships a prep script that parses', () => {
    expect(spawnSync('bash', ['-n', path.join(dir, 'prep.sh')]).status).toBe(0);
  });

  it('only sets settings that something reads', () => {
    const keys = fs
      .readFileSync(path.join(dir, 'profile.env'), 'utf-8')
      .split('\n')
      .filter((l) => /^[A-Z_]+=/.test(l))
      .map((l) => l.split('=')[0]);
    expect(keys.sort()).toEqual([
      'NANOCLAW_AGENT_DOCKER_HOST',
      'NANOCLAW_AGENT_NETWORK',
      'NANOCLAW_BUILD_NETWORK',
      'NANOCLAW_DOCKERHUB_MIRROR',
      'NANOCLAW_EXTRA_CA_DIR',
      'NANOCLAW_GHCR_MIRROR',
      'NANOCLAW_GITHUB_RELEASES_MIRROR',
      'NANOCLAW_SLIRP_HOST_IP',
    ]);
  });
});
