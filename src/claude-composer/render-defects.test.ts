/**
 * Rendering defects found by auditing the composed production documents, each
 * pinned here with the smallest fixture that reproduces it. Hermetic temp-dir
 * fixtures (the `claude-composer-refactor.test.ts` pattern), so they pass whether
 * or not sibling branches are merged.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { composeCoworkerSpine, readCoworkerTypes } from '../claude-composer.js';

const tempDirs: string[] = [];

afterEach(() => {
  for (const d of tempDirs) fs.rmSync(d, { recursive: true, force: true });
  tempDirs.length = 0;
});

function scratch(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-render-defects-'));
  tempDirs.push(dir);
  return dir;
}

function write(file: string, contents: string): void {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, contents);
}

function writeSpineBase(root: string): void {
  write(path.join(root, 'container', 'spines', 'base', 'identity', 'role.md'), 'You are a probe.');
  write(
    path.join(root, 'container', 'spines', 'base', 'coworker-types.yaml'),
    ['base-common:', '  abstract: true', '  description: "Test spine."', ''].join('\n'),
  );
}

function writeWorkflow(
  root: string,
  name: string,
  body: string,
  fm: { description?: string; extends?: string; params?: string[]; produces?: string[] } = {},
): void {
  const text = [
    '---',
    `name: ${name}`,
    'type: workflow',
    `description: "${fm.description ?? `Test ${name} workflow.`}"`,
    'requires: []',
    'uses:',
    '  skills: []',
    '  workflows: []',
    ...(fm.extends ? [`extends: ${fm.extends}`] : []),
    ...(fm.params ? ['params:', ...fm.params.map((p) => `  ${p}: { type: string }`)] : []),
    ...(fm.produces ? ['produces:', ...fm.produces.map((p, i) => `  - out${i}: { path: '${p}' }`)] : []),
    '---',
    '',
    body,
  ].join('\n');
  write(path.join(root, 'container', 'workflows', name, 'WORKFLOW.md'), text);
}

function writeSkill(root: string, name: string, description: string, provides: string[]): void {
  const text = [
    '---',
    `name: ${name}`,
    'type: capability',
    `description: '${description}'`,
    `provides: [${provides.join(', ')}]`,
    '---',
    '',
    `Body for ${name}.`,
  ].join('\n');
  write(path.join(root, 'container', 'skills', name, 'SKILL.md'), text);
}

function writeType(root: string, yaml: string): void {
  write(path.join(root, 'container', 'spines', 'project', 'coworker-types.yaml'), yaml);
}

const probeType = (extra: string[]): string =>
  ['probe:', '  extends: base-common', '  identity: container/spines/base/identity/role.md', ...extra, ''].join('\n');

const steps = (...bodies: string[]): string =>
  ['# W', '', '## Steps', '', ...bodies.map((b, i) => `${i + 1}. **Step ${i + 1}** {#s${i + 1}} — ${b}\n`)].join('\n');

describe('type description reaches the agent', () => {
  it('renders the leaf description under Identity, after the identity fragment', () => {
    const root = scratch();
    writeSpineBase(root);
    writeType(root, probeType(['  description: "Comment-only reviewer: never approve a PR."']));

    const out = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    expect(out).toContain('## Identity\n\nYou are a probe.\n\nComment-only reviewer: never approve a PR.\n');
  });

  it('leaves a flat identity body verbatim', () => {
    const root = scratch();
    write(path.join(root, 'base', 'flat.md'), '# Flat\n\nBody text.');
    writeType(root, 'flatty:\n  flat: true\n  description: "Flat label."\n  identity: base/flat.md\n');

    expect(composeCoworkerSpine({ projectRoot: root, coworkerType: 'flatty' })).not.toContain('Flat label.');
  });
});

describe('step-body H1 demotion is fence-aware', () => {
  it('demotes a prose H1 but leaves a heredoc title inside a fenced block as written', () => {
    const root = scratch();
    writeSpineBase(root);
    writeWorkflow(
      root,
      'triage',
      steps(
        [
          'Write the memo.',
          '',
          '# Prose heading',
          '',
          '```bash',
          "cat > memo.md << 'EOF'",
          '# Triage: shader-slang/slang#<number> — <title>',
          'EOF',
          '```',
        ].join('\n'),
      ),
    );
    writeType(root, probeType(['  workflows: [triage]']));

    const out = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    expect(out).toContain('\n# Triage: shader-slang/slang#<number> — <title>\n');
    expect(out).not.toContain('##### Triage');
    expect(out).toContain('\n##### Prose heading\n');
  });
});

describe('the extends note is a cross-reference, not a claim', () => {
  it('is omitted when the parent workflow is not rendered for this coworker', () => {
    const root = scratch();
    writeSpineBase(root);
    writeWorkflow(root, 'parent', steps('parent body.'));
    writeWorkflow(root, 'child', '# C\n', { extends: 'parent' });
    writeType(root, probeType(['  workflows: [child]']));

    const out = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    expect(out).not.toContain('(extends /parent');
    // The inherited steps are what the reader needs, and they are present.
    expect(out).toContain('parent body.');
  });

  it('is rendered, with the actual direction, when the parent is itself a rendered workflow', () => {
    const root = scratch();
    writeSpineBase(root);
    writeWorkflow(root, 'parent', steps('parent body.'));
    writeWorkflow(root, 'child', '# C\n', { extends: 'parent' });

    writeType(root, probeType(['  workflows: [parent, child]']));
    expect(composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' })).toContain(
      '### /child\n\nTest child workflow. (extends /parent—see section above)',
    );

    writeType(root, probeType(['  workflows: [child, parent]']));
    expect(composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' })).toContain(
      '### /child\n\nTest child workflow. (extends /parent—see section below)',
    );
  });
});

describe('workflow cross-references carry no direction', () => {
  it('rewrites `/name` to the section name without "below" or "above"', () => {
    const root = scratch();
    writeSpineBase(root);
    writeWorkflow(root, 'first', steps('Then follow `/second`.'));
    writeWorkflow(root, 'second', steps('Then revisit `/first`.'));
    writeType(root, probeType(['  workflows: [first, second]']));

    const out = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    expect(out).toContain('Then follow the **second** workflow section.');
    expect(out).toContain('Then revisit the **first** workflow section.');
    expect(out).not.toMatch(/workflow section (below|above)/);
  });
});

describe('flat-path persona', () => {
  it('is wrapped in a titled Additional Instructions section with its headings re-leveled', () => {
    const root = scratch();
    write(path.join(root, 'base', 'flat.md'), '# Flat\n\nBody text.');
    writeType(root, 'flatty:\n  flat: true\n  identity: base/flat.md\n');

    const out = composeCoworkerSpine({
      projectRoot: root,
      coworkerType: 'flatty',
      extraInstructions: '# Persona\n\n**OPS:** be terse.',
    });

    expect(out.endsWith('\n## Additional Instructions\n\n### Persona\n\n**OPS:** be terse.\n')).toBe(true);
    expect(out.split('\n').filter((l) => /^# \S/.test(l))).toEqual(['# Flat']);
  });
});

describe('Skills section', () => {
  it('buckets the github trait domain under Repo', () => {
    const root = scratch();
    writeSpineBase(root);
    writeSkill(root, 'hooks', 'Route GitHub webhooks.', ['github.webhook.routing']);
    writeSkill(root, 'editor', 'Edit code.', ['code.edit']);
    writeType(root, probeType(['  skills: [hooks, editor]']));

    const out = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    expect(out).toContain('**Repo**\n\n- `/hooks` — Route GitHub webhooks.\n\n**Code**\n\n- `/editor` — Edit code.');
    expect(out).not.toContain('**Other**');
  });

  it('lists each skill with the first sentence of its description only', () => {
    const root = scratch();
    writeSpineBase(root);
    writeSkill(root, 'long', 'Explain a diff as HTML (see slang.h for headers). Run it after every push. Then stop.', [
      'doc.write',
    ]);
    writeType(root, probeType(['  skills: [long]']));

    const out = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    expect(out).toContain('- `/long` — Explain a diff as HTML (see slang.h for headers).\n');
    expect(out).not.toContain('Run it after every push.');
  });
});

describe('placeholders inside fenced blocks', () => {
  it('rewrites names the workflow (or its parent) declares via params/produces, and only those', () => {
    const root = scratch();
    writeSpineBase(root);
    writeWorkflow(root, 'parent', steps('parent body.'), {
      params: ['target'],
      produces: ['/workspace/agent/reports/{{target_slug}}.md'],
    });
    writeWorkflow(
      root,
      'child',
      steps(
        [
          'Work in `wt-{{target_slug}}` for {{target}}.',
          '',
          '```bash',
          'git worktree add /workspace/agent/wt-{{target_slug}} -b fix/{{target}}',
          'echo "{{undeclared}} stays literal"',
          '```',
        ].join('\n'),
      ),
      { extends: 'parent' },
    );
    writeType(root, probeType(['  workflows: [child]']));

    const out = composeCoworkerSpine({ projectRoot: root, coworkerType: 'probe' });

    expect(out).toContain('Work in `wt-<target_slug>` for <target>.');
    expect(out).toContain('git worktree add /workspace/agent/wt-<target_slug> -b fix/<target>');
    expect(out).toContain('echo "{{undeclared}} stays literal"');
    expect(out).not.toContain('{{target');
  });
});

describe('abstract flag', () => {
  it('survives a same-name merge across registry files and defaults to unset', () => {
    const root = scratch();
    writeSpineBase(root);
    write(
      path.join(root, 'container', 'skills', 'addon', 'coworker-types.yaml'),
      'base-common:\n  context: []\nprobe:\n  extends: base-common\n',
    );

    const types = readCoworkerTypes(root);

    expect(types['base-common'].abstract).toBe(true);
    expect(types['probe'].abstract).toBeUndefined();
  });
});
