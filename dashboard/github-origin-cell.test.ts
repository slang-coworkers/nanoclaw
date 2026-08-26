/**
 * Rendering contract for the Sessions table's GitHub PR/issue badge
 * (dashboard/public/app.js — renderGithubOriginCell).
 *
 * Two independently optional fields per session row: which PR/issue the
 * session's work is tied to (s.ghRepo/ghNumber/ghKind/ghUrl), and who filed
 * it (s.ghAuthor). Most sessions (orchestrator loops, non-GitHub channels,
 * ad-hoc chat) have neither — this pins that "no association" renders a
 * dash, not an empty/broken cell, and that a number-without-author and a
 * number-with-author render distinctly.
 *
 * app.js is a browser script with no module exports, so the function is
 * extracted from source and evaluated. Crude, but it tests the SHIPPED code
 * rather than a copy — and it fails loudly if the function is renamed.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const APP = fs.readFileSync(path.join(HERE, 'public', 'app.js'), 'utf-8');

function loadCell(): (s: Record<string, unknown>) => string {
  const start = APP.indexOf('function renderGithubOriginCell(');
  expect(start, 'renderGithubOriginCell must exist in app.js').toBeGreaterThan(-1);
  let depth = 0;
  let end = -1;
  for (let j = APP.indexOf('{', start); j < APP.length; j++) {
    if (APP[j] === '{') depth++;
    else if (APP[j] === '}') {
      depth--;
      if (depth === 0) {
        end = j + 1;
        break;
      }
    }
  }
  expect(end, 'renderGithubOriginCell must be brace-balanced').toBeGreaterThan(-1);
  const esc = (s: unknown) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const escAttr = (s: unknown) => esc(s).replace(/"/g, '&quot;');
  const factory = new Function(
    'esc',
    'escAttr',
    `${APP.slice(start, end)}; return renderGithubOriginCell;`,
  ) as (esc: unknown, escAttr: unknown) => (s: Record<string, unknown>) => string;
  return factory(esc, escAttr);
}

describe('renderGithubOriginCell', () => {
  const render = loadCell();

  it('renders a dash when the session has no GitHub association', () => {
    const html = render({});
    expect(html).toContain('—');
    expect(html).not.toContain('href=');
  });

  it('renders a dash when ghNumber is set but ghRepo is missing (defensive — should not happen in practice)', () => {
    const html = render({ ghNumber: 42 });
    expect(html).toContain('—');
  });

  it('renders repo#number as a link when both are known, with no author suffix', () => {
    const html = render({
      ghRepo: 'shader-slang/slang',
      ghNumber: 11487,
      ghKind: 'issue',
      ghUrl: 'https://github.com/shader-slang/slang/issues/11487',
    });
    expect(html).toContain('href="https://github.com/shader-slang/slang/issues/11487"');
    expect(html).toContain('slang#11487');
    expect(html).not.toContain('@');
  });

  it('shortens owner/repo to just repo in the visible label', () => {
    const html = render({
      ghRepo: 'shader-slang/slang',
      ghNumber: 1,
      ghKind: 'pr',
      ghUrl: 'https://github.com/shader-slang/slang/pull/1',
    });
    expect(html).toContain('>slang#1<');
    expect(html).not.toContain('shader-slang/slang#1');
  });

  it('appends the author when known', () => {
    const html = render({
      ghRepo: 'shader-slang/slang',
      ghNumber: 11487,
      ghKind: 'issue',
      ghUrl: 'https://github.com/shader-slang/slang/issues/11487',
      ghAuthor: 'reporter-login',
    });
    expect(html).toContain('@reporter-login');
  });

  it('renders the label (no link) when ghUrl is absent but repo/number are known', () => {
    const html = render({ ghRepo: 'shader-slang/slang', ghNumber: 5 });
    expect(html).not.toContain('href=');
    expect(html).toContain('slang#5');
  });

  it('escapes an author login that contains HTML-special characters', () => {
    const html = render({
      ghRepo: 'a/b',
      ghNumber: 1,
      ghUrl: 'https://github.com/a/b/pull/1',
      ghAuthor: '<script>',
    });
    expect(html).not.toContain('<script>');
    expect(html).toContain('&lt;script&gt;');
  });
});
