/**
 * The FORK's side-channel of a plugin manifest.
 *
 * Deliberately a separate namespace from `ai.nanoco.nanoclaw` rather than extra
 * keys inside it, for two reasons that both favour the seam:
 *
 *   - Upstream keeps foreign namespace payloads and never looks inside them
 *     ("Foreign namespaces are kept but never validated", manifest.ts; spec §8:
 *     ignore namespaces you don't implement). So a template carrying this field
 *     stamps on a stock upstream install with NO notice at all, where an
 *     unrecognized key inside `ai.nanoco.nanoclaw` would be reported on every
 *     stamp by the loop in extension.ts.
 *   - It keeps the divergence additive. `readNanoclawExtension` is byte-identical
 *     to upstream's; extending it would make every future upstream touch of that
 *     function a conflict. This file is one upstream does not have, so it cannot
 *     conflict with anything.
 *
 * If upstream ever adopts an equivalent field, migrating is a move out of this
 * file — the same escape hatch extension.ts documents for itself.
 */

export const FORK_EXTENSION_NS = 'dev.slang-coworkers.nanoclaw';

export interface ForkExtension {
  /**
   * The coworker type this template would like to be composed as — a lego type
   * name resolved from THIS install's catalog, so it is a hint, never a
   * requirement. A template author cannot know which types an install has, so an
   * unresolvable value degrades to an untyped stamp rather than failing: the
   * template's content (persona, skills, MCP, tasks) is usable either way.
   */
  defaultCoworkerType?: string;
  /** Non-fatal notices — nothing is ever silently dropped. */
  report: string[];
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Read our namespace out of an already-parsed manifest's `extensions` map.
 * Absent namespace → empty result, which is the plain-upstream-plugin case.
 */
export function readForkExtension(manifestExtensions: Record<string, unknown>): ForkExtension {
  const report: string[] = [];
  const ours = manifestExtensions[FORK_EXTENSION_NS];
  if (ours === undefined) return { report };
  if (!isPlainObject(ours)) {
    report.push(`plugin.json: extensions["${FORK_EXTENSION_NS}"] is not an object; ignored`);
    return { report };
  }

  let defaultCoworkerType: string | undefined;
  const value = ours.defaultCoworkerType;
  if (value !== undefined) {
    if (typeof value === 'string' && value.trim()) defaultCoworkerType = value.trim();
    else
      report.push(
        `plugin.json: extensions["${FORK_EXTENSION_NS}"].defaultCoworkerType must be a nonempty string; ignored`,
      );
  }

  // Report rather than ignore: a misspelled key in a field that decides how the
  // agent is composed would otherwise stamp a silently-untyped coworker.
  for (const key of Object.keys(ours)) {
    if (key !== 'defaultCoworkerType') {
      report.push(`plugin.json: extensions["${FORK_EXTENSION_NS}"].${key} is not recognized; ignored`);
    }
  }

  return { ...(defaultCoworkerType === undefined ? {} : { defaultCoworkerType }), report };
}
