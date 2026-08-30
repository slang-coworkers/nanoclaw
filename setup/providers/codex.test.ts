import { EventEmitter } from 'events';
import fs from 'fs';
import { mkdirSync, mkdtempSync, rmSync } from 'fs';
import os from 'os';
import path from 'path';

import * as p from '@clack/prompts';
import { afterAll, describe, expect, it, vi } from 'vitest';

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

// Barrel-driven registration lives in ./barrel-registration.test.ts — importing
// codex.js here self-registers the provider, so a registration assertion in this
// file would survive deletion of the barrel's import line.
import { buildCodexFailurePrompt, runCodexLoginAuth, verifyCodexInstall } from './codex.js';

const ROOT = process.cwd();
const scratches: string[] = [];

afterAll(() => {
  for (const dir of scratches) rmSync(dir, { recursive: true, force: true });
});

/** Scratch tree that satisfies verifyCodexInstall, so a case can break one thing. */
function wiredRoot(): string {
  const root = mkdtempSync(path.join(os.tmpdir(), 'codex-verify-'));
  scratches.push(root);

  for (const file of [
    'src/providers/codex.ts',
    'container/agent-runner/src/providers/codex.ts',
    'container/agent-runner/src/providers/codex-app-server.ts',
  ]) {
    mkdirSync(path.join(root, path.dirname(file)), { recursive: true });
    fs.writeFileSync(path.join(root, file), '');
  }
  for (const barrel of [
    'src/providers/index.ts',
    'container/agent-runner/src/providers/index.ts',
    'setup/providers/index.ts',
  ]) {
    mkdirSync(path.join(root, path.dirname(barrel)), { recursive: true });
    fs.writeFileSync(path.join(root, barrel), "import './codex.js';\n");
  }
  mkdirSync(path.join(root, 'container'), { recursive: true });
  fs.writeFileSync(
    path.join(root, 'container/cli-tools.json'),
    JSON.stringify([{ name: '@openai/codex', version: '1.2.3' }]),
  );
  mkdirSync(path.join(root, '.claude/skills/add-codex'), { recursive: true });
  fs.writeFileSync(
    path.join(root, '.claude/skills/add-codex/SKILL.md'),
    '```nc:json-merge into:container/cli-tools.json key:name\n{ "name": "@openai/codex", "version": "1.2.3" }\n```\n',
  );
  return root;
}

/** verifyCodexInstall reads process.cwd(), so a scratch root needs a chdir. */
function verifyIn(root: string): ReturnType<typeof verifyCodexInstall> {
  const cwd = process.cwd();
  try {
    process.chdir(root);
    return verifyCodexInstall();
  } finally {
    process.chdir(cwd);
  }
}

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

  it('passes on a fully wired scratch tree', () => {
    expect(verifyIn(wiredRoot())).toEqual({ ok: true, problems: [] });
  });

  // The engine's json-merge is idempotent on `name` alone, so re-applying the
  // skill never repairs a drifted version — reporting it here is the only signal.
  it('reports a CLI pin that disagrees with the version /add-codex declares', () => {
    const root = wiredRoot();
    fs.writeFileSync(
      path.join(root, 'container/cli-tools.json'),
      JSON.stringify([{ name: '@openai/codex', version: '9.9.9' }]),
    );

    const { ok, problems } = verifyIn(root);

    expect(ok).toBe(false);
    expect(problems).toEqual(['container/cli-tools.json pins @openai/codex@9.9.9 but /add-codex declares 1.2.3']);
  });

  it('reports a missing setup barrel import — the gap that broke provider-auth', () => {
    const root = wiredRoot();
    fs.writeFileSync(path.join(root, 'setup/providers/index.ts'), '// no codex line\n');

    expect(verifyIn(root).problems).toEqual(['missing barrel import in setup/providers/index.ts']);
  });

  it('reports a skill that declares no parseable pin', () => {
    const root = wiredRoot();
    fs.writeFileSync(path.join(root, '.claude/skills/add-codex/SKILL.md'), 'no fence here\n');

    expect(verifyIn(root).problems).toEqual([
      '/add-codex declares no parseable @openai/codex pin — the CLI version has no source of truth',
    ]);
  });

  it('checks presence only when the tree carries no /add-codex to declare a pin', () => {
    const root = wiredRoot();
    rmSync(path.join(root, '.claude'), { recursive: true, force: true });

    expect(verifyIn(root)).toEqual({ ok: true, problems: [] });
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

  // Ctrl-C / SIGTERM mid-login has two failure modes, and the mock below models
  // the real child lifecycle (`exit` THEN `close`) because the second one only
  // appears once `close` fires:
  //   1. deleting CODEX_HOME while the child still runs — it rewrites auth.json
  //      and the credential is stranded. Caught by the at-kill dir state.
  //   2. letting the killed child's non-zero exit reach the ordinary
  //      sign-in-failed path, which prints a misleading error and exits 1 with
  //      the wrong code. Caught by asserting nothing after the re-raise runs.
  for (const signal of ['SIGINT', 'SIGTERM'] as const) {
    it(`kills the login child, then removes CODEX_HOME, and lets ${signal} decide the exit`, async () => {
      mockSpawnSync.mockReturnValue({ status: 0, stdout: '', stderr: '' });
      mockExecFileSync.mockReturnValue('');

      const order: string[] = [];
      let codexHome: string | undefined;
      // Stands in for process.kill (the real one would take down vitest) and for
      // process.exit, whose absence from `order` is the point of case 2.
      const killSpy = vi.spyOn(process, 'kill').mockImplementation((_pid, sig) => {
        order.push(`re-raise:${String(sig)}`);
        return true;
      });
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((code?: number) => {
        order.push(`process.exit:${code}`);
        return undefined as never;
      }) as never);
      const errorSpy = vi.spyOn(p.log, 'error').mockImplementation(() => {});

      mockSpawn.mockImplementation((...args: unknown[]) => {
        const opts = args[2] as { env?: NodeJS.ProcessEnv };
        codexHome = opts.env!.CODEX_HOME;
        const child = Object.assign(new EventEmitter(), {
          exitCode: null as number | null,
          signalCode: null as string | null,
          kill: (sig: string) => {
            order.push(`kill:${sig}`);
            order.push(`home-exists-at-kill:${fs.existsSync(codexHome!)}`);
            // signalCode stays null until the child actually exits, exactly as
            // node reports it. Setting it here would let waitForExit return on
            // its fast path and the test would pass with the wait deleted.
            setTimeout(() => {
              order.push('child-exited');
              child.signalCode = sig;
              // A real killed child emits `exit`, then `close`; `close` is what
              // resolves runInherit with a non-zero code.
              child.emit('exit', null, sig);
              child.emit('close', null, sig);
            }, 15);
            return true;
          },
        });
        setImmediate(() => process.emit(signal));
        return child;
      });

      void runCodexLoginAuth('browser');
      await new Promise((r) => setTimeout(r, 80));

      // `child-exited` before the re-raise is the assertion that the production
      // code awaits the exit; drop the await and the re-raise lands before it.
      expect(order).toEqual(['kill:SIGKILL', 'home-exists-at-kill:true', 'child-exited', `re-raise:${signal}`]);
      expect(fs.existsSync(codexHome!)).toBe(false);
      // The interrupt owns the exit: no sign-in-failed message, no exit(1).
      expect(errorSpy).not.toHaveBeenCalled();

      killSpy.mockRestore();
      exitSpy.mockRestore();
      errorSpy.mockRestore();
    });
  }
});

/**
 * `/add-codex` must carry no `nc:copy` directive — not even one pruned to the
 * files this fork does carry, since those are the diverged ones.
 *
 * `selfStatus` returns `apply` unconditionally for `copy` in refresh mode, and
 * `detectInstalledSkills` reads `src/providers/index.ts`, so `/update-skills`
 * would overwrite this fork's codex implementations with upstream's even though
 * every destination is present — and tsc stays green, because upstream's compile.
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
