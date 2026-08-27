import { describe, it, expect } from 'vitest';

import { getLaunchdLabel, getSystemdUnit } from '../install-slug.js';
import { formatTransportError } from './transport-errors.js';

describe('formatTransportError', () => {
  it('renders per-install service names on ENOENT, not the bare v1 names', () => {
    const out = formatTransportError(new Error('connect ENOENT /tmp/nanoclaw.sock'));

    // Regression for #2484: pre-fix, this string was a hardcoded
    // `com.nanoclaw` / `nanoclaw`, which doesn't match the actual
    // v2 per-install slug-suffixed unit and label.
    expect(out).toContain(`gui/$(id -u)/${getLaunchdLabel()}`);
    expect(out).toContain(`systemctl --user restart ${getSystemdUnit()}`);
    expect(out).not.toMatch(/gui\/\$\(id -u\)\/com\.nanoclaw\b(?!-v2)/);
    expect(out).not.toMatch(/systemctl --user restart nanoclaw\b(?!-v2)/);
  });

  it('gives each platform its OWN finder', () => {
    // A single shared `systemctl ... | grep -i claw` hint printed above both
    // platform lines tells a macOS operator to run systemctl — recreating the
    // confidently-wrong guidance this function exists to prevent. Each finder
    // must sit under the platform it belongs to.
    const out = formatTransportError(new Error('connect ENOENT /tmp/nanoclaw.sock'));
    const lines = out.split('\n');
    const macIdx = lines.findIndex((l) => l.includes('macOS:'));
    const linuxIdx = lines.findIndex((l) => l.includes('Linux:'));
    expect(macIdx).toBeGreaterThan(-1);
    expect(linuxIdx).toBeGreaterThan(macIdx);

    // The macOS finder is launchctl and lives in the macOS block.
    const macBlock = lines.slice(macIdx, linuxIdx).join('\n');
    expect(macBlock).toContain('launchctl list | grep -i claw');
    expect(macBlock).not.toContain('systemctl');

    // The Linux finder is systemctl and lives in the Linux block.
    const linuxBlock = lines.slice(linuxIdx).join('\n');
    expect(linuxBlock).toContain('systemctl --user list-units --all | grep -i claw');
    expect(linuxBlock).not.toContain('launchctl');

    // And no finder may appear before either platform line (the original bug).
    expect(lines.slice(0, macIdx).join('\n')).not.toMatch(/systemctl|launchctl/);
  });

  it('renders the same on ECONNREFUSED', () => {
    const out = formatTransportError(new Error('connect ECONNREFUSED'));
    expect(out).toContain(getLaunchdLabel());
    expect(out).toContain(getSystemdUnit());
  });

  it('falls back to a generic transport error for other failures', () => {
    const out = formatTransportError(new Error('some unrelated failure'));
    expect(out).toBe('ncl: transport error: some unrelated failure\n');
    expect(out).not.toContain('launchctl');
    expect(out).not.toContain('systemctl');
  });
});
