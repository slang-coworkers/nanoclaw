/**
 * Regression guards for the critique-gate approval card in
 * dashboard/public/{app,mobile}.js.
 *
 * Those files are browser scripts loaded via <script>, not modules — they
 * reference `document` and `cwState` at top level, so they cannot be imported
 * into vitest and there is no client-side harness in this repo. These are
 * therefore source-level assertions. They are narrow on purpose: each one
 * pins a specific defect that shipped in #1095 and was caught in review, and
 * each would silently "work" again if someone reverted the fix.
 *
 * The three defects:
 *   1. the session link was a Markdown link to a query-string URL — md() only
 *      linkifies http(s), so it rendered as literal "[session](?session=…)"
 *      text, and the router is hash-based (#/cw/<folder>/s/<id>) anyway;
 *   2. mobile truncated every reason at 180 chars with no way to expand, so
 *      decision-critical text was unreachable;
 *   3. expansion state lived in the DOM, and the 3s message poll rebuilds the
 *      cards — an expanded reason collapsed again within seconds.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { describe, expect, it } from 'vitest';

const here = path.dirname(fileURLToPath(import.meta.url));
const app = fs.readFileSync(path.join(here, 'public/app.js'), 'utf-8');
const mobile = fs.readFileSync(path.join(here, 'public/mobile.js'), 'utf-8');

describe('critique-gate card: session link', () => {
  it('links the session via the hash route the router actually parses', () => {
    // applyCwUrl() parses /^#\/cw\/([^/]+)(?:\/(t|s|l)\/(.+))?$/
    expect(app).toContain('#/cw/${encodeURIComponent(item.coworkerFolder)}/s/${encodeURIComponent(item.sessionId)}');
  });

  it('never uses a ?session= query string — that route does not exist', () => {
    expect(app).not.toContain('?session=');
  });

  it('builds the session anchor as raw HTML, not Markdown', () => {
    // md() only linkifies https?:// URLs, so `[session](#/cw/...)` would
    // render as literal text. Assert no Markdown link to a non-http target.
    const mdLinkToNonHttp = /\]\((?!https?:\/\/)[#?]/;
    expect(mdLinkToNonHttp.test(app)).toBe(false);
  });
});

describe('critique-gate card: reason clamping stays reachable', () => {
  it('mobile offers a toggle rather than discarding the tail outright', () => {
    expect(mobile).toContain('reason-toggle');
    expect(mobile).toMatch(/show more/);
    expect(mobile).toMatch(/show less/);
  });

  it('mobile appends the toggle AFTER md(), which escapes its whole input', () => {
    // mobile's md() begins `let h = esc(s)`, so an anchor embedded in the
    // markdown string would render as literal <a…> text.
    expect(mobile).toContain('${md(desc)}${toggleHtml}');
  });

  it('desktop offers both directions', () => {
    expect(app).toContain('reason-more');
    expect(app).toContain('reason-less');
  });
});

describe('critique-gate card: expansion survives the poll re-render', () => {
  it('tracks expansion in cwState, not the DOM, on both surfaces', () => {
    // fetchCwMessages polls every 3s and re-runs the renderers; DOM-only
    // state (toggled display, removed link) is wiped almost immediately.
    expect(app).toContain('cwState.expandedReasons');
    expect(mobile).toContain('cwState.expandedReasons');
  });

  it('re-renders after a toggle instead of mutating the rendered nodes', () => {
    // Anchor on the handler's own variable, not on the string "reason-" —
    // that also appears in the renderer's class names, which come first in
    // both files and would slice the wrong region.
    for (const src of [app, mobile]) {
      expect(src).toMatch(/const reasonToggle[\s\S]{0,800}renderCwMessages\(\)/);
    }
  });

  it('does not restore the old DOM-mutating expander', () => {
    expect(app).not.toContain("full.style.display = 'inline'");
  });
});
