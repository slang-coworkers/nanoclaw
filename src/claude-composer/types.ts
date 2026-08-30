// Type definitions for the coworker composer. Split out so runtime modules
// (registry / resolve / spine / legacy) can depend on these without pulling
// in each other.

// ---------------------------------------------------------------------------
// Legacy 6-section model (used only for `main` and `global` manifests — the
// two static documents in the repo that aren't coworker-typed). Typed
// coworkers use the lego spine model further down.
// ---------------------------------------------------------------------------

export interface ManifestConfig {
  base: string;
  sections?: string[];
  project_overlays?: boolean;
}

export type PromptSectionName = 'role' | 'capabilities' | 'workflow' | 'constraints' | 'formatting' | 'resources';

export const PROMPT_SECTION_ORDER: PromptSectionName[] = [
  'role',
  'capabilities',
  'workflow',
  'constraints',
  'formatting',
  'resources',
];

export const PROMPT_SECTION_HEADINGS: Record<PromptSectionName, string> = {
  role: 'Role',
  capabilities: 'Capabilities',
  workflow: 'Workflow',
  constraints: 'Constraints',
  formatting: 'Formatting',
  resources: 'Resources',
};

export interface PromptDocument {
  title: string;
  sections: Record<PromptSectionName, string[]>;
}

export interface MergeState {
  seen: Set<string>;
}

export interface PromptTemplateConfig {
  role?: string;
  capabilities?: string;
  workflow?: string;
  constraints?: string;
  formatting?: string;
  resources?: string;
}

// ---------------------------------------------------------------------------
// Lego model: spine fragments + workflows + skills, all composed into a thin
// always-in-context CLAUDE.md for typed coworkers.
// ---------------------------------------------------------------------------

export interface CoworkerTypeEntry {
  extends?: string | string[];
  project?: string;
  description?: string;

  // Display title used as the `# ${title}` heading at the top of the
  // composed CLAUDE.md. When omitted, the composer humanizes the type
  // name (e.g. "slang-writer" → "Slang Writer"). Set explicitly when
  // the humanized type name reads poorly (e.g. "default" → "Coworker").
  title?: string;

  // Flat rendering mode: emit identity + context bodies verbatim with `---`
  // separators, no `## Identity` / `## Invariants` wrappers, no auto-generated
  // title. Used for main/global where the upstream body is a single prose
  // document that additive skills append to. Typed coworkers leave this unset.
  flat?: boolean;

  // Spine fragments (paths relative to projectRoot).
  identity?: string;
  invariants?: string[];
  context?: string[];

  // Catalog references by `name`. Workflows live under container/workflows/,
  // capability skills under container/skills/. See registry.ts.
  workflows?: string[];
  skills?: string[];

  // External skill registry: "owner/repo@ref". Skills listed in `skills:`
  // are fetched from this repo at build time via `gh skill install`. Leaf-wins
  // across the extends chain. Per-skill @version in workflow `uses:` overrides.
  skillSource?: string;

  // Compose-time substitution values. A shared workflow/overlay body can write
  // `{{vars.repo}}` and the composer replaces it with this map's value when
  // rendering for THIS coworker — including inside fenced code blocks (unlike
  // the runtime `{{target}}` placeholders, which render as `<target>`). Merged
  // leaf-wins across the extends chain, so a project-common type declares
  // `vars: { repo: shader-slang/slang, fixer: slang-fixer }` once and every
  // subtype inherits it. Lets one base workflow serve multiple projects that
  // differ only in hard-coded strings. A referenced-but-undeclared var is a
  // compose-time error (caught by validate:templates).
  vars?: Record<string, string>;

  // Trait bindings: abstract trait name → concrete skill name that provides it.
  // Leaf-wins across the type chain. Lets a type inherit a workflow that
  // declares `requires: [repo.pr]` without hard-coding which skill satisfies it.
  bindings?: Record<string, string>;

  // Overlays (SKILL.md `type: overlay` entries) to apply to this coworker's
  // workflows at compose time. Union-merged across the type chain.
  overlays?: string[];

  // codex-critique STAGE values that gate-critique-on-deliver.sh must see
  // completed (count >= 1 in workflow-state.json's `critique_stages`) before
  // allowing delivery markers / `gh pr create`. Inherited via `extends:` —
  // base types declare the stage set for their workflow shape (plan-style,
  // implement-style, answer-style); project subtypes inherit. The composer
  // unions across the type chain and materializes to
  // <groupDir>/.critique-required-stages so the hook reads it at
  // /workspace/agent/. Empty / unset = legacy mode (any 1 critique round
  // suffices). YAML key: `required_critique_stages`.
  requiredCritiqueStages?: string[];

  // Extra delivery-marker labels for the critique gate, ADDITIVE to the
  // built-in vocabulary ([Fix Report] etc. — defaults can be extended, never
  // removed, so config tampering can only widen the gate). Plain labels, no
  // brackets; sanitized to [A-Za-z0-9 _-]. Union across the type chain;
  // materialized with the bash patterns below to
  // <groupDir>/.critique-delivery-markers. YAML key: `delivery_markers`.
  deliveryMarkers?: string[];

  // Extra Bash PR/egress patterns (POSIX ERE fragments) for the critique
  // gate, additive to the built-ins (gh pr create, …/pulls,
  // createPullRequest). YAML key: `pr_command_patterns`.
  prCommandPatterns?: string[];

  // MCP servers to inject into containers for this coworker type.
  // Shallow merge across the extends chain (leaf wins per server name).
  // Per-instance container.json overrides type-level config.
  mcpServers?: Record<string, McpServerTypeConfig>;
}

export interface McpServerTypeConfig {
  type?: 'stdio' | 'http';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

// One anchor entry. `step` is the canonical (overlay-author-chosen) step id.
// `aliases` are alternate ids that this anchor also matches when the canonical
// step isn't in the target workflow's step set. Resolution order is canonical
// first, then aliases left-to-right; first hit wins. Plain-string anchors
// (back-compat) parse to `{ step, aliases: [] }`.
export interface AnchorSpec {
  step: string;
  aliases: string[];
}

export interface OverlayMeta {
  // Which workflows this overlay attaches to (by workflow name).
  appliesToWorkflows: string[];
  // Alternative targeting: any workflow that requires one of these traits.
  appliesToTraits: string[];
  // Step-id anchors. Overlay body is inserted AFTER each listed step (or
  // alias). See `AnchorSpec`.
  insertAfter: AnchorSpec[];
  // Step-id anchors. Overlay body is inserted BEFORE each listed step (or
  // alias). See `AnchorSpec`.
  insertBefore: AnchorSpec[];
  // `applies-to.start: true` — splice the overlay body at the very start of
  // every matched workflow's body, before step 1. Independent of (and
  // composes with) named-step anchors. Used by always-on observers (e.g.
  // /buddy) whose protocol must fire before any real work runs.
  applyAtStart: boolean;
  // Inline step markdown (body of the overlay after the frontmatter).
  step: string;
}

export interface SkillMeta {
  name: string;
  type: 'capability' | 'workflow' | 'overlay';
  description: string;
  allowedTools: string[];
  uses: { skills: string[]; workflows: string[] };
  path: string;

  // Trait system.
  provides: string[]; // Traits this skill provides (capability skills).
  requires: string[]; // Traits this workflow needs (workflow skills).

  // Workflow inheritance — this workflow extends another workflow;
  // step-level `overrides` replace the body under the matching step id.
  steps: string[];
  // Per-step prose body keyed by step id. Extracted from the workflow markdown
  // between one `{#step-id}` anchor and the next. Used to embed full workflow
  // content into CLAUDE.md at compose time (no runtime slash-command loading).
  stepBodies: Record<string, string>;
  // Prologue text from the workflow body — everything between the `# /name`
  // H1 and the first numbered step. Lets workflows surface top-of-doc prose
  // (`> [!IMPORTANT]` callouts, mode notes, framing) into the rendered output
  // alongside the description.
  prologue?: string;
  // Epilogue text from the workflow body — text after the last step
  // (e.g. `## Mode invariants` block). Renders below the steps so
  // cross-mode rules survive composition.
  epilogue?: string;
  extendsWorkflow?: string;
  // Author wrote `extends: none` — opts out of the implicit `extends: base`
  // applied by the post-pass when `extends:` is absent. Honored only on
  // workflows; capability/overlay skills never auto-extend.
  extendsExplicitNone?: boolean;
  overrides: Record<string, string>;

  // Overlay metadata (only populated for type: overlay skills).
  overlay?: OverlayMeta;
}

export interface WorkflowCustomization {
  workflow: string; // Target workflow name.
  kind: 'extends' | 'override' | 'overlay';
  summary: string; // One-line description rendered into the spine.
  detail?: string; // Optional longer form (step body / override body).
  stepId?: string; // For kind=override: the step id whose body is replaced.
  overlayName?: string; // For kind=overlay: the overlay skill name (used to group rendering).
  // For kind=overlay: which steps this gate attaches to.
  // `position: 'start'` is a synthetic anchor (`step` is unused) used when
  // the overlay declared `applies-to.start: true` — splices at workflow
  // body start, before step 1.
  anchorSteps?: { position: 'before' | 'after' | 'start'; step: string }[];
  extendsWorkflow?: string; // For kind=extends: the parent workflow name.
}

export interface CoworkerManifest {
  typeName: string;
  title: string;
  identity: string;
  invariants: string[];
  context: string[];
  workflows: {
    name: string;
    description: string;
    uses: string[];
    requires: string[];
    steps: string[];
    stepBodies: Record<string, string>;
    prologue?: string;
    epilogue?: string;
  }[];
  skills: { name: string; description: string; provides: string[] }[];
  tools: string[];

  // Trait layer.
  bindings: Record<string, string>;
  customizations: WorkflowCustomization[];

  // Compose-time `{{vars.KEY}}` substitution values, merged leaf-wins across
  // the type chain. See CoworkerTypeEntry.vars.
  vars: Record<string, string>;

  // MCP servers from the type registry (merged across extends chain).
  mcpServers: Record<string, McpServerTypeConfig>;

  // See CoworkerTypeEntry.flat.
  flat: boolean;
}

export interface ComposeCoworkerSpineOptions {
  coworkerType: string;
  extraInstructions?: string | null;
  projectRoot?: string;
  // When true, strip all overlays before rendering — no `## Gate Protocol`
  // section, no inline `⟐ ... GATE` blocks inside workflow steps. Used when
  // the per-coworker `agent_groups.disable_overlays` flag is 1. Workflows and
  // skills are unaffected.
  disableOverlays?: boolean;
  // Per-agent overlay names from agent_groups.overlays (JSON array). When
  // provided, these are injected into the manifest after type-chain resolution.
  // This is the runtime source of overlays now that YAML types no longer
  // declare them.
  overlays?: string[];
  // Per-group ncl CLI scope (from agent_groups.cli_scope). Forwarded to spine
  // rendering so cli/ncl-specific tool-instructions can be conditionally
  // omitted when the group disables CLI access.
  cliScope?: 'disabled' | 'group' | 'global';
  // Per-server usage prose from `container.json` `mcpServers[].instructions`,
  // keyed by server name. An external server's own tool descriptions cannot say
  // "in THIS install, point at the staging endpoint" — that is what this carries,
  // and it has to be in context before the agent reaches for the tool.
  //
  // Operator- and template-authored. The agent's `add_mcp_server` tool exposes no
  // `instructions` field, so an agent cannot author its own; entries reach the DB
  // only through `ncl groups config` or a template, both admin-gated.
  mcpInstructions?: Record<string, string>;
}

export interface ComposeLegacyPromptOptions {
  manifestName: 'main' | 'coworker';
  coworkerType?: string | null;
  extraInstructions?: string | null;
  projectRoot?: string;
}
