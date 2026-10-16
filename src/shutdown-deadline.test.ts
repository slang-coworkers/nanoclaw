import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./log.js', () => ({
  log: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(), fatal: vi.fn() },
}));

import { log } from './log.js';
import {
  DEFAULT_SHUTDOWN_DEADLINE_MS,
  resolveShutdownDeadlineMs,
  runShutdownSteps,
  type ShutdownStep,
} from './shutdown-deadline.js';

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe('runShutdownSteps', () => {
  it('runs every step in order when they settle in time', async () => {
    const order: string[] = [];
    const steps: ShutdownStep[] = ['a', 'b', 'c'].map((name) => ({ name, run: async () => void order.push(name) }));
    const result = await runShutdownSteps(steps, 1_000);
    expect(result).toMatchObject({ completed: true, skipped: [] });
    expect(order).toEqual(['a', 'b', 'c']);
  });

  it('continues past a step that throws', async () => {
    const ran = vi.fn();
    const result = await runShutdownSteps(
      [
        {
          name: 'boom',
          run: () => {
            throw new Error('x');
          },
        },
        { name: 'after', run: ran },
      ],
      1_000,
    );
    expect(result.completed).toBe(true);
    expect(ran).toHaveBeenCalled();
    expect(log.error).toHaveBeenCalledWith('Shutdown step threw', expect.objectContaining({ step: 'boom' }));
  });

  it('a hung step does not block past the deadline; reports pending + skipped', async () => {
    const later = vi.fn();
    let settled = false;
    const p = runShutdownSteps(
      [
        { name: 'fast', run: () => undefined },
        { name: 'hung', run: () => new Promise<void>(() => {}) },
        { name: 'close-db', run: later },
      ],
      7_000,
    ).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(6_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    const result = await p;
    expect(result).toMatchObject({ completed: false, pending: 'hung', skipped: ['close-db'] });
    expect(later).not.toHaveBeenCalled();
    expect(log.warn).toHaveBeenCalledWith(
      'Shutdown deadline reached — abandoning remaining cleanup',
      expect.objectContaining({ pending: 'hung', skipped: ['close-db'] }),
    );
  });

  it('counts a first step’s synchronous work against the deadline', async () => {
    let settled = false;
    const p = runShutdownSteps(
      [
        { name: 'sync-4s', run: () => void vi.advanceTimersByTime(4_000) },
        { name: 'hung', run: () => new Promise<void>(() => {}) },
      ],
      7_000,
    ).then((r) => {
      settled = true;
      return r;
    });
    await vi.advanceTimersByTimeAsync(2_999);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(p).resolves.toMatchObject({ completed: false, pending: 'hung' });
  });

  it('does not admit another step once a synchronous step overran the budget', async () => {
    const later = vi.fn();
    const p = runShutdownSteps(
      [
        { name: 'sync-overrun', run: () => void vi.advanceTimersByTime(8_000) },
        { name: 'later', run: later },
      ],
      7_000,
    );
    await vi.advanceTimersByTimeAsync(0);
    const result = await p;
    expect(later).not.toHaveBeenCalled();
    expect(result.completed).toBe(false);
    expect(result.skipped).toContain('later');
  });

  it('does not start later steps once the hung step finally settles after the deadline', async () => {
    let release!: () => void;
    const later = vi.fn();
    const p = runShutdownSteps(
      [
        { name: 'slow', run: () => new Promise<void>((r) => (release = r)) },
        { name: 'later', run: later },
      ],
      100,
    );
    await vi.advanceTimersByTimeAsync(100);
    await p;
    release();
    await vi.advanceTimersByTimeAsync(0);
    expect(later).not.toHaveBeenCalled();
  });
});

describe('resolveShutdownDeadlineMs', () => {
  it('defaults inside the unit TimeoutStopSec=10 and honours a valid override', () => {
    expect(DEFAULT_SHUTDOWN_DEADLINE_MS).toBeLessThan(10_000);
    expect(resolveShutdownDeadlineMs({})).toBe(DEFAULT_SHUTDOWN_DEADLINE_MS);
    expect(resolveShutdownDeadlineMs({ NANOCLAW_SHUTDOWN_DEADLINE_MS: '4000' })).toBe(4_000);
    expect(resolveShutdownDeadlineMs({ NANOCLAW_SHUTDOWN_DEADLINE_MS: 'nope' })).toBe(DEFAULT_SHUTDOWN_DEADLINE_MS);
  });
});
