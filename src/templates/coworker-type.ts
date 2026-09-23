/**
 * Resolve and validate the coworker type a stamp should use, BEFORE any group
 * state exists.
 *
 * Composition is resolved at spawn, so an unresolvable type does not fail at
 * stamp time on its own — it fails later, at the point the container needs a
 * CLAUDE.md it cannot produce, by which time the group row, its directories,
 * its MCP config and its paused tasks all exist. Validating here is what keeps a
 * bad value from half-creating a group.
 *
 * Two strictnesses, decided by WHO supplied the value:
 *
 *   - explicit (an operator flag): unresolvable is a hard failure. They asked
 *     for something specific and silently ignoring it would be worse than
 *     stopping.
 *   - template hint: unresolvable degrades to untyped, with a report line. A
 *     template author cannot know this install's catalog, and the template's
 *     content is perfectly usable without the composition — that is also what
 *     makes one published template work on upstream and here.
 */
import { readCoworkerTypes, readSkillCatalog, resolveCoworkerManifest } from '../claude-composer.js';
import { isImmortalGroup } from '../container-config.js';

export interface CoworkerTypeDecision {
  /** The value to stamp on the group row. */
  coworkerType: string | null;
  /** Non-fatal notices for the caller's report. */
  report: string[];
}

/**
 * Why a candidate was refused, or null when it is good. Resolution is run in
 * full (not through container-runner's private `resolveTypeManifest`, which
 * catches and returns an empty manifest — that would defeat the check).
 */
function refuse(projectRoot: string, type: string): string | null {
  // TWO INDEPENDENT CHECKS. They look similar and are not interchangeable —
  // conflating them fails open, which an earlier draft of this file did.
  //
  // (a) MONEY SAFETY. Cost-cap immortality is decided by the LITERAL stored
  //     value, via isImmortalGroup — not by resolved flatness. Asking the
  //     authority itself (rather than re-deriving its rule) means this check can
  //     never drift from it, and it stays correct even where a registry
  //     contribution has overridden `main` to `flat: false` — a case a
  //     resolved-flat test would wave through. A stamped group is always
  //     is_admin: 0, so the type name is the only route it has here.
  if (isImmortalGroup({ is_admin: 0, coworker_type: type })) {
    return `coworker type "${type}" grants cost-cap immortality; a stamped agent may not adopt it`;
  }

  let types: ReturnType<typeof readCoworkerTypes>;
  let catalog: ReturnType<typeof readSkillCatalog>;
  // Registry/catalog load failure is INFRASTRUCTURE, not "this candidate is
  // unknown", so it must not degrade to an untyped stamp: the untyped group
  // would need the same registry to resolve `default` at spawn and would be
  // just as broken, only later and without having said so. Let it throw.
  types = readCoworkerTypes(projectRoot);
  catalog = readSkillCatalog(projectRoot);

  let flat: boolean;
  try {
    // Compound `a+b` refs resolve here too, and full resolution is what
    // validates missing types, dangling references and missing files.
    flat = resolveCoworkerManifest(types, type, catalog, projectRoot, { cliScope: 'group' }).flat;
  } catch (err) {
    return `coworker type "${type}" does not resolve on this install: ${(err as Error).message}`;
  }

  // (b) COMPOSITION SANITY, a separate concern from (a). Flat mode discards
  //     workflows, skills, bindings and tools, so a stamped agent adopting it —
  //     directly, by `extends`, or as one role of a compound — would compose to
  //     something the template author could not have intended.
  if (flat) {
    return `coworker type "${type}" resolves to a flat composition, which discards workflows, skills and bindings`;
  }
  return null;
}

/**
 * @param explicit `undefined` = not supplied; `null` = supplied as an explicit
 *   opt-out of the template's hint.
 */
export function decideCoworkerType(args: {
  projectRoot: string;
  explicit?: string | null;
  templateHint?: string;
}): CoworkerTypeDecision {
  const { projectRoot, explicit, templateHint } = args;
  const report: string[] = [];

  if (explicit === null) return { coworkerType: null, report };

  if (explicit !== undefined) {
    const problem = refuse(projectRoot, explicit);
    if (problem) throw new Error(problem);
    return { coworkerType: explicit, report };
  }

  if (templateHint === undefined) return { coworkerType: null, report };

  const problem = refuse(projectRoot, templateHint);
  if (problem) {
    report.push(`${problem} — stamping untyped`);
    return { coworkerType: null, report };
  }
  return { coworkerType: templateHint, report };
}
