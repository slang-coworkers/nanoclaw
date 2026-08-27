/**
 * Setup wizard step: optional project integrations.
 *
 * After the coworker infrastructure (nv-main) is merged, this offers the
 * project overlay branches (Slang, SlangPy, Dashboard, …) as a clack
 * multiselect. Each selected project is merged via `setup/merge-train.sh
 * <branch>`, which is idempotent and auto-resolves nv-main-owned infra
 * conflicts. Nothing is fork-specific for the user: they run the same vanilla
 * setup; this step only appears once nv-main is present, and only lists project
 * branches that actually exist on `origin`.
 *
 * Non-interactive: NANOCLAW_PROJECTS="slang,slangpy" (comma-separated values or
 * branch names) skips the prompt. Empty/unset with no TTY → no-op.
 *
 * Merge tiers (see composeBranch): deterministic `merge-train.sh` first, then —
 * only when NANOCLAW_LLM_MERGE=1 — an LLM-assisted keep-both fallback for
 * branches merge-train can't compose (e.g. nv-dashboard, whose shared-source
 * edits is_owned would drop). CI leaves the flag unset, so its composed-state
 * check stays deterministic.
 *
 * The orchestration core (`runProjectIntegrations`) takes its selector and
 * merger as injected dependencies so it is unit-testable without a terminal or
 * a real git merge; `run()` wires the real clack + merge-train implementations.
 */
import { spawnSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

import * as p from '@clack/prompts';
import { styleText } from 'node:util';

import { composeMergeViaClaude } from './lib/claude-assist.js';

export interface ProjectOption {
  /** Stable key used in NANOCLAW_PROJECTS. */
  value: string;
  /** The nv-* branch merged via merge-train.sh. */
  branch: string;
  label: string;
  hint?: string;
  /** Pre-selected in the wizard multiselect (the user can still toggle it off). */
  default?: boolean;
}

/**
 * The project overlays offered at setup time. Data-driven — add a row to extend.
 * Dashboard (the observability viewer) is pre-selected by default; the others
 * are opt-in. Slang / SlangPy / NanoClaw are clean additive overlays; Dashboard
 * edits shared host src and may need manual conflict resolution, hence the hint.
 */
export const PROJECTS: ProjectOption[] = [
  {
    value: 'dashboard',
    branch: 'nv-dashboard',
    label: 'Dashboard (viewer)',
    hint: 'observability viewer — selected by default; may need manual conflict resolution',
    default: true,
  },
  {
    value: 'slang',
    branch: 'nv-slang',
    label: 'Slang compiler',
    hint: 'multi-agent support for shader-slang/slang',
  },
  {
    value: 'slangpy',
    branch: 'nv-slangpy',
    label: 'SlangPy',
    hint: 'multi-agent support for shader-slang/slangpy',
  },
  {
    value: 'nanoclaw',
    branch: 'nv-nanoclaw',
    label: 'NanoClaw coworkers',
    hint: 'agents for developing nanoclaw itself',
  },
];

/**
 * Parse NANOCLAW_PROJECTS into the matching project options. Accepts either the
 * `value` key or the full `branch` name. Returns null when unset/empty so the
 * caller can fall through to the interactive prompt.
 */
export function parseProjectsEnv(raw: string | undefined): ProjectOption[] | null {
  const trimmed = raw?.trim();
  if (!trimmed) return null;
  const wanted = new Set(
    trimmed
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean),
  );
  return PROJECTS.filter((proj) => wanted.has(proj.value) || wanted.has(proj.branch));
}

/** Returns null when the user cancels or picks nothing (both mean "skip"). */
export type ProjectSelector = () => Promise<ProjectOption[] | null>;
/** Composes one branch; returns the process exit status (0 = ok). May be async
 *  (the LLM fallback tier is). */
export type ProjectMerger = (branch: string) => number | Promise<number>;

/** Tier 1: deterministic merge-train; returns exit status (0 = ok). */
export type MergeTrainRunner = (branch: string) => number;
/** Tier 2: LLM-assisted compose; returns true iff the tree is composed + builds. */
export type LlmComposer = (branch: string) => Promise<boolean>;

/**
 * Compose one branch across the merge tiers: deterministic `merge-train.sh`
 * first; if that fails (conflict outside nv-main's owned set, or a merge that
 * dropped an overlay's edits so it won't build — merge-train rolls back either
 * way) and the LLM tier is enabled, hand off to Claude to resolve keep-both.
 * Returns the process exit status (0 = composed). Pure over injected deps.
 */
export async function composeBranch(
  branch: string,
  deps: { runMergeTrain: MergeTrainRunner; llmCompose: LlmComposer; llmEnabled: boolean },
): Promise<number> {
  const status = deps.runMergeTrain(branch);
  if (status === 0) return 0;
  if (deps.llmEnabled && (await deps.llmCompose(branch))) return 0;
  return status;
}

export interface ProjectIntegrationResult {
  merged: string[];
  failed: string[];
  skipped: boolean;
}

/**
 * Orchestration core: select projects, merge each in listed order, collect the
 * outcome. Pure over its injected `select`/`merge` deps — no clack, no git.
 * A failed merge does not abort the rest; every selection is attempted and the
 * failures are reported so the operator can resolve them individually.
 */
export async function runProjectIntegrations(deps: {
  select: ProjectSelector;
  merge: ProjectMerger;
}): Promise<ProjectIntegrationResult> {
  const chosen = await deps.select();
  if (!chosen || chosen.length === 0) {
    return { merged: [], failed: [], skipped: true };
  }
  const merged: string[] = [];
  const failed: string[] = [];
  for (const proj of chosen) {
    const status = await deps.merge(proj.branch);
    if (status === 0) merged.push(proj.branch);
    else failed.push(proj.branch);
  }
  return { merged, failed, skipped: false };
}

/** Repo root — this file lives at <root>/setup/project-integrations.ts. */
function repoRoot(): string {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

/**
 * Which project branches actually exist on `origin`. Keeps the prompt honest —
 * a fork checkout that lacks nv-dashboard never offers it. Best-effort: on any
 * git error, fall back to offering all (merge-train's fetch will surface a
 * genuinely missing branch).
 */
export function availableProjects(root = repoRoot()): ProjectOption[] {
  const res = spawnSync('git', ['ls-remote', '--heads', 'origin', ...PROJECTS.map((p) => p.branch)], {
    cwd: root,
    encoding: 'utf-8',
  });
  // Can't reach origin → we can't merge anyway, so offer nothing rather than
  // listing branches that would fail to fetch. Empty stdout with status 0 means
  // no project branch exists (a vanilla install) → also offer nothing.
  if (res.status !== 0) return [];
  const present = res.stdout ?? '';
  return PROJECTS.filter((proj) => present.includes(`refs/heads/${proj.branch}`));
}

/** Real interactive selector: NANOCLAW_PROJECTS override, else clack multiselect. */
async function selectInteractively(
  options: ProjectOption[],
  fromEnv: ProjectOption[] | null,
): Promise<ProjectOption[] | null> {
  if (fromEnv) return fromEnv;
  if (options.length === 0) return null;

  const selected = await p.multiselect({
    message:
      'Which project integrations do you want to add?\n' +
      styleText('dim', '  space to toggle, enter to confirm — defaults pre-selected') +
      '\n',
    options: options.map((proj) => ({
      value: proj.value,
      label: proj.label,
      hint: proj.hint,
    })),
    // Pre-select the defaults (e.g. Dashboard) among the available options; the
    // user can toggle any of them off before confirming.
    initialValues: options.filter((proj) => proj.default).map((proj) => proj.value),
    required: false,
  });

  if (p.isCancel(selected)) return null;
  const picked = new Set(selected as string[]);
  return options.filter((proj) => picked.has(proj.value));
}

/**
 * Real merger: deterministic merge-train.sh, then (opt-in via NANOCLAW_LLM_MERGE)
 * an LLM-assisted keep-both fallback when merge-train can't compose the branch.
 * CI leaves the flag unset, so the composed-state check stays deterministic.
 */
function mergeViaMergeTrain(branch: string): Promise<number> {
  const root = repoRoot();
  return composeBranch(branch, {
    runMergeTrain: (b) => spawnSync('bash', ['setup/merge-train.sh', b], { cwd: root, stdio: 'inherit' }).status ?? 1,
    llmCompose: (b) => composeMergeViaClaude(b, root),
    llmEnabled: process.env.NANOCLAW_LLM_MERGE === '1',
  });
}

/**
 * Wizard entry point (matches the setup/index.ts step contract:
 * `run(args): Promise<void>`).
 */
export async function run(_args: string[] = []): Promise<void> {
  const options = availableProjects();
  const fromEnv = parseProjectsEnv(process.env.NANOCLAW_PROJECTS);
  // Vanilla install (no project branches on origin) with no explicit override →
  // silent no-op. Nothing fork-specific is surfaced on a stock nanoclaw setup.
  if (options.length === 0 && !fromEnv) return;

  const result = await runProjectIntegrations({
    select: () => selectInteractively(options, fromEnv),
    merge: mergeViaMergeTrain,
  });

  if (result.skipped) {
    p.log.info(
      'No project integrations selected — you can add them later with `/add-slang` or `bash setup/merge-train.sh <branch>`.',
    );
    return;
  }
  if (result.merged.length > 0) {
    p.log.success(
      `Merged project ${result.merged.length === 1 ? 'integration' : 'integrations'}: ${result.merged.join(', ')}`,
    );
  }
  if (result.failed.length > 0) {
    p.log.warn(
      `Could not compose: ${result.failed.join(', ')}. ` +
        'The merge was rolled back — either it conflicts outside nv-main’s owned set, ' +
        'or it merged but the composed tree failed to build (see the merge-train output above). ' +
        'Retry or resolve manually with `bash setup/merge-train.sh <branch>`.',
    );
  }
}
