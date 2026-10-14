/**
 * The nv-dashboard viewer (dashboard/server.ts) as a service next to the host.
 *
 * The host process only runs the dashboard's ingress bridge; the viewer itself
 * is a separate process, and setup used to leave starting it to the operator.
 * Setup now installs it when the channel step's Dashboard pick composes (or
 * finds) the dashboard, with the service manager the host uses: a systemd user unit (system unit as root) on Linux, a launchd agent on
 * macOS. Hosts without a user manager (nohup fallback) are told how to start it.
 *
 * Names are install-scoped like the host's, so two installs never collide. An
 * operator's own `nanoclaw-dashboard` unit (hand-written on older installs) is
 * left alone — it serves the same port, and replacing it is their call.
 */
import { execSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { getInstallSlug, getLaunchdLabel, getSystemdUnit } from '../src/install-slug.js';
import { log } from '../src/log.js';
import { getNodePath, isRoot } from './platform.js';

export type DashboardServiceResult =
  | { status: 'absent' }
  | { status: 'installed'; name: string }
  | { status: 'skipped'; reason: 'operator-unit' | 'no-service-manager' | 'unsupported-platform'; hint: string }
  | { status: 'failed'; name: string; error: string };

/** Unit name (Linux, no `.service`) / launchd label (macOS) for this install's dashboard. */
export function dashboardServiceName(projectRoot: string, platform: NodeJS.Platform = process.platform): string {
  const slug = getInstallSlug(projectRoot);
  return platform === 'darwin' ? `com.nanoclaw-dashboard-v2-${slug}` : `nanoclaw-dashboard-v2-${slug}`;
}

export function hasDashboard(projectRoot: string): boolean {
  return fs.existsSync(path.join(projectRoot, 'dashboard', 'server.ts'));
}

/** Absolute command line: no PATH lookup for node, tsx or pnpm at boot. */
function dashboardCommand(projectRoot: string, nodePath: string): string[] {
  return [nodePath, path.join(projectRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs'), 'dashboard/server.ts'];
}

export function renderDashboardSystemdUnit(
  projectRoot: string,
  nodePath: string,
  homeDir: string,
  runningAsRoot: boolean,
  hostUnit = getSystemdUnit(projectRoot),
): string {
  return `[Unit]
Description=NanoClaw Dashboard
After=network.target ${hostUnit}.service

[Service]
Type=simple
ExecStart=${dashboardCommand(projectRoot, nodePath).join(' ')}
WorkingDirectory=${projectRoot}
EnvironmentFile=-${projectRoot}/.env
Environment=HOME=${homeDir}
Environment=PATH=${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin:${homeDir}/.local/bin
Restart=always
RestartSec=5
StandardOutput=append:${projectRoot}/logs/dashboard.log
StandardError=append:${projectRoot}/logs/dashboard.error.log

[Install]
WantedBy=${runningAsRoot ? 'multi-user.target' : 'default.target'}`;
}

function xmlEscape(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function renderDashboardPlist(projectRoot: string, nodePath: string, label: string, homeDir: string): string {
  const args = dashboardCommand(projectRoot, nodePath)
    .map((a) => `    <string>${xmlEscape(a)}</string>`)
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>Label</key>
  <string>${xmlEscape(label)}</string>
  <key>ProgramArguments</key>
  <array>
${args}
  </array>
  <key>WorkingDirectory</key>
  <string>${xmlEscape(projectRoot)}</string>
  <key>EnvironmentVariables</key>
  <dict>
    <key>HOME</key>
    <string>${xmlEscape(homeDir)}</string>
    <key>PATH</key>
    <string>${xmlEscape(`${path.dirname(nodePath)}:/usr/local/bin:/usr/bin:/bin:${homeDir}/.local/bin`)}</string>
  </dict>
  <key>RunAtLoad</key>
  <true/>
  <key>KeepAlive</key>
  <true/>
  <key>StandardOutPath</key>
  <string>${xmlEscape(path.join(projectRoot, 'logs', 'dashboard.log'))}</string>
  <key>StandardErrorPath</key>
  <string>${xmlEscape(path.join(projectRoot, 'logs', 'dashboard.error.log'))}</string>
</dict>
</plist>`;
}

/** Where this install's dashboard service is (or would be) registered. */
export function dashboardServicePaths(projectRoot: string, homeDir = os.homedir()) {
  return {
    launchdPlist: path.join(homeDir, 'Library', 'LaunchAgents', `${dashboardServiceName(projectRoot, 'darwin')}.plist`),
    systemdUserUnit: path.join(
      homeDir,
      '.config',
      'systemd',
      'user',
      `${dashboardServiceName(projectRoot, 'linux')}.service`,
    ),
    systemdSystemUnit: `/etc/systemd/system/${dashboardServiceName(projectRoot, 'linux')}.service`,
  };
}

const MANUAL_HINT = 'Start it yourself with: pnpm exec tsx dashboard/server.ts';

/** Write `content` only if it differs; true when the file changed. */
function writeIfChanged(file: string, content: string): boolean {
  if (fs.existsSync(file) && fs.readFileSync(file, 'utf-8') === content) return false;
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content);
  return true;
}

export function installDashboardService(projectRoot = process.cwd()): DashboardServiceResult {
  if (!hasDashboard(projectRoot)) return { status: 'absent' };
  const homeDir = os.homedir();
  const nodePath = getNodePath();
  fs.mkdirSync(path.join(projectRoot, 'logs'), { recursive: true });
  const paths = dashboardServicePaths(projectRoot, homeDir);

  if (process.platform === 'darwin') {
    const label = dashboardServiceName(projectRoot, 'darwin');
    try {
      writeIfChanged(paths.launchdPlist, renderDashboardPlist(projectRoot, nodePath, label, homeDir));
      try {
        execSync(`launchctl unload ${JSON.stringify(paths.launchdPlist)}`, { stdio: 'ignore' });
      } catch {
        // not loaded yet
      }
      execSync(`launchctl load ${JSON.stringify(paths.launchdPlist)}`, { stdio: 'ignore' });
      execSync(`launchctl kickstart -k gui/${process.getuid!()}/${label}`, { stdio: 'ignore' });
      return { status: 'installed', name: label };
    } catch (err) {
      return { status: 'failed', name: label, error: String(err) };
    }
  }

  if (process.platform !== 'linux') {
    return { status: 'skipped', reason: 'unsupported-platform', hint: MANUAL_HINT };
  }

  const operatorUnits = [
    path.join(homeDir, '.config', 'systemd', 'user', 'nanoclaw-dashboard.service'),
    '/etc/systemd/system/nanoclaw-dashboard.service',
  ];
  if (operatorUnits.some((unit) => fs.existsSync(unit))) {
    return {
      status: 'skipped',
      reason: 'operator-unit',
      hint: 'An existing nanoclaw-dashboard unit already runs the dashboard; left as it is.',
    };
  }

  const runningAsRoot = isRoot();
  const prefix = runningAsRoot ? 'systemctl' : 'systemctl --user';
  if (!runningAsRoot) {
    try {
      execSync('systemctl --user daemon-reload', { stdio: 'pipe' });
    } catch {
      return { status: 'skipped', reason: 'no-service-manager', hint: MANUAL_HINT };
    }
  }

  const name = dashboardServiceName(projectRoot, 'linux');
  const unitPath = runningAsRoot ? paths.systemdSystemUnit : paths.systemdUserUnit;
  try {
    writeIfChanged(unitPath, renderDashboardSystemdUnit(projectRoot, nodePath, homeDir, runningAsRoot));
    execSync(`${prefix} daemon-reload`, { stdio: 'ignore' });
    execSync(`${prefix} enable ${name}`, { stdio: 'ignore' });
    execSync(`${prefix} restart ${name}`, { stdio: 'ignore' });
    log.info('Dashboard service installed', { name, unitPath });
    return { status: 'installed', name };
  } catch (err) {
    return { status: 'failed', name, error: String(err) };
  }
}

/**
 * Restart the host service so it loads a just-composed overlay. Best effort:
 * false when this install has no service registration to restart.
 */
export function restartHostService(projectRoot = process.cwd()): boolean {
  try {
    if (process.platform === 'darwin') {
      const label = getLaunchdLabel(projectRoot);
      if (!fs.existsSync(path.join(os.homedir(), 'Library', 'LaunchAgents', `${label}.plist`))) return false;
      execSync(`launchctl kickstart -k gui/${process.getuid!()}/${label}`, { stdio: 'ignore' });
      return true;
    }
    if (process.platform === 'linux') {
      const unit = getSystemdUnit(projectRoot);
      const prefix = isRoot() ? 'systemctl' : 'systemctl --user';
      const unitFile = isRoot()
        ? `/etc/systemd/system/${unit}.service`
        : path.join(os.homedir(), '.config', 'systemd', 'user', `${unit}.service`);
      if (!fs.existsSync(unitFile)) return false;
      execSync(`${prefix} restart ${unit}`, { stdio: 'ignore' });
      return true;
    }
  } catch (err) {
    log.warn('Could not restart the host service', { err });
  }
  return false;
}

/** Poll `probe` until true or `timeoutMs` passes. */
async function waitFor(probe: () => boolean | Promise<boolean>, timeoutMs: number): Promise<boolean> {
  const end = Date.now() + timeoutMs;
  while (Date.now() < end) {
    if (await probe()) return true;
    await new Promise((r) => setTimeout(r, 1000));
  }
  return false;
}

async function dashboardUp(port: string): Promise<boolean> {
  try {
    return (await fetch(`http://127.0.0.1:${port}/`)).ok;
  } catch {
    return false;
  }
}

export type OrchestratorResult =
  | { status: 'ready'; id: string; created: boolean }
  | { status: 'failed'; error: string };

/**
 * The admin coworker every dashboard install starts from: created through the
 * dashboard (as its "new coworker" button does), then given ncl global scope so
 * it can manage the other coworkers. The host only creates a group's container
 * config at startup, so it is restarted before the scope is set. Idempotent.
 */
export async function ensureOrchestrator(projectRoot = process.cwd(), port = '3737'): Promise<OrchestratorResult> {
  if (!(await waitFor(() => dashboardUp(port), 60_000))) {
    return { status: 'failed', error: `the dashboard is not answering on port ${port}` };
  }
  const base = `http://127.0.0.1:${port}/api/coworkers`;
  let id: string | undefined;
  let created = false;
  try {
    const list = (await (await fetch(base)).json()) as unknown;
    const rows = (Array.isArray(list) ? list : ((list as { coworkers?: unknown[] }).coworkers ?? [])) as {
      id?: string;
      folder?: string;
    }[];
    id = rows.find((r) => r.folder === 'orchestrator')?.id;
    if (!id) {
      const res = (await (
        await fetch(base, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ name: 'Orchestrator', folder: 'orchestrator', agentProvider: 'claude' }),
        })
      ).json()) as { ok?: boolean; id?: string; error?: string };
      if (!res.ok || !res.id) return { status: 'failed', error: res.error ?? 'the dashboard did not create it' };
      id = res.id;
      created = true;
    }
  } catch (err) {
    return { status: 'failed', error: String(err) };
  }

  restartHostService(projectRoot);
  const socket = path.join(projectRoot, 'data', 'ncl.sock');
  await new Promise((r) => setTimeout(r, 3000));
  if (!(await waitFor(() => fs.existsSync(socket), 90_000))) {
    return { status: 'failed', error: 'NanoClaw did not come back after the restart' };
  }
  try {
    execSync(
      `${JSON.stringify(path.join(projectRoot, 'bin', 'ncl'))} groups config update --id ${id} --cli-scope global`,
      {
        cwd: projectRoot,
        stdio: 'pipe',
      },
    );
  } catch (err) {
    return { status: 'failed', error: `could not give it global scope: ${String(err).slice(0, 200)}` };
  }
  return { status: 'ready', id, created };
}
