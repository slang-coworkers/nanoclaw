import { describe, expect, test } from 'bun:test';

import { classifyTurnError } from './transient-error.js';

describe('classifyTurnError', () => {
  test('the #12097 auth-outage string is transient', () => {
    // The exact string the fixer bounced on during the Jul-14 auth outage.
    expect(classifyTurnError('Not logged in · Please run /login')).toBe('transient');
  });

  test('the SDK-wrapped error-result form is transient', () => {
    expect(
      classifyTurnError('Error: Claude Code returned an error result: Not logged in · Please run /login'),
    ).toBe('transient');
  });

  test('gateway 5xx / connection faults are transient', () => {
    expect(classifyTurnError('Error: 503 Service Unavailable')).toBe('transient');
    expect(classifyTurnError('Error: 502 Bad Gateway')).toBe('transient');
    expect(classifyTurnError('fetch failed: ECONNREFUSED 127.0.0.1:8080')).toBe('transient');
    expect(classifyTurnError('socket hang up')).toBe('transient');
    expect(classifyTurnError('overloaded_error: the model is overloaded')).toBe('transient');
  });

  test('transport-death (mid-response stream errors) are transient (#12108)', () => {
    // These only ever surface via the SDK's THROWN error path — a response
    // stream that dies mid-read never yields a clean structured result. Each
    // must classify transient so the outer-catch bounce redrives it instead of
    // silently acking the a2a handoff completed (the #12108 drop).
    expect(
      classifyTurnError(
        'Error: Claude Code returned an error result: API Error: Connection closed mid-response. The response above may be incomplete.',
      ),
    ).toBe('transient');
    expect(classifyTurnError('Error: API Error: Unable to connect to API (ECONNRESET)')).toBe('transient');
    expect(classifyTurnError('Error: API Error: Unable to connect to API (ConnectionRefused)')).toBe(
      'transient',
    );
    expect(classifyTurnError('Error: API Error: The socket connection was closed unexpectedly')).toBe(
      'transient',
    );
  });

  test('a 403 billing_error is permanent (never redrive)', () => {
    expect(classifyTurnError('Error: 403 billing_error: credit balance too low')).toBe('permanent');
  });

  test('an invalid API key is permanent', () => {
    expect(classifyTurnError('authentication_error: invalid x-api-key')).toBe('permanent');
    expect(classifyTurnError('invalid_request_error: bad model')).toBe('permanent');
  });

  test('a novel isError string is unknown (small budget → fast dead-letter)', () => {
    expect(classifyTurnError('Error: something totally novel happened')).toBe('unknown');
  });

  test('empty / null text is unknown, not a crash', () => {
    expect(classifyTurnError('')).toBe('unknown');
    expect(classifyTurnError(null)).toBe('unknown');
    expect(classifyTurnError(undefined)).toBe('unknown');
  });

  test('permanent wins when both signatures are present', () => {
    // A billing error that also mentions a gateway should NOT be redriven.
    expect(classifyTurnError('Error: 503 then billing_error: credit balance too low')).toBe('permanent');
  });
});
