import os from 'os';

import { describe, expect, it } from 'vitest';

import { dockerNetworkArgs } from './index.js';
import { fixtureSpec, fixtureSpecWithAux } from './spec-fixture.js';

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
