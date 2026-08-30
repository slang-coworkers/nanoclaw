// Author-time guardrail: walks every registered coworker type through the
// composer, so missing spine fragments, unknown workflow/skill refs,
// unresolved traits, and cross-project extends errors surface before CI
// instead of at container-start time.
//
// Exit code 0 = all types compose cleanly, 1 = one or more failed.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  composeCoworkerSpine,
  readCoworkerTypes,
  readSkillCatalog,
  resolveAllowedSkillNames,
  resolveCoworkerManifest,
  resolveTypeChain,
  type CoworkerTypeEntry,
  type SkillMeta,
} from '../src/claude-composer.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, '..');

interface Failure {
  typeName: string;
  message: string;
}

// Types that are `extends:`'d by other types are treated as abstract bases —
// they define shared structure (e.g. base-common) but aren't composed on
// their own. Composing them directly would fail on unresolved traits the
// parent intentionally leaves for subtypes to bind.
function findAbstractBases(types: Record<string, CoworkerTypeEntry>): Set<string> {
  const bases = new Set<string>();
  for (const entry of Object.values(types)) {
    const parents = entry.extends ? (Array.isArray(entry.extends) ? entry.extends : [entry.extends]) : [];
    for (const parent of parents) bases.add(parent);
  }
  return bases;
}

// Extract the critique STAGE vocabulary from the codex-critique skill's prompt
// menu — the single line `STAGE: <A | B | C>`. This is the vocabulary the
// agent is actually taught to emit; the tracking hook keys on the STAGE marker
// and the delivery gate keys on the resulting recorded stages. A coworker type
// that declares `required_critique_stages: [X]` where X is absent from this
// menu will gate on a stage the agent was never told how to run (the
// DECISION_REVIEW drift that surfaced only as a live approver escalation).
// Returns null if the skill or its menu line can't be found — that's a
// structural problem the caller reports rather than silently passing.
function readCritiqueStageVocabulary(skillPath: string): Set<string> | null {
  let body: string;
  try {
    body = fs.readFileSync(skillPath, 'utf-8');
  } catch {
    return null;
  }
  const m = body.match(/^STAGE:\s*<([^>]+)>/m);
  if (!m) return null;
  const vocab = new Set(
    m[1]
      .split('|')
      .map((s) => s.trim())
      .filter((s) => /^[A-Z_]+$/.test(s)),
  );
  return vocab.size > 0 ? vocab : null;
}

// Extract every `/slash-name` reference from a rendered-into-CLAUDE.md body.
// Mirrors the two passes rewriteSlashRefs (src/claude-composer/spine.ts) runs:
// backticked `` `/name` `` and bare `/name` at a word boundary. Deliberately
// permissive — the caller filters to names the catalog knows as capability
// skills, so prose like `/tmp/foo` or a workflow ref never reaches it.
function extractSlashRefs(body: string): Set<string> {
  const refs = new Set<string>();
  for (const m of body.matchAll(/`\/([a-z][a-z0-9-]*)`/g)) refs.add(m[1]);
  for (const m of body.matchAll(/(?:^|[\s(])\/([a-z][a-z0-9-]*)(?=[\s.,;:!?)]|$)/gm)) refs.add(m[1]);
  return refs;
}

// SAFETY BACKSTOP for the Tier 2 scoped skills mirror (src/group-init.ts).
//
// group-init now mirrors only `MIRROR_FLOOR_SKILLS ∪ unclaimed-skills ∪
// resolveCoworkerSkillNames(type)` into a group's `.claude-shared/skills/`
// (see src/claude-composer/skill-scope.ts). Anything a coworker can actually
// invoke but that falls outside that set would 404 at runtime as a missing
// slash command — in production, with no test coverage in between. So assert
// the containment here, at author time: for every leaf coworker type, every
// capability skill referenced by its resolved workflows (declared `uses:`
// skills AND `/skill` invocations inside step bodies / prologue / epilogue /
// overlay bodies) must be inside the mirrored allow-list.
//
// Flat types (`main`) are skipped — group-init mirrors everything for them.
function checkMirrorScope(
  types: Record<string, CoworkerTypeEntry>,
  catalog: Record<string, SkillMeta>,
  typeNames: string[],
  abstractBases: Set<string>,
  failures: Failure[],
): void {
  const capabilityNames = new Set(
    Object.values(catalog)
      .filter((m) => m.type === 'capability')
      .map((m) => m.name),
  );

  for (const name of typeNames) {
    if (abstractBases.has(name)) continue;

    let allowed: Set<string> | null;
    try {
      allowed = resolveAllowedSkillNames(projectRoot, name);
    } catch {
      continue; // compose check above already reports the resolution failure
    }
    if (allowed === null) continue; // flat type — group-init mirrors all

    let manifest: ReturnType<typeof resolveCoworkerManifest>;
    try {
      manifest = resolveCoworkerManifest(types, name, catalog, projectRoot, { cliScope: 'group' });
    } catch {
      continue;
    }

    // Every body that is rendered into this coworker's CLAUDE.md, i.e. every
    // place the agent can read a `/skill` instruction from — spine fragments
    // included, since a context fragment is just as capable of saying
    // "run `/some-skill`" as a workflow step is.
    const bodies: string[] = [manifest.identity, ...manifest.invariants, ...manifest.context];
    for (const wf of manifest.workflows) {
      if (wf.prologue) bodies.push(wf.prologue);
      if (wf.epilogue) bodies.push(wf.epilogue);
      bodies.push(...Object.values(wf.stepBodies));
      const meta = catalog[wf.name];
      if (meta) bodies.push(...Object.values(meta.overrides));
    }
    for (const c of manifest.customizations) {
      if (c.detail) bodies.push(c.detail);
    }

    const referenced = new Set<string>();
    for (const wf of manifest.workflows) {
      const meta = catalog[wf.name];
      for (const used of meta?.uses.skills ?? []) {
        if (capabilityNames.has(used)) referenced.add(used);
      }
    }
    for (const body of bodies) {
      for (const ref of extractSlashRefs(body)) {
        if (capabilityNames.has(ref)) referenced.add(ref);
      }
    }

    const missing = [...referenced].filter((s) => !allowed!.has(s)).sort();
    if (missing.length > 0) {
      failures.push({
        typeName: name,
        message:
          `invokes capability skill(s) that the scoped skills mirror would NOT ship: ${missing.join(', ')}. ` +
          `src/group-init.ts mirrors only MIRROR_FLOOR_SKILLS plus this type's resolved skills into ` +
          `.claude-shared/skills/, so these would be missing slash commands at runtime. Fix by either ` +
          `(a) adding the skill to this coworker type's \`skills:\` list in its coworker-types.yaml, ` +
          `(b) declaring it under the referencing workflow's \`uses.skills:\` frontmatter, or ` +
          `(c) adding it to MIRROR_FLOOR_SKILLS in src/claude-composer/skill-scope.ts if every ` +
          `coworker genuinely needs it.`,
      });
    }
  }
}

function main(): number {
  let types: Record<string, CoworkerTypeEntry>;
  let catalog: ReturnType<typeof readSkillCatalog>;
  try {
    types = readCoworkerTypes(projectRoot);
  } catch (err) {
    console.error(`Failed to read coworker-types.yaml registry: ${(err as Error).message}`);
    return 1;
  }
  try {
    catalog = readSkillCatalog(projectRoot);
  } catch (err) {
    console.error(`Failed to read skill catalog: ${(err as Error).message}`);
    return 1;
  }

  const typeNames = Object.keys(types).sort();
  if (typeNames.length === 0) {
    console.error('No coworker types found under container/{spines,skills}/*/coworker-types.yaml');
    return 1;
  }

  const abstractBases = findAbstractBases(types);
  const failures: Failure[] = [];
  for (const name of typeNames) {
    if (abstractBases.has(name)) continue;
    try {
      composeCoworkerSpine({ projectRoot, coworkerType: name });
    } catch (err) {
      failures.push({ typeName: name, message: (err as Error).message });
    }
  }

  // Workflow body assertion: catches the silent-empty-body failure mode where
  // a WORKFLOW.md uses an unrecognized step format (e.g. `## Step N: TITLE`
  // instead of `N. **Title** {#id}`). The composer's step parser regex in
  // src/claude-composer/registry.ts only matches numbered-list items, so any
  // other format produces steps=[], stepBodies={}, and the rendered CLAUDE.md
  // emits the description with no body. Workflows that declare `extends:`
  // legitimately inherit step structure from a parent and may have an empty
  // own-body — those are exempt.
  for (const meta of Object.values(catalog)) {
    if (meta.type !== 'workflow') continue;
    if (meta.extendsWorkflow) continue;
    if (meta.steps.length > 0) continue;
    failures.push({
      typeName: meta.name,
      message:
        `WORKFLOW.md at ${meta.path} parsed to zero steps. The composer's step parser ` +
        `(src/claude-composer/registry.ts) only matches numbered-list items shaped ` +
        `\`N. **Title** {#id}\` — see container/workflows/plan/WORKFLOW.md for the ` +
        `canonical example. ` +
        `If you used \`## Step N: TITLE\` H2 headers or \`#### N. Title\` H4 headers, ` +
        `rewrite as numbered-list items at column 0. ` +
        `If this workflow inherits its steps from a parent, declare \`extends: <parent>\` ` +
        `in frontmatter to opt out of this check.`,
    });
  }

  // Critique-stage vocabulary cross-check: every stage a coworker type
  // requires (`required_critique_stages:` in coworker-types.yaml) must appear
  // in the codex-critique skill's STAGE menu. Without this, a type can declare
  // a stage the base skill never documents — the delivery gate then blocks on
  // a stage the agent was never taught to run, which previously surfaced only
  // as a production approver escalation (missing DECISION_REVIEW guidance).
  const critiqueSkill = catalog['codex-critique'];
  if (critiqueSkill) {
    const vocab = readCritiqueStageVocabulary(critiqueSkill.path);
    if (!vocab) {
      failures.push({
        typeName: 'codex-critique',
        message:
          `Could not extract the STAGE vocabulary from ${critiqueSkill.path}. ` +
          `Expected a prompt line shaped \`STAGE: <A | B | C>\` (see the "## Prompt" ` +
          `section). The required_critique_stages cross-check depends on it.`,
      });
    } else {
      for (const name of typeNames) {
        const declared = types[name].requiredCritiqueStages;
        if (!declared || declared.length === 0) continue;
        const unknown = declared.filter((s) => !vocab.has(s));
        if (unknown.length > 0) {
          failures.push({
            typeName: name,
            message:
              `required_critique_stages references stage(s) absent from the ` +
              `codex-critique STAGE menu: ${unknown.join(', ')}. ` +
              `The delivery gate would block this coworker on a stage the agent ` +
              `was never taught to run. Add the stage to the \`STAGE: <…>\` menu ` +
              `and the "when to invoke" table in ` +
              `container/skills/codex-critique/SKILL.md (known vocabulary: ` +
              `${[...vocab].sort().join(', ')}).`,
          });
        }
      }
    }
  }

  // OUTPUT_REVIEW-presence invariant: gate-critique-on-deliver.sh hardcodes
  // OUTPUT_REVIEW as the load-bearing stage — the verdict (must be "approve"),
  // freshness, and attested-hash checks are ALL guarded by
  // `jq -e 'index("OUTPUT_REVIEW")'`. A type that requires stages WITHOUT
  // OUTPUT_REVIEW (e.g. [PLAN_REVIEW, CODE_REVIEW]) would gate on stage
  // existence only — no approve/freshness/hash enforcement at all — silently
  // degrading the gate to "did these run" with no "is it blessed". Assert on
  // the RESOLVED chain (extends-walked union), matching exactly what
  // resolveTypeChain feeds the gate via .critique-required-stages, so a child
  // that inherits OUTPUT_REVIEW from a base is not falsely flagged. Abstract
  // bases are skipped — they may leave stages for subtypes to complete.
  for (const name of typeNames) {
    if (abstractBases.has(name)) continue;
    let resolvedStages: Set<string>;
    try {
      resolvedStages = new Set(resolveTypeChain(types, name).flatMap((e) => e.requiredCritiqueStages ?? []));
    } catch {
      continue; // cycle / unknown — the compose check above already reports it
    }
    if (resolvedStages.size > 0 && !resolvedStages.has('OUTPUT_REVIEW')) {
      failures.push({
        typeName: name,
        message:
          `required_critique_stages resolves to [${[...resolvedStages].sort().join(', ')}] ` +
          `but omits OUTPUT_REVIEW. gate-critique-on-deliver.sh hardcodes OUTPUT_REVIEW ` +
          `as the only verdict/freshness/attestation-gated stage — without it the gate ` +
          `checks stage existence only and never enforces an "approve" before delivery. ` +
          `Add OUTPUT_REVIEW to this type's required_critique_stages (or a base it extends).`,
      });
    }
  }

  checkMirrorScope(types, catalog, typeNames, abstractBases, failures);

  const skillCount = Object.keys(catalog).length;
  const leafCount = typeNames.length - abstractBases.size;
  console.log(
    `Validated ${leafCount} coworker type(s) against ${skillCount} catalog entries ` +
      `(${abstractBases.size} abstract base(s) skipped).`,
  );
  for (const name of typeNames) {
    if (abstractBases.has(name)) {
      console.log(`  skip  ${name}  (abstract base)`);
      continue;
    }
    const ok = !failures.find((f) => f.typeName === name);
    console.log(`  ${ok ? 'ok  ' : 'FAIL'}  ${name}`);
  }

  if (failures.length === 0) return 0;

  console.error(`\n${failures.length} coworker type(s) failed to compose:\n`);
  for (const { typeName, message } of failures) {
    console.error(`- ${typeName}`);
    console.error(`    ${message}\n`);
  }
  return 1;
}

process.exit(main());
