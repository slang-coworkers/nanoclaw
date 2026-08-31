/**
 * The invariants byte-parity cannot see.
 *
 * The parity fixtures render only VALID producer output, so no validator rule and
 * no eviction path is reachable from them. Every rule here therefore needs its
 * own negative case: without one, deleting the rule leaves the suite green.
 */
import crypto from 'crypto';

import { describe, expect, it, vi } from 'vitest';

import { ProjectDocTooLargeError } from './doc-size-cap.js';
import { type ComposedSectionInput, type ProjectDocSpec, renderProjectDoc, stripFencedBlocks } from './project-doc.js';

const MARKER = '<!-- composed -->';

function title(body = '# Title'): ComposedSectionInput {
  return { role: 'title', droppable: false, name: 'Title', heading: { kind: 'verbatim' }, body };
}

function body(name: string, text: string, extra: Partial<ComposedSectionInput> = {}): ComposedSectionInput {
  return {
    role: 'body',
    droppable: false,
    name,
    heading: { kind: 'titled', level: 2 },
    body: text,
    ...extra,
  } as ComposedSectionInput;
}

function spec(sections: ComposedSectionInput[], maxBytes?: number): ProjectDocSpec {
  // Deliberately cast: several tests below feed the validator states the tuple
  // type forbids (empty, two titles), which is the point — the runtime guard has
  // to hold for values that arrive from JSON or an `as`-cast.
  return { fileName: 'CLAUDE.md', maxBytes, extraSections: sections as unknown as ProjectDocSpec['extraSections'] };
}

function render(sections: ComposedSectionInput[], maxBytes?: number) {
  return renderProjectDoc(MARKER, spec(sections, maxBytes));
}

describe('validator — cardinality and ordering', () => {
  it('rejects two titles', () => {
    expect(() => render([title(), title()])).toThrow(/2 title sections/);
  });

  // Separate from the two-title case on purpose: an implementation checking only
  // `count > 1` passes that test while accepting a document with no H1 at all.
  it('rejects zero titles', () => {
    expect(() => render([body('Only', 'x')])).toThrow(/no title section/);
  });

  it('rejects a title that is not first', () => {
    expect(() => render([body('First', 'x'), title()])).toThrow(/must come first/);
  });

  it('rejects a flat identity with no H1', () => {
    expect(() => render([title('No heading here')])).toThrow(/must render an H1/);
  });

  // A tilde fence is valid CommonMark. The three scanners this replaces test
  // backticks only, so a heading inside ~~~ would have satisfied the title check.
  it('does not accept a heading inside a tilde fence as the H1', () => {
    expect(() => render([title('~~~\n# fake\n~~~')])).toThrow(/must render an H1/);
  });

  it('accepts a real H1 after a fenced block', () => {
    expect(() => render([title('```\n## fenced\n```\n\n# Real')])).not.toThrow();
  });

  it('rejects two personas', () => {
    const persona: ComposedSectionInput = {
      role: 'persona',
      droppable: false,
      name: 'Additional Instructions',
      heading: { kind: 'verbatim' },
      body: 'p',
    };
    expect(() => render([title(), persona, persona])).toThrow(/2 persona sections/);
  });

  it('rejects content after the persona', () => {
    const persona: ComposedSectionInput = {
      role: 'persona',
      droppable: false,
      name: 'Additional Instructions',
      heading: { kind: 'verbatim' },
      body: 'p',
    };
    expect(() => render([title(), persona, body('After', 'x')])).toThrow(/must be last/);
  });

  it('rejects a synthesized H1 outside the title', () => {
    expect(() => render([title(), { ...body('Second', 'x'), heading: { kind: 'titled', level: 1 } }])).toThrow(
      /synthesizes an H1/,
    );
  });

  it('rejects an empty section list at runtime, not only in the type', () => {
    expect(() => renderProjectDoc(MARKER, { fileName: 'CLAUDE.md', extraSections: [] as never })).toThrow(
      /at least one section/,
    );
  });
});

describe('validator — group topology', () => {
  const header: ComposedSectionInput = {
    role: 'group-header',
    droppable: false,
    name: 'MCP Servers',
    heading: { kind: 'titled', level: 2 },
    group: 'mcp',
    body: '',
  };
  const member = (name: string) => body(name, `body-${name}`, { group: 'mcp', droppable: true });

  it('accepts a header followed by contiguous members', () => {
    expect(() => render([title(), header, member('a'), member('b')])).not.toThrow();
  });

  it('rejects an orphan member', () => {
    expect(() => render([title(), member('a')])).toThrow(/has no header/);
  });

  it('rejects two headers for one group', () => {
    expect(() => render([title(), header, member('a'), header, member('b')])).toThrow(/more than one header/);
  });

  it('rejects a member emitted before its header', () => {
    expect(() => render([title(), member('a'), header])).toThrow(/directly follow their header/);
  });

  it('rejects non-contiguous members', () => {
    expect(() => render([title(), header, member('a'), body('Other', 'x'), member('b')])).toThrow(/contiguous/);
  });

  it('rejects a header with no members', () => {
    expect(() => render([title(), header])).toThrow(/no members/);
  });
});

describe('rendering', () => {
  it('joins with a blank line, marker first, and ends in exactly one newline', () => {
    const out = render([title(), body('Second', 'text')]).content;

    expect(out).toBe(`${MARKER}\n\n# Title\n\n## Second\n\ntext\n`);
  });

  // `## name\n\n` plus the join's separator would emit three newlines; the tail
  // is exactly where byte-parity breaks.
  it('emits a heading-only block for an empty titled body', () => {
    const out = render([title(), body('Empty', '')]).content;

    expect(out).toBe(`${MARKER}\n\n# Title\n\n## Empty\n`);
  });

  it('hashes the content it returns', () => {
    const { content, hash } = render([title()]);

    expect(hash).toBe(crypto.createHash('sha256').update(content).digest('hex'));
  });
});

describe('cap ladder', () => {
  const big = (name: string, size: number) => body(name, 'x'.repeat(size), { group: 'mcp', droppable: true });
  const header: ComposedSectionInput = {
    role: 'group-header',
    droppable: false,
    name: 'MCP Servers',
    heading: { kind: 'titled', level: 2 },
    group: 'mcp',
    body: '',
  };

  it('does nothing when no cap is configured', () => {
    const { dropped, diagnostics } = render([title(), header, big('a', 5000)]);

    expect(dropped).toEqual([]);
    expect(diagnostics.maxBytes).toBeUndefined();
    expect(diagnostics.nearCap).toBe(false);
  });

  it('evicts the largest droppable section first', () => {
    const { dropped, content } = render([title(), header, big('small', 100), big('large', 4000)], 3000);

    expect(dropped).toEqual(['large']);
    expect(content).toContain('## small');
  });

  it('ranks by rendered block bytes, not body length', () => {
    // Equal bodies; 'has-a-much-longer-heading' is larger once its heading counts.
    const short = body('s', 'y'.repeat(500), { group: 'mcp', droppable: true });
    const long = body('has-a-much-longer-heading', 'y'.repeat(500), { group: 'mcp', droppable: true });
    const { dropped } = render([title(), header, short, long], 700);

    expect(dropped[0]).toBe('has-a-much-longer-heading');
  });

  it('places the notice immediately before the persona, never after it', () => {
    const persona: ComposedSectionInput = {
      role: 'persona',
      droppable: false,
      name: 'Additional Instructions',
      heading: { kind: 'verbatim' },
      body: 'PERSONA-BODY',
    };
    const { content } = render([title(), header, big('a', 4000), persona], 3000);

    expect(content.indexOf('Omitted for size')).toBeLessThan(content.indexOf('PERSONA-BODY'));
  });

  it('places the notice last when there is no persona', () => {
    const { content } = render([title(), header, big('a', 4000), body('Tail', 'TAIL-BODY')], 3000);

    expect(content.indexOf('TAIL-BODY')).toBeLessThan(content.indexOf('Omitted for size'));
  });

  it('drops a group header once its last member is evicted, and reports it as structural', () => {
    const { dropped, diagnostics, content } = render([title(), header, big('a', 4000)], 2000);

    expect(dropped).toEqual(['a']);
    expect(diagnostics.structurallyOmitted).toEqual(['MCP Servers']);
    expect(content).not.toContain('## MCP Servers');
  });

  it('reports no structural omission when nothing was configured', () => {
    const { diagnostics } = render([title(), body('Plain', 'x')], 100000);

    expect(diagnostics.structurallyOmitted).toEqual([]);
  });

  it('refuses when only core remains, carrying the full attempted eviction list', () => {
    const core = body('Core', 'z'.repeat(5000));
    let err: unknown;
    try {
      render([title(), header, big('a', 400), big('b', 800), core], 1000);
    } catch (e) {
      err = e;
    }

    expect(err).toBeInstanceOf(ProjectDocTooLargeError);
    // Largest-first, so 'b' before 'a' — the order proves the ladder ran rather
    // than the cap simply rejecting the input outright.
    expect((err as ProjectDocTooLargeError).dropped).toEqual(['b', 'a']);
  });

  it('never logs — the 60s sweep calls this seam, so a near-cap document must not warn forever', async () => {
    const { log } = await import('../log.js');
    const warn = vi.spyOn(log, 'warn');
    const error = vi.spyOn(log, 'error');

    for (let i = 0; i < 3; i++) render([title(), header, big('a', 4000)], 3000);

    expect(warn).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
    warn.mockRestore();
    error.mockRestore();
  });
});

describe('diagnostics', () => {
  it('accounts every rendered byte: sum of sections + marker + separator === total', () => {
    const { content, diagnostics } = render([title(), body('A', 'aaa'), body('B', 'bbb')]);
    const sum = diagnostics.sections.reduce((n, s) => n + s.bytes, 0);

    expect(sum + Buffer.byteLength(MARKER, 'utf-8') + 2).toBe(Buffer.byteLength(content, 'utf-8'));
  });
});

describe('stripFencedBlocks', () => {
  it('removes backtick and tilde blocks, and does not let one style close the other', () => {
    const lines = stripFencedBlocks('a\n```\nb\n```\nc\n~~~\n```\nd\n~~~\ne');

    expect(lines.filter(Boolean)).toEqual(['a', 'c', 'e']);
  });
});
