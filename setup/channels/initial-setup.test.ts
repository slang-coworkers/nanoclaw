import { describe, it, expect } from 'vitest';

import { initialChannelOptions, channelDmLabel } from './initial-setup.js';

describe('initialChannelOptions', () => {
  const opts = initialChannelOptions();

  it('offers Dashboard as the first option so it is pre-selected by default', () => {
    expect(opts[0]?.value).toBe('dashboard');
  });

  it('keeps the chat channels and the escape hatches', () => {
    const values = opts.map((o) => o.value);
    for (const expected of ['dashboard', 'slack', 'teams', 'telegram', 'whatsapp', 'other', 'skip']) {
      expect(values).toContain(expected);
    }
  });

  it('has a non-empty label for every option', () => {
    for (const o of opts) {
      expect(o.label.length).toBeGreaterThan(0);
    }
  });
});

describe('channelDmLabel', () => {
  it('returns null for Dashboard (it is a viewer, not a DM channel)', () => {
    expect(channelDmLabel('dashboard')).toBeNull();
  });

  it('still labels real chat channels', () => {
    expect(channelDmLabel('slack')).toBe('Slack DMs');
    expect(channelDmLabel('teams')).toBe('Teams');
  });
});
