import { describe, expect, it } from 'bun:test';

import { makeOutboundMaintenance } from './poll-loop.js';

// Runner-side outbound maintenance is a series of bounded steps: GC until its
// cursor says done, then reclaim until a pass finds nothing — one unit per step.

describe('makeOutboundMaintenance', () => {
  it('runs one bounded GC unit per step, then reclaim, then stops', () => {
    const calls: string[] = [];
    let gcLeft = 3;
    let reclaimLeft = 2;
    const m = makeOutboundMaintenance(30, {
      gc: (_cutoff, rows) => {
        calls.push(`gc:${rows}`);
        gcLeft--;
        return { messagesOut: 1, acks: 1, more: gcLeft > 0 };
      },
      reclaim: () => {
        calls.push('reclaim');
        reclaimLeft--;
        return {
          action: reclaimLeft >= 0 ? 'incremental' : 'none',
          fileBytesBefore: 2,
          fileBytesAfter: 1,
          freeBytesBefore: 1,
          liveBytes: 1,
          durationMs: 0,
        };
      },
      rowsPerStep: 50,
    });
    for (let i = 0; i < 10 && m.pending(); i++) m.step();
    expect(calls).toEqual(['gc:50', 'gc:50', 'gc:50', 'reclaim', 'reclaim', 'reclaim']);
    expect(m.pending()).toBe(false);
  });

  it('retention 0 = nothing to do', () => {
    let called = false;
    const m = makeOutboundMaintenance(0, {
      gc: () => {
        called = true;
        return { messagesOut: 0, acks: 0 };
      },
    });
    m.step();
    expect(m.pending()).toBe(false);
    expect(called).toBe(false);
  });
});
