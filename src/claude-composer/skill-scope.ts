// Mirror-scope policy: which `container/skills/<dir>` trees a given coworker
// type actually needs.
//
// WHY: `src/group-init.ts` mirrors skill dirs into
// `data/v2-sessions/<group>/.claude-shared/skills/`, and Claude Code lists
// EVERY mirrored skill's name + description in the per-turn preamble. Mirroring
// all of them means a slang coworker pays for `nanoclaw-*` (and vice versa) on
// every single turn, forever. Scoping the mirror to the type's own resolved
// skills + a small always-on floor removes that dead weight without changing
// what the coworker can do.
//
// The resolution reuses the SAME loaders the spine composer uses
// (`readCoworkerTypes` + `readSkillCatalog` → `resolveCoworkerManifest`), so
// the mirror can never drift from what `renderCoworkerSpine` puts in CLAUDE.md.
// A miss is caught at author time by `scripts/validate-templates.ts`, never as
// a 404 slash command in production.

import fs from 'fs';
import path from 'path';

import { readCoworkerTypes, readSkillCatalog } from './registry.js';
import { resolveCoworkerManifest } from './resolve.js';
import type { CoworkerManifest, CoworkerTypeEntry, SkillMeta } from './types.js';

/**
 * Always mirrored, regardless of coworker type.
 *
 * These are cross-cutting host/agent capabilities that any coworker may need
 * without its type declaring them: the NanoClaw tool surface (`base-nanoclaw`),
 * the critique + buddy protocols wired by overlays (`codex-critique`, `buddy`),
 * first-run onboarding (`welcome`), self-modification (`self-customize`),
 * browsing (`agent-browser`), and the two memory/wiki synthesis skills that
 * scheduled tasks invoke by name (`learnings-wiki`, `okf-synthesis`).
 *
 * Names are matched against BOTH the skill's declared `name:` frontmatter and
 * its on-disk directory name, so a floor entry keeps working if the two ever
 * diverge. A floor entry that doesn't exist in this install is simply a no-op.
 *
 * This is the STABLE floor. A second, dynamic tier — see `unclaimedSkillNames`
 * — additionally keeps every capability skill that no coworker type and no
 * workflow claims, which is what covers discovery-only skills like
 * `slack-formatting` / `onecli-gateway` / `supervise-issues` without having to
 * enumerate them here.
 */
export const MIRROR_FLOOR_SKILLS: readonly string[] = [
  'base-nanoclaw',
  'codex-critique',
  'buddy',
  'welcome',
  'self-customize',
  'agent-browser',
  'learnings-wiki',
  'okf-synthesis',
];

/**
 * Skills that SOME coworker type (or workflow) explicitly claims — via a type's
 * `skills:` list, a trait `bindings:` value, or a workflow/overlay's
 * `uses.skills:` frontmatter.
 */
function claimedSkillNames(types: Record<string, CoworkerTypeEntry>, catalog: Record<string, SkillMeta>): Set<string> {
  const claimed = new Set<string>();
  for (const entry of Object.values(types)) {
    for (const s of entry.skills ?? []) claimed.add(s);
    for (const s of Object.values(entry.bindings ?? {})) claimed.add(s);
  }
  for (const meta of Object.values(catalog)) {
    for (const s of meta.uses.skills) claimed.add(s);
  }
  return claimed;
}

/**
 * Capability skills that NO coworker type and NO workflow claims — the
 * "unclaimed" tier, which is mirrored for every coworker on top of the
 * explicit floor.
 *
 * WHY: some skills are reached by discovery, never by a declared reference —
 * channel formatters installed by `/add-<channel>` (`slack-formatting`),
 * gateway/credential guidance (`onecli-gateway`), and operational skills a
 * scheduled task invokes by name (`supervise-issues`). Nothing in the registry
 * points at them, so scoping by declaration alone would silently drop them, and
 * `scripts/validate-templates.ts` structurally CANNOT catch it — there is no
 * reference to check. Absence of a claim is therefore treated as "everyone may
 * need this", which is both safe and self-maintaining: the moment a type claims
 * a skill, it becomes scoped, and until then nobody loses a capability.
 *
 * This costs nothing against the actual goal — the bulk of the preamble weight
 * is project skill families (`nanoclaw-*`, `slang-*`), and every one of those
 * IS claimed by its project's types, so it still gets scoped away.
 */
function unclaimedSkillNames(types: Record<string, CoworkerTypeEntry>, catalog: Record<string, SkillMeta>): string[] {
  const claimed = claimedSkillNames(types, catalog);
  return Object.values(catalog)
    .filter((m) => m.type === 'capability' && !claimed.has(m.name))
    .map((m) => m.name);
}

/**
 * Every capability skill a coworker of `manifest`'s type can actually invoke.
 *
 * Broader than `manifest.skills` on purpose — those three sources are all
 * reachable as `/slash` commands from a rendered spine, so all three must be
 * mirrored:
 *
 *   1. `manifest.skills`   — the `## Skills` list the spine renders.
 *   2. bound trait skills  — an explicit `bindings: { repo: foo }` in
 *                            coworker-types.yaml can name a skill the type
 *                            never listed under `skills:`.
 *   3. workflow `uses:`    — a workflow body may invoke a skill it declared in
 *                            `uses.skills` without the type re-declaring it.
 *                            Walked transitively through `uses.workflows` and
 *                            `extends:` parents, matching `collectTools`.
 */
function coworkerSkillClosure(manifest: CoworkerManifest, catalog: Record<string, SkillMeta>): Set<string> {
  const names = new Set<string>();
  for (const s of manifest.skills) names.add(s.name);
  for (const bound of Object.values(manifest.bindings)) names.add(bound);

  const seen = new Set<string>();
  const walk = (ref: string): void => {
    if (seen.has(ref)) return;
    seen.add(ref);
    const meta = catalog[ref];
    if (!meta) return;
    if (meta.type === 'capability') {
      names.add(meta.name);
      return;
    }
    for (const sub of [...meta.uses.skills, ...meta.uses.workflows]) walk(sub);
    if (meta.type === 'workflow' && meta.extendsWorkflow) walk(meta.extendsWorkflow);
  };
  for (const w of manifest.workflows) walk(w.name);
  for (const c of manifest.customizations) {
    if (c.kind === 'overlay' && c.overlayName) walk(c.overlayName);
  }
  return names;
}

/**
 * Resolve the capability skills a coworker type can invoke, by name.
 *
 * Returns `null` for a FLAT type (`main`, and any other `flat: true` entry):
 * flat types render verbatim prose with no manifest skill list, so there is
 * nothing to scope against — callers must fall back to "mirror everything".
 *
 * Throws for an unknown/malformed type (same errors `renderCoworkerSpine`
 * raises), so callers can catch and fall back safely.
 */
export function resolveCoworkerSkillNames(
  projectRoot: string,
  coworkerType: string,
  opts: { cliScope?: 'disabled' | 'group' | 'global' } = {},
): string[] | null {
  const types = readCoworkerTypes(projectRoot);
  const catalog = readSkillCatalog(projectRoot);
  const manifest = resolveCoworkerManifest(types, coworkerType, catalog, projectRoot, {
    cliScope: opts.cliScope ?? 'group',
  });
  if (manifest.flat) return null;
  return [...coworkerSkillClosure(manifest, catalog)];
}

/**
 * The allow-list a coworker type's skills mirror should carry:
 * `MIRROR_FLOOR_SKILLS ∪ unclaimed ∪ everything the type resolves to`.
 *
 * Returns `null` when scoping does not apply (flat type) — callers mirror all.
 * Throws on an unresolvable type, same as `resolveCoworkerSkillNames`.
 */
export function resolveAllowedSkillNames(projectRoot: string, coworkerType: string): Set<string> | null {
  const types = readCoworkerTypes(projectRoot);
  const catalog = readSkillCatalog(projectRoot);
  const manifest = resolveCoworkerManifest(types, coworkerType, catalog, projectRoot, { cliScope: 'group' });
  if (manifest.flat) return null;
  return allowedNamesFor(types, catalog, manifest);
}

function allowedNamesFor(
  types: Record<string, CoworkerTypeEntry>,
  catalog: Record<string, SkillMeta>,
  manifest: CoworkerManifest,
): Set<string> {
  return new Set<string>([
    ...MIRROR_FLOOR_SKILLS,
    ...unclaimedSkillNames(types, catalog),
    ...coworkerSkillClosure(manifest, catalog),
  ]);
}

/** Map allowed skill NAMES onto the `container/skills/<dir>` dirs to mirror. */
function mirrorDirsFor(projectRoot: string, catalog: Record<string, SkillMeta>, allowed: Set<string>): Set<string> {
  const skillsRoot = path.join(projectRoot, 'container', 'skills');
  // dir basename → declared `name:` frontmatter. Usually identical; the
  // catalog is authoritative because the composer resolves refs by NAME.
  const nameByDir = new Map<string, string>();
  for (const meta of Object.values(catalog)) {
    const dir = path.dirname(meta.path);
    if (path.dirname(dir) !== skillsRoot) continue;
    nameByDir.set(path.basename(dir), meta.name);
  }

  const dirs = new Set<string>();
  let entries: string[];
  try {
    entries = fs.readdirSync(skillsRoot);
  } catch {
    return dirs;
  }
  for (const entry of entries) {
    const declared = nameByDir.get(entry);
    // A dir the catalog never parsed (no SKILL.md, or no `name:` frontmatter)
    // is not something we can reason about — and Claude Code can't surface it
    // in the preamble either, so mirroring it is free. Keep it.
    if (declared === undefined) {
      dirs.add(entry);
      continue;
    }
    if (allowed.has(declared) || allowed.has(entry)) dirs.add(entry);
  }
  return dirs;
}

export interface MirroredSkillScope {
  /** Dirs under `container/skills/` to mirror, or `null` = mirror everything. */
  dirs: Set<string> | null;
  /** Human-readable explanation, for the group-init log line. */
  reason: string;
  /** True when the scope fell back to mirror-all because resolution failed. */
  degraded: boolean;
}

/**
 * Decide which `container/skills/<dir>` trees to mirror for an agent group.
 *
 * Fail-open by construction — every path that can't produce a trustworthy
 * allow-list returns `dirs: null` ("mirror everything"), so a registry typo can
 * never silently strip a coworker's skills:
 *
 *   - no `coworker_type`  → untyped group, mirror all
 *   - flat type (`main`)  → admin/global orchestrator, mirror all
 *   - resolution throws   → mirror all, `degraded: true` (caller should warn)
 */
export function resolveMirroredSkillScope(
  projectRoot: string,
  coworkerType: string | null | undefined,
): MirroredSkillScope {
  const type = (coworkerType ?? '').trim();
  if (!type) {
    return { dirs: null, reason: 'no coworker_type — mirroring all skills', degraded: false };
  }

  let types: ReturnType<typeof readCoworkerTypes>;
  let catalog: Record<string, SkillMeta>;
  let manifest: CoworkerManifest;
  try {
    types = readCoworkerTypes(projectRoot);
    catalog = readSkillCatalog(projectRoot);
    manifest = resolveCoworkerManifest(types, type, catalog, projectRoot, { cliScope: 'group' });
  } catch (err) {
    return {
      dirs: null,
      reason: `coworker type "${type}" failed to resolve (${(err as Error).message}) — mirroring all skills`,
      degraded: true,
    };
  }

  if (manifest.flat) {
    return { dirs: null, reason: `flat coworker type "${type}" — mirroring all skills`, degraded: false };
  }

  const allowed = allowedNamesFor(types, catalog, manifest);
  return {
    dirs: mirrorDirsFor(projectRoot, catalog, allowed),
    reason: `scoped to coworker type "${type}"`,
    degraded: false,
  };
}
