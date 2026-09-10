/**
 * The group-scope `ncl` table an agent reads must name every resource a
 * group-scoped agent can actually reach.
 *
 * Three lists described that surface and no two agreed: `scopeField` on the
 * resource definitions (the truth dispatch enforces), the table in
 * `ncl-group.md` (what agents are told), and the prose in CLAUDE.md. The table
 * was missing `tasks` and `pr-mappings`, so a typed coworker was never told it
 * could inspect its own scheduled tasks or PR routing — a capability present and
 * unadvertised.
 *
 * This derives the expectation from the resource registry instead of restating
 * it, which is the whole point: a fourth hand-maintained copy would rot the same
 * way. Adding a `scopeField` to a resource now forces a documentation decision
 * rather than silently widening what agents can do but not know.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { getResources } from './crud.js';
import '../cli/resources/index.js';

const FRAGMENT = path.join(process.cwd(), 'container', 'spines', 'base', 'tool-instructions', 'ncl-group.md');

/**
 * Reachable at group scope == declares `scopeField`. That is exactly the
 * condition `dispatch.ts` fails closed on: a resource without one is rejected
 * with "not available in group scope", so the set is not a second opinion.
 */
function reachableAtGroupScope(): string[] {
  return getResources()
    .filter((def) => typeof def.scopeField === 'string' && def.scopeField.length > 0)
    .map((def) => def.plural)
    .sort();
}

/** Resource names in the fragment's markdown table, from its first column. */
function documentedInFragment(): string[] {
  const rows = fs.readFileSync(FRAGMENT, 'utf-8').split('\n');
  const names: string[] = [];
  for (const row of rows) {
    const m = /^\|\s*`([a-z-]+)`\s*\|/.exec(row);
    if (m) names.push(m[1]);
  }
  return names.sort();
}

describe('ncl-group.md documents the real group scope', () => {
  it('finds resources and rows to compare — neither side may be silently empty', () => {
    // Without this, an import that stopped registering resources, or a renamed
    // table, would make the comparison below pass on two empty lists.
    expect(reachableAtGroupScope().length).toBeGreaterThan(4);
    expect(documentedInFragment().length).toBeGreaterThan(4);
  });

  it('names every resource a group-scoped agent can reach, and no others', () => {
    expect(documentedInFragment()).toEqual(reachableAtGroupScope());
  });
});
