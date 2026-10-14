import { describe, expect, it } from 'vitest';

import { dashboardServiceName, renderDashboardPlist, renderDashboardSystemdUnit } from './dashboard-service.js';

describe('dashboard service', () => {
  it('is named per install, next to the host service', () => {
    const linux = dashboardServiceName('/home/u/nanoclaw', 'linux');
    expect(linux).toMatch(/^nanoclaw-dashboard-v2-[a-f0-9]+$/);
    expect(dashboardServiceName('/home/u/other', 'linux')).not.toBe(linux);
    expect(dashboardServiceName('/home/u/nanoclaw', 'darwin')).toMatch(/^com\.nanoclaw-dashboard-v2-/);
  });

  it('runs dashboard/server.ts with absolute node and tsx paths and the install .env', () => {
    const unit = renderDashboardSystemdUnit('/srv/nc', '/usr/bin/node', '/home/u', false, 'nanoclaw-v2-abc');
    expect(unit).toContain('ExecStart=/usr/bin/node /srv/nc/node_modules/tsx/dist/cli.mjs dashboard/server.ts');
    expect(unit).toContain('EnvironmentFile=-/srv/nc/.env');
    expect(unit).toContain('After=network.target nanoclaw-v2-abc.service');
    expect(unit).toContain('WantedBy=default.target');
    expect(renderDashboardSystemdUnit('/srv/nc', '/usr/bin/node', '/root', true)).toContain(
      'WantedBy=multi-user.target',
    );
  });

  it('renders a keep-alive launchd agent on macOS', () => {
    const plist = renderDashboardPlist(
      '/Users/u/nc',
      '/opt/homebrew/bin/node',
      'com.nanoclaw-dashboard-v2-x',
      '/Users/u',
    );
    expect(plist).toContain('<string>/Users/u/nc/node_modules/tsx/dist/cli.mjs</string>');
    expect(plist).toContain('<key>KeepAlive</key>');
  });
});
