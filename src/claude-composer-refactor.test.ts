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

  it('writer-style workflows pick up critique-overlay via trait union', () => {
    // Hermetic — proves the new critique-overlay frontmatter works against
    // a synthetic writer workflow that requires `code.edit`. Doesn't depend
    // on the slang/slangpy spines.
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
    writeWorkflow(
      root,
      'project-fix',
      [
        '# Project fix',
        '',
        '## Steps',
        '',
        '1. **Diagnose** {#diagnose} — root cause.',
        '',
        '2. **Change** {#change} — apply the fix.',
        '',
        '3. **Deliver** {#deliver} — push the artifact.',
      ].join('\n'),
      { requires: ['code.edit'] },
    );
    // Drop the shipped critique-overlay body into the fixture verbatim.
    const realCritique = fs.readFileSync(
      path.join(REPO_ROOT, 'container', 'overlays', 'critique-overlay', 'OVERLAY.md'),
      'utf-8',
    );
    write(path.join(root, 'container', 'overlays', 'critique-overlay', 'OVERLAY.md'), realCritique);
    writeProjectType(
      root,
      [
        'probe:',
        '  extends: base-common',
        '  description: "Probe."',
        '  workflows: [project-fix]',
        '  skills: [editor]',
        '  overlays: [critique-overlay]',
        '  bindings:',
        '    code: editor',
        '',
      ].join('\n'),
    );
    const spine = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });
    // Trait-driven attach: critique-overlay has `traits: [code.edit, ...]`,
    // project-fix declares `requires: [code.edit]`, so the gates inline.
    expect(spine).toMatch(/⟐ CRITIQUE OVERLAY GATE/);
  });

  it('base-extending workflows pick up buddy-monitor at start', () => {
    // Uses the shipped buddy-monitor body against a synthetic base + project
    // workflow. Validates the Phase 4 shape end-to-end without slang spines.
    const root = makeTempProject();
    writeSpineBase(root);
    writeWorkflow(root, 'base', '# Base\n\n## Steps\n\n1. **A** {#a} — base-body.');
    writeWorkflow(root, 'project-flow', '# P\n\n## Steps\n\n1. **First** {#first} — project-body.');
    const realBuddy = fs.readFileSync(path.join(REPO_ROOT, 'container', 'overlays', 'buddy-monitor', 'OVERLAY.md'), 'utf-8');
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
