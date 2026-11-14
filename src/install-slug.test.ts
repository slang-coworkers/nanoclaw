/**
 * Guards the shared service-restart hint.
 *
 * This text existed in two hand-maintained copies (`src/cli/transport-errors.ts`
 * and `setup/auto.ts`). They diverged: #1085 added the custom-name caveat and the
 * per-platform finders to the ncl path and missed the setup path, so setup kept
 * telling operators to restart a unit name that may not exist — and, worse,
 * printed a Linux-only finder above the macOS line.
 *
 * The single-source test at the bottom is the one that matters: it fails if
 * anyone hand-writes these commands a third time.
 */
import { spawnSync } from 'node:child_process';
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';

import {
  SERVICE_NAME_CAVEAT,
  getContainerImageBase,
  getInstallSlug,
  getLaunchdLabel,
  getSystemdUnit,
  serviceRestartHint,
} from './install-slug.js';

describe('serviceRestartHint', () => {
  it('gives each platform its own finder, under its own command', () => {
    const lines = serviceRestartHint().split('\n');
    const mac = lines.findIndex((l) => l.includes('macOS:'));
    const linux = lines.findIndex((l) => l.includes('Linux:'));
    expect(mac).toBeGreaterThan(-1);
    expect(linux).toBeGreaterThan(mac);

    const macBlock = lines.slice(mac, linux).join('\n');
    expect(macBlock).toContain('launchctl list | grep -i claw');
    expect(macBlock).not.toContain('systemctl');

    const linuxBlock = lines.slice(linux).join('\n');
    expect(linuxBlock).toContain('systemctl --user list-units --all | grep -i claw');
    expect(linuxBlock).not.toContain('launchctl');
  });

  it('never emits a finder before either platform line', () => {
    // The original bug: one shared finder printed above both, so a macOS
    // operator was told to run systemctl.
    const lines = serviceRestartHint().split('\n');
    const first = lines.findIndex((l) => l.includes('macOS:') || l.includes('Linux:'));
    expect(lines.slice(0, first).join('\n')).not.toMatch(/systemctl|launchctl/);
  });

  it('uses the per-checkout derived names', () => {
    const out = serviceRestartHint();
    expect(out).toContain(getLaunchdLabel());
    expect(out).toContain(getSystemdUnit());
  });

  it('ships a caveat saying the names are defaults, not necessarily this install', () => {
    expect(SERVICE_NAME_CAVEAT).toMatch(/default/i);
    expect(SERVICE_NAME_CAVEAT).toMatch(/custom name/i);
  });
});

describe('single source of the restart guidance', () => {
  it('is authored in exactly one place', () => {
    // Walk the TS sources and find any file that hand-writes the restart
    // commands instead of calling serviceRestartHint(). install-slug.ts is the
    // one legitimate author; its own test is allowed to assert the strings.
    const roots = [path.join(__dirname), path.join(__dirname, '..', 'setup'), path.join(__dirname, '..', 'dashboard')];
    const allowed = new Set([path.join(__dirname, 'install-slug.ts'), path.join(__dirname, 'install-slug.test.ts')]);
    const offenders: string[] = [];

    const walk = (dir: string) => {
      let entries: string[];
      try {
        entries = readdirSync(dir);
      } catch {
        return; // directory may not exist in every checkout
      }
      for (const e of entries) {
        const full = path.join(dir, e);
        if (e === 'node_modules' || e === 'dist' || e.startsWith('.')) continue;
        if (statSync(full).isDirectory()) {
          walk(full);
        } else if (e.endsWith('.ts') && !allowed.has(full)) {
          const src = readFileSync(full, 'utf-8');
          // The literal command text — not the helper call, and not a comment
          // mentioning it. Both markers together means it was re-authored.
          if (src.includes('launchctl kickstart -k gui/') && src.includes('systemctl --user restart ')) {
            offenders.push(path.relative(path.join(__dirname, '..'), full));
          }
        }
      }
    };
    roots.forEach(walk);

    expect(
      offenders,
      `These files hand-write the service-restart commands instead of calling serviceRestartHint(). ` +
        `That is how the guidance diverged before — one copy was corrected and the other kept ` +
        `printing an unqualified unit name. Use the helper.`,
    ).toEqual([]);
  });
});

afterEach(() => {
  delete process.env.NANOCLAW_INSTALL_ID;
});

describe('getInstallSlug', () => {
  it('derives from the project root when NANOCLAW_INSTALL_ID is unset', () => {
    const slug = getInstallSlug('/some/checkout');
    expect(slug).toMatch(/^[0-9a-f]{8}$/);
    expect(getInstallSlug('/some/checkout')).toBe(slug);
    expect(getInstallSlug('/other/checkout')).not.toBe(slug);
  });

  it('honors a valid NANOCLAW_INSTALL_ID override', () => {
    process.env.NANOCLAW_INSTALL_ID = 'prod-eks_1';
    expect(getInstallSlug('/some/checkout')).toBe('prod-eks_1');
  });

  it('rejects label-unsafe overrides', () => {
    for (const bad of ['UPPER', '-leading', 'has space', 'a'.repeat(33), 'dot.dot']) {
      process.env.NANOCLAW_INSTALL_ID = bad;
      expect(() => getInstallSlug('/some/checkout'), bad).toThrow(/NANOCLAW_INSTALL_ID/);
    }
  });
});

const shellHelper = fileURLToPath(new URL('../setup/lib/install-slug.sh', import.meta.url));
const shellFunctions = ['_nanoclaw_install_slug', 'launchd_label', 'systemd_unit', 'container_image_base'];
const tsFunctions = [getInstallSlug, getLaunchdLabel, getSystemdUnit, getContainerImageBase];

function runShell(fn: string, override: string) {
  return spawnSync('bash', ['-c', '. "$1"; "$2"', 'test', shellHelper, fn], {
    encoding: 'utf8',
    env: {
      ...process.env,
      PROJECT_ROOT: '/some/checkout',
      NANOCLAW_PROJECT_ROOT: '/some/checkout',
      NANOCLAW_INSTALL_ID: override,
    },
  });
}

describe('shell install identity parity', () => {
  it.each(['', 'prod-eks_1', 'a', 'a'.repeat(32)])('matches every TypeScript name with override %j', (override) => {
    process.env.NANOCLAW_INSTALL_ID = override;
    shellFunctions.forEach((fn, i) => {
      const result = runShell(fn, override);
      expect(result.status, result.stderr).toBe(0);
      expect(result.stdout.trimEnd()).toBe(tsFunctions[i]('/some/checkout'));
    });
  });

  it.each(['UPPER', '-leading', '_leading', 'has space', 'a'.repeat(33), 'dot.dot', 'a\nb', 'é'])(
    'fails closed for invalid override %j',
    (override) => {
      process.env.NANOCLAW_INSTALL_ID = override;
      expect(() => getInstallSlug('/some/checkout')).toThrow(/NANOCLAW_INSTALL_ID/);
      for (const fn of shellFunctions) {
        const result = runShell(fn, override);
        expect(result.status).not.toBe(0);
        expect(result.stdout).toBe('');
        expect(result.stderr).toContain('NANOCLAW_INSTALL_ID');
      }
    },
  );
});

describe('nanoclaw.sh --uninstall without dependencies', () => {
  // A copy with no node_modules takes the manual cleanup-guidance branch.
  function runUninstall(override: string) {
    const root = mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-uninstall-'));
    try {
      mkdirSync(path.join(root, 'setup', 'lib'), { recursive: true });
      copyFileSync(fileURLToPath(new URL('../nanoclaw.sh', import.meta.url)), path.join(root, 'nanoclaw.sh'));
      copyFileSync(shellHelper, path.join(root, 'setup', 'lib', 'install-slug.sh'));
      return spawnSync('bash', [path.join(root, 'nanoclaw.sh'), '--uninstall'], {
        encoding: 'utf8',
        env: { ...process.env, NANOCLAW_INSTALL_ID: override },
      });
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  }

  it('prints cleanup commands for the override', () => {
    const result = runUninstall('prod-eks_1');
    expect(result.status).toBe(1);
    expect(result.stdout).toContain('nanoclaw-agent-v2-prod-eks_1:latest');
    expect(result.stdout).toContain('/.nanoclaw-updates/prod-eks_1"');
  });

  it('prints no cleanup commands for an invalid override', () => {
    const result = runUninstall('UPPER');
    expect(result.status).toBe(1);
    expect(result.stderr).toContain('NANOCLAW_INSTALL_ID');
    expect(result.stdout).not.toContain('rm -rf');
  });
});
