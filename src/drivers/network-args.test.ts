import os from 'os';

import { describe, expect, it } from 'vitest';

import { applyAgentDockerHost, dockerNetworkArgs } from './index.js';
import { fixtureSpec, fixtureSpecWithAux } from './spec-fixture.js';

describe('applyAgentDockerHost', () => {
  const PODMAN = 'unix:///run/podman/podman.sock';

  it('points docker children at the agent engine', () => {
    const env: NodeJS.ProcessEnv = { NANOCLAW_AGENT_DOCKER_HOST: PODMAN };
    expect(applyAgentDockerHost(env)).toBe(PODMAN);
    expect(env.DOCKER_HOST).toBe(PODMAN);
  });

  it('leaves an explicit DOCKER_HOST alone', () => {
    const env: NodeJS.ProcessEnv = { NANOCLAW_AGENT_DOCKER_HOST: PODMAN, DOCKER_HOST: 'tcp://elsewhere:2375' };
    expect(applyAgentDockerHost(env)).toBeUndefined();
    expect(env.DOCKER_HOST).toBe('tcp://elsewhere:2375');
  });

  it('does nothing when unset', () => {
    const env: NodeJS.ProcessEnv = {};
    expect(applyAgentDockerHost(env)).toBeUndefined();
    expect(env.DOCKER_HOST).toBeUndefined();
  });
});

describe('dockerNetworkArgs', () => {
  it('keeps the default topology when NANOCLAW_AGENT_NETWORK is unset', () => {
    const args = dockerNetworkArgs(fixtureSpec(), {});
    const expected = os.platform() === 'linux' ? ['--add-host=host.internal:host-gateway'] : [];
    expect(args).toEqual(expected);
  });

  it('ignores unknown NANOCLAW_AGENT_NETWORK values', () => {
    const args = dockerNetworkArgs(fixtureSpec(), { NANOCLAW_AGENT_NETWORK: 'bridge' });
    const expected = os.platform() === 'linux' ? ['--add-host=host.internal:host-gateway'] : [];
    expect(args).toEqual(expected);
  });

  it('uses slirp4netns with the slirp host address when opted in', () => {
    expect(dockerNetworkArgs(fixtureSpec(), { NANOCLAW_AGENT_NETWORK: 'slirp4netns' })).toEqual([
      '--network',
      'slirp4netns',
      '--add-host=host.internal:10.0.2.2',
    ]);
  });

  it('honors NANOCLAW_SLIRP_HOST_IP and is case-insensitive on the mode', () => {
    expect(
      dockerNetworkArgs(fixtureSpec(), { NANOCLAW_AGENT_NETWORK: 'SLIRP4NETNS', NANOCLAW_SLIRP_HOST_IP: '10.0.2.3' }),
    ).toEqual(['--network', 'slirp4netns', '--add-host=host.internal:10.0.2.3']);
  });

  it('leaves session-container topologies alone even when opted in', () => {
    expect(dockerNetworkArgs(fixtureSpecWithAux(), { NANOCLAW_AGENT_NETWORK: 'slirp4netns' })).toEqual([]);
  });
});
