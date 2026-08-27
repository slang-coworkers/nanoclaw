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
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { SERVICE_NAME_CAVEAT, getLaunchdLabel, getSystemdUnit, serviceRestartHint } from './install-slug.js';

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
