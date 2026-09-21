// The codex MCP child's git write guard (codex-mcp-server.ts) and the files it
// points at (container/hooks/codex-git-guard/). Behavioural proof of the guard
// against a real git lives in scripts/prove-codex-git-guard.sh; this pins the
// wiring: what the child's env carries, that envInherit did not move, that both
// providers' serializers accept it, that the shell-policy overrides are forced,
// that the hook files are executable — git silently ignores a hook without +x,
// which would switch the guard off with no error anywhere — and that the
// system-scope gitconfig on disk is the TypeScript table, not a drifting copy.
import { execFileSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'bun:test';

import {
  CODEX_GIT_GUARD_CONFIG,
  CODEX_GIT_GUARD_GITCONFIG_PATH,
  CODEX_GIT_GUARD_HOOKS_PATH,
  CODEX_MCP_ENV_INHERIT,
  CODEX_SHELL_ENV_INCLUDE_ONLY_OVERRIDE,
  buildCodexMcpServer,
  codexGitGuardEnv,
  codexGitGuardShellPolicyOverrides,
  renderCodexGitGuardGitconfig,
} from './codex-mcp-server.js';
import { resolveEnvInherit, writeCodexMcpConfigToml } from './providers/codex-app-server.js';

const PUSH_INSTEAD_OF = 'url.disabled://.pushInsteadOf';

const EXPECTED_GIT_CONFIG: Record<string, string> = {
  GIT_CONFIG_COUNT: '10',
  GIT_CONFIG_SYSTEM: '/app/hooks/codex-git-guard/gitconfig',
  GIT_CONFIG_KEY_0: 'core.hooksPath',
  GIT_CONFIG_VALUE_0: '/app/hooks/codex-git-guard',
  GIT_CONFIG_KEY_1: PUSH_INSTEAD_OF,
  GIT_CONFIG_VALUE_1: 'https://',
  GIT_CONFIG_KEY_2: PUSH_INSTEAD_OF,
  GIT_CONFIG_VALUE_2: 'http://',
  GIT_CONFIG_KEY_3: PUSH_INSTEAD_OF,
  GIT_CONFIG_VALUE_3: 'git@',
  GIT_CONFIG_KEY_4: PUSH_INSTEAD_OF,
  GIT_CONFIG_VALUE_4: 'ssh://',
  // Local paths: git strips GIT_CONFIG_* from the receive-pack it spawns for
  // them, so the client-side rewrite is the first stop.
  GIT_CONFIG_KEY_5: PUSH_INSTEAD_OF,
  GIT_CONFIG_VALUE_5: 'file://',
  GIT_CONFIG_KEY_6: PUSH_INSTEAD_OF,
  GIT_CONFIG_VALUE_6: '/',
  GIT_CONFIG_KEY_7: PUSH_INSTEAD_OF,
  GIT_CONFIG_VALUE_7: '.',
  // pushInsteadOf is ignored for a remote with an explicit pushurl, for
  // scp-style user@host: and for insteadOf aliases; the protocol policy is
  // checked on the transport type and closes all of those. protocol.file.allow
  // must be explicit — a per-protocol key beats the protocol.allow fallback.
  GIT_CONFIG_KEY_8: 'protocol.allow',
  GIT_CONFIG_VALUE_8: 'never',
  GIT_CONFIG_KEY_9: 'protocol.file.allow',
  GIT_CONFIG_VALUE_9: 'never',
};

const HOOKS = ['pre-commit', 'pre-merge-commit', 'pre-rebase', 'pre-push', 'reference-transaction'];

// container/agent-runner/src → container/hooks
const hooksDir = path.resolve(import.meta.dir, '..', '..', 'hooks', 'codex-git-guard');

function stdio(cfg: ReturnType<typeof buildCodexMcpServer>) {
  if (!('command' in cfg)) throw new Error('codex MCP entry must be a stdio server');
  return cfg;
}

function gitAvailable(): boolean {
  try {
    execFileSync('git', ['--version'], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

describe('codex MCP child env — git write guard', () => {
  it('carries HOME/PATH plus exactly the GIT_CONFIG_* guard pairs', () => {
    const cfg = stdio(buildCodexMcpServer({ HOME: '/home/node', PATH: '/usr/bin' }));
    expect(cfg.command).toBe('codex');
    expect(cfg.env).toEqual({ HOME: '/home/node', PATH: '/usr/bin', ...EXPECTED_GIT_CONFIG });
    // No stray GIT_CONFIG_* beyond the count — git dies on a KEY without a VALUE.
    const gitKeys = Object.keys(cfg.env ?? {}).filter((k) => k.startsWith('GIT_CONFIG_'));
    expect(gitKeys.sort()).toEqual(Object.keys(EXPECTED_GIT_CONFIG).sort());
  });

  it('pins hooksPath, the seven pushInsteadOf prefixes, protocol.allow/protocol.file.allow=never and the system gitconfig', () => {
    expect(CODEX_GIT_GUARD_HOOKS_PATH).toBe('/app/hooks/codex-git-guard');
    expect(CODEX_GIT_GUARD_GITCONFIG_PATH).toBe('/app/hooks/codex-git-guard/gitconfig');
    expect(CODEX_GIT_GUARD_CONFIG[0]).toEqual(['core.hooksPath', '/app/hooks/codex-git-guard']);
    const pushInsteadOf = CODEX_GIT_GUARD_CONFIG.filter(([k]) => k === PUSH_INSTEAD_OF).map(([, v]) => v);
    // The four required network transports…
    for (const prefix of ['https://', 'http://', 'git@', 'ssh://']) expect(pushInsteadOf).toContain(prefix);
    // …plus the local-path shapes, which hooks cannot stop (see EXPECTED_GIT_CONFIG).
    for (const prefix of ['file://', '/', '.']) expect(pushInsteadOf).toContain(prefix);
    expect(pushInsteadOf).toHaveLength(7);
    // Both protocol keys, explicitly — protocol.allow alone loses to any protocol.file.allow.
    expect(CODEX_GIT_GUARD_CONFIG).toContainEqual(['protocol.allow', 'never']);
    expect(CODEX_GIT_GUARD_CONFIG).toContainEqual(['protocol.file.allow', 'never']);
    // Nothing else — an insteadOf (fetch) rewrite would break reads.
    expect(CODEX_GIT_GUARD_CONFIG.map(([k]) => k).filter((k) => k !== PUSH_INSTEAD_OF)).toEqual([
      'core.hooksPath',
      'protocol.allow',
      'protocol.file.allow',
    ]);
    expect(codexGitGuardEnv()).toEqual(EXPECTED_GIT_CONFIG);
  });

  it('leaves envInherit unchanged (names only, no guard vars, no overlap with env)', () => {
    const cfg = stdio(buildCodexMcpServer({}));
    expect(cfg.envInherit).toEqual([
      'NVIDIA_API_KEY',
      'HTTPS_PROXY',
      'HTTP_PROXY',
      'NO_PROXY',
      'SSL_CERT_FILE',
      'SSL_CERT_DIR',
      'NODE_EXTRA_CA_CERTS',
    ]);
    expect(cfg.envInherit).toEqual([...CODEX_MCP_ENV_INHERIT]);
    for (const name of cfg.envInherit ?? []) expect(cfg.env).not.toHaveProperty(name);
  });

  it('survives the Claude provider path: resolveEnvInherit keeps the guard in the spawn env', () => {
    const cfg = stdio(buildCodexMcpServer({ HOME: '/home/node', PATH: '/usr/bin' }));
    const spawnEnv = resolveEnvInherit(cfg, { HTTPS_PROXY: 'http://tok@proxy:1', NVIDIA_API_KEY: 'x' }, 'codex');
    expect(spawnEnv).toMatchObject({ ...EXPECTED_GIT_CONFIG, HTTPS_PROXY: 'http://tok@proxy:1' });
  });

  it('forces include_only=[] and mirrors every pair as a TOML-string shell_environment_policy.set, before mcp-server', () => {
    const cfg = stdio(buildCodexMcpServer({}));
    const args = cfg.args ?? [];
    expect(args[args.length - 1]).toBe('mcp-server');
    // Every override is a `-c <k=v>` pair.
    const overrides: string[] = [];
    for (let i = 0; i < args.length - 1; i += 2) {
      expect(args[i]).toBe('-c');
      overrides.push(args[i + 1]);
    }
    const policyOverrides = codexGitGuardShellPolicyOverrides();
    // include_only=[] comes first: a config.toml include_only is applied after
    // `set` and would silently drop every pair — git would run unguarded.
    expect(policyOverrides[0]).toBe(CODEX_SHELL_ENV_INCLUDE_ONLY_OVERRIDE);
    expect(CODEX_SHELL_ENV_INCLUDE_ONLY_OVERRIDE).toBe('shell_environment_policy.include_only=[]');
    expect(policyOverrides).toHaveLength(1 + Object.keys(EXPECTED_GIT_CONFIG).length);
    for (const [name, value] of Object.entries(EXPECTED_GIT_CONFIG)) {
      // Quoted: codex parses the value as TOML and rejects a bare integer for a string map.
      expect(policyOverrides).toContain(`shell_environment_policy.set.${name}="${value}"`);
    }
    for (const o of policyOverrides) expect(overrides).toContain(o);
    // The pre-existing routing overrides are still there.
    expect(overrides).toContain('sandbox_mode=danger-full-access');
    expect(overrides).toContain('features.use_linux_sandbox_bwrap=false');
  });
});

describe('codex MCP child env — Codex provider TOML serializer', () => {
  const oldHome = process.env.HOME;
  let tmp: string;
  beforeEach(() => {
    tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'codex-git-guard-toml-'));
    process.env.HOME = tmp;
  });
  afterEach(() => {
    process.env.HOME = oldHome;
    fs.rmSync(tmp, { recursive: true, force: true });
  });

  it('writes the guard pairs under [mcp_servers.codex.env] and the names under env_vars', () => {
    writeCodexMcpConfigToml({ codex: buildCodexMcpServer({ HOME: '/home/node', PATH: '/usr/bin' }) });
    const toml = fs.readFileSync(path.join(tmp, '.codex', 'config.toml'), 'utf-8');
    expect(toml).toContain('[mcp_servers.codex.env]');
    expect(toml).toContain('GIT_CONFIG_COUNT = "10"');
    expect(toml).toContain('GIT_CONFIG_SYSTEM = "/app/hooks/codex-git-guard/gitconfig"');
    expect(toml).toContain('GIT_CONFIG_KEY_0 = "core.hooksPath"');
    expect(toml).toContain('GIT_CONFIG_VALUE_0 = "/app/hooks/codex-git-guard"');
    expect(toml).toContain('GIT_CONFIG_KEY_1 = "url.disabled://.pushInsteadOf"');
    expect(toml).toContain('GIT_CONFIG_VALUE_4 = "ssh://"');
    expect(toml).toContain('GIT_CONFIG_VALUE_7 = "."');
    expect(toml).toContain('GIT_CONFIG_KEY_8 = "protocol.allow"');
    expect(toml).toContain('GIT_CONFIG_KEY_9 = "protocol.file.allow"');
    expect(toml).toContain('GIT_CONFIG_VALUE_9 = "never"');
    expect(toml).toContain('env_vars = ["NVIDIA_API_KEY", "HTTPS_PROXY"');
    // Secrets stay out of the literal block.
    expect(toml).not.toMatch(/\nNVIDIA_API_KEY = /);
    expect(toml).not.toMatch(/\nHTTPS_PROXY = /);
  });
});

describe('container/hooks/codex-git-guard/', () => {
  it('is the directory core.hooksPath names, relative to the /app/hooks bind mount', () => {
    expect(CODEX_GIT_GUARD_HOOKS_PATH.startsWith('/app/hooks/')).toBe(true);
    expect(path.basename(CODEX_GIT_GUARD_HOOKS_PATH)).toBe(path.basename(hooksDir));
    expect(fs.statSync(hooksDir).isDirectory()).toBe(true);
  });

  it('contains exactly the five hooks and the gitconfig — nothing that git could pick up as an unintended hook', () => {
    expect(fs.readdirSync(hooksDir).sort()).toEqual([...HOOKS, 'gitconfig'].sort());
  });

  for (const hook of HOOKS) {
    it(`${hook} exists, is executable, has a shebang and refuses by name`, () => {
      const file = path.join(hooksDir, hook);
      const st = fs.statSync(file);
      expect(st.isFile()).toBe(true);
      // git ignores a hook without the execute bit — silently. Owner bit is
      // what git's access(X_OK) needs; a umask-077 checkout is still fine.
      expect(st.mode & 0o100).toBe(0o100);
      const body = fs.readFileSync(file, 'utf-8');
      expect(body.startsWith('#!/bin/sh\n')).toBe(true);
      expect(body).toContain(`codex critique is read-only: git ${hook} refused (codex-git-guard)`);
      expect(body).toContain('exit 1');
    });
  }

  it('reference-transaction refuses only the "prepared" state', () => {
    const body = fs.readFileSync(path.join(hooksDir, 'reference-transaction'), 'utf-8');
    expect(body).toContain('prepared)');
    expect(body.trimEnd().endsWith('exit 0')).toBe(true);
  });
});

describe('container/hooks/codex-git-guard/gitconfig (GIT_CONFIG_SYSTEM)', () => {
  const file = path.join(hooksDir, 'gitconfig');

  it('is byte-for-byte the render of CODEX_GIT_GUARD_CONFIG — one source of truth', () => {
    expect(path.basename(CODEX_GIT_GUARD_GITCONFIG_PATH)).toBe('gitconfig');
    expect(fs.readFileSync(file, 'utf-8')).toBe(renderCodexGitGuardGitconfig());
  });

  it('renders the git key grammar: section / quoted subsection / variable, grouped', () => {
    const rendered = renderCodexGitGuardGitconfig();
    expect(rendered).toContain('[core]\n\thooksPath = /app/hooks/codex-git-guard\n');
    expect(rendered).toContain('[url "disabled://"]\n\tpushInsteadOf = https://\n');
    expect(rendered).toContain('\tpushInsteadOf = .\n[protocol]\n\tallow = never\n[protocol "file"]\n\tallow = never\n');
    // Comments only start with '#'; every other line is a header or a tab-indented pair.
    for (const line of rendered.trimEnd().split('\n')) {
      expect(line).toMatch(/^(#.*|\[[a-z]+( "[^"]+")?\]|\t[A-Za-z]+ = \S+)$/);
    }
  });

  it.skipIf(!gitAvailable())('parses with `git config -f … --list` to the same pairs as the env table', () => {
    const listed = execFileSync('git', ['config', '-f', file, '--list'], { encoding: 'utf-8' })
      .trimEnd()
      .split('\n')
      .map((line) => {
        const eq = line.indexOf('=');
        return [line.slice(0, eq), line.slice(eq + 1)] as const;
      });
    // git lowercases section and variable names but keeps the subsection.
    const expected = CODEX_GIT_GUARD_CONFIG.map(([key, value]) => {
      const first = key.indexOf('.');
      const last = key.lastIndexOf('.');
      const sub = last > first ? key.slice(first + 1, last) : undefined;
      const norm = `${key.slice(0, first).toLowerCase()}.${sub === undefined ? '' : `${sub}.`}${key
        .slice(last + 1)
        .toLowerCase()}`;
      return [norm, value] as const;
    });
    expect(listed).toEqual(expected);
    expect(listed).toHaveLength(Number(EXPECTED_GIT_CONFIG.GIT_CONFIG_COUNT));
  });
});
