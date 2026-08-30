// Discovery: read the distributed coworker-type registry and skill catalog.
//
// Layout (post-refactor):
//   container/skills/<name>/SKILL.md       — capability skills (runtime slash
//                                              commands). May also contribute
//                                              coworker-types.yaml additions.
//   container/workflows/<name>/WORKFLOW.md — workflows (compose-time only;
//                                              full body embedded into CLAUDE.md).
//   container/overlays/<name>/OVERLAY.md   — overlays (compose-time only;
//                                              body inlined at gate anchors).
//   container/spines/<name>/coworker-types.yaml — spine/project coworker-type
//                                                  definitions.
//
// Alphabetical merge per dir tree: later entries extend or override earlier.

import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';

import type { AnchorSpec, CoworkerTypeEntry, OverlayMeta, SkillMeta } from './types.js';

// Parse the `insert-after` / `insert-before` frontmatter list. Each entry can
// be a plain string (canonical-only) or an object with `step` + optional
// `aliases`. Plain-string back-compat is preserved: `[ change, deliver ]`
// renders identically to the pre-alias world. Malformed entries are skipped
// quietly so a bad object doesn't crash the composer mid-load.
function parseAnchorList(raw: unknown): AnchorSpec[] {
  if (!Array.isArray(raw)) return [];
  const out: AnchorSpec[] = [];
  for (const entry of raw) {
    if (typeof entry === 'string') {
      out.push({ step: entry, aliases: [] });
      continue;
    }
    if (entry && typeof entry === 'object') {
      const obj = entry as Record<string, unknown>;
      const step = typeof obj.step === 'string' ? obj.step : '';
      if (!step) continue;
      const aliases = Array.isArray(obj.aliases)
        ? (obj.aliases as unknown[]).filter((a): a is string => typeof a === 'string')
        : [];
      out.push({ step, aliases });
    }
  }
  return out;
}

// Directories that may contribute coworker-type registrations. Capability
// skill dirs can add type contributions (e.g. `dashboard-base` appends
// `context:` to `main`). Spine dirs own the root types.
const TYPE_SOURCE_DIRS = [
  ['container', 'spines'],
  ['container', 'skills'],
] as const;

export function readCoworkerTypes(projectRoot = process.cwd()): Record<string, CoworkerTypeEntry> {
  const registry: Record<string, CoworkerTypeEntry> = {};

  for (const parts of TYPE_SOURCE_DIRS) {
    const rootDir = path.join(projectRoot, ...parts);
    if (!fs.existsSync(rootDir)) continue;

    let dirs: string[];
    try {
      dirs = fs.readdirSync(rootDir).sort();
    } catch {
      continue;
    }

    for (const dir of dirs) {
      const typesFile = path.join(rootDir, dir, 'coworker-types.yaml');
      if (!fs.existsSync(typesFile)) continue;
      const loaded = yaml.load(fs.readFileSync(typesFile, 'utf-8'));
      if (!loaded || typeof loaded !== 'object') continue;
      for (const [name, raw] of Object.entries(loaded as Record<string, Record<string, unknown>>)) {
        const entry = raw as CoworkerTypeEntry;
        if (typeof (raw as Record<string, unknown>)['skill-source'] === 'string') {
          entry.skillSource = (raw as Record<string, unknown>)['skill-source'] as string;
        }
        // YAML uses snake_case → TS camelCase. Filter to STAGE-shaped strings
        // (UPPER_SNAKE) to keep the materialized JSON clean even if the YAML
        // accidentally contains lowercase / typos.
        const rawStages = (raw as Record<string, unknown>)['required_critique_stages'];
        if (Array.isArray(rawStages)) {
          entry.requiredCritiqueStages = rawStages.map(String).filter((s) => /^[A-Z_]+$/.test(s));
        }
        // Critique-gate vocabulary extensions. Marker labels are sanitized to
        // a regex-metachar-free charset — they get spliced into an ERE
        // alternation by the gate. Bash patterns are operator-authored ERE
        // fragments and pass through as-is (same trust level as the YAML).
        const rawMarkers = (raw as Record<string, unknown>)['delivery_markers'];
        if (Array.isArray(rawMarkers)) {
          entry.deliveryMarkers = rawMarkers.map(String).filter((m) => /^[A-Za-z0-9][A-Za-z0-9 _-]*$/.test(m));
        }
        const rawPatterns = (raw as Record<string, unknown>)['pr_command_patterns'];
        if (Array.isArray(rawPatterns)) {
          entry.prCommandPatterns = rawPatterns.map(String).filter((p) => p.trim().length > 0);
        }
        registry[name] = registry[name] ? mergeTypeEntries(registry[name], entry, name) : entry;
      }
    }
  }

  return registry;
}

// Merge a later coworker-types.yaml contribution into an earlier one.
//
// Semantics:
// - scalars (description, project, extends, flat, identity): leaf-wins when
//   the later entry sets them; otherwise keep the earlier value
// - arrays (invariants, context, workflows, skills, overlays): append in
//   discovery order; dedup happens downstream in `resolveCoworkerManifest`
// - bindings: shallow merge, later wins per trait key
function mergeTypeEntries(base: CoworkerTypeEntry, addon: CoworkerTypeEntry, typeName?: string): CoworkerTypeEntry {
  if (typeName && addon.bindings && base.bindings) {
    for (const key of Object.keys(addon.bindings)) {
      if (base.bindings[key] && base.bindings[key] !== addon.bindings[key]) {
        console.warn(
          `Coworker type "${typeName}": binding "${key}" overwritten during merge: "${base.bindings[key]}" → "${addon.bindings[key]}".`,
        );
      }
    }
  }
  return {
    extends: addon.extends ?? base.extends,
    project: addon.project ?? base.project,
    description: addon.description ?? base.description,
    title: addon.title ?? base.title,
    flat: addon.flat ?? base.flat,
    identity: addon.identity ?? base.identity,
    invariants: [...(base.invariants || []), ...(addon.invariants || [])],
    context: [...(base.context || []), ...(addon.context || [])],
    workflows: [...(base.workflows || []), ...(addon.workflows || [])],
    skills: [...(base.skills || []), ...(addon.skills || [])],
    skillSource: addon.skillSource ?? base.skillSource,
    overlays: [...(base.overlays || []), ...(addon.overlays || [])],
    // Union across same-name contributions (e.g. spine + project both
    // declare stages). Inheritance via `extends:` is composed by
    // resolveCritiqueRequiredStages walking the chain — that's separate
    // from this base+addon merge for redeclarations of the same type.
    requiredCritiqueStages: [...(base.requiredCritiqueStages || []), ...(addon.requiredCritiqueStages || [])],
    deliveryMarkers: [...(base.deliveryMarkers || []), ...(addon.deliveryMarkers || [])],
    prCommandPatterns: [...(base.prCommandPatterns || []), ...(addon.prCommandPatterns || [])],
    bindings: { ...(base.bindings || {}), ...(addon.bindings || {}) },
    vars: { ...(base.vars || {}), ...(addon.vars || {}) },
    mcpServers: { ...(base.mcpServers || {}), ...(addon.mcpServers || {}) },
  };
}

// Each catalog source: directory + filename to scan + forced type.
// The `forcedType` is the default; SKILL.md in container/skills/ still
// respects `type:` in its frontmatter (for legacy overlay-typed skills,
// though none should remain after the refactor).
interface CatalogSource {
  subdir: string[];
  filename: string;
  forcedType?: SkillMeta['type'];
}

const CATALOG_SOURCES: CatalogSource[] = [
  { subdir: ['container', 'skills'], filename: 'SKILL.md' },
  { subdir: ['container', 'workflows'], filename: 'WORKFLOW.md', forcedType: 'workflow' },
  { subdir: ['container', 'overlays'], filename: 'OVERLAY.md', forcedType: 'overlay' },
];

export function readSkillCatalog(projectRoot = process.cwd()): Record<string, SkillMeta> {
  const catalog: Record<string, SkillMeta> = {};

  for (const source of CATALOG_SOURCES) {
    const rootDir = path.join(projectRoot, ...source.subdir);
    if (!fs.existsSync(rootDir)) continue;

    let dirs: string[];
    try {
      dirs = fs.readdirSync(rootDir).sort();
    } catch {
      continue;
    }

    for (const dir of dirs) {
      const filePath = path.join(rootDir, dir, source.filename);
      if (!fs.existsSync(filePath)) continue;
      const meta = parseSkillMeta(filePath, source.forcedType);
      if (!meta) continue;
      if (catalog[meta.name]) {
        throw new Error(`Duplicate skill name "${meta.name}" at ${filePath} (also at ${catalog[meta.name].path})`);
      }
      catalog[meta.name] = meta;
    }
  }

  // Implicit `extends: base` — every workflow that didn't declare an
  // `extends:` and didn't opt out (`extends: none`) inherits from `base`,
  // provided a `base` workflow exists in the catalog. Opt-in via presence,
  // so installations that haven't shipped a `base/WORKFLOW.md` retain the
  // pre-base-workflow behavior automatically.
  //
  // Combined with the chain-walking matcher (R20), an overlay declaring
  // `applies-to.workflows: [base]` reaches every workflow that didn't
  // explicitly opt out. Cross-cutting concerns (buddy, codex-critique) can
  // target `[base]` once instead of name-matching every concrete workflow.
  const baseEntry = catalog['base'];
  if (baseEntry && baseEntry.type === 'workflow') {
    for (const meta of Object.values(catalog)) {
      if (meta.type !== 'workflow') continue;
      if (meta.name === 'base') continue;
      if (meta.extendsWorkflow) continue;
      if (meta.extendsExplicitNone) continue;
      meta.extendsWorkflow = 'base';
    }
  }

  return catalog;
}

function parseSkillMeta(filePath: string, forcedType?: SkillMeta['type']): SkillMeta | null {
  const text = fs.readFileSync(filePath, 'utf-8');
  const match = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  const raw = yaml.load(match[1]);
  if (!raw || typeof raw !== 'object') return null;
  const fm = raw as Record<string, unknown>;
  const name = typeof fm.name === 'string' ? fm.name.trim() : '';
  if (!name) return null;
  const declaredType: SkillMeta['type'] =
    fm.type === 'workflow' ? 'workflow' : fm.type === 'overlay' ? 'overlay' : 'capability';
  const type: SkillMeta['type'] = forcedType ?? declaredType;
  const description = typeof fm.description === 'string' ? fm.description.trim() : '';
  const allowedTools = extractAllowedTools(fm['allowed-tools']);
  const usesRaw = fm.uses && typeof fm.uses === 'object' ? (fm.uses as Record<string, unknown>) : {};
  const uses = {
    skills: Array.isArray(usesRaw.skills) ? (usesRaw.skills as unknown[]).map(String) : [],
    workflows: Array.isArray(usesRaw.workflows) ? (usesRaw.workflows as unknown[]).map(String) : [],
  };

  const provides = Array.isArray(fm.provides) ? (fm.provides as unknown[]).map(String) : [];
  const requires = Array.isArray(fm.requires) ? (fm.requires as unknown[]).map(String) : [];
  // `extends:` semantics on workflows:
  //   absent / empty       → implicit `extends: base` filled in by the post-pass
  //   "none" (literal)     → explicit opt-out; never auto-extends `base`
  //   "<workflow-name>"    → standard parent reference
  // The post-pass in `readSkillCatalog` reads `extendsExplicitNone` to decide
  // whether to fill in the implicit base parent.
  const rawExtends = typeof fm.extends === 'string' ? fm.extends.trim() : '';
  const extendsExplicitNone = rawExtends.toLowerCase() === 'none';
  const extendsWorkflow = rawExtends && !extendsExplicitNone ? rawExtends : undefined;

  const overridesRaw =
    fm.overrides && typeof fm.overrides === 'object' ? (fm.overrides as Record<string, unknown>) : {};
  const overrides: Record<string, string> = {};
  for (const [stepId, value] of Object.entries(overridesRaw)) {
    if (typeof value === 'string') overrides[stepId] = value;
  }

  const steps: string[] = [];
  const stepBodies: Record<string, string> = {};
  let prologue: string | undefined;
  let epilogue: string | undefined;
  if (type === 'workflow') {
    const body = text.slice(match[0].length);
    // Capture step ids in order. We match every numbered-list step
    // `N. **Title** [{#id}] — body…` and either use the explicit {#id}
    // or synthesize one from the title. Synthesized ids let workflows
    // skip anchors when no overlay/override needs to target the step,
    // without losing the step's prose from the rendered output.
    //
    // The step header MUST start at column 0 (no leading whitespace). Top-level
    // workflow steps are always col-0; an INDENTED `N. **Bold**` line is a
    // sub-list inside a step body (e.g. enumerated sub-steps) and must NOT be
    // promoted to a step — otherwise it would phantom-split the parent step.
    const stepHeaderRe = /^(\d+\.\s+\*\*([^*]+)\*\*)(?:\s*\{#([a-z0-9-]+)\})?/gm;
    const positions: { id: string; index: number }[] = [];
    const usedIds = new Set<string>();
    // Gate the step-header scan to the `## Steps` region. Numbered-bold
    // bullets in a workflow's PROLOGUE (mode-delta notes like
    // `1. **Step 1** — …` or `1. **Reproduce/Setup** — …`) are framing, not
    // real steps, and must NOT be parsed as steps:
    //   - In workflows WITH a `## Steps` heading, phantom prologue steps would
    //     offset every real step's number.
    //   - In `extends:` workflows WITHOUT their own `## Steps` heading, any
    //     parsed step makes `steps` non-empty, which suppresses inheritance of
    //     the parent's procedure at resolve.ts (`if (steps.length === 0 && …)`).
    // So: if `## Steps` is found, scan ONLY from that heading onward (offsetting
    // match indices back into full-`body` coordinates so the prologue/epilogue/
    // stepBodies slicing below — which keys off absolute `body` indices —
    // keeps working unchanged). If NOT found, parse ZERO steps, letting
    // `extends:` workflows inherit the parent (resolve.ts), exactly as
    // `slang-implement`/`slang-plan` already do.
    const stepsHeadingMatch = body.match(/^##\s+Steps\s*$/m);
    type RawStep = { id?: string; title: string; index: number };
    const rawSteps: RawStep[] = [];
    if (stepsHeadingMatch) {
      const stepsRegionStart = stepsHeadingMatch.index ?? 0;
      // Bound the scan to the `## Steps` SECTION — from the heading to the next
      // H2 (`## Mode invariants`, `## Notes`, etc.) or EOF. A numbered-bold list
      // in a trailing H2 block (e.g. an enumerated invariant) must NOT be parsed
      // as steps. The text after the region is handled as epilogue below.
      const afterHeading = body.slice(stepsRegionStart + stepsHeadingMatch[0].length);
      const nextH2 = afterHeading.match(/\n##\s+(?!#)/);
      const stepsRegionEnd =
        nextH2 != null ? stepsRegionStart + stepsHeadingMatch[0].length + (nextH2.index ?? 0) : body.length;
      const stepsRegion = body.slice(stepsRegionStart, stepsRegionEnd);
      for (const m of stepsRegion.matchAll(stepHeaderRe)) {
        rawSteps.push({ id: m[3], title: m[2].trim(), index: (m.index ?? 0) + stepsRegionStart });
      }
    }
    for (const raw of rawSteps) {
      const title = raw.title;
      let id = raw.id;
      if (!id) {
        const base =
          title
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, '-')
            .replace(/^-+|-+$/g, '') || 'step';
        id = base;
        let n = 2;
        while (usedIds.has(id)) {
          id = `${base}-${n++}`;
        }
      }
      usedIds.add(id);
      steps.push(id);
      // Anchor at the start of the header match (already in full-`body`
      // coordinates) so per-step body extraction below slices from the
      // numbered-bullet line as before.
      positions.push({ id, index: raw.index });
    }
    // Extract per-step body: from the step's list-item start (back up to the
    // start of the numbered bullet line) until the next step's bullet start.
    // Pattern: "  1. **Name** {#id} — body...\n...\n\n2. **Next**..." — so we
    // walk from each {#id} backward to the nearest "^N. " or "N) " or bullet
    // on the line, then forward until just before the next such anchor.
    for (let i = 0; i < positions.length; i++) {
      const cur = positions[i];
      // Back up to the start of the line containing this marker.
      let startLine = body.lastIndexOf('\n', cur.index);
      startLine = startLine === -1 ? 0 : startLine + 1;
      // End: just before the next step's line start, or EOF.
      let endLine: number;
      if (i + 1 < positions.length) {
        const next = positions[i + 1];
        let nl = body.lastIndexOf('\n', next.index);
        nl = nl === -1 ? 0 : nl + 1;
        // Trim trailing blank lines between current step body and next step.
        endLine = nl;
      } else {
        // Last step: run until the next `## ` heading (e.g. Resumability) or EOF.
        const tail = body.slice(cur.index);
        const headingMatch = tail.match(/\n## /);
        endLine = headingMatch ? cur.index + (headingMatch.index ?? 0) : body.length;
      }
      stepBodies[cur.id] = body.slice(startLine, endLine).trim();
    }

    // Prologue: text between the workflow's `# /name` H1 and the first step.
    // Lets workflows surface top-of-doc framing (IMPORTANT callouts, mode
    // notes) into the rendered CLAUDE.md alongside the description.
    if (positions.length > 0) {
      const firstStepNl = body.lastIndexOf('\n', positions[0].index);
      const prologueRaw = body.slice(0, firstStepNl === -1 ? 0 : firstStepNl);
      const stripped = prologueRaw
        // Drop ANY leading H1 — the workflow's own top-of-file heading is
        // redundant with the rendered `### /name` wrapper. Matches both
        // `# /workflow-name — Title` and `# Plan`.
        .replace(/^\s*#\s+[^\n]*\n/, '')
        .replace(/^\s*##\s+Steps\s*$\n?/im, '') // drop "## Steps" heading
        .trim();
      if (stripped) prologue = stripped;
    }

    // Epilogue: text after the last step's body — workflows often have a
    // `## Mode invariants` / `## Notes` block at the end whose bullets are
    // load-bearing across all modes. Without this, those bullets are silently
    // dropped from the rendered CLAUDE.md.
    if (positions.length > 0) {
      const last = positions[positions.length - 1];
      const tail = body.slice(last.index);
      const nextHeading = tail.match(/\n## /);
      const epilogueStart = nextHeading ? last.index + (nextHeading.index ?? 0) + 1 : body.length;
      const epilogueRaw = body.slice(epilogueStart).trim();
      if (epilogueRaw) epilogue = epilogueRaw;
    } else if (!stepsHeadingMatch) {
      // No `## Steps` heading → this workflow parses zero own steps and
      // inherits its procedure from `extends:` (resolve.ts). But it may still
      // author its OWN body sections (e.g. `slangpy-implement`'s
      // `## PR-review-fix mode` / `## PR follow-up` mode-deltas). Those are not
      // steps, but they MUST survive: render the whole body (minus the leading
      // H1) as the epilogue so it lands after the inherited parent steps.
      // Without this, an extends-only workflow with a body silently loses it.
      const stripped = body
        .replace(/^\s*#\s+[^\n]*\n/, '') // drop the workflow's own H1
        .trim();
      if (stripped) epilogue = stripped;
    }
  }

  let overlay: OverlayMeta | undefined;
  if (type === 'overlay') {
    const appliesTo =
      fm['applies-to'] && typeof fm['applies-to'] === 'object' ? (fm['applies-to'] as Record<string, unknown>) : {};
    const insertAfter = parseAnchorList(fm['insert-after']);
    const insertBefore = parseAnchorList(fm['insert-before']);
    const body = text.slice(match[0].length).trim();
    overlay = {
      appliesToWorkflows: Array.isArray(appliesTo.workflows) ? (appliesTo.workflows as unknown[]).map(String) : [],
      appliesToTraits: Array.isArray(appliesTo.traits) ? (appliesTo.traits as unknown[]).map(String) : [],
      insertAfter,
      insertBefore,
      // `applies-to.start: true` — splice at workflow body start. Coexists
      // with named anchors; an overlay can declare both.
      applyAtStart: appliesTo.start === true,
      step: body,
    };
  }

  return {
    name,
    type,
    description,
    allowedTools,
    uses,
    path: filePath,
    provides,
    steps,
    stepBodies,
    prologue,
    epilogue,
    requires,
    extendsWorkflow,
    extendsExplicitNone: extendsExplicitNone || undefined,
    overrides,
    overlay,
  };
}

function extractAllowedTools(raw: unknown): string[] {
  if (!raw) return [];
  const text = Array.isArray(raw) ? raw.join(',') : String(raw);
  const tokens: string[] = [];
  // Greedy MCP token match — handles paren-wrapped bash globs without
  // getting confused by commas inside parens.
  const mcpRe = /mcp__[a-zA-Z0-9_-]+/g;
  for (const m of text.match(mcpRe) || []) tokens.push(m);
  return [...new Set(tokens)];
}
