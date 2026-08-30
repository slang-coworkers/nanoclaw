// Type-chain resolution: walk `extends` ancestors, merge fragments, validate
// bindings, and return a fully-resolved CoworkerManifest ready to render.

import fs from 'fs';
import path from 'path';

import { readCoworkerTypes, readSkillCatalog } from './registry.js';
import type { CoworkerManifest, CoworkerTypeEntry, OverlayMeta, SkillMeta, WorkflowCustomization } from './types.js';

function normalizeList<T>(v: T | T[] | undefined | null): T[] {
  if (v == null) return [];
  if (Array.isArray(v)) return v.filter((x): x is T => x !== null && x !== undefined);
  return [v];
}

// Walk a workflow's `extends:` chain in catalog order, starting at the
// workflow itself. Cycle-safe (a malformed chain that loops back to a seen
// ancestor terminates quietly — the cycle ancestor still appears in the
// returned list, so any overlay name match in that ring still hits).
//
// Used by overlay matching so an overlay declaring `applies-to.workflows:
// [implement]` auto-attaches to every workflow whose extends chain reaches
// `implement` — not just the direct child. Without this, project workflows
// that go `slang-fix-issue → implement → base` skip cross-cutting overlays
// targeted at `implement`.
function collectWorkflowExtendsChain(workflowName: string, catalog: Record<string, SkillMeta>): string[] {
  const chain: string[] = [];
  const seen = new Set<string>();
  let cur: SkillMeta | undefined = catalog[workflowName];
  while (cur) {
    if (seen.has(cur.name)) break;
    seen.add(cur.name);
    chain.push(cur.name);
    if (!cur.extendsWorkflow) break;
    cur = catalog[cur.extendsWorkflow];
  }
  return chain;
}

// Resolve a single anchor spec against the target workflow's step set.
// Canonical step is preferred; falls back to aliases left-to-right; first
// match wins. Returns the resolved step name (canonical or alias), or `null`
// if neither canonical nor any alias matches the target. Authors get to
// declare overlay anchors in canonical-stage terms ("after `change`") while
// project workflows are free to use stage-specific ids ("after `implement`").
function resolveAnchor(spec: { step: string; aliases: string[] }, targetStepSet: Set<string>): string | null {
  if (targetStepSet.has(spec.step)) return spec.step;
  for (const alias of spec.aliases) {
    if (targetStepSet.has(alias)) return alias;
  }
  return null;
}

// Format an anchor spec for the unmatched-anchor warning ("declared anchors").
// Plain canonical-only anchors render as `step`; aliased anchors render as
// `step|alias1|alias2` so the author can see what was tried.
function formatAnchorSpec(spec: { step: string; aliases: string[] }): string {
  if (spec.aliases.length === 0) return spec.step;
  return [spec.step, ...spec.aliases].join('|');
}

// Build the anchorSteps array for an overlay attaching to a target workflow.
// Combines named-step anchors (insert-after / insert-before) with the synthetic
// `start` anchor when the overlay declared `applies-to.start: true`. Also emits
// the "no anchors matched any step" warning so authors catch typos.
//
// Per-anchor alias resolution: each `insert-after`/`insert-before` entry may
// declare aliases (canonical-stage matching). If the canonical step isn't a
// step id of the target workflow, aliases are tried in order. The resolved
// step name is what flows into both the rendered "after step `X`" pointer
// and the downstream gate placement in spine.ts — so the agent reads the
// step id their workflow actually uses (e.g. `implement`), not the canonical
// anchor (`change`).
function buildOverlayAnchors(
  overlay: OverlayMeta,
  target: string,
  workflowEntries: { name: string; steps: string[] }[],
  overlayName: string,
): { anchorSteps: { position: 'before' | 'after' | 'start'; step: string }[]; where: string } {
  const anchorSteps: { position: 'before' | 'after' | 'start'; step: string }[] = [];
  const anchors: string[] = [];
  const targetWf = workflowEntries.find((w) => w.name === target);
  const targetStepSet = new Set(targetWf?.steps ?? []);

  if (overlay.applyAtStart) {
    anchorSteps.push({ position: 'start', step: '' });
    anchors.push('at workflow start');
  }
  // Track which specs failed to resolve so we can emit one combined warning
  // listing the actual tried-and-missed anchors. Successful resolutions push
  // the resolved (post-alias) step into anchorSteps + render summary.
  const unresolvedSpecs: { spec: { step: string; aliases: string[] }; position: 'after' | 'before' }[] = [];
  for (const spec of overlay.insertAfter) {
    const resolved = resolveAnchor(spec, targetStepSet);
    if (resolved == null) {
      unresolvedSpecs.push({ spec, position: 'after' });
      continue;
    }
    anchors.push(`after step \`${resolved}\``);
    anchorSteps.push({ position: 'after', step: resolved });
  }
  for (const spec of overlay.insertBefore) {
    const resolved = resolveAnchor(spec, targetStepSet);
    if (resolved == null) {
      unresolvedSpecs.push({ spec, position: 'before' });
      continue;
    }
    anchors.push(`before step \`${resolved}\``);
    anchorSteps.push({ position: 'before', step: resolved });
  }
  const where = anchors.length > 0 ? anchors.join(' and ') : 'at the end';

  // Warn only when *neither* canonical nor any alias matches for any named
  // anchor. The `start` synthetic anchor is exempt. Suppressed if at least
  // one named anchor (or `start`) resolved — partial matches are normal when
  // an overlay declares more anchors than a given workflow uses.
  const namedResolvedCount = anchorSteps.filter((a) => a.position !== 'start').length;
  if (namedResolvedCount === 0 && unresolvedSpecs.length > 0 && !overlay.applyAtStart) {
    const declared = [...overlay.insertAfter, ...overlay.insertBefore].map(formatAnchorSpec);
    console.warn(
      `Overlay "${overlayName}" targets workflow "${target}" but none of its anchors [${declared.join(', ')}] match steps [${[...targetStepSet].join(', ')}]. No inline gate markers will render.`,
    );
  }
  return { anchorSteps, where };
}

// Does this workflow match the overlay's `applies-to`? An overlay attaches
// when EITHER the workflow's name (or any ancestor in its `extends:` chain)
// is in the overlay's `appliesToWorkflows` list, OR the workflow declares a
// `requires:` trait whose name or domain is in the overlay's appliesToTraits.
function workflowMatchesOverlay(
  workflowName: string,
  workflowRequires: string[],
  appliesToWorkflows: Set<string>,
  appliesToTraits: string[],
  catalog: Record<string, SkillMeta>,
): boolean {
  if (appliesToWorkflows.size > 0) {
    for (const ancestor of collectWorkflowExtendsChain(workflowName, catalog)) {
      if (appliesToWorkflows.has(ancestor)) return true;
    }
  }
  if (appliesToTraits.length > 0) {
    for (const trait of workflowRequires) {
      const domain = trait.split('.')[0];
      if (appliesToTraits.includes(trait) || appliesToTraits.includes(domain)) {
        return true;
      }
    }
  }
  return false;
}

function validateCrossProjectExtends(types: Record<string, CoworkerTypeEntry>): void {
  for (const [name, entry] of Object.entries(types)) {
    if (!entry.project) continue;
    for (const parent of normalizeList(entry.extends)) {
      const parentEntry = types[parent];
      if (parentEntry?.project && parentEntry.project !== entry.project) {
        throw new Error(
          `Cross-project extends: "${name}" (project: ${entry.project}) cannot extend "${parent}" (project: ${parentEntry.project})`,
        );
      }
    }
  }
}

export function resolveTypeChain(types: Record<string, CoworkerTypeEntry>, typeName: string): CoworkerTypeEntry[] {
  const chain: CoworkerTypeEntry[] = [];
  const seen = new Set<string>();
  const visiting = new Set<string>();
  const stack: string[] = [];

  function visit(current: string): void {
    if (seen.has(current)) return;
    if (visiting.has(current)) {
      // Cycle detected — fail loudly. Silent skip would produce a partial,
      // plausible-looking merged manifest that's missing half its ancestors.
      const cycle = [...stack.slice(stack.indexOf(current)), current].join(' → ');
      throw new Error(`Cycle in coworker-type extends chain: ${cycle}`);
    }
    visiting.add(current);
    stack.push(current);
    const entry = types[current];
    if (!entry) {
      // Unknown parent — fail loudly. This catches yaml typos like
      // `extends: base-commmon` that would otherwise render a coworker
      // with missing invariants/context/skills.
      const available = Object.keys(types).slice(0, 8).join(', ');
      throw new Error(
        `Unknown coworker type "${current}" referenced via extends (path: ${stack.join(' → ')}). ` +
          `Available: ${available}${Object.keys(types).length > 8 ? ', …' : ''}`,
      );
    }
    for (const parent of normalizeList(entry.extends)) {
      visit(parent);
    }
    chain.push(entry);
    stack.pop();
    visiting.delete(current);
    seen.add(current);
  }

  visit(typeName);
  return chain;
}

export function resolveCoworkerManifest(
  types: Record<string, CoworkerTypeEntry>,
  typeName: string,
  catalog: Record<string, SkillMeta>,
  projectRoot: string,
  opts: { cliScope?: 'disabled' | 'group' | 'global' } = {},
): CoworkerManifest {
  validateCrossProjectExtends(types);
  const cliScope = opts.cliScope ?? 'group';

  const roles = typeName
    .split('+')
    .map((r) => r.trim())
    .filter(Boolean);
  if (roles.length === 0) {
    throw new Error(`Coworker type name is empty: "${typeName}"`);
  }

  // Cross-project `+` composition — warn on mixed projects, don't throw.
  const projects = new Set<string>();
  for (const role of roles) {
    for (const entry of resolveTypeChain(types, role)) {
      if (entry.project) projects.add(entry.project);
    }
  }
  if (roles.length > 1 && projects.size > 1) {
    console.warn(`Cross-project composition: "${typeName}" mixes projects: ${[...projects].join(', ')}`);
  }

  const identityParts: string[] = [];
  const invariantFiles: string[] = [];
  const contextFiles: string[] = [];
  const workflowNames: string[] = [];
  const skillNames: string[] = [];
  const overlayNames: string[] = [];
  const bindings: Record<string, string> = {};
  const vars: Record<string, string> = {};
  const mcpServers: Record<string, import('./types.js').McpServerTypeConfig> = {};
  let manifestProject: string | undefined;
  let flat = false;

  // Build skill → native project. A skill is project-specific only when every
  // project-typed type that lists it shares the same project. Skills listed by
  // types from multiple different projects, or only by base types (no project),
  // are universal and can bind to any manifest.
  const skillProjectSets = new Map<string, Set<string>>();
  for (const entry of Object.values(types)) {
    if (!entry.skills || !entry.project) continue;
    for (const s of entry.skills) {
      const projs = skillProjectSets.get(s) || new Set();
      projs.add(entry.project);
      skillProjectSets.set(s, projs);
    }
  }

  for (const role of roles) {
    const chain = resolveTypeChain(types, role);
    if (chain.length === 0) {
      throw new Error(`Unknown coworker type: "${role}"`);
    }
    let leafIdentity = '';
    for (const entry of chain) {
      if (entry.identity) leafIdentity = entry.identity;
      if (entry.invariants) invariantFiles.push(...entry.invariants);
      if (entry.context) contextFiles.push(...entry.context);
      if (entry.workflows) workflowNames.push(...entry.workflows);
      if (entry.skills) skillNames.push(...entry.skills);
      if (entry.overlays) overlayNames.push(...entry.overlays);
      if (entry.flat === true) flat = true;
      if (entry.bindings) {
        for (const [trait, skillName] of Object.entries(entry.bindings)) {
          bindings[trait] = skillName;
        }
      }
      if (entry.vars) {
        for (const [key, value] of Object.entries(entry.vars)) {
          vars[key] = value; // leaf-wins: chain is base→leaf
        }
      }
      if (entry.mcpServers) {
        for (const [name, config] of Object.entries(entry.mcpServers)) {
          mcpServers[name] = config;
        }
      }
    }
    if (leafIdentity) identityParts.push(leafIdentity);
    if (!manifestProject) {
      const leaf = chain[chain.length - 1];
      if (leaf?.project) manifestProject = leaf.project;
    }
  }

  // cliScope filter for ncl-* fragments. The YAML lists both ncl-group.md
  // and ncl-global.md when an agent might use either; the runtime cli_scope
  // setting decides which one (or neither) actually renders into CLAUDE.md.
  const filterByCliScope = (paths: string[]): string[] =>
    paths.filter((p) => {
      const base = p.split('/').pop() ?? '';
      if (base !== 'ncl-group.md' && base !== 'ncl-global.md') return true;
      if (cliScope === 'disabled') return false;
      if (cliScope === 'group') return base === 'ncl-group.md';
      if (cliScope === 'global') return base === 'ncl-global.md';
      return true;
    });

  // Flat types are verbatim prose bodies (main/global). Skip workflow/skill/
  // overlay/binding validation — they don't apply. Additive skills contribute
  // context fragments only.
  if (flat) {
    const identity = readFragments(dedupRelative(identityParts, projectRoot), projectRoot).join('\n\n').trim();
    const context = readFragments(filterByCliScope(dedupRelative(contextFiles, projectRoot)), projectRoot);
    const leafEntry = types[typeName];
    const title = leafEntry?.title ?? humanize(roles[roles.length - 1]);
    return {
      typeName,
      title,
      identity: identity || defaultIdentity(title),
      invariants: [],
      context,
      workflows: [],
      skills: [],
      tools: [],
      bindings: {},
      vars,
      customizations: [],
      mcpServers,
      flat: true,
    };
  }

  // Validate references. Actionable errors naming the exact offender.
  const unknownRefs: string[] = [];
  for (const name of [...workflowNames, ...skillNames, ...overlayNames]) {
    if (!catalog[name]) unknownRefs.push(name);
  }
  if (unknownRefs.length > 0) {
    throw new Error(
      `Coworker type "${typeName}" references unknown skill/workflow/overlay: ${[...new Set(unknownRefs)].join(', ')}. ` +
        `Each reference must match a SKILL.md (container/skills/), WORKFLOW.md (container/workflows/), ` +
        `or OVERLAY.md (container/overlays/) with \`name: <ref>\` in its frontmatter.`,
    );
  }

  // Read spine fragments (dedup by resolved absolute path).
  const identity = readFragments(dedupRelative(identityParts, projectRoot), projectRoot).join('\n\n').trim();
  const invariants = readFragments(dedupRelative(invariantFiles, projectRoot), projectRoot);
  const context = readFragments(filterByCliScope(dedupRelative(contextFiles, projectRoot)), projectRoot);

  // Classify workflow vs skill by the catalog's declared type. Overlays are
  // not directly invocable; they appear in ## Workflow Customizations only.
  const workflowEntries: CoworkerManifest['workflows'] = [];
  const skillEntries: CoworkerManifest['skills'] = [];
  const uniqueRefs = [...new Set([...workflowNames, ...skillNames])];
  const workflowSet = new Set<string>();
  for (const name of uniqueRefs) {
    const meta = catalog[name];
    if (meta.type === 'workflow') {
      const uses = [...meta.uses.skills, ...meta.uses.workflows];
      // Inherit steps + step bodies + prologue + epilogue from parent
      // workflow if this child has none of its own.
      // A declared `extends:` parent MUST resolve. Previously a missing parent
      // was silently skipped (the `&& catalog[...]` guard below), producing an
      // empty-body workflow with no error — e.g. onboard-project generating
      // `extends: investigate` after that base workflow was consolidated into
      // `plan`. Fail loudly so the composer and validate:templates catch it,
      // the same way an unknown skill ref already throws.
      if (meta.extendsWorkflow && !catalog[meta.extendsWorkflow]) {
        throw new Error(
          `Workflow '${name}' extends '${meta.extendsWorkflow}' but no workflow with that name is ` +
            `registered — extends targets must resolve (was the parent renamed or removed?).`,
        );
      }
      let steps = meta.steps;
      let stepBodies = meta.stepBodies;
      let prologue = meta.prologue;
      let epilogue = meta.epilogue;
      if (steps.length === 0 && meta.extendsWorkflow && catalog[meta.extendsWorkflow]) {
        const parent = catalog[meta.extendsWorkflow];
        steps = parent.steps;
        stepBodies = { ...parent.stepBodies };
        // Combine parent + child framing rather than letting the child shadow
        // the parent. A child that authors its own body (e.g. `slangpy-implement`'s
        // `## PR-review-fix mode` mode-deltas, captured as the child's epilogue)
        // must NOT drop the parent's epilogue (`## Mode invariants` etc.). Parent
        // framing comes first, then the child's specialization.
        prologue = [parent.prologue, prologue].filter(Boolean).join('\n\n') || undefined;
        epilogue = [parent.epilogue, epilogue].filter(Boolean).join('\n\n') || undefined;
      }
      workflowEntries.push({
        name: meta.name,
        description: meta.description,
        uses,
        requires: meta.requires,
        steps,
        stepBodies,
        prologue,
        epilogue,
      });
      workflowSet.add(meta.name);
    } else if (meta.type === 'capability') {
      skillEntries.push({ name: meta.name, description: meta.description, provides: meta.provides });
    }
  }

  // Validate bindings. Traits use dotted qualifiers (e.g. repo.pr, code.edit).
  // Bindings are keyed by domain (e.g. repo, code). The validator:
  //   1. Extracts the domain from a qualified trait (repo.pr → repo)
  //   2. Looks up the binding by domain
  //   3. Checks the bound skill provides the full qualified string
  //   4. Falls back to a project-scoped skill scan (same project or base first)
  const requiredTraits = new Set<string>();
  for (const wf of workflowEntries) {
    for (const trait of wf.requires) requiredTraits.add(trait);
  }

  // Build project-scoped provider map. Only same-project or universal skills
  // can auto-bind. Cross-project skills are never considered — if a trait is
  // only satisfiable by a foreign skill, it's an unresolved-trait error.
  const directlyProvided = new Map<string, string>();
  const traitProviders = new Map<string, string[]>();
  for (const s of skillEntries) {
    const projs = skillProjectSets.get(s.name);
    const soleProject = projs?.size === 1 ? [...projs][0] : undefined;
    const compatible = !soleProject || !manifestProject || soleProject === manifestProject;
    for (const trait of s.provides) {
      const providers = traitProviders.get(trait) || [];
      providers.push(s.name);
      traitProviders.set(trait, providers);
      if (compatible && !directlyProvided.has(trait)) {
        directlyProvided.set(trait, s.name);
      }
    }
  }

  // Warn when multiple skills provide the same trait without an explicit binding.
  for (const [trait, providers] of traitProviders) {
    if (providers.length <= 1) continue;
    const domain = trait.split('.')[0];
    if (!bindings[domain] && !bindings[trait]) {
      console.warn(
        `Coworker type "${typeName}": trait "${trait}" provided by [${providers.join(', ')}] with no explicit binding. Using "${providers[0]}".`,
      );
    }
  }

  const resolvedBindings: Record<string, string> = { ...bindings };
  const unresolvedTraits: string[] = [];
  for (const qualifiedTrait of requiredTraits) {
    const domain = qualifiedTrait.split('.')[0];

    // 1. Check domain-level binding
    if (resolvedBindings[domain]) {
      const skill = catalog[resolvedBindings[domain]];
      if (!skill) {
        throw new Error(
          `Coworker type "${typeName}" binds domain "${domain}" → "${resolvedBindings[domain]}" but that skill is not in the catalog.`,
        );
      }
      if (skill.provides.includes(qualifiedTrait)) {
        continue;
      }
      console.warn(
        `Coworker type "${typeName}": binding "${domain}" → "${resolvedBindings[domain]}" does not provide "${qualifiedTrait}". Falling back to skill scan.`,
      );
    }

    // 2. Check exact-key binding (backward compat with unqualified traits)
    if (resolvedBindings[qualifiedTrait]) {
      const skill = catalog[resolvedBindings[qualifiedTrait]];
      if (skill?.provides.includes(qualifiedTrait)) {
        continue;
      }
    }

    // 3. Fallback: project-scoped skill scan. Only same-project or universal skills.
    if (directlyProvided.has(qualifiedTrait)) {
      if (!resolvedBindings[domain]) {
        resolvedBindings[domain] = directlyProvided.get(qualifiedTrait)!;
      }
      continue;
    }

    unresolvedTraits.push(qualifiedTrait);
  }
  if (unresolvedTraits.length > 0) {
    throw new Error(
      `Coworker type "${typeName}" requires trait(s) with no binding: ${[...new Set(unresolvedTraits)].join(', ')}. ` +
        `Either include a skill whose frontmatter declares \`provides: [<trait>]\`, or add a \`bindings: { <trait>: <skill-name> }\` mapping to the coworker type.`,
    );
  }

  // Collect workflow customizations: extends-chains, overrides, and overlays.
  const customizations: WorkflowCustomization[] = [];
  const manifestWorkflowSet = new Set(workflowEntries.map((w) => w.name));
  for (const wf of workflowEntries) {
    const meta = catalog[wf.name];
    // Suppress the visible "(extends /base—see section below)" note when the
    // parent is the implicit `base` workflow that the coworker didn't actually
    // include. Without this, every concrete workflow would render a phantom
    // pointer to a section that doesn't exist in this coworker's spine. If a
    // coworker DOES list `base` in its workflows, the note still renders.
    const suppressExtendsNote = meta.extendsWorkflow === 'base' && !manifestWorkflowSet.has('base');
    if (meta.extendsWorkflow && !suppressExtendsNote) {
      customizations.push({
        workflow: wf.name,
        kind: 'extends',
        extendsWorkflow: meta.extendsWorkflow,
        summary: `\`/${wf.name}\` extends \`/${meta.extendsWorkflow}\` — run base steps, then the specialized steps.`,
      });
    }
    for (const [stepId, body] of Object.entries(meta.overrides)) {
      customizations.push({
        workflow: wf.name,
        kind: 'override',
        stepId,
        summary: `In \`/${wf.name}\`, step \`${stepId}\` is overridden.`,
        detail: body.trim(),
      });
    }
  }
  const uniqueOverlayNames = [...new Set(overlayNames)];
  for (const overlayName of uniqueOverlayNames) {
    const overlayMeta = catalog[overlayName];
    if (!overlayMeta || overlayMeta.type !== 'overlay' || !overlayMeta.overlay) {
      throw new Error(
        `Coworker type "${typeName}" references overlay "${overlayName}" but no container/overlays/<dir>/OVERLAY.md declares it.`,
      );
    }
    const overlay = overlayMeta.overlay;
    const targets = new Set<string>();
    const appliesToSet = new Set(overlay.appliesToWorkflows);
    for (const wf of workflowEntries) {
      if (workflowMatchesOverlay(wf.name, wf.requires, appliesToSet, overlay.appliesToTraits, catalog)) {
        targets.add(wf.name);
      }
    }
    // Deduplicate: if a child workflow extends an ancestor that's also a
    // target, drop the ancestor — the child's customization subsumes it.
    // Walks the full extends chain so transitive (grand)parents are pruned.
    for (const target of [...targets]) {
      const chain = collectWorkflowExtendsChain(target, catalog);
      // chain[0] is `target` itself; everything past it is an ancestor.
      for (const ancestor of chain.slice(1)) {
        if (targets.has(ancestor)) targets.delete(ancestor);
      }
    }
    for (const target of targets) {
      const { anchorSteps, where } = buildOverlayAnchors(overlay, target, workflowEntries, overlayName);
      customizations.push({
        workflow: target,
        kind: 'overlay',
        overlayName,
        anchorSteps,
        summary: `\`/${target}\` is augmented by \`${overlayName}\` ${where}.`,
        detail: overlay.step,
      });
    }
  }

  // Derive tool allowlist: direct refs + transitive workflow `uses` + bound
  // trait skills + overlays that attach to any referenced workflow.
  const tools = new Set<string>();
  const visited = new Set<string>();
  function collectTools(ref: string): void {
    if (visited.has(ref)) return;
    visited.add(ref);
    const meta = catalog[ref];
    if (!meta) return;
    for (const t of meta.allowedTools) tools.add(t);
    if (meta.type === 'workflow') {
      for (const sub of [...meta.uses.skills, ...meta.uses.workflows]) collectTools(sub);
      if (meta.extendsWorkflow) collectTools(meta.extendsWorkflow);
    }
  }
  for (const name of uniqueRefs) collectTools(name);
  for (const skillName of Object.values(resolvedBindings)) collectTools(skillName);
  for (const overlayName of uniqueOverlayNames) collectTools(overlayName);

  const leafEntry = types[typeName];
  const title = leafEntry?.title ?? humanize(roles[roles.length - 1]);

  return {
    typeName,
    title,
    identity: identity || defaultIdentity(title),
    invariants,
    context,
    workflows: workflowEntries,
    skills: skillEntries,
    tools: [...tools].sort(),
    bindings: resolvedBindings,
    vars,
    customizations,
    mcpServers,
    flat: false,
  };
}

function dedupRelative(paths: string[], projectRoot: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const p of paths) {
    const abs = path.resolve(projectRoot, p);
    if (seen.has(abs)) continue;
    seen.add(abs);
    out.push(p);
  }
  return out;
}

function readFragments(paths: string[], projectRoot: string): string[] {
  const out: string[] = [];
  for (const p of paths) {
    const abs = path.resolve(projectRoot, p);
    if (!fs.existsSync(abs)) {
      throw new Error(`Spine fragment not found: ${p}`);
    }
    const text = fs.readFileSync(abs, 'utf-8').trim();
    if (text) out.push(text);
  }
  return out;
}

function humanize(value: string): string {
  return value
    .split(/[-_+/]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function defaultIdentity(title: string): string {
  return `You are ${title}, a specialist coworker.`;
}

/**
 * Inject per-agent overlays into a resolved manifest. Called from spine.ts
 * when the caller supplies runtime overlay names (from agent_groups.overlays).
 * Validates names, matches overlays to workflows, and appends WorkflowCustomizations.
 */
export function injectOverlays(
  manifest: CoworkerManifest,
  overlayNames: string[],
  catalog: Record<string, SkillMeta>,
): void {
  // Dedup against overlays already present from the type chain
  const alreadyApplied = new Set(manifest.customizations.filter((c) => c.kind === 'overlay').map((c) => c.overlayName));
  const unique = [...new Set(overlayNames)].filter((n) => !alreadyApplied.has(n));
  for (const overlayName of unique) {
    const overlayMeta = catalog[overlayName];
    if (!overlayMeta || overlayMeta.type !== 'overlay' || !overlayMeta.overlay) {
      console.warn(`injectOverlays: overlay "${overlayName}" not found in catalog, skipping.`);
      continue;
    }
    const overlay = overlayMeta.overlay;
    const targets = new Set<string>();
    const appliesToSet = new Set(overlay.appliesToWorkflows);
    for (const wf of manifest.workflows) {
      if (workflowMatchesOverlay(wf.name, wf.requires, appliesToSet, overlay.appliesToTraits, catalog)) {
        targets.add(wf.name);
      }
    }
    for (const target of [...targets]) {
      const chain = collectWorkflowExtendsChain(target, catalog);
      for (const ancestor of chain.slice(1)) {
        if (targets.has(ancestor)) targets.delete(ancestor);
      }
    }
    for (const target of targets) {
      const { anchorSteps, where } = buildOverlayAnchors(overlay, target, manifest.workflows, overlayName);
      manifest.customizations.push({
        workflow: target,
        kind: 'overlay',
        overlayName,
        anchorSteps,
        summary: `\`/${target}\` is augmented by \`${overlayName}\` ${where}.`,
        detail: overlay.step,
      });
    }
    // Add overlay tools to manifest
    for (const t of overlayMeta.allowedTools) {
      if (!manifest.tools.includes(t)) manifest.tools.push(t);
    }
  }
}

/**
 * Resolve which overlays apply to a coworker — same pipeline as
 * renderCoworkerSpine, but returning the deduped overlay-name list instead
 * of a rendered string. Used by container-runner.ts to materialize per-overlay
 * MARKER files alongside the composed CLAUDE.md.
 *
 * Returns [] when disableOverlays is set (matches the renderer's strip behavior).
 */
export function getAppliedOverlayNames(
  projectRoot: string,
  coworkerType: string,
  opts: { disableOverlays?: boolean; overlays?: string[]; cliScope?: 'disabled' | 'group' | 'global' } = {},
): string[] {
  const cliScope = opts.cliScope ?? 'group';
  const types = readCoworkerTypes(projectRoot);
  const catalog = readSkillCatalog(projectRoot);
  const manifest = resolveCoworkerManifest(types, coworkerType, catalog, projectRoot, { cliScope });
  if (opts.overlays && opts.overlays.length > 0) {
    injectOverlays(manifest, opts.overlays, catalog);
  }
  if (opts.disableOverlays) return [];
  const seen = new Set<string>();
  // Anchor-spliced overlays (applies-to matches → CLAUDE.md text).
  for (const c of manifest.customizations) {
    if (c.kind === 'overlay' && c.overlayName) seen.add(c.overlayName);
  }
  // Operator-selected overlays (R2). The MARKER file is the activation
  // primitive for hooks; CLAUDE.md splicing is a separate concern
  // (anchor-driven). An overlay with empty applies-to (e.g. critique-gate)
  // has no spine prose but must still materialize its MARKER so the hook
  // first-line gate passes. Overlays are selected per agent-group from the
  // dashboard (agent_groups.overlays → opts.overlays), never declared on the
  // coworker type.
  if (opts.overlays) {
    for (const name of opts.overlays) {
      if (catalog[name]?.type === 'overlay') seen.add(name);
    }
  }
  return [...seen];
}

/**
 * For each overlay name with a sibling MARKER file at
 * container/overlays/<dirname>/MARKER, write its content to
 * <groupDir>/.overlay-<overlayName>. Containers see this at
 * /workspace/agent/.overlay-<overlayName> via the standard mount.
 *
 * Lookup is by overlay name (frontmatter `name:`), not directory basename —
 * the catalog stores the OVERLAY.md absolute path, and MARKER lives next to
 * it. Overlays without a MARKER file are silently skipped (prose-only).
 *
 * Idempotent. Safe to call on every spawn.
 */
export function materializeOverlayMarkers(overlayNames: string[], projectRoot: string, groupDir: string): void {
  const catalog = readSkillCatalog(projectRoot);
  for (const name of overlayNames) {
    const meta = catalog[name];
    if (!meta?.path) continue;
    const markerPath = path.join(path.dirname(meta.path), 'MARKER');
    if (!fs.existsSync(markerPath)) continue;
    const content = fs.readFileSync(markerPath, 'utf-8').trim();
    if (!content) continue;
    fs.writeFileSync(path.join(groupDir, `.overlay-${name}`), content + '\n');
  }
}

/**
 * Read the union of `required_critique_stages` from the coworker-type chain
 * (rooted at `coworkerType`, walked via `extends:`) and write it to
 * `<groupDir>/.critique-required-stages` as a JSON list. Containers see
 * this at `/workspace/agent/.critique-required-stages`, and
 * `gate-critique-on-deliver.sh` uses it to decide which codex-critique
 * STAGEs must have completed before allowing a delivery marker / `gh pr
 * create`.
 *
 * Honors two kill switches by skipping (and removing any stale file):
 *   1. `appliedOverlays` does not contain `critique-gate` — the coworker
 *      didn't opt into critique enforcement, so the hook will short-circuit
 *      anyway. Removing the stages file keeps on-disk state honest.
 *   2. `disableOverlays` (passed indirectly: the caller computes
 *      appliedOverlays with disableOverlays applied; an empty list trips #1).
 *
 * Empty union (overlay opted in but no stages declared) → write `[]`.
 * The hook treats empty as legacy mode (any 1 critique round suffices),
 * which preserves behavior for coworkers using the bare `critique-gate`
 * overlay without per-type stage requirements.
 *
 * Idempotent. Safe to call on every spawn alongside materializeOverlayMarkers.
 */
export function materializeCritiqueRequiredStages(
  coworkerType: string,
  types: Record<string, CoworkerTypeEntry>,
  appliedOverlays: string[],
  groupDir: string,
): void {
  const filePath = path.join(groupDir, '.critique-required-stages');
  if (!appliedOverlays.includes('critique-gate')) {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    return;
  }
  const stages = new Set<string>();
  try {
    for (const entry of resolveTypeChain(types, coworkerType)) {
      if (entry.requiredCritiqueStages) {
        for (const s of entry.requiredCritiqueStages) stages.add(s);
      }
    }
  } catch {
    // Cycle or unknown type — fall through to empty (legacy gate mode).
  }
  fs.writeFileSync(filePath, JSON.stringify([...stages]) + '\n');
}

/**
 * Union `delivery_markers` / `pr_command_patterns` across the coworker-type
 * chain and write them to `<groupDir>/.critique-delivery-markers` as
 * `{"message_markers": [...], "bash_patterns": [...]}`. The gates
 * (gate-critique-on-deliver.sh + poll-loop's checkCritiqueGate) union the
 * file with their built-in vocabulary — extensions are ADDITIVE only, so the
 * defaults can never be configured (or tampered) away.
 *
 * No declarations → remove any stale file; absent file = built-in vocabulary
 * only. Idempotent, safe on every spawn.
 *
 * NOT gated on the `critique-gate` overlay (unlike materializeCritiqueRequiredStages):
 * the delivery vocabulary feeds the ALWAYS-ON routing gate, which applies to
 * every role — including non-critique-gated ones (triager, reviewer). Since
 * the built-in floor now carries only the general primitives, a non-gated
 * role's role-specific marker (e.g. a reviewer's [Review Verdict]) would go
 * unrecognized by routing unless its file is materialized regardless of the
 * critique-gate overlay. `appliedOverlays` is retained for call-site symmetry.
 */
export function materializeCritiqueDeliveryMarkers(
  coworkerType: string,
  types: Record<string, CoworkerTypeEntry>,
  _appliedOverlays: string[],
  groupDir: string,
): void {
  const filePath = path.join(groupDir, '.critique-delivery-markers');
  const remove = (): void => {
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  };
  const markers = new Set<string>();
  const patterns = new Set<string>();
  try {
    for (const entry of resolveTypeChain(types, coworkerType)) {
      for (const m of entry.deliveryMarkers ?? []) markers.add(m);
      for (const p of entry.prCommandPatterns ?? []) patterns.add(p);
    }
  } catch {
    // Cycle or unknown type — treat as no extensions.
  }
  if (markers.size === 0 && patterns.size === 0) {
    remove();
    return;
  }
  fs.writeFileSync(filePath, JSON.stringify({ message_markers: [...markers], bash_patterns: [...patterns] }) + '\n');
}
