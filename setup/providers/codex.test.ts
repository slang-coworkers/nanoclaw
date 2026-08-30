import { EventEmitter } from 'events';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { describe, expect, it, vi } from 'vitest';

// Mock child_process so runCodexLoginAuth never spawns a real codex CLI; the
// spawn stand-in plays `codex login` writing auth.json into whatever
// CODEX_HOME it was handed.
const mockSpawn = vi.fn();
const mockSpawnSync = vi.fn();
const mockExecFileSync = vi.fn();
vi.mock('child_process', () => ({
  spawn: (...args: unknown[]) => mockSpawn(...args),
  spawnSync: (...args: unknown[]) => mockSpawnSync(...args),
  execFileSync: (...args: unknown[]) => mockExecFileSync(...args),
}));

// Keep the auth flow's structured logging out of logs/setup.log.
vi.mock('../logs.js', () => ({ step: vi.fn(), userInput: vi.fn() }));

// Imports ONLY the barrel, like src/providers/barrel-registration.test.ts: the
// `import './codex.js'` line in index.ts is the load-bearing wiring, and a test
// that imported codex.js directly would stay green after someone deleted it.
import './index.js';
import { buildCodexFailurePrompt, runCodexLoginAuth, verifyCodexInstall } from './codex.js';
import { getSetupProvider, listSetupProviders } from './registry.js';

const ROOT = process.cwd();

describe('setup provider barrel', () => {
  it('registers codex via the barrel (guards the import line)', () => {
    expect(listSetupProviders().map((e) => e.value)).toContain('codex');
  });

  it('exposes the three hooks the setup flow dispatches on', () => {
    const entry = getSetupProvider('codex');

    // Absent runAuth, `--step provider-auth codex` stops at setup/provider-auth.ts:84
    // ("uses the standard auth flow") and never reaches the vault walk-through.
    expect(typeof entry?.runAuth).toBe('function');
    expect(typeof entry?.runInstallCheck).toBe('function');
    expect(typeof entry?.offerFailureAssist).toBe('function');
  });

  it('resolves case-insensitively, matching how resolveProviderName normalizes', () => {
    expect(getSetupProvider('CODEX')?.value).toBe('codex');
  });
});

describe('verifyCodexInstall', () => {
  it('passes on this fork tree', () => {
    const { ok, problems } = verifyCodexInstall();

    expect(problems).toEqual([]);
    expect(ok).toBe(true);
  });

  it('does not require the AGENTS.md composer this fork omits', () => {
    // This fork gives codex native discovery via the AGENTS.md → CLAUDE.md
    // symlink in src/group-init.ts, so upstream's composer has no reader here
    // and requiring it would report a healthy install as broken.
    expect(fs.existsSync(path.join(ROOT, 'src/providers/codex-agents-md.ts'))).toBe(false);
    expect(verifyCodexInstall().ok).toBe(true);
  });

  it('checks the CLI pin against the version /add-codex declares', () => {
    const skill = fs.readFileSync(path.join(ROOT, '.claude/skills/add-codex/SKILL.md'), 'utf-8');
    const declared = JSON.parse(
      skill.match(/```nc:json-merge[^\n]*container\/cli-tools\.json[^\n]*\n([\s\S]*?)```/)![1],
    ) as { version: string };
    const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'container/cli-tools.json'), 'utf-8')) as Array<{
      name: string;
      version: string;
    }>;

    // The engine's json-merge is idempotent on `name` alone, so a drifted
    // version is never repaired by re-applying the skill — only reported here.
    expect(manifest.find((t) => t.name === '@openai/codex')?.version).toBe(declared.version);
  });
});

// Pure prompt builder for the failure-assist hook — no spawning involved.
describe('buildCodexFailurePrompt', () => {
  it('carries the failure context and the de-duped reference list', () => {
    const prompt = buildCodexFailurePrompt(
      {
        stepName: 'verify',
        msg: 'first-chat ping timed out',
        hint: 'check the container logs',
        rawLogPath: '/repo/logs/setup-steps/verify.log',
      },
      '/repo',
    );

    expect(prompt).toContain('Failed step: verify');
    expect(prompt).toContain('Error: first-chat ping timed out');
    expect(prompt).toContain('Hint: check the container logs');
    expect(prompt).toContain('README.md'); // BIG_PICTURE_FILES
    expect(prompt).toContain('setup/verify.ts'); // STEP_FILES['verify']
    expect(prompt).toContain('logs/setup.log');
    expect(prompt).toContain('logs/setup-steps/verify.log'); // relativized rawLogPath
  });

  it('falls back to the step-log directory when no raw log path is given', () => {
    const prompt = buildCodexFailurePrompt({ stepName: 'verify', msg: 'boom' }, '/repo');

    expect(prompt).toContain('logs/setup-steps/');
    expect(prompt).not.toContain('Hint:');
  });
});

// Session-isolation invariant: the ChatGPT session vaulted for the gateway
// must never be the user's personal ~/.codex session — sharing one OAuth
// session across two consumers gets the whole family invalidated server-side
// when refresh tokens rotate (see the header of codex.ts).
describe('runCodexLoginAuth', () => {
  it('logs in under an isolated CODEX_HOME, vaults from it, and deletes it', async () => {
    mockSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
    mockExecFileSync.mockReturnValue('');

    let loginEnv: NodeJS.ProcessEnv | undefined;
    mockSpawn.mockImplementation((...args: unknown[]) => {
      const opts = args[2] as { env?: NodeJS.ProcessEnv };
      loginEnv = opts.env;
      fs.writeFileSync(path.join(opts.env!.CODEX_HOME!, 'auth.json'), '{"tokens":{}}');
      const child = new EventEmitter();
      setImmediate(() => child.emit('close', 0));
      return child;
    });

    await runCodexLoginAuth('browser');

    const codexHome = loginEnv?.CODEX_HOME;
    expect(codexHome).toBeDefined();
    expect(codexHome).not.toBe(path.join(os.homedir(), '.codex'));

    // The vault snapshot was read from the isolated dir, not ~/.codex.
    const vaultCall = mockExecFileSync.mock.calls.find((c) => c[0] === 'onecli');
    expect(vaultCall).toBeDefined();
    const vaultArgs = vaultCall![1] as string[];
    expect(vaultArgs[vaultArgs.indexOf('--file') + 1]).toBe(path.join(codexHome!, 'auth.json'));

    // The isolated dir holds a live credential — gone once vaulted.
    expect(fs.existsSync(codexHome!)).toBe(false);
  });
});

/**
 * `/add-codex` must carry no `nc:copy` directive. Its prose once said not to
 * re-copy the payload while its fence listed it anyway; the engine executes
 * directives, not prose. Two mechanisms make a fence here destructive:
 *
 *   - `selfStatus` returns `apply` unconditionally for `copy` in refresh mode,
 *     and `detectInstalledSkills` reads `src/providers/index.ts` — so
 *     `/update-skills` overwrites the destinations even when all are present.
 *   - This fork's codex files diverge substantially from the `providers` branch,
 *     and the upstream versions compile, so tsc stays green through the revert.
 *
 * A fence pruned to "only the files we carry" would still overwrite exactly the
 * diverged ones, so the invariant is no fence at all.
 */
describe('add-codex carries no copy fence', () => {
  const skill = fs.readFileSync(path.join(ROOT, '.claude/skills/add-codex/SKILL.md'), 'utf-8');

  it('has no nc:copy directive at all', () => {
    expect([...skill.matchAll(/```nc:copy[^\n]*\n([\s\S]*?)```/g)]).toEqual([]);
  });

  it('still carries the barrel appends that make registration self-heal', () => {
    for (const barrel of [
      'src/providers/index.ts',
      'container/agent-runner/src/providers/index.ts',
      'setup/providers/index.ts',
    ]) {
      expect(skill).toContain(`nc:append to:${barrel}`);
    }
  });

  it('vitest-runs only test paths that exist', () => {
    const targets = [...skill.matchAll(/```nc:run[^\n]*\n([\s\S]*?)```/g)]
      .flatMap((m) => m[1].split('\n'))
      .filter((l) => /\bvitest run\b/.test(l))
      .flatMap((l) => l.split(/\s+/))
      .filter((tok) => tok.endsWith('.test.ts') || tok.endsWith('/'));

    expect(targets.length).toBeGreaterThan(0);
    expect(targets.filter((t) => !fs.existsSync(path.join(ROOT, t)))).toEqual([]);
  });
});
