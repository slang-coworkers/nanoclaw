import { afterEach, describe, expect, it } from 'vitest';

import { _resetEchoDropState, evaluateEchoDrop, extractText } from './modules/runaway/echo-drop.js';

afterEach(() => _resetEchoDropState());

describe('extractText', () => {
  it('pulls the text field from a JSON content blob', () => {
    expect(extractText(JSON.stringify({ text: 'hello', sender: 'a' }))).toBe('hello');
  });
  it('falls back to the raw string when not JSON', () => {
    expect(extractText('plain string')).toBe('plain string');
  });
  it('returns empty string when there is no text field', () => {
    expect(extractText(JSON.stringify({ sender: 'a' }))).toBe('');
  });
});

describe('evaluateEchoDrop — no-op patterns', () => {
  it('drops a bare "No response."', () => {
    const d = evaluateEchoDrop('sess-1', 'No response.');
    expect(d.drop).toBe(true);
    expect(d.reason).toBe('noop_pattern');
  });
  it('drops "No response requested" and acks and bare dots', () => {
    expect(evaluateEchoDrop('s', 'No response requested').drop).toBe(true);
    expect(evaluateEchoDrop('s', 'ack').drop).toBe(true);
    expect(evaluateEchoDrop('s', '...').drop).toBe(true);
    expect(evaluateEchoDrop('s', '   ').drop).toBe(true);
  });
  it('is case/space insensitive', () => {
    expect(evaluateEchoDrop('s', '  NO RESPONSE.  ').drop).toBe(true);
  });
});

describe('evaluateEchoDrop — loop detection', () => {
  it('does NOT drop a normal task message the first times, but drops on the Nth repeat', () => {
    const text = 'Please review PR #123 for the buffer-load fix.';
    const t0 = 1_000_000;
    // 1st and 2nd occurrences pass (N defaults to 3)
    expect(evaluateEchoDrop('sess-loop', text, t0).drop).toBe(false);
    expect(evaluateEchoDrop('sess-loop', text, t0 + 1000).drop).toBe(false);
    // 3rd identical occurrence within the window → loop drop
    const third = evaluateEchoDrop('sess-loop', text, t0 + 2000);
    expect(third.drop).toBe(true);
    expect(third.reason).toBe('loop_repeat');
  });

  it('does NOT count repeats outside the time window', () => {
    const text = 'distinct repeating note';
    const t0 = 2_000_000;
    expect(evaluateEchoDrop('sess-win', text, t0).drop).toBe(false);
    expect(evaluateEchoDrop('sess-win', text, t0 + 1000).drop).toBe(false);
    // 3rd occurrence but >120s later → window expired, prior two evicted
    expect(evaluateEchoDrop('sess-win', text, t0 + 200_000).drop).toBe(false);
  });

  it('isolates loop state per target session', () => {
    const text = 'same text different sessions';
    expect(evaluateEchoDrop('A', text).drop).toBe(false);
    expect(evaluateEchoDrop('A', text).drop).toBe(false);
    // Session B has only seen it once → not dropped
    expect(evaluateEchoDrop('B', text).drop).toBe(false);
  });

  it('distinct task messages never trip the loop', () => {
    for (let i = 0; i < 10; i++) {
      expect(evaluateEchoDrop('sess-distinct', `unique task ${i}`).drop).toBe(false);
    }
  });
});
