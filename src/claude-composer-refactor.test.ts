// Refactor contract tests for the workflow/overlay/spine migration.
//
// These tests pin the behaviors the refactor introduced. They use temp-dir
// fixtures (same pattern as claude-composer.test.ts) so they are hermetic —
// no project-specific content is hardcoded, and they pass whether or not
// sibling branches are merged.
//
// Coverage map:
//   R01 full workflow step body embedded in composed CLAUDE.md
//   R02 overlay body inlined at each anchor as `⟐ NAME GATE` block
//   R03 extends + override: child override text replaces parent step body
//   R04 container/skills/ holds no WORKFLOW.md/OVERLAY.md (real repo state)
//   R05 no `type: workflow` or `type: overlay` in container/skills/ SKILL.md
//   R06 container/spines/*/coworker-types.yaml uses container/spines/* paths
//   R07 rebuild idempotency (same compose twice = byte-identical)
//   R08 overlay body headings demoted below the `####` gate header
//   R09 trailing "## Gates" section is gone (bodies are inline)
//   R10 "## How to Work" lists every workflow (no category dedup)
//   R11 mount/copy destinations contain only container/skills/ + overlay agent.md
//   R12 backticked `/workflow` refs inside bodies rewritten to section refs;
//       `/overlay` refs rewritten to Task subagent pointer;
//       capability skill slash commands left literal
//   R13 every real on-disk WORKFLOW.md parses to ≥1 step OR declares extends
//       (catches the silent-empty-body failure mode where a wrong step format
//       causes the parser to drop the entire workflow body)

import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { composeCoworkerSpine, readCoworkerTypes, readSkillCatalog } from './claude-composer.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
  tempDirs.length = 0;
});

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-refactor-'));
  tempDirs.push(dir);
  return dir;
}

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function writeSpineBase(root: string): void {
  write(path.join(root, 'container', 'spines', 'base', 'invariants', 'safety.md'), '- Do not ship broken code.');
  write(
    path.join(root, 'container', 'spines', 'base', 'coworker-types.yaml'),
    [
      'base-common:',
      '  description: "Test spine."',
      '  invariants:',
      '    - container/spines/base/invariants/safety.md',
      '',
    ].join('\n'),
  );
}

function writeWorkflow(
  root: string,
  name: string,
  body: string,
  frontmatter: {
    description?: string;
    requires?: string[];
    extends?: string;
    overrides?: Record<string, string>;
  } = {},
): void {
  const fm = [
    '---',
    `name: ${name}`,
    'type: workflow',
    `description: "${frontmatter.description || `Test ${name} workflow.`}"`,
    `requires: ${JSON.stringify(frontmatter.requires || [])}`,
    'uses:',
    '  skills: []',
    '  workflows: []',
    ...(frontmatter.extends ? [`extends: ${frontmatter.extends}`] : []),
    ...(frontmatter.overrides
      ? ['overrides:', ...Object.entries(frontmatter.overrides).map(([id, text]) => `  ${id}: ${JSON.stringify(text)}`)]
      : []),
    '---',
    '',
    body,
  ].join('\n');
  write(path.join(root, 'container', 'workflows', name, 'WORKFLOW.md'), fm);
}

function writeOverlay(
  root: string,
  name: string,
  body: string,
  frontmatter: {
    appliesToWorkflows?: string[];
    insertAfter?: string[];
    insertBefore?: string[];
  } = {},
): void {
  const fm = [
    '---',
    `name: ${name}`,
    'type: overlay',
    `description: "Test ${name} overlay."`,
    'applies-to:',
    `  workflows: ${JSON.stringify(frontmatter.appliesToWorkflows || [])}`,
    '  traits: []',
    `insert-after: ${JSON.stringify(frontmatter.insertAfter || [])}`,
    `insert-before: ${JSON.stringify(frontmatter.insertBefore || [])}`,
    'uses:',
    '  skills: []',
    '---',
    '',
    body,
  ].join('\n');
  write(path.join(root, 'container', 'overlays', name, 'OVERLAY.md'), fm);
}

function writeCapabilitySkill(root: string, name: string, description: string): void {
  const fm = [
    '---',
    `name: ${name}`,
    'type: capability',
    `description: "${description}"`,
    'provides: [probe.act]',
    '---',
    '',
    `Body for ${name}.`,
  ].join('\n');
  write(path.join(root, 'container', 'skills', name, 'SKILL.md'), fm);
}

function writeProjectType(root: string, yaml: string): void {
  write(path.join(root, 'container', 'spines', 'project', 'coworker-types.yaml'), yaml);
}

// --- Fixture-based behavioral tests ---

describe('R01: composed CLAUDE.md contains full workflow step body', () => {
  it('emits each step body, not just the step id', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'triage',
      [
        '# Triage',
        '',
        '## Steps',
        '',
        '1. **Ingest** {#ingest} — DISTINCTIVE_INGEST_PHRASE read target.',
        '',
        '2. **Classify** {#classify} — DISTINCTIVE_CLASSIFY_PHRASE decide type.',
        '',
      ].join('\n'),
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [triage]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('DISTINCTIVE_INGEST_PHRASE');
    expect(spine).toContain('DISTINCTIVE_CLASSIFY_PHRASE');
  });
});

describe('R02: overlay body inlined at anchor', () => {
  it('renders a `⟐ NAME GATE (position `stepId`)` block at each anchor', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'build', '# Build\n\n## Steps\n\n1. **Do** {#do} — thing.\n');
    writeOverlay(root, 'guard', 'SENTINEL_GUARD_BODY', {
      appliesToWorkflows: ['build'],
      insertAfter: ['do'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [build]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ GUARD GATE \(after `do`\)/);
    expect(spine).toContain('SENTINEL_GUARD_BODY');
  });
});

describe('R03: extends + overrides replace parent step body', () => {
  it('override text replaces parent body for matching step id; inherited steps keep parent body', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'parent-flow',
      [
        '# Parent',
        '',
        '## Steps',
        '',
        '1. **Reproduce** {#reproduce} — PARENT_REPRODUCE_BODY.',
        '',
        '2. **Patch** {#patch} — PARENT_PATCH_BODY.',
        '',
      ].join('\n'),
    );
    writeWorkflow(root, 'child-flow', '', {
      extends: 'parent-flow',
      overrides: { patch: 'CHILD_PATCH_OVERRIDE.' },
    });
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [child-flow]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('PARENT_REPRODUCE_BODY');
    expect(spine).toContain('CHILD_PATCH_OVERRIDE');
    expect(spine).not.toContain('PARENT_PATCH_BODY');
  });
});

describe('R07: rebuild idempotency', () => {
  it('composing the same type twice is byte-identical', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'flow', '# F\n\n## Steps\n\n1. **A** {#a} — hi.');
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [flow]\n');
    const a = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    const b = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(a).toBe(b);
  });
});

describe('R08: overlay body headings demoted below gate header', () => {
  it('source `## Foo` renders as `#####` or deeper inside the gate block', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'flow', '# F\n\n## Steps\n\n1. **A** {#a} — hi.');
    writeOverlay(root, 'guard', ['BODY_PREAMBLE.', '', '## Subheading One', '', 'Subheading body.'].join('\n'), {
      appliesToWorkflows: ['flow'],
      insertAfter: ['a'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/^##### Subheading One\s*$/m);
    expect(spine).not.toMatch(/^## Subheading One\s*$/m);
  });
});

describe('R09: trailing "## Gates" section is gone', () => {
  it('spine does not emit a standalone Gates section (bodies inline now)', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'flow', '# F\n\n## Steps\n\n1. **A** {#a} — hi.');
    writeOverlay(root, 'guard', 'body', { appliesToWorkflows: ['flow'], insertAfter: ['a'] });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).not.toMatch(/\n## Gates\b/);
  });
});

describe('R10: "## How to Work" lists every workflow (no category dedup)', () => {
  it('two workflows sharing a category are both rendered', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeCapabilitySkill(root, 'repo-reader', 'Read repo.');
    // Tweak the skill's `provides` to expose `repo.read` so the trait-binding
    // check passes for our fixture workflows.
    fs.writeFileSync(
      path.join(root, 'container', 'skills', 'repo-reader', 'SKILL.md'),
      [
        '---',
        'name: repo-reader',
        'type: capability',
        'description: "Read repo."',
        'provides: [repo.read]',
        '---',
        '',
        'Body.',
      ].join('\n'),
    );
    writeWorkflow(root, 'alpha-flow', '# A\n\n## Steps\n\n1. **A** {#a} — x.', {
      requires: ['repo.read'],
    });
    writeWorkflow(root, 'beta-flow', '# B\n\n## Steps\n\n1. **B** {#b} — y.', {
      requires: ['repo.read'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [alpha-flow, beta-flow]',
        '  skills: [repo-reader]',
        '  bindings:',
        '    repo: repo-reader',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    const howStart = spine.indexOf('## How to Work');
    const howEnd = spine.indexOf('\n## ', howStart + 1);
    const how = spine.slice(howStart, howEnd === -1 ? undefined : howEnd);
    expect(how).toContain('alpha-flow');
    expect(how).toContain('beta-flow');
  });
});

describe('R12: backticked slash refs in bodies are rewritten by kind', () => {
  it('workflow ref → section pointer; overlay ref → Task subagent pointer; skill ref → left literal', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'alpha',
      [
        '# Alpha',
        '',
        '## Steps',
        '',
        '1. **Do** {#do} — first run `/beta` workflow, then invoke `/gamma-skill`, then spawn `/delta-overlay`.',
      ].join('\n'),
    );
    writeWorkflow(root, 'beta', '# Beta\n\n## Steps\n\n1. **B** {#b} — x.');
    writeCapabilitySkill(root, 'gamma-skill', 'Do gamma.');
    writeOverlay(root, 'delta-overlay', 'delta body', {
      appliesToWorkflows: [],
      insertAfter: [],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [alpha, beta]',
        '  skills: [gamma-skill]',
        '  overlays: [delta-overlay]',
        '  bindings:',
        '    probe: gamma-skill',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    // Workflow ref in step body rewritten to section pointer. (Route lines
    // in "## How to Work" intentionally still use `/beta` to read naturally
    // as "General task → `/beta` workflow".)
    expect(spine).toContain('the **beta** workflow section below');
    // Overlay ref rewritten to Task subagent
    expect(spine).toContain('the **delta-overlay** subagent (spawn via the Task tool)');
    // Capability skill slash command left literal
    expect(spine).toMatch(/`\/gamma-skill`/);
  });

  it('leaves slash-prefixed paths inside code fences untouched', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'alpha',
      [
        '# Alpha',
        '',
        '## Steps',
        '',
        '1. **Do** {#do} — run:',
        '```bash',
        'mkdir -p /workspace/agent/plans',
        '```',
      ].join('\n'),
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [alpha]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('/workspace/agent/plans');
  });
});

describe('R13: unresolved template placeholders rewritten to angle-bracket form', () => {
  it('replaces {{target}} / {{report.path}} / {{target_slug}} with <name> form inside workflow bodies', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'research',
      [
        '# Research',
        '',
        '## Steps',
        '',
        '1. **Ingest** {#ingest} — read {{target}} and open {{report.path}} (slug {{target_slug}}).',
      ].join('\n'),
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [research]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('<target>');
    expect(spine).toContain('<report.path>');
    expect(spine).toContain('<target_slug>');
    const workflowsStart = spine.indexOf('## Workflows');
    const workflowsSection = workflowsStart === -1 ? '' : spine.slice(workflowsStart);
    expect(workflowsSection).not.toMatch(/\{\{\s*target\s*\}\}/);
    expect(workflowsSection).not.toMatch(/\{\{\s*report\.path\s*\}\}/);
    expect(workflowsSection).not.toMatch(/\{\{\s*target_slug\s*\}\}/);
  });
});

describe('R14: placeholders inside fenced code blocks are left untouched', () => {
  it('leaves {{NOT_A_TEMPLATE}} inside ``` fences as-is', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      [
        '# F',
        '',
        '## Steps',
        '',
        '1. **Do** {#do} — here is a literal example:',
        '```text',
        'echo "{{NOT_A_TEMPLATE}}"',
        '```',
      ].join('\n'),
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [flow]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('{{NOT_A_TEMPLATE}}');
    expect(spine).not.toContain('<NOT_A_TEMPLATE>');
  });
});

describe('R15: unbackticked /workflow refs in prose are rewritten to section pointer', () => {
  it('rewrites `Use /alpha workflow` (no backticks) when alpha is a workflow', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'entry',
      ['# Entry', '', '## Steps', '', '1. **Do** {#do} — Use /alpha workflow for navigation, then continue.'].join(
        '\n',
      ),
    );
    writeWorkflow(root, 'alpha', '# Alpha\n\n## Steps\n\n1. **A** {#a} — x.');
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [entry, alpha]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('Use the **alpha** workflow section below');
    expect(spine).not.toMatch(/\sUse \/alpha workflow/);
  });
});

describe('R16: unbackticked /skill refs (capability skills) are left literal', () => {
  it('does not rewrite /gamma-skill when gamma-skill is a capability skill', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'entry',
      ['# Entry', '', '## Steps', '', '1. **Do** {#do} — Run /gamma-skill to handle the probe.'].join('\n'),
    );
    writeCapabilitySkill(root, 'gamma-skill', 'Do gamma.');
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [entry]',
        '  skills: [gamma-skill]',
        '  bindings:',
        '    probe: gamma-skill',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('/gamma-skill');
    expect(spine).not.toContain('the **gamma-skill** workflow section below');
    expect(spine).not.toContain('the **gamma-skill** subagent');
  });
});

describe('R17: path-like /foo/bar refs in prose are untouched', () => {
  it('leaves `/workspace/agent/plans/` intact even when a workflow named `agent` exists', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      ['# F', '', '## Steps', '', '1. **Do** {#do} — outputs land in /workspace/agent/plans/ before exit.'].join('\n'),
    );
    writeWorkflow(root, 'agent', '# Agent\n\n## Steps\n\n1. **A** {#a} — x.');
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [flow, agent]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toContain('/workspace/agent/plans/');
    expect(spine).not.toContain('/workspacethe **agent** workflow section below');
    expect(spine).not.toContain('workspacethe **agent**');
  });
});

// --- Repo-state invariants (run against real repo) ---

const REPO_ROOT = process.cwd();

describe('R04: container/skills/ holds no WORKFLOW.md or OVERLAY.md', () => {
  it('no workflow/overlay files live under container/skills/', () => {
    const skillsDir = path.join(REPO_ROOT, 'container', 'skills');
    if (!fs.existsSync(skillsDir)) return;
    for (const d of fs.readdirSync(skillsDir)) {
      expect(fs.existsSync(path.join(skillsDir, d, 'WORKFLOW.md')), `${d}/WORKFLOW.md`).toBe(false);
      expect(fs.existsSync(path.join(skillsDir, d, 'OVERLAY.md')), `${d}/OVERLAY.md`).toBe(false);
    }
  });
});

describe('R05: no `type: workflow|overlay` in container/skills/*/SKILL.md', () => {
  it('capability-skill dirs stay capability', () => {
    const skillsDir = path.join(REPO_ROOT, 'container', 'skills');
    if (!fs.existsSync(skillsDir)) return;
    for (const d of fs.readdirSync(skillsDir)) {
      const skillMd = path.join(skillsDir, d, 'SKILL.md');
      if (!fs.existsSync(skillMd)) continue;
      const fm = fs.readFileSync(skillMd, 'utf-8').match(/^---\n([\s\S]*?)\n---/);
      if (!fm) continue;
      expect(/^type:\s*(workflow|overlay)\s*$/m.test(fm[1]), `${d} has wrong type`).toBe(false);
    }
  });
});

describe('R06: every spine YAML uses container/spines/* paths', () => {
  it('no legacy container/skills/spine-* references inside container/spines/*/coworker-types.yaml', () => {
    const spinesDir = path.join(REPO_ROOT, 'container', 'spines');
    if (!fs.existsSync(spinesDir)) return;
    for (const d of fs.readdirSync(spinesDir)) {
      const yamlPath = path.join(spinesDir, d, 'coworker-types.yaml');
      if (!fs.existsSync(yamlPath)) continue;
      const text = fs.readFileSync(yamlPath, 'utf-8');
      expect(text, `${d} yaml`).not.toMatch(/container\/skills\/spine-/);
    }
  });
});

describe('R11: mount/copy code does not pull workflows or overlay bodies into containers', () => {
  // The refactor invariant: only container/skills/ (capability skills) and
  // overlay agent.md (subagent defs) are copied to .claude-shared. Workflow
  // bodies, overlay OVERLAY.md, and spine fragments are compose-time only.
  it('group-init.ts does not copy container/workflows/ or container/spines/', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'group-init.ts'), 'utf-8');
    // Allowed source roots for runtime copy are container/skills and container/overlays (for agent.md).
    expect(src).not.toMatch(/container['"]\s*,\s*['"]workflows/);
    expect(src).not.toMatch(/container['"]\s*,\s*['"]spines/);
  });

  it('group-init.ts overlay scan never copies an OVERLAY.md body', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'group-init.ts'), 'utf-8');
    // Strip single-line `//` comments so commentary mentioning "OVERLAY.md"
    // doesn't false-positive. We only care whether OVERLAY.md appears inside
    // executable code (e.g. a `copyFileSync` / `readFileSync` call).
    const code = src.replace(/\/\/.*$/gm, '').replace(/\/\*[\s\S]*?\*\//g, '');
    expect(code).not.toContain('OVERLAY.md');
  });

  it('container-runner.ts does not bind-mount container/workflows or container/spines into the container', () => {
    const src = fs.readFileSync(path.join(REPO_ROOT, 'src', 'container-runner.ts'), 'utf-8');
    // Only specific containerPath strings are mounted; ensure workflows/spines
    // are never used as host paths for a mount entry.
    const mountBlocks = src.split(/mounts\.push\(/).slice(1);
    for (const block of mountBlocks) {
      const hostPath = block.match(/hostPath:\s*([^,\n]+)/);
      if (!hostPath) continue;
      expect(hostPath[1]).not.toMatch(/container\/workflows/);
      expect(hostPath[1]).not.toMatch(/container\/spines/);
    }
  });
});

describe('R18: composing every non-abstract coworker type emits zero "Unknown slash ref" warnings', () => {
  // Any such warning means a workflow/overlay body references a `/name` that
  // doesn't resolve to a workflow, overlay, or capability skill in the leaf
  // catalog — an instruction-quality bug (the agent is told to invoke a
  // non-existent slash command). This test treats every warning as a failure.
  //
  // Types without `invariants` or with an empty `workflows` list are treated
  // as abstract / incomplete and skipped — only concrete leaf types compose.
  it('no warnings from any concrete leaf type discovered under container/spines/', () => {
    const types = readCoworkerTypes(REPO_ROOT);
    const leafNames = Object.entries(types)
      .filter(([, t]) => Array.isArray(t.workflows) && t.workflows.length > 0)
      .map(([name]) => name);
    // nv-main alone has no leaf types (only abstract `base-common`); the
    // assertion fires on nv-coworkers integration where project leaves exist.
    if (leafNames.length === 0) return;

    const originalWarn = console.warn;
    const warnings: string[] = [];
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };
    try {
      for (const type of leafNames) {
        composeCoworkerSpine({ coworkerType: type, projectRoot: REPO_ROOT });
      }
    } finally {
      console.warn = originalWarn;
    }
    const unknownSlash = warnings.filter((w) => /\[composer\] Unknown slash ref/.test(w));
    expect(unknownSlash, `composer warnings:\n${unknownSlash.join('\n')}`).toEqual([]);
  });
});

describe('R13: every real WORKFLOW.md parses to ≥1 step (or declares extends)', () => {
  // The composer's step parser (src/claude-composer/registry.ts) only matches
  // numbered-list step headers shaped `N. **Title** {#id}`. Workflows that use
  // `## Step N: TITLE` H2 headers, `#### N. Title` H4 headers, or any other
  // shape silently produce steps=[], stepBodies={}, and renderCoworkerSpine
  // emits the description with no body. This is a recurring foot-gun (4
  // workflows shipped broken before this test landed) so we pin it.
  //
  // Workflows that declare `extends: <parent>` legitimately inherit step
  // structure from a parent and may have an empty own-body — those are exempt.
  it('on-disk workflows produce non-empty step parses', () => {
    const workflowsDir = path.join(REPO_ROOT, 'container', 'workflows');
    if (!fs.existsSync(workflowsDir)) return;

    const catalog = readSkillCatalog(REPO_ROOT);
    const broken: Array<{ name: string; reason: string }> = [];
    for (const meta of Object.values(catalog)) {
      if (meta.type !== 'workflow') continue;
      if (meta.extendsWorkflow) continue;
      if (meta.steps.length === 0) {
        broken.push({
          name: meta.name,
          reason: `${meta.path} parsed to zero steps`,
        });
        continue;
      }
      const totalBody = Object.values(meta.stepBodies).reduce((acc, b) => acc + b.length, 0);
      // 100 chars is a generous floor — any workflow with real procedural
      // content easily clears it. The previous broken slang workflows had
      // 200+ lines of body that the parser dropped to 0 chars.
      if (totalBody < 100) {
        broken.push({
          name: meta.name,
          reason: `${meta.path} parses to ${meta.steps.length} step(s) but stepBodies sum to only ${totalBody} chars (likely the parser captured headers but not body content)`,
        });
      }
    }

    expect(
      broken,
      broken.length === 0
        ? ''
        : `Workflow body silently dropped — fix step format to \`N. **Title** {#id}\`:\n` +
            broken.map((b) => `  - ${b.name}: ${b.reason}`).join('\n'),
    ).toEqual([]);
  });
});

describe('R20: overlay matching follows workflow `extends:` chain transitively', () => {
  // The naive matcher checked only the workflow's direct name and one-level
  // extends. That left transitive children (`slang-fix-issue → implement →
  // base`) skipping cross-cutting overlays whose `applies-to.workflows` lists
  // a transitive ancestor. The fix walks the full extends chain when matching.
  it('overlay targeting `base-flow` attaches to a grandchild that extends an intermediate', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    // Three-tier chain: base-flow ← mid-flow ← leaf-flow.
    writeWorkflow(root, 'base-flow', '# B\n\n## Steps\n\n1. **Anchor** {#anchor} — base-body.');
    writeWorkflow(root, 'mid-flow', '', { extends: 'base-flow' });
    writeWorkflow(root, 'leaf-flow', '# L\n\n## Steps\n\n1. **Custom** {#custom} — leaf-body.', {
      extends: 'mid-flow',
    });
    writeOverlay(root, 'guard', 'TRANSITIVE_GATE_BODY', {
      appliesToWorkflows: ['base-flow'],
      insertAfter: ['custom'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [leaf-flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    // Gate must land inside leaf-flow's section even though it only extends
    // base-flow transitively (via mid-flow).
    const leafStart = spine.indexOf('### /leaf-flow');
    expect(leafStart).toBeGreaterThanOrEqual(0);
    const leafEnd = spine.indexOf('\n## ', leafStart);
    const leafSection = spine.slice(leafStart, leafEnd === -1 ? undefined : leafEnd);
    expect(leafSection).toMatch(/⟐ GUARD GATE/);
    expect(leafSection).toContain('TRANSITIVE_GATE_BODY');
  });

  it('runtime-injected overlays also follow the chain', () => {
    // Same shape but the overlay attaches via agent_groups.overlays at
    // compose time (the path slang-fixer / slang-triage actually take).
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'base-flow', '# B\n\n## Steps\n\n1. **Anchor** {#anchor} — base-body.');
    writeWorkflow(root, 'leaf-flow', '# L\n\n## Steps\n\n1. **Custom** {#custom} — leaf-body.', {
      extends: 'base-flow',
    });
    writeOverlay(root, 'runtime-guard', 'RUNTIME_TRANSITIVE_BODY', {
      appliesToWorkflows: ['base-flow'],
      insertAfter: ['custom'],
    });
    writeProjectType(
      root,
      ['probe:', '  extends: base-common', '  description: "Probe."', '  workflows: [leaf-flow]', ''].join('\n'),
    );
    const spine = composeCoworkerSpine({
      projectRoot: root,
      coworkerType: 'probe',
      overlays: ['runtime-guard'],
    });
    expect(spine).toMatch(/⟐ RUNTIME GUARD GATE/);
    expect(spine).toContain('RUNTIME_TRANSITIVE_BODY');
  });
});

describe('R21: implicit `extends: base` for workflows omitting extends:', () => {
  // Phase 2 contract. When a `base` workflow ships in the catalog, every
  // workflow that didn't explicitly opt in or out of extends inherits from
  // `base`. Combined with R20's chain-walking matcher, an overlay declaring
  // `applies-to.workflows: [base]` reaches every implicit-base workflow.
  function writeBaseWorkflow(root: string): void {
    writeWorkflow(root, 'base', '# Base\n\n## Steps\n\n1. **Anchor** {#anchor} — base-body.');
  }

  it('workflow with no extends: matches an overlay targeting [base]', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeBaseWorkflow(root);
    // `flow` declares no `extends:` — picks up implicit base parent.
    writeWorkflow(root, 'flow', '# F\n\n## Steps\n\n1. **Custom** {#custom} — flow-body.');
    writeOverlay(root, 'guard', 'IMPLICIT_BASE_GATE_BODY', {
      appliesToWorkflows: ['base'],
      insertAfter: ['custom'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ GUARD GATE/);
    expect(spine).toContain('IMPLICIT_BASE_GATE_BODY');
  });

  it('`extends: none` opts out — overlay targeting [base] does NOT attach', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeBaseWorkflow(root);
    // Hand-written WORKFLOW.md so `extends: none` lands literally — the
    // helper treats undefined and "none" the same upstream and we need the
    // explicit token here.
    write(
      path.join(root, 'container', 'workflows', 'opt-out', 'WORKFLOW.md'),
      [
        '---',
        'name: opt-out',
        'type: workflow',
        'description: "Opted out."',
        'requires: []',
        'uses:',
        '  skills: []',
        '  workflows: []',
        'extends: none',
        '---',
        '',
        '# Opt-out',
        '',
        '## Steps',
        '',
        '1. **Custom** {#custom} — flow-body that should not get the gate.',
      ].join('\n'),
    );
    writeOverlay(root, 'guard', 'OPTED_OUT_GATE_BODY', {
      appliesToWorkflows: ['base'],
      insertAfter: ['custom'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [opt-out]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).not.toMatch(/⟐ GUARD GATE/);
    expect(spine).not.toContain('OPTED_OUT_GATE_BODY');
  });

  it('transitive: overlay targeting [base] reaches a grandchild via a named intermediate', () => {
    // mid-flow extends nothing → implicit base. leaf-flow extends mid-flow
    // explicitly. Chain becomes leaf → mid → base. Phase 1's chain matcher
    // (R20) should find the implicit base ancestor.
    const root = makeTempProject();
    writeSpineBase(root);
    writeBaseWorkflow(root);
    writeWorkflow(root, 'mid-flow', '# M\n\n## Steps\n\n1. **MStep** {#mstep} — mid-body.');
    writeWorkflow(root, 'leaf-flow', '# L\n\n## Steps\n\n1. **Custom** {#custom} — leaf-body.', {
      extends: 'mid-flow',
    });
    writeOverlay(root, 'guard', 'TRANSITIVE_IMPLICIT_BODY', {
      appliesToWorkflows: ['base'],
      insertAfter: ['custom'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [leaf-flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ GUARD GATE/);
    expect(spine).toContain('TRANSITIVE_IMPLICIT_BODY');
  });

  it('no-base catalog → implicit extends is a no-op (pre-Phase-2 fixtures unchanged)', () => {
    // When no `base/WORKFLOW.md` exists, the post-pass shouldn't fill in
    // anything. Old fixtures keep their pre-Phase-2 shape.
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'solo-flow', '# S\n\n## Steps\n\n1. **Custom** {#custom} — solo-body.');
    writeProjectType(
      root,
      ['probe:', '  extends: base-common', '  description: "Probe."', '  workflows: [solo-flow]', ''].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).not.toMatch(/extends \/base/);
  });

  it('does not render a phantom "(extends /base—see section below)" pointer when base is implicit', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeBaseWorkflow(root);
    writeWorkflow(root, 'flow', '# F\n\n## Steps\n\n1. **Custom** {#custom} — flow-body.');
    writeProjectType(
      root,
      ['probe:', '  extends: base-common', '  description: "Probe."', '  workflows: [flow]', ''].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    // /flow's section header should not include the implicit-base pointer.
    expect(spine).not.toMatch(/\/flow[^\n]*\(extends \/base/);
  });
});

describe('R22: trait-based union matching + `applies-to.start: true` mode', () => {
  // Phase 3 contract:
  //   1. Overlay matching is a UNION of name-based and trait-based — either
  //      gets the overlay attached to the workflow.
  //   2. `applies-to.start: true` — splice the overlay body at the start of
  //      every matched workflow's body, before step 1. Coexists with named
  //      anchors (an overlay can declare both).
  function writeStartOverlay(
    root: string,
    name: string,
    body: string,
    fm: { appliesToWorkflows?: string[]; appliesToTraits?: string[]; insertAfter?: string[] },
  ): void {
    const text = [
      '---',
      `name: ${name}`,
      'type: overlay',
      `description: "Test ${name} overlay."`,
      'applies-to:',
      `  workflows: ${JSON.stringify(fm.appliesToWorkflows || [])}`,
      `  traits: ${JSON.stringify(fm.appliesToTraits || [])}`,
      '  start: true',
      `insert-after: ${JSON.stringify(fm.insertAfter || [])}`,
      `insert-before: []`,
      'uses:',
      '  skills: []',
      '---',
      '',
      body,
    ].join('\n');
    write(path.join(root, 'container', 'overlays', name, 'OVERLAY.md'), text);
  }

  it('union: trait match attaches an overlay even when the workflow name is not listed', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeCapabilitySkill(root, 'editor', 'Edit code.');
    fs.writeFileSync(
      path.join(root, 'container', 'skills', 'editor', 'SKILL.md'),
      [
        '---',
        'name: editor',
        'type: capability',
        'description: "Edit."',
        'provides: [code.edit]',
        '---',
        '',
        'Body.',
      ].join('\n'),
    );
    writeWorkflow(root, 'project-flow', '# P\n\n## Steps\n\n1. **Custom** {#custom} — edit a thing.', {
      requires: ['code.edit'],
    });
    writeOverlay(root, 'guard', 'TRAIT_UNION_BODY', {
      // No workflow name listed — match relies on trait union.
      appliesToWorkflows: [],
      insertAfter: ['custom'],
    });
    // Tweak the overlay's traits to match `code.edit`.
    const overlayPath = path.join(root, 'container', 'overlays', 'guard', 'OVERLAY.md');
    const txt = fs.readFileSync(overlayPath, 'utf-8').replace('  traits: []', '  traits: [code.edit]');
    fs.writeFileSync(overlayPath, txt);
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [project-flow]',
        '  skills: [editor]',
        '  overlays: [guard]',
        '  bindings:',
        '    code: editor',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ GUARD GATE/);
    expect(spine).toContain('TRAIT_UNION_BODY');
  });

  it('start: true alone splices the overlay body before step 1', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      '# F\n\n## Steps\n\n1. **First** {#first} — first-step.\n\n2. **Second** {#second} — second-step.',
    );
    writeStartOverlay(root, 'observer', 'OBSERVER_START_BODY', {
      appliesToWorkflows: ['flow'],
      // No insertAfter / insertBefore — purely a start splice.
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [observer]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ OBSERVER GATE \(at workflow start\)/);
    expect(spine).toContain('OBSERVER_START_BODY');
    // The start gate must land before step 1's heading.
    const wfStart = spine.indexOf('### /flow');
    const gateIdx = spine.indexOf('OBSERVER GATE', wfStart);
    const step1Idx = spine.indexOf('#### 1. First', wfStart);
    expect(gateIdx).toBeGreaterThanOrEqual(0);
    expect(step1Idx).toBeGreaterThanOrEqual(0);
    expect(gateIdx).toBeLessThan(step1Idx);
  });

  it('start: true coexists with named anchors — both render', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      '# F\n\n## Steps\n\n1. **First** {#first} — first-step.\n\n2. **Second** {#second} — second-step.',
    );
    writeStartOverlay(root, 'observer', 'OBSERVER_BOTH_BODY', {
      appliesToWorkflows: ['flow'],
      insertAfter: ['second'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [observer]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ OBSERVER GATE \(at workflow start\)/);
    expect(spine).toMatch(/⟐ OBSERVER GATE \(after `second`\)/);
    // Body emitted once at the first anchor (start); the second anchor
    // (after `second`) becomes a back-pointer per the existing dedup rule.
    expect((spine.match(/OBSERVER_BOTH_BODY/g) || []).length).toBe(1);
  });

  it('start: true with `applies-to.workflows: [base]` reaches every implicit-base workflow', () => {
    // Combines Phase 2 (implicit base) + Phase 3 (start mode). One overlay
    // declaration covers an arbitrary set of project workflows.
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'base', '# Base\n\n## Steps\n\n1. **A** {#a} — base-body.');
    writeWorkflow(root, 'flow-a', '# A\n\n## Steps\n\n1. **First** {#first} — a-body.');
    writeWorkflow(root, 'flow-b', '# B\n\n## Steps\n\n1. **First** {#first} — b-body.');
    writeStartOverlay(root, 'observer', 'CROSS_CUTTING_BODY', {
      appliesToWorkflows: ['base'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow-a, flow-b]',
        '  overlays: [observer]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    // Both workflows get a start gate.
    const matches = spine.match(/⟐ OBSERVER GATE \(at workflow start\)/g) || [];
    expect(matches.length).toBe(2);
  });
});

describe('R23: real overlays adopt the auto-attach shape', () => {
  // Phase 4 contract — assertions about the shipped buddy + critique
  // overlays' frontmatter plus end-to-end render checks that don't depend
  // on the slang/slangpy spines (which aren't shipped in nv-main alone).
  it('buddy-monitor declares applies-to.start: true and applies-to.workflows: [base]', () => {
    const buddyPath = path.join(REPO_ROOT, 'container', 'overlays', 'buddy-monitor', 'OVERLAY.md');
    if (!fs.existsSync(buddyPath)) return;
    const text = fs.readFileSync(buddyPath, 'utf-8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    expect(fm, 'buddy frontmatter').toMatch(/start:\s*true/);
    // After Phase 4, buddy targets [base] not [plan, implement] — combined
    // with the implicit-extends post-pass (R21), this reaches every
    // workflow that didn't opt out.
    expect(fm).toMatch(/workflows:\s*\[base\]/);
    // Named anchors are dropped — start mode is enough.
    expect(fm).toMatch(/insert-before:\s*\[\]/);
    expect(fm).toMatch(/insert-after:\s*\[\]/);
  });

  it('critique-overlay drops the workflow name list and relies on traits', () => {
    const critiquePath = path.join(REPO_ROOT, 'container', 'overlays', 'critique-overlay', 'OVERLAY.md');
    if (!fs.existsSync(critiquePath)) return;
    const text = fs.readFileSync(critiquePath, 'utf-8');
    const fm = text.match(/^---\n([\s\S]*?)\n---/)?.[1] ?? '';
    expect(fm).toMatch(/workflows:\s*\[\]/);
    expect(fm, 'trait list preserved').toMatch(/traits:\s*\[code\.edit,\s*test\.gen,\s*doc\.write\]/);
    // Anchor splices preserved — canonical stages with aliases so project
    // workflows using stage-specific ids (`implement`, `report`, etc.) still
    // get the inline gates. R24 covers the resolution behavior end-to-end.
    expect(fm).toMatch(/step:\s*diagnose/);
    expect(fm).toMatch(/step:\s*change/);
    expect(fm).toMatch(/step:\s*deliver/);
    expect(fm).toMatch(/aliases:\s*\[implement,\s*patch\]/);
  });

  // Removed in this PR: "writer-style workflows pick up critique-overlay
  // via trait union". The critique-overlay file was deleted as part of the
  // critique-gate refactor — there is no longer a shipped OVERLAY.md to
  // splice via traits. The trait-union activation pattern itself is still
  // covered by the next test (buddy-monitor via applies-to.workflows: [base]),
  // and the marker-based critique-gate is exercised in
  // src/gate-critique-on-deliver.test.ts.

  it('base-extending workflows pick up buddy-monitor at start', () => {
    // Uses the shipped buddy-monitor body against a synthetic base + project
    // workflow. Validates the Phase 4 shape end-to-end without slang spines.
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'base', '# Base\n\n## Steps\n\n1. **A** {#a} — base-body.');
    writeWorkflow(root, 'project-flow', '# P\n\n## Steps\n\n1. **First** {#first} — project-body.');
    const realBuddy = fs.readFileSync(
      path.join(REPO_ROOT, 'container', 'overlays', 'buddy-monitor', 'OVERLAY.md'),
      'utf-8',
    );
    write(path.join(root, 'container', 'overlays', 'buddy-monitor', 'OVERLAY.md'), realBuddy);
    writeCapabilitySkill(root, 'buddy', 'Buddy.');
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [project-flow]',
        '  skills: [buddy]',
        '  overlays: [buddy-monitor]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ BUDDY MONITOR GATE \(at workflow start\)/);
    // Gate must precede step 1.
    const wfStart = spine.indexOf('### /project-flow');
    const gateIdx = spine.indexOf('BUDDY MONITOR GATE', wfStart);
    const step1Idx = spine.indexOf('#### 1. First', wfStart);
    expect(gateIdx).toBeLessThan(step1Idx);
  });
});

describe('R24: anchor aliases resolve canonical stages against project step ids', () => {
  // Canonical-stage anchor matching: an overlay author declares anchors in
  // canonical terms (`change`, `deliver`, …) and lists per-anchor aliases for
  // the project-specific step ids workflows actually use (`implement`,
  // `report`, …). Resolution order is canonical first, then aliases
  // left-to-right, first hit wins. Plain-string anchors keep working.
  function writeAliasOverlay(
    root: string,
    name: string,
    body: string,
    fm: {
      appliesToWorkflows?: string[];
      appliesToTraits?: string[];
      // Each entry can be `'step'` (back-compat) OR `{ step, aliases }`.
      insertAfter?: Array<string | { step: string; aliases?: string[] }>;
      insertBefore?: Array<string | { step: string; aliases?: string[] }>;
    },
  ): void {
    function renderAnchor(a: string | { step: string; aliases?: string[] }): string {
      if (typeof a === 'string') return JSON.stringify(a);
      const aliases = JSON.stringify(a.aliases ?? []);
      return `{ step: ${a.step}, aliases: ${aliases} }`;
    }
    const insertAfter = (fm.insertAfter ?? []).map(renderAnchor).join(', ');
    const insertBefore = (fm.insertBefore ?? []).map(renderAnchor).join(', ');
    const text = [
      '---',
      `name: ${name}`,
      'type: overlay',
      `description: "Test ${name} overlay."`,
      'applies-to:',
      `  workflows: ${JSON.stringify(fm.appliesToWorkflows || [])}`,
      `  traits: ${JSON.stringify(fm.appliesToTraits || [])}`,
      `insert-after: [${insertAfter}]`,
      `insert-before: [${insertBefore}]`,
      'uses:',
      '  skills: []',
      '---',
      '',
      body,
    ].join('\n');
    write(path.join(root, 'container', 'overlays', name, 'OVERLAY.md'), text);
  }

  it('plain-string anchor still resolves when step matches (back-compat)', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      '# F\n\n## Steps\n\n1. **Change** {#change} — apply edits.\n\n2. **Deliver** {#deliver} — push.',
    );
    writeOverlay(root, 'guard', 'PLAIN_STRING_BODY', {
      appliesToWorkflows: ['flow'],
      insertAfter: ['change'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(spine).toMatch(/⟐ GUARD GATE \(after `change`\)/);
    expect(spine).toContain('PLAIN_STRING_BODY');
  });

  it('object form: canonical step matches → uses canonical, aliases ignored', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      '# F\n\n## Steps\n\n1. **Change** {#change} — apply edits.\n\n2. **Deliver** {#deliver} — push.',
    );
    writeAliasOverlay(root, 'guard', 'CANONICAL_HIT_BODY', {
      appliesToWorkflows: ['flow'],
      insertAfter: [{ step: 'change', aliases: ['implement', 'patch'] }],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    // Canonical step is in the workflow, so it wins — aliases not mentioned.
    expect(spine).toMatch(/⟐ GUARD GATE \(after `change`\)/);
    expect(spine).not.toMatch(/after `implement`/);
    expect(spine).not.toMatch(/after `patch`/);
    expect(spine).toContain('CANONICAL_HIT_BODY');
  });

  it('object form: canonical missing, first alias matches → uses alias and customization summary names it', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      // Project workflow uses `implement` (no `change` step).
      '# F\n\n## Steps\n\n1. **Implement** {#implement} — apply edits.\n\n2. **Report** {#report} — push.',
    );
    writeAliasOverlay(root, 'guard', 'ALIAS_HIT_BODY', {
      appliesToWorkflows: ['flow'],
      insertAfter: [{ step: 'change', aliases: ['implement', 'patch'] }],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    // Resolved step is `implement` (first alias). The inline gate marker
    // names the resolved step, and the gate lands inside the `implement`
    // step's section (between step 1 and step 2).
    expect(spine).toMatch(/⟐ GUARD GATE \(after `implement`\)/);
    expect(spine).not.toMatch(/after `change`/);
    expect(spine).toContain('ALIAS_HIT_BODY');
    const step1 = spine.indexOf('#### 1. Implement');
    const gate = spine.indexOf('GUARD GATE');
    const step2 = spine.indexOf('#### 2. Report');
    expect(step1).toBeGreaterThanOrEqual(0);
    expect(gate).toBeGreaterThan(step1);
    expect(gate).toBeLessThan(step2);
  });

  it('object form: neither canonical nor any alias matches → warn fires, no anchor markers render', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow',
      // Steps do not include canonical or any alias.
      '# F\n\n## Steps\n\n1. **Setup** {#setup} — prep.\n\n2. **Verify** {#verify} — check.',
    );
    writeAliasOverlay(root, 'guard', 'NO_HIT_BODY', {
      appliesToWorkflows: ['flow'],
      insertAfter: [{ step: 'change', aliases: ['implement', 'patch'] }],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [flow]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );
    const warnings: string[] = [];
    const origWarn = console.warn;
    console.warn = (...args: unknown[]) => {
      warnings.push(args.map(String).join(' '));
    };
    let spine: string;
    try {
      spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    } finally {
      console.warn = origWarn;
    }
    // Warn fires and lists the spec with aliases joined by `|`.
    const matched = warnings.find((w) => w.includes('Overlay "guard"') && w.includes('change|implement|patch'));
    expect(matched, `expected unmatched-anchor warning, got: ${warnings.join(' | ')}`).toBeDefined();
    // No inline gate marker for this overlay against the unmatched workflow.
    expect(spine).not.toMatch(/⟐ GUARD GATE/);
  });
});

describe('R19: disableOverlays option strips every overlay gate and the Gate Protocol section', () => {
  // Honors per-coworker `agent_groups.disable_overlays` — when set, the composed
  // CLAUDE.md must contain no `⟐ ... GATE` inline blocks and no trailing
  // `## Gate Protocol` section. Workflow bodies and skills are unaffected.
  it('compose with disableOverlays=true → zero gates, zero Gate Protocol; compose with false → gate renders', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'build', '# Build\n\n## Steps\n\n1. **Do** {#do} — thing.\n');
    writeOverlay(root, 'guard', 'SENTINEL_GUARD_BODY', {
      appliesToWorkflows: ['build'],
      insertAfter: ['do'],
    });
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [build]',
        '  overlays: [guard]',
        '',
      ].join('\n'),
    );

    // Baseline: overlays enabled — gate renders.
    const withOverlays = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    expect(withOverlays).toMatch(/⟐ GUARD GATE/);
    expect(withOverlays).toContain('SENTINEL_GUARD_BODY');

    // Flag on: no gate blocks, no Gate Protocol, and the overlay body is gone.
    const withoutOverlays = composeCoworkerSpine({
      projectRoot: root,
      coworkerType: 'probe',
      disableOverlays: true,
    });
    expect(withoutOverlays).not.toMatch(/⟐/);
    expect(withoutOverlays).not.toMatch(/^## Gate Protocol$/m);
    expect(withoutOverlays).not.toContain('SENTINEL_GUARD_BODY');
    // Workflow body still there (flag only strips overlays, not workflows).
    expect(withoutOverlays).toMatch(/^### \/build$/m);
  });
});

describe('R25: prologue numbered-bold bullets never parse as steps', () => {
  // The step parser (src/claude-composer/registry.ts) gates its `N. **Title**`
  // scan to the `## Steps` region. Numbered-bold bullets that appear in a
  // workflow's PROLOGUE (mode-delta notes like `1. **Reproduce/Setup** — …`)
  // are framing, not steps, and must not be parsed as such. Two failure modes
  // this pins:
  //   - In workflows WITH `## Steps`, phantom prologue steps offset every real
  //     step number (slang-fix-issue regression).
  //   - In `extends:` workflows WITHOUT `## Steps`, any parsed step makes
  //     `steps` non-empty, which suppresses inheritance of the parent's
  //     procedure (resolve.ts `if (steps.length === 0 && extendsWorkflow …)`),
  //     dropping the whole parent procedure (slangpy-implement regression).

  // 1) On-disk parser-behavior guard: for every real WORKFLOW.md, the parsed
  // step set must equal exactly the numbered-bold lines INSIDE its `## Steps`
  // section (from the heading to the next H2). Numbered-bold lines anywhere
  // else — prologue mode-deltas, trailing `## Mode invariants` enumerations —
  // must NOT be parsed as steps. This is asserted against the parser's own
  // output (`readSkillCatalog`), so it is independent of which branch the
  // workflow sources came from (CI composes a merged nv-* tree where a given
  // workflow's content cleanup may live in a sibling branch's PR).
  it('parsed steps match exactly the numbered-bold lines inside `## Steps`', () => {
    const catalog = readSkillCatalog(REPO_ROOT);
    const offenders: string[] = [];
    for (const meta of Object.values(catalog)) {
      if (meta.type !== 'workflow') continue;
      const text = fs.readFileSync(meta.path, 'utf-8');
      const body = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n/, '');
      const stepsHeading = body.match(/^##\s+Steps\s*$/m);
      // Count numbered-bold lines strictly within the `## Steps` section.
      let expectedCount = 0;
      if (stepsHeading) {
        const regionStart = (stepsHeading.index ?? 0) + stepsHeading[0].length;
        const after = body.slice(regionStart);
        const nextH2 = after.match(/\n##\s+(?!#)/);
        const region = nextH2 ? after.slice(0, nextH2.index ?? 0) : after;
        expectedCount = (region.match(/^\s*\d+\.\s+\*\*[^*]+\*\*/gm) ?? []).length;
      }
      // The parser's own steps[] for this workflow (NOT inherited — meta.steps
      // is the workflow's locally-parsed set before resolve.ts inheritance).
      if (meta.steps.length !== expectedCount) {
        offenders.push(
          `${meta.name}: parser produced ${meta.steps.length} step(s) but the \`## Steps\` ` +
            `section has ${expectedCount} numbered-bold line(s) — a bullet outside the section ` +
            `was mis-parsed (or a real step was missed).`,
        );
      }
    }

    expect(
      offenders,
      offenders.length === 0 ? '' : 'Step parse mismatch:\n' + offenders.map((o) => `  - ${o}`).join('\n'),
    ).toEqual([]);
  });

  // 2) Synthetic inheritance test (hermetic): a child workflow that `extends:` a
  // parent, has NO `## Steps`, and carries a prologue numbered-bold bullet must
  // inherit the PARENT's steps — not parse its own prologue bullet as the only
  // step (which would suppress inheritance entirely).
  it('extends-child with a prologue `N. **Foo**` bullet inherits the parent procedure', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'parent-proc',
      [
        '# Parent',
        '',
        '## Steps',
        '',
        '1. **Alpha** {#alpha} — PARENT_ALPHA_BODY.',
        '',
        '2. **Beta** {#beta} — PARENT_BETA_BODY.',
        '',
        '3. **Gamma** {#gamma} — PARENT_GAMMA_BODY.',
        '',
        '4. **Delta** {#delta} — PARENT_DELTA_BODY.',
        '',
        '5. **Epsilon** {#epsilon} — PARENT_EPSILON_BODY.',
        '',
        '6. **Zeta** {#zeta} — PARENT_ZETA_BODY.',
        '',
      ].join('\n'),
    );
    // Child: extends parent, NO `## Steps`, prologue with a numbered-bold bullet.
    writeWorkflow(
      root,
      'child-proc',
      [
        '# Child Mode',
        '',
        'Mode-delta framing for this child:',
        '',
        '1. **Foo** — phantom prologue bullet that must NOT become a step.',
        '',
        '2. **Bar** — another phantom prologue bullet.',
        '',
      ].join('\n'),
      { extends: 'parent-proc' },
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [child-proc]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    // The child section must show the PARENT's six step headers, contiguously.
    const childStart = spine.indexOf('### /child-proc');
    expect(childStart).toBeGreaterThanOrEqual(0);
    const childEnd = spine.indexOf('\n## ', childStart);
    const childSection = spine.slice(childStart, childEnd === -1 ? undefined : childEnd);

    expect(childSection).toMatch(/^#### 1\. Alpha$/m);
    expect(childSection).toMatch(/^#### 6\. Zeta$/m);
    expect(childSection).toContain('PARENT_ALPHA_BODY');
    expect(childSection).toContain('PARENT_ZETA_BODY');
    // The prologue bullet must NOT have been promoted to a step header.
    expect(childSection).not.toMatch(/^#### \d+\. Foo$/m);
    expect(childSection).not.toMatch(/^#### \d+\. Bar$/m);
  });

  // 2b) An extends-child with NO `## Steps` may still author its OWN body
  // sections (mode-deltas, peer-review notes). Inheriting the parent's steps
  // must NOT drop that content — it renders as the epilogue, after the
  // inherited steps. This pins the regression where gating step parsing to the
  // `## Steps` region left positions empty and skipped prologue/epilogue
  // extraction entirely, silently dropping `slangpy-implement`'s body.
  it('extends-child with no `## Steps` keeps its own body content (renders after inherited steps)', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'parent-proc',
      ['# Parent', '', '## Steps', '', '1. **Alpha** {#alpha} — PARENT_ALPHA_BODY.', ''].join('\n'),
    );
    // Child: extends parent, NO `## Steps`, but authors its own `## Section`.
    writeWorkflow(
      root,
      'child-proc',
      [
        '# Child Mode',
        '',
        '## PR-review-fix mode',
        '',
        'CHILD_OWN_BODY_MARKER — this section must survive inheritance.',
        '',
        '## Peer review',
        '',
        'CHILD_PEER_REVIEW_MARKER.',
        '',
      ].join('\n'),
      { extends: 'parent-proc' },
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [child-proc]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    const childStart = spine.indexOf('### /child-proc');
    expect(childStart).toBeGreaterThanOrEqual(0);
    const childEnd = spine.indexOf('\n## ', childStart);
    const childSection = spine.slice(childStart, childEnd === -1 ? undefined : childEnd);

    // Inherited step is present...
    expect(childSection).toMatch(/^#### 1\. Alpha$/m);
    // ...AND the child's own body sections survived.
    expect(childSection).toContain('CHILD_OWN_BODY_MARKER');
    expect(childSection).toContain('CHILD_PEER_REVIEW_MARKER');
    // Body sections render after the inherited step, not before it.
    expect(childSection.indexOf('CHILD_OWN_BODY_MARKER')).toBeGreaterThan(childSection.indexOf('#### 1. Alpha'));
  });

  // 2c) Explicit structural invariant the parser depends on: a workflow either
  // declares its own `## Steps`, or it declares `extends:` to inherit one. A
  // workflow with neither parses to zero steps AND inherits nothing — its
  // procedure would vanish. Pin the contract so it can't be violated on disk.
  it('every on-disk workflow either has `## Steps` or declares `extends:`', () => {
    const workflowsDir = path.join(REPO_ROOT, 'container', 'workflows');
    if (!fs.existsSync(workflowsDir)) return;

    const offenders: string[] = [];
    for (const name of fs.readdirSync(workflowsDir)) {
      const wfPath = path.join(workflowsDir, name, 'WORKFLOW.md');
      if (!fs.existsSync(wfPath)) continue;
      const text = fs.readFileSync(wfPath, 'utf-8');
      const hasSteps = /^##\s+Steps\s*$/m.test(text);
      const fm = text.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const hasExtends = fm ? /^extends:\s*\S+/m.test(fm[1]) : false;
      if (!hasSteps && !hasExtends) {
        offenders.push(`${name}: no \`## Steps\` heading and no \`extends:\` — its procedure renders empty`);
      }
    }

    expect(
      offenders,
      offenders.length === 0
        ? ''
        : 'Workflow(s) with neither own steps nor inheritance:\n' + offenders.map((o) => `  - ${o}`).join('\n'),
    ).toEqual([]);
  });

  // 3) Contiguous numbering: a workflow that HAS `## Steps` plus a prologue
  // numbered-bold bullet must render its real steps as 1..N with no phantom
  // prologue step offsetting the numbering.
  it('workflow with `## Steps` plus a prologue bullet renders contiguous 1..N steps', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'flow-proc',
      [
        '# Flow Mode',
        '',
        'Mode-delta framing:',
        '',
        '1. **Reproduce/Setup** — phantom prologue note, not a real step.',
        '',
        '## Steps',
        '',
        '1. **RealOne** {#realone} — REAL_ONE_BODY.',
        '',
        '2. **RealTwo** {#realtwo} — REAL_TWO_BODY.',
        '',
        '3. **RealThree** {#realthree} — REAL_THREE_BODY.',
        '',
      ].join('\n'),
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [flow-proc]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    const flowStart = spine.indexOf('### /flow-proc');
    expect(flowStart).toBeGreaterThanOrEqual(0);
    const flowEnd = spine.indexOf('\n## ', flowStart);
    const flowSection = spine.slice(flowStart, flowEnd === -1 ? undefined : flowEnd);

    // Real steps render contiguously 1..3 — the prologue bullet did not offset them.
    const stepHeaders = [...flowSection.matchAll(/^#### (\d+)\. (.+)$/gm)].map((m) => `${m[1]}:${m[2].trim()}`);
    expect(stepHeaders).toEqual(['1:RealOne', '2:RealTwo', '3:RealThree']);
    // Sanity: the prologue bullet survives as prose but never as a step header.
    expect(flowSection).toContain('Reproduce/Setup');
    expect(flowSection).not.toMatch(/^#### \d+\. Reproduce/m);
  });

  // 4) A numbered-bold list in a TRAILING H2 block (e.g. `## Mode invariants`)
  // after the `## Steps` section must not be parsed as steps. The step scan is
  // bounded to the Steps section (heading → next H2), so the real steps render
  // 1..N and the trailing enumeration survives as epilogue prose.
  it('numbered-bold list in a trailing `## Mode invariants` block is not parsed as steps', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'tail-proc',
      [
        '# Tail',
        '',
        '## Steps',
        '',
        '1. **RealOne** {#realone} — REAL_ONE_BODY.',
        '',
        '2. **RealTwo** {#realtwo} — REAL_TWO_BODY.',
        '',
        '## Mode invariants',
        '',
        '1. **Invariant A** — must hold across all modes.',
        '',
        '2. **Invariant B** — also load-bearing.',
        '',
      ].join('\n'),
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [tail-proc]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    const start = spine.indexOf('### /tail-proc');
    const end = spine.indexOf('\n## ', start);
    const sec = spine.slice(start, end === -1 ? undefined : end);

    // Exactly the two real steps render as headers — not the invariant bullets.
    const stepHeaders = [...sec.matchAll(/^#### (\d+)\. (.+)$/gm)].map((m) => `${m[1]}:${m[2].trim()}`);
    expect(stepHeaders).toEqual(['1:RealOne', '2:RealTwo']);
    // The invariant enumeration survives as epilogue prose.
    expect(sec).toContain('Invariant A');
    expect(sec).toContain('Invariant B');
    expect(sec).not.toMatch(/^#### \d+\. Invariant/m);
  });

  // 5) BLOCKER regression: when an `extends:` child has its own body (captured
  // as the child's epilogue) AND the parent ALSO has an epilogue, BOTH must
  // survive — the child must not shadow the parent's epilogue. Pins the
  // resolve.ts inheritance fix (concatenate parent + child framing).
  it('extends-child with own body keeps BOTH parent and child epilogue', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    // Parent has a step AND a trailing `## Mode invariants` epilogue.
    writeWorkflow(
      root,
      'parent-proc',
      [
        '# Parent',
        '',
        '## Steps',
        '',
        '1. **Alpha** {#alpha} — PARENT_ALPHA_BODY.',
        '',
        '## Mode invariants',
        '',
        'PARENT_EPILOGUE_MARKER — load-bearing across modes.',
        '',
      ].join('\n'),
    );
    // Child: extends parent, NO `## Steps`, authors its own body section.
    writeWorkflow(
      root,
      'child-proc',
      ['# Child', '', '## PR-review-fix mode', '', 'CHILD_EPILOGUE_MARKER — child specialization.', ''].join('\n'),
      { extends: 'parent-proc' },
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [child-proc]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    const start = spine.indexOf('### /child-proc');
    const end = spine.indexOf('\n## ', start);
    const sec = spine.slice(start, end === -1 ? undefined : end);

    // Inherited step present...
    expect(sec).toMatch(/^#### 1\. Alpha$/m);
    // ...and BOTH epilogues survive — parent's must not be dropped by the child.
    expect(sec).toContain('PARENT_EPILOGUE_MARKER');
    expect(sec).toContain('CHILD_EPILOGUE_MARKER');
    // Parent framing renders before the child's specialization.
    expect(sec.indexOf('PARENT_EPILOGUE_MARKER')).toBeLessThan(sec.indexOf('CHILD_EPILOGUE_MARKER'));
  });

  // 6) An INDENTED numbered-bold sub-list inside a step body (enumerated
  // sub-steps) must NOT be promoted to a top-level step — step headers are
  // anchored to column 0. Without this, a step containing `   1. **Sub A**`
  // would phantom-split into extra steps and renumber everything after it.
  it('indented numbered-bold sub-list inside a step body is not parsed as a step', () => {
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'sub-proc',
      [
        '# Sub',
        '',
        '## Steps',
        '',
        '1. **Setup** {#setup} — do the thing. Sub-steps:',
        '   1. **Inner A** — first inner detail.',
        '   2. **Inner B** — second inner detail.',
        '',
        '2. **Finish** {#finish} — wrap up.',
        '',
      ].join('\n'),
    );
    writeProjectType(root, 'probe:\n  extends: base-common\n  description: "Probe."\n  workflows: [sub-proc]\n');
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    const start = spine.indexOf('### /sub-proc');
    const end = spine.indexOf('\n## ', start);
    const sec = spine.slice(start, end === -1 ? undefined : end);

    // Exactly the two top-level steps render as headers — not the inner bullets.
    const stepHeaders = [...sec.matchAll(/^#### (\d+)\. (.+)$/gm)].map((m) => `${m[1]}:${m[2].trim()}`);
    expect(stepHeaders).toEqual(['1:Setup', '2:Finish']);
    // The inner sub-list survives as prose inside the Setup step body.
    expect(sec).toContain('Inner A');
    expect(sec).toContain('Inner B');
    expect(sec).not.toMatch(/^#### \d+\. Inner/m);
  });
});
