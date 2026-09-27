import { afterEach, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  adopted: false,
  approvalReady: false,
  releaseAdoption: undefined as (() => void) | undefined,
  routeInbound: vi.fn(),
  startChannels: vi.fn(),
  ready: vi.fn(),
}));
vi.mock('./backfill-container-configs.js', () => ({ backfillContainerConfigs: vi.fn() }));
vi.mock('./config.js', () => ({
  CENTRAL_DB_PATH: ':memory:',
  DASHBOARD_INGRESS_HOST: '127.0.0.1',
  DASHBOARD_INGRESS_PORT: 0,
  DATA_DIR: '/tmp/nanoclaw-startup-order',
  MCP_PROXY_PORT: 0,
  PROXY_BIND_HOST: '127.0.0.1',
  validateContainerTimeouts: () => ({ ok: true }),
}));
// Fork-only startup work, stubbed so the assertions below are about ORDER and
// nothing else: each of these would otherwise open a real port, touch the
// working tree, or query a table this test never migrates, and any one of them
// throwing makes `main()` die before the ordering it is here to pin.
vi.mock('./agents-symlink-backfill.js', () => ({ backfillAgentsSymlinks: vi.fn() }));
vi.mock('./migrations/global-to-shared.js', () => ({ runGlobalToSharedMigration: vi.fn() }));
vi.mock('./mcp-registry.js', () => ({
  startMcpServers: async () => ({ servers: [] }),
  getRunningServerNames: () => [],
  getServerUpstreamPort: () => null,
}));
vi.mock('./mcp-auth-proxy.js', () => ({
  startMcpAuthProxy: () => ({ close: vi.fn() }),
  setUpstreamPortResolver: vi.fn(),
  discoverTools: vi.fn(),
  configureContainerTokenStore: vi.fn(),
}));
vi.mock('./dashboard-ingress.js', () => ({ startDashboardIngress: () => ({ close: vi.fn() }) }));
vi.mock('./github-webhook-server.js', () => ({ startGitHubWebhookServer: () => undefined }));
vi.mock('./modules/cost-approval/index.js', () => ({ registerCostApproval: vi.fn() }));
vi.mock('./db/messaging-groups.js', () => ({
  getMessagingGroupsByChannel: async () => [],
  getMessagingGroupAgents: async () => [],
}));
vi.mock('./circuit-breaker.js', () => ({ enforceStartupBackoff: vi.fn(), resetCircuitBreaker: vi.fn() }));
vi.mock('./upgrade-state.js', () => ({ enforceUpgradeTripwire: vi.fn() }));
vi.mock('./db/connection.js', () => ({
  initDb: async () => ({ dialect: 'sqlite' }),
  closeDb: vi.fn(),
  getDb: () => ({ run: vi.fn(), all: async () => [], get: async () => undefined }),
}));
vi.mock('./db/migrations/index.js', () => ({ runMigrations: vi.fn() }));
vi.mock('./drivers/index.js', () => ({ getSessionDriver: () => ({ ensureReady: vi.fn() }) }));
vi.mock('./container-runner.js', () => ({
  adoptRunningSessions: async () => {
    expect(state.approvalReady).toBe(true);
    await new Promise<void>((resolve) => {
      state.releaseAdoption = resolve;
    });
    state.adopted = true;
  },
  abortGatewaySessionObservers: vi.fn(),
  resumeGatewaySessionAdmission: vi.fn(),
  stopGatewaySessionsForUnavailability: vi.fn(),
}));
vi.mock('./host-instance.js', () => ({ startHostInstanceLease: vi.fn(), stopHostInstanceLease: vi.fn() }));
vi.mock('./gateway-providers/index.js', () => ({ getGatewayProvider: () => ({}), resetGatewayProvider: vi.fn() }));
vi.mock('./gateway-availability.js', () => ({
  startGatewayAvailabilityMonitor: async () => {
    expect(state.approvalReady).toBe(true);
  },
}));
vi.mock('./gateway-approval-coordinator.js', () => ({
  startGatewayApprovalCoordinator: async (
    _provider: unknown,
    _delivery: unknown,
    _unavailable: unknown,
    options: { waitUntilReady?: boolean },
  ) => {
    expect(options.waitUntilReady).toBe(true);
    state.approvalReady = true;
  },
  stopGatewayApprovalCoordinator: vi.fn(),
}));
vi.mock('./delivery.js', () => ({
  startActiveDeliveryPoll: vi.fn(),
  startSweepDeliveryPoll: vi.fn(),
  setDeliveryAdapter: vi.fn(),
  stopDeliveryPolls: vi.fn(),
}));
vi.mock('./host-sweep.js', () => ({ startHostSweep: vi.fn(), stopHostSweep: vi.fn() }));
vi.mock('./host-lifecycle.js', () => ({ startHostModules: vi.fn(), stopHostModules: vi.fn() }));
vi.mock('./router.js', () => ({ routeInbound: state.routeInbound }));
vi.mock('./response-registry.js', () => ({ getResponseHandlers: () => [] }));
vi.mock('./channels/index.js', () => ({}));
vi.mock('./modules/index.js', () => ({}));
vi.mock('./cli/commands/index.js', () => ({}));
vi.mock('./cli/delivery-action.js', () => ({}));
vi.mock('./cli/socket-server.js', () => ({ startCliServer: state.ready, stopCliServer: vi.fn() }));
// `fatal` prints rather than swallowing: when `main()` dies early the only
// visible symptom is `releaseAdoption` staying undefined, which says nothing
// about why. The cause belongs in the output.
vi.mock('./log.js', () => ({
  log: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    fatal: (message: string, data?: { err?: unknown }) => console.error('FATAL', message, data?.err),
  },
}));
vi.mock('./channels/channel-registry.js', () => ({
  createChannelDeliveryAdapter: () => ({}),
  teardownChannelAdapters: vi.fn(),
  initChannelAdapters: state.startChannels,
}));

afterEach(() => vi.restoreAllMocks());

it('finishes adoption before a channel can route its first inbound message', async () => {
  vi.spyOn(process, 'on').mockReturnValue(process);
  state.routeInbound.mockImplementation(async () => {
    expect(state.adopted).toBe(true);
  });
  state.startChannels.mockImplementation(async (setup) => {
    setup({ channelType: 'fixture' }).onInbound('chat', null, {
      id: 'message',
      kind: 'text',
      content: 'hello',
      timestamp: new Date().toISOString(),
    });
  });
  await import('./index.js');
  await vi.waitFor(() => expect(state.releaseAdoption).toBeDefined());
  expect(state.routeInbound).not.toHaveBeenCalled();
  state.releaseAdoption!();
  await vi.waitFor(() => expect(state.ready).toHaveBeenCalled());
  expect(state.routeInbound).toHaveBeenCalledOnce();
});
