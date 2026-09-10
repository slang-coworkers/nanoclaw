/**
 * The upstream module-instruction surface the spine shadows, pinned.
 *
 * `container/agent-runner/src/mcp-tools/*.instructions.md` is upstream's prose for
 * the built-in MCP tools. `project-doc-compose.ts` emits those files directly, and
 * takes the document whenever a provider owns its surfaces; the spine composer
 * instead emits its own fragments under
 * `container/spines/base/tool-instructions/`, and that is the path every shipped
 * group takes today. So on that path the fragment is the copy an agent reads, while
 * the upstream file it stands in for is never opened.
 *
 * That asymmetry has two failure modes, and both are silent without this file:
 * upstream edits a module's prose and our substitute keeps saying the old thing;
 * or upstream adds a seventh module file and nothing stands in for it.
 *
 * Hence the assertions run over the upstream files: the inventory comes from disk,
 * and each entry pins a digest. A digest cannot prove our fragment still SAYS the
 * same thing — nothing mechanical can — so each entry also names the rules that
 * must survive on our side. Together they turn a divergence into a red check with
 * a filename attached, which is the difference between a decision and an omission.
 *
 * When one goes red: read `git log -p` on the upstream file, carry what changed
 * into the fragment(s) the entry names, then update the digest in the same commit.
 */
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { composeCoworkerSpine } from '../claude-composer.js';

const ROOT = process.cwd();
const UPSTREAM_DIR = path.join(ROOT, 'container', 'agent-runner', 'src', 'mcp-tools');
const FRAGMENT_DIR = path.join(ROOT, 'container', 'spines', 'base', 'tool-instructions');

interface Shadow {
  /** Fork fragments that stand in for this upstream file, relative to FRAGMENT_DIR. */
  fragments: string[];
  /** sha256 (first 16) of the upstream file as last reconciled. */
  digest: string;
  /** Why the shadow is adequate, or what is deliberately not carried. */
  note: string;
  /**
   * Rules that must appear in THIS entry's own fragments. Scoped per shadow because
   * a rule that migrates to an unrelated fragment has still left the surface an
   * agent reads for this tool.
   */
  rules?: string[];
}

const SHADOWS: Record<string, Shadow> = {
  'agents.instructions.md': {
    fragments: ['agents.md', 'wire-agents.md', '../context/chain-reporting.md'],
    digest: '3d7287cdebb6ac18',
    note:
      'Split three ways: wiring peers is a distinct decision from addressing them, and the ' +
      '`report_pr_created` rule lives with the chain contract it belongs to rather than with the ' +
      'tool list.',
    rules: ['report_pr_created'],
  },
  'cli.instructions.md': {
    fragments: ['ncl-group.md', 'ncl-global.md'],
    digest: '8fefc0066e15bb58',
    note: 'Deliberately scope-split: a group-scoped coworker is shown only what it can reach, which upstream does not distinguish. `ncl-group.md` is derived from `scopeField` by src/cli/group-scope-doc.test.ts.',
  },
  'core.instructions.md': {
    fragments: ['core.md'],
    digest: 'a9aee9ee19fc3b5c',
    note:
      'The destinations list comes from the runtime prompt, as upstream itself states. Upstream requires ' +
      'an explicit `to` on every call; the fork deliberately lets a single-destination agent omit it ' +
      '(`resolveRouting`), so `core.md` describes the fork behaviour rather than upstream prose.',
  },
  'interactive.instructions.md': {
    fragments: ['interactive.md'],
    digest: 'd7dfd5909b760125',
    note: 'Carries the action-validation and callback-button rules; adds that `send_card` has no `to:` and does not route across coworkers.',
    rules: [
      'never renders a callback button',
      'dropped before the card is sent',
      'Only top-level `actions`',
      '`timeout: 0`',
    ],
  },
  'scheduling.instructions.md': {
    fragments: ['scheduling.md'],
    digest: '9b2315059c307465',
    note:
      'Scheduling is `ncl tasks`; there is no scheduling MCP module in the barrel. Per-task delivery ' +
      'and run-log contract arrives with the task prompt, not the spine. The upstream file carries a ' +
      'local correction: its `--process-after "tomorrow 18:00"` example is rejected by ' +
      '`parseProcessAfter`, and that file is emitted verbatim for a provider that owns its surfaces, ' +
      'so leaving it would ship a command that cannot run.',
    rules: ['ncl tasks create', '--script', 'fresh session'],
  },
  'self-mod.instructions.md': {
    fragments: ['self-mod.md'],
    digest: '760305a39e7ef14d',
    note: 'Carries the remote-URL rules and the `onecli-managed` literal; adds rebuild-vs-restart semantics upstream lacks.',
    rules: [
      'host.docker.internal',
      'credential-looking query parameter',
      '`"onecli-managed"`',
      'never invent credential setup steps',
    ],
  },
};

/**
 * Shadows whose fragments only `main` binds. Non-flat types reach the same nuance
 * through `base-nanoclaw`, so both surfaces must carry the same rules.
 */
const MAIN_ONLY_SHADOWS: readonly string[] = [
  'interactive.instructions.md',
  'self-mod.instructions.md',
  'scheduling.instructions.md',
];

function upstreamFiles(): string[] {
  return fs
    .readdirSync(UPSTREAM_DIR)
    .filter((f) => f.endsWith('.instructions.md'))
    .sort();
}

function digest(file: string): string {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex').slice(0, 16);
}

describe('upstream tool-instruction surface', () => {
  const files = upstreamFiles();

  it('finds the upstream files — an empty read must not pass vacuously', () => {
    // A moved or renamed upstream directory would otherwise satisfy every
    // assertion below by having nothing to check.
    expect(files.length).toBeGreaterThan(4);
  });

  it('declares a shadow for every upstream file, and shadows nothing that is gone', () => {
    expect(files).toEqual(Object.keys(SHADOWS).sort());
  });

  it('names fragments that exist', () => {
    for (const [name, shadow] of Object.entries(SHADOWS)) {
      expect(shadow.fragments.length, `${name} declares no fragment`).toBeGreaterThan(0);
      for (const fragment of shadow.fragments) {
        expect(fs.existsSync(path.join(FRAGMENT_DIR, fragment)), `${name} → missing ${fragment}`).toBe(true);
      }
      expect(shadow.note.length, `${name} needs a note saying why the shadow is adequate`).toBeGreaterThan(20);
    }
  });

  it('matches the digest each shadow was reconciled against', () => {
    const actual: Record<string, string> = {};
    const recorded: Record<string, string> = {};
    for (const name of files) {
      actual[name] = digest(path.join(UPSTREAM_DIR, name));
      recorded[name] = SHADOWS[name].digest;
    }
    expect(
      actual,
      'An upstream module instruction file changed. Read its diff, carry what changed into the ' +
        'fragment(s) this entry names, then update the digest in the same commit — our fragment is ' +
        'the copy an agent reads on the spine-composed path.',
    ).toEqual(recorded);
  });

  it("keeps each shadow's load-bearing rules in that shadow's own fragments", () => {
    let checked = 0;
    for (const [name, shadow] of Object.entries(SHADOWS)) {
      if (!shadow.rules) continue;
      const text = shadow.fragments.map((f) => fs.readFileSync(path.join(FRAGMENT_DIR, f), 'utf-8')).join('\n');
      for (const rule of shadow.rules) {
        expect(text.includes(rule), `${name} → ${shadow.fragments.join(', ')} no longer states "${rule}"`).toBe(true);
        checked++;
      }
    }
    // Every rule list emptied out would otherwise leave this passing on nothing.
    expect(checked).toBeGreaterThan(6);
  });

  it('reaches typed coworkers too, not only the fragments `main` binds', () => {
    // `self-mod.md` and `interactive.md` are bound by `main.context` alone; non-flat
    // types reach the same nuance through the `base-nanoclaw` skill body. Both
    // surfaces therefore have to carry every rule, or the rule holds for one kind of
    // coworker and not the other.
    const skill = fs.readFileSync(path.join(ROOT, 'container', 'skills', 'base-nanoclaw', 'SKILL.md'), 'utf-8');
    // Every main-only shadow, scheduling included: `scheduling.md` is bound by
    // `main.context` alone too, so the skill is the only place a typed coworker
    // learns that tasks are `ncl tasks`.
    const required = MAIN_ONLY_SHADOWS.flatMap((name) => SHADOWS[name].rules ?? []);
    expect(required.length).toBeGreaterThan(6);
    for (const rule of required) {
      expect(skill.includes(rule), `base-nanoclaw/SKILL.md does not state "${rule}"`).toBe(true);
    }
  });

  it('teaches no MCP tool the barrel does not register', () => {
    // Scheduling is `ncl tasks`; no scheduling MCP module is registered. A surface
    // naming a tool that does not exist sends every agent that reads it after
    // something it cannot call, and the tool list it sees will not contradict the
    // prose loudly enough to help.
    const barrel = fs.readFileSync(path.join(UPSTREAM_DIR, 'index.ts'), 'utf-8');
    // Fragments AND skill bodies: a phantom tool in `base-nanoclaw` reaches every
    // non-flat coworker, so a guard over the spine alone leaves the larger surface
    // unchecked.
    const surfaces = [
      ...new Set(Object.values(SHADOWS).flatMap((s) => s.fragments)).values(),
      '../identity/main-body.md',
      '../context/invocation.md',
      '../../../skills/base-nanoclaw/SKILL.md',
      '../../../skills/learnings-wiki/SKILL.md',
      '../../../skills/supervise-issues/SKILL.md',
    ];
    for (const tool of ['schedule_task', 'list_tasks', 'update_task', 'cancel_task', 'pause_task', 'resume_task']) {
      expect(barrel.includes('scheduling'), 'a scheduling module appeared — revisit this list').toBe(false);
      for (const fragment of surfaces) {
        const text = fs.readFileSync(path.join(FRAGMENT_DIR, fragment), 'utf-8');
        expect(text.includes(tool), `${fragment} names \`${tool}\`, which no MCP module registers`).toBe(false);
      }
    }
  });

  it('states the task-verb approval exception on both ncl surfaces', () => {
    // Task verbs are `access: 'open'` (`src/cli/resources/tasks.ts`), unlike the rest
    // of the mutating surface. Asserted per file, not over the shadow's fragments
    // together: a group-scoped agent and a global one read different documents, and
    // either could otherwise satisfy this on the other's behalf.
    const stated: Record<string, string> = {
      'ncl-group.md': '`update` needs human approval; task mutations do not.',
      'ncl-global.md': 'except `tasks`, whose verbs are all open',
    };
    for (const [fragment, literal] of Object.entries(stated)) {
      const text = fs.readFileSync(path.join(FRAGMENT_DIR, fragment), 'utf-8');
      expect(text.includes(literal), `${fragment} no longer states: ${literal}`).toBe(true);
    }
  });

  it('withholds the scheduling section from a group with no CLI access', () => {
    // Scheduling IS the CLI: `ncl tasks` is the whole surface and no MCP tool stands
    // behind it, so at `cli_scope: disabled` — where the dispatcher rejects every
    // request — the section would describe an operation the agent cannot perform.
    // Checked on both render paths because they assemble context differently.
    for (const coworkerType of ['default', 'main']) {
      const disabled = composeCoworkerSpine({ coworkerType, cliScope: 'disabled', projectRoot: ROOT });
      expect(disabled, `${coworkerType} at cli_scope=disabled`).not.toContain('## Task scheduling');
      // Not just the heading: any `ncl tasks` guidance is an operation this agent
      // cannot perform, wherever it appears in the document.
      expect(disabled, `${coworkerType} at cli_scope=disabled names ncl tasks`).not.toContain('ncl tasks');

      const enabled = composeCoworkerSpine({ coworkerType, cliScope: 'global', projectRoot: ROOT });
      // Guard the guard: if the section stopped rendering at every scope, the
      // assertion above would pass for the wrong reason.
      expect(enabled.includes('## Task scheduling'), `${coworkerType} at cli_scope=global`).toBe(
        coworkerType === 'main',
      );
    }
  });
});
