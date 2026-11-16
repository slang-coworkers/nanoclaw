/**
 * A container that survives a host restart keeps its 1 s delivery latency.
 *
 * Consider a coworker whose container keeps running while the host restarts
 * (the unit uses KillMode=process). The new host process adopts the container
 * in `adoptRunningSessions`, which marks its session `container_status =
 * 'running'`. The active delivery poll (every ACTIVE_POLL_MS = 1 s) drains
 * exactly the `'running'` sessions; every other active session waits for the
 * sweep poll (every 60 s). An `ncl` call from the container is a `cli_request`
 * row in its outbound mailbox, so the poll that visits the session decides how
 * long the call waits before the host even starts it.
 *
 * This test runs the real startup sequence in `main()` with the real central
 * DB, mailboxes and delivery polls. Only adoption is stubbed, to do what the
 * real one does for a survivor: mark its session running. The test then writes
 * a `cli_request` for the survivor after the boot sweep tick has passed and
 * checks that the host answers it within one active-poll interval.
 */
import Database from 'better-sqlite3';
import fs from 'fs';
import { afterAll, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  survivorId: '',
  ready: vi.fn(),
}));

vi.mock('./config.js', async () => {
  const actual = await vi.importActual<typeof import('./config.js')>('./config.js');
  return {
    ...actual,
    DATA_DIR: '/tmp/nanoclaw-test-startup-adoption',
    GROUPS_DIR: '/tmp/nanoclaw-test-startup-adoption/groups',
  };
});
// main() opens the central DB itself. It gets the in-memory DB this test has
// already migrated and seeded with the previous host process's rows.
vi.mock('./db/connection.js', async () => {
  const actual = await vi.importActual<typeof import('./db/connection.js')>('./db/connection.js');
  return {
    ...actual,
    initDb: async (...args: Parameters<typeof actual.initDb>) =>
      args[1]?.role === 'host' ? actual.getDb() : actual.initDb(...args),
  };
});
// Adoption claims the survivor and marks it running, as `adoptRunningSessions`
// does after a successful claim and gateway adoption.
vi.mock('./container-runner.js', () => ({
  adoptRunningSessions: async () => {
    const { markContainerRunning } = await import('./session-manager.js');
    await markContainerRunning(state.survivorId);
    return { adopted: 1, stopped: 0 };
  },
  abortGatewaySessionObservers: vi.fn(),
  resumeGatewaySessionAdmission: vi.fn(),
  stopGatewaySessionsForUnavailability: vi.fn(),
  wakeContainer: vi.fn().mockResolvedValue(true),
  isContainerRunning: vi.fn().mockReturnValue(true),
  killContainer: vi.fn(),
  buildAgentGroupImage: vi.fn().mockResolvedValue(undefined),
}));
// The ncl command itself is not under test: dispatch answers every request.
vi.mock('./cli/dispatch.js', () => ({
  dispatch: vi.fn(async (req: { id: string }) => ({ id: req.id, ok: true, data: [] })),
}));
// Startup work that would open ports, touch the working tree or reach a
// gateway; none of it writes container_status.
vi.mock('./agents-symlink-backfill.js', () => ({ backfillAgentsSymlinks: vi.fn() }));
vi.mock('./backfill-container-configs.js', () => ({ backfillContainerConfigs: vi.fn() }));
vi.mock('./migrations/global-to-shared.js', () => ({ runGlobalToSharedMigration: vi.fn() }));
vi.mock('./reconcile-gh-sessions.js', () => ({ reconcileGhSessions: async () => ({ merged: 0 }) }));
vi.mock('./orphan-groups.js', () => ({ logOrphanGroupDirs: vi.fn() }));
vi.mock('./circuit-breaker.js', () => ({ enforceStartupBackoff: vi.fn(), resetCircuitBreaker: vi.fn() }));
vi.mock('./upgrade-state.js', () => ({ enforceUpgradeTripwire: vi.fn() }));
vi.mock('./drivers/index.js', () => ({ getSessionDriver: () => ({ ensureReady: vi.fn() }) }));
vi.mock('./host-instance.js', () => ({ startHostInstanceLease: vi.fn(), stopHostInstanceLease: vi.fn() }));
vi.mock('./mcp-registry.js', () => ({
  startMcpServers: async () => ({ servers: [], getUpstreamPort: () => null, stop: vi.fn() }),
  getRunningServerNames: () => [],
  getServerUpstreamPort: () => null,
}));
vi.mock('./mcp-auth-proxy.js', () => ({
  startMcpAuthProxy: () => ({ stop: vi.fn() }),
  setUpstreamPortResolver: vi.fn(),
  discoverTools: vi.fn(),
  configureContainerTokenStore: vi.fn(),
}));
vi.mock('./dashboard-ingress.js', () => ({ startDashboardIngress: () => ({ stop: vi.fn() }) }));
vi.mock('./github-webhook-server.js', () => ({
  startGitHubWebhookServer: () => undefined,
  processGitHubDelivery: vi.fn(),
}));
vi.mock('./webhook-inbox-drain.js', () => ({ startWebhookInboxDrain: vi.fn(), stopWebhookInboxDrain: vi.fn() }));
vi.mock('./gateway-providers/index.js', () => ({ getGatewayProvider: () => ({}), resetGatewayProvider: vi.fn() }));
vi.mock('./gateway-availability.js', () => ({ startGatewayAvailabilityMonitor: async () => () => {} }));
vi.mock('./gateway-approval-coordinator.js', () => ({
  startGatewayApprovalCoordinator: vi.fn(),
  stopGatewayApprovalCoordinator: vi.fn(),
}));
vi.mock('./host-sweep.js', () => ({ startHostSweep: vi.fn(), stopHostSweep: vi.fn() }));
vi.mock('./host-lifecycle.js', () => ({ startHostModules: vi.fn(), stopHostModules: vi.fn() }));
vi.mock('./modules/cost-approval/index.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('./modules/cost-approval/index.js')>()),
  registerCostApproval: vi.fn(),
}));
vi.mock('./router.js', () => ({ routeInbound: vi.fn() }));
vi.mock('./channels/index.js', () => ({}));
vi.mock('./modules/index.js', () => ({}));
vi.mock('./cli/commands/index.js', () => ({}));
vi.mock('./cli/socket-server.js', () => ({ startCliServer: state.ready, stopCliServer: vi.fn() }));
vi.mock('./channels/channel-registry.js', () => ({
  createChannelDeliveryAdapter: () => ({ deliver: vi.fn(async () => 'platform-id') }),
  initChannelAdapters: vi.fn(),
  teardownChannelAdapters: vi.fn(),
  getActiveAdapters: () => [],
}));
vi.mock('./log.js', () => ({
  log: {
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    fatal: (message: string, data?: { err?: unknown }) => console.error('FATAL', message, data?.err),
  },
}));

import { dispatch } from './cli/dispatch.js';
import { closeDb, createAgentGroup, createMessagingGroup, initTestDb, runMigrations } from './db/index.js';
import { getRunningSessions, getSession, updateSession } from './db/sessions.js';
import { stopDeliveryPolls } from './delivery.js';
import { inboundDbPath, outboundDbPath } from './mailbox/sqlite/paths.js';
import { resolveSession } from './session-manager.js';
import type { Session } from './types.js';

const TEST_DIR = '/tmp/nanoclaw-test-startup-adoption';
const ACTIVE_POLL_MS = 1_000; // ACTIVE_POLL_MS in delivery.ts

function writeCliRequest(session: Session, requestId: string): void {
  const db = new Database(outboundDbPath(session.agent_group_id, session.id));
  db.prepare(`INSERT INTO messages_out (id, timestamp, kind, content) VALUES (?, datetime('now'), 'system', ?)`).run(
    `out-${requestId}`,
    JSON.stringify({ action: 'cli_request', requestId, command: 'groups-list', args: {} }),
  );
  db.close();
}

function hasCliResponse(session: Session, requestId: string): boolean {
  const db = new Database(inboundDbPath(session.agent_group_id, session.id), { readonly: true });
  const row = db.prepare('SELECT 1 FROM messages_in WHERE id = ?').get(`cli-resp-${requestId}`);
  db.close();
  return row !== undefined;
}

afterAll(async () => {
  stopDeliveryPolls();
  vi.useRealTimers();
  await closeDb();
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
});

it('answers an ncl request from an adopted container within one active-poll interval', async () => {
  fs.rmSync(TEST_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DIR, { recursive: true });
  await runMigrations(await initTestDb());
  await createAgentGroup({ id: 'ag-1', name: 'ag-1', folder: 'ag-1', agent_provider: null, created_at: '' });
  await createMessagingGroup({
    id: 'mg-1',
    channel_type: 'telegram',
    platform_id: 'telegram:123',
    name: 'Test Chat',
    is_group: 1,
    unknown_sender_policy: 'public',
    created_at: '',
  });
  // The previous host process left both sessions at 'running'. Only the
  // survivor's container is still alive; the other one died with that process.
  const { session: survivor } = await resolveSession('ag-1', 'mg-1', 'thread-survivor', 'per-thread');
  const { session: dead } = await resolveSession('ag-1', 'mg-1', 'thread-dead', 'per-thread');
  await updateSession(survivor.id, { container_status: 'running' });
  await updateSession(dead.id, { container_status: 'running' });
  state.survivorId = survivor.id;

  vi.spyOn(process, 'on').mockReturnValue(process);
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval'] });
  await import('./index.js');
  await vi.waitFor(() => expect(state.ready).toHaveBeenCalled());

  // Startup marked the dead session stopped and left the adopted survivor running.
  expect((await getRunningSessions()).map((s) => s.id)).toEqual([survivor.id]);
  expect((await getSession(dead.id))?.container_status).toBe('stopped');

  // Both polls ran their boot tick. A request written now is found only by a
  // later tick: the active poll's next one, or the sweep's 60 s after boot.
  await vi.advanceTimersByTimeAsync(5 * ACTIVE_POLL_MS);
  writeCliRequest(survivor, 'req-after-restart');
  await vi.advanceTimersByTimeAsync(ACTIVE_POLL_MS);

  expect(vi.mocked(dispatch)).toHaveBeenCalledWith(
    expect.objectContaining({ id: 'req-after-restart', command: 'groups-list' }),
    expect.objectContaining({ caller: 'agent', sessionId: survivor.id }),
  );
  expect(hasCliResponse(survivor, 'req-after-restart')).toBe(true);
});
