/**
 * GAP-4: `container.json` `mcpServers[].instructions` never reached fork agents.
 * Upstream's composer emits each entry; the fork's spine had zero handling, so
 * operator-authored per-server guidance was stored, materialized into
 * `container.json`, and then ignored.
 *
 * Why it cannot be lazily loaded: an external MCP server ships its own tool
 * descriptions, but those cannot say "in THIS install, use staging" or "never
 * call `delete_*` here". A prohibition has to be in context BEFORE the agent
 * reaches for the tool — unlike a SKILL.md body, which can load on demand.
 *
 * Ordered after the size cap (#1344) deliberately: this is unbounded
 * operator-authored text copied verbatim into an always-loaded document, so
 * without a cap it is an uncapped injection. The last case here pins that the cap
 * actually catches it.
 */
import { describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';
import { PROJECT_DOC_MAX_BYTES, assertWithinDocSizeCap } from './doc-size-cap.js';

const ROOT = process.cwd();

function compose(mcpInstructions?: Record<string, string>, coworkerType = 'default'): string {
  return composeCoworkerSpine({ coworkerType, projectRoot: ROOT, mcpInstructions });
}

function section(doc: string): string {
  const i = doc.indexOf('## MCP Servers');
  if (i === -1) return '';
  const rest = doc.slice(i + 1);
  const end = rest.indexOf('\n## ');
  return end === -1 ? doc.slice(i) : doc.slice(i, i + 1 + end);
}

describe('emitting per-server instructions', () => {
  it('carries the prose into the document', () => {
    const doc = compose({ 'zebra-api': 'Use the STAGING endpoint. Never call `delete_*`.' });

    expect(doc).toContain('## MCP Servers');
    expect(doc).toContain('### zebra-api');
    expect(doc).toContain('Use the STAGING endpoint. Never call `delete_*`.');
  });

  it('emits one sub-heading per server', () => {
    const s = section(compose({ a: 'A prose', b: 'B prose', c: 'C prose' }));

    expect(s.match(/^### /gm)).toHaveLength(3);
  });

  // Deterministic order: the composed document feeds a sha256 staleness
  // comparison, so `Object.entries` order would make an unrelated config edit
  // look like a content change and respawn the container.
  it('sorts server names', () => {
    const s = section(compose({ zebra: 'Z', alpha: 'A', middle: 'M' }));

    expect(s.indexOf('### alpha')).toBeLessThan(s.indexOf('### middle'));
    expect(s.indexOf('### middle')).toBeLessThan(s.indexOf('### zebra'));
  });

  it('produces the same document regardless of key insertion order', () => {
    expect(compose({ b: 'B', a: 'A' })).toBe(compose({ a: 'A', b: 'B' }));
  });
});

describe('emitting nothing when there is nothing', () => {
  it('omits the section when no instructions are supplied', () => {
    expect(compose()).not.toContain('## MCP Servers');
  });

  it('omits the section for an empty map', () => {
    expect(compose({})).not.toContain('## MCP Servers');
  });

  // A heading with no body is worse than no heading: it tells the agent a server
  // has install-specific rules and then withholds them.
  it('skips a whitespace-only entry rather than emitting a bare heading', () => {
    const doc = compose({ blank: '   \n\t\n  ', real: 'Real guidance.' });

    expect(doc).toContain('### real');
    expect(doc).not.toContain('### blank');
  });

  it('omits the whole section when every entry is blank', () => {
    expect(compose({ one: '  ', two: '\n' })).not.toContain('## MCP Servers');
  });
});

describe('heading normalization', () => {
  // Operator prose is authored freely. An `##` heading left as-authored would end
  // the `## MCP Servers` section and promote the rest of the operator's text to a
  // peer of Identity and Invariants.
  it('demotes operator headings below the server sub-heading', () => {
    const doc = compose({ srv: '## Read-only\n\nThis credential 403s on write.' });

    expect(doc).toContain('#### Read-only');
    expect(section(doc)).not.toMatch(/^## Read-only$/m);
  });

  it('preserves relative structure inside the prose', () => {
    const doc = compose({ srv: '## Top\n\nbody\n\n### Nested\n\nmore' });

    expect(doc).toContain('#### Top');
    expect(doc).toContain('##### Nested');
  });

  it('keeps every heading nested under the document title', () => {
    const levels = compose({ srv: '# Escaped\n\nbody' })
      .split('\n')
      .filter((l) => /^#{1,6} /.test(l))
      .map((l) => l.match(/^(#+)/)![1].length);

    expect(levels[0]).toBe(1);
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeLessThanOrEqual(levels[i - 1] + 1);
  });
});

describe('placement', () => {
  it('follows Skills — same kind of thing, how to use a tool you have', () => {
    const doc = compose({ srv: 'prose' });

    expect(doc.indexOf('## Skills')).toBeLessThan(doc.indexOf('## MCP Servers'));
  });

  // The persona keeps the last word: an operator's standing instructions must be
  // able to override guidance for a specific server.
  it('precedes Additional Instructions', () => {
    const doc = composeCoworkerSpine({
      coworkerType: 'default',
      projectRoot: ROOT,
      mcpInstructions: { srv: 'prose' },
      extraInstructions: 'Persona text.',
    });

    expect(doc.indexOf('## MCP Servers')).toBeLessThan(doc.indexOf('## Additional Instructions'));
  });
});

describe('both render paths', () => {
  // `main` is `flat: true` and returns early — the asymmetry that made both the
  // COMPOSED_HEADER seam and the contract layer initially miss the orchestrator.
  it('reaches the flat admin orchestrator', () => {
    const doc = compose({ srv: 'Admin-visible guidance.' }, 'main');

    expect(doc).toContain('## MCP Servers');
    expect(doc).toContain('Admin-visible guidance.');
  });

  it('emits it exactly once on the flat path', () => {
    expect(compose({ srv: 'prose' }, 'main').split('## MCP Servers')).toHaveLength(2);
  });
});

describe('interaction with the size cap', () => {
  // The reason this step lands AFTER the cap. Operator prose is unbounded; before
  // #1344 an oversized entry would push the document past 4 MiB and Claude Code
  // would silently skip the whole file, leaving the agent with no instructions.
  it('is caught by the cap rather than silently blanking the document', () => {
    const doc = compose({ big: 'x'.repeat(PROJECT_DOC_MAX_BYTES) });

    expect(Buffer.byteLength(doc, 'utf-8')).toBeGreaterThan(PROJECT_DOC_MAX_BYTES);
    expect(() => assertWithinDocSizeCap(doc, 'g')).toThrow(/over the/);
  });

  it('names the MCP section as the culprit', () => {
    try {
      assertWithinDocSizeCap(compose({ big: 'x'.repeat(PROJECT_DOC_MAX_BYTES) }), 'g');
      expect.unreachable('should have thrown');
    } catch (err) {
      expect((err as { sections: { section: string }[] }).sections[0].section).toBe('MCP Servers');
    }
  });
});
