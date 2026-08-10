/**
 * Rendering contract for the KB doctor panel (dashboard/public/app.js).
 *
 * The panel exists because /api/kb-health has been serving a validated `doctor`
 * block since #1121/#1169 and nothing rendered it — the only way to read a drift
 * report was curl. These tests pin the two properties that made the route worth
 * hardening in the first place, because a renderer can reintroduce a false clean
 * that the route carefully refuses to produce:
 *
 *   unavailable is not zero   — an absent or untrustworthy report must say so
 *   unknown is not clean      — checks that could not be evaluated stay visible
 *
 * app.js is a browser script with no module exports, so the function is
 * extracted by source and evaluated. Crude, but it tests the shipped code rather
 * than a copy of it — and it fails loudly if the function is renamed or removed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

function loadPanel(): (kbh: unknown) => string {
  const start = APP.indexOf('function kbDoctorHtml(');
  expect(start, 'kbDoctorHtml must exist in app.js').toBeGreaterThan(-1);
  // Balance braces from the function's opening brace to its close.
  let i = APP.indexOf('{', start);
  let depth = 0;
  let end = -1;
  for (let j = i; j < APP.length; j++) {
    if (APP[j] === '{') depth++;
    else if (APP[j] === '}') {
      depth--;
      if (depth === 0) { end = j + 1; break; }
    }
  }
  expect(end, 'kbDoctorHtml must be brace-balanced').toBeGreaterThan(-1);
  const src = APP.slice(start, end);
  // `esc` is defined elsewhere in app.js; supply an equivalent.
  const factory = new Function(
    'esc',
    `${src}; return kbDoctorHtml;`,
  ) as (esc: (s: string) => string) => (kbh: unknown) => string;
  return factory((s: string) =>
    String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;'),
  );
}

const kbDoctorHtml = loadPanel();

describe('KB doctor panel', () => {
  it('renders nothing when the response carries no doctor block', () => {
    expect(kbDoctorHtml({})).toBe('');
    expect(kbDoctorHtml(null)).toBe('');
  });

  it('says UNAVAILABLE rather than showing a zero', () => {
    // The defect this whole chain was built to kill: a missing report rendering
    // as "0 drift", which reads identically to a healthy KB.
    const html = kbDoctorHtml({ doctor: { available: false, reason: 'artifact not found' } });
    expect(html).toContain('No usable drift report');
    expect(html).toContain('artifact not found');
    expect(html).not.toMatch(/drift 0/);
  });

  it('shows unknown as its own count, never folded into drift', () => {
    const html = kbDoctorHtml({
      doctor: { available: true, status: 'unknown', driftCount: 0, unknownCount: 3, complete: true, ageHours: 1 },
    });
    expect(html).toContain('drift 0');
    expect(html).toContain('unknown 3');
  });

  it('flags an incomplete run so it cannot read as a pass', () => {
    const html = kbDoctorHtml({
      doctor: { available: true, status: 'ok', driftCount: 0, unknownCount: 0, complete: false, ageHours: 1 },
    });
    expect(html).toContain('incomplete run');
  });

  it('flags a stale report', () => {
    const html = kbDoctorHtml({
      doctor: { available: true, status: 'ok', driftCount: 0, unknownCount: 0, complete: true, stale: true },
    });
    expect(html).toContain('stale');
  });

  it('says age unknown rather than implying freshness', () => {
    const html = kbDoctorHtml({
      doctor: { available: true, status: 'ok', driftCount: 0, unknownCount: 0, complete: true },
    });
    expect(html).toContain('age unknown');
  });

  it('lists the drift findings and escapes them', () => {
    const html = kbDoctorHtml({
      doctor: {
        available: true, status: 'drift', driftCount: 1, unknownCount: 0, complete: true, ageHours: 0.2,
        drift: ['builder: <script>alert(1)</script> differs'],
      },
    });
    expect(html).toContain('drift 1');
    expect(html).toContain('&lt;script&gt;');
    expect(html).not.toContain('<script>alert');
  });
});
