import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { composeClaudeMd, resolveTypeChain, resolveTypeFields, type CoworkerTypeEntry } from './claude-composer.js';

const tempDirs: string[] = [];

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-claude-compose-'));
  tempDirs.push(dir);

  fs.mkdirSync(path.join(dir, 'groups', 'templates'), { recursive: true });
  fs.cpSync(path.join(process.cwd(), 'groups', 'templates'), path.join(dir, 'groups', 'templates'), {
    recursive: true,
  });
  fs.copyFileSync(
    path.join(process.cwd(), 'groups', 'coworker-types.json'),
    path.join(dir, 'groups', 'coworker-types.json'),
  );
  return dir;
}

function writeYaml(filePath: string, contents: string): void {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  fs.writeFileSync(filePath, `${contents.trim()}\n`);
}

afterEach(() => {
  for (const dir of tempDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe('CLAUDE.md composition', () => {
  it('reconstructs the checked-in global and main CLAUDE.md files for the current tree', () => {
    const generatedGlobal = composeClaudeMd({ projectRoot: process.cwd(), manifestName: 'global' });
    const generatedMain = composeClaudeMd({ projectRoot: process.cwd(), manifestName: 'main' });

    expect(generatedGlobal).toBe(fs.readFileSync(path.join(process.cwd(), 'groups', 'global', 'CLAUDE.md'), 'utf-8'));
    expect(generatedMain).toBe(fs.readFileSync(path.join(process.cwd(), 'groups', 'main', 'CLAUDE.md'), 'utf-8'));
  });

  it('skips sections that remain empty after composition', () => {
    const projectRoot = makeTempProject();
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'base', 'global.yaml'),
      `
role: |
  Base role.
workflow: |
  Base workflow.
`,
    );
    fs.rmSync(path.join(projectRoot, 'groups', 'templates', 'projects'), { recursive: true, force: true });

    const generated = composeClaudeMd({ projectRoot, manifestName: 'global' });

    expect(generated).toContain('# Global');
    expect(generated).toContain('## Role');
    expect(generated).toContain('## Workflow');
    expect(generated).not.toContain('## Capabilities');
    expect(generated).not.toContain('## Constraints');
    expect(generated).not.toContain('## Formatting');
    expect(generated).not.toContain('## Resources');
  });

  it('merges project sections and manifest overlays into named sections instead of appending raw trailing blocks', () => {
    const projectRoot = makeTempProject();
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'base', 'main.yaml'),
      `
role: |
  Base role.
capabilities: |
  Base capabilities.
workflow: |
  Base workflow.
constraints: |
  Base constraints.
formatting: |
  Base formatting.
resources: |
  Base resources.
`,
    );
    const dashboardDir = path.join(projectRoot, 'groups', 'templates', 'projects', 'dashboard');
    const slangDir = path.join(projectRoot, 'groups', 'templates', 'projects', 'slang');
    writeYaml(
      path.join(dashboardDir, 'formatting.yaml'),
      `
formatting: |
  Dashboard formatting.
`,
    );
    writeYaml(
      path.join(slangDir, 'main-overlay.yaml'),
      `
capabilities: |
  Slang capabilities.
workflow: |
  Slang workflow.
resources: |
  Slang resources.
`,
    );

    const generated = composeClaudeMd({ projectRoot, manifestName: 'main' });

    expect(generated).toBe(
      [
        '# Main',
        '',
        '## Role',
        '',
        'Base role.',
        '',
        '## Capabilities',
        '',
        'Base capabilities.',
        '',
        'Slang capabilities.',
        '',
        '## Workflow',
        '',
        'Base workflow.',
        '',
        'Slang workflow.',
        '',
        '## Constraints',
        '',
        'Base constraints.',
        '',
        '## Formatting',
        '',
        'Base formatting.',
        '',
        'Dashboard formatting.',
        '',
        '## Resources',
        '',
        'Base resources.',
        '',
        'Slang resources.',
        '',
      ].join('\n'),
    );
  });

  it('applies project shared section files to every composed manifest', () => {
    const projectRoot = makeTempProject();
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'base', 'global.yaml'),
      `
role: |
  Global role.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'base', 'main.yaml'),
      `
role: |
  Main role.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'projects', 'dashboard', 'formatting.yaml'),
      `
formatting: |
  Dashboard formatting.
`,
    );

    const generatedGlobal = composeClaudeMd({ projectRoot, manifestName: 'global' });
    const generatedMain = composeClaudeMd({ projectRoot, manifestName: 'main' });

    expect(generatedGlobal).toContain('Dashboard formatting.');
    expect(generatedMain).toContain('Dashboard formatting.');
  });

  it('supports prompt template extends arrays and dedupes shared ancestors', () => {
    const projectRoot = makeTempProject();
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'base', 'global.yaml'),
      `
role: |
  Base role.
`,
    );
    const sharedDir = path.join(projectRoot, 'groups', 'templates', 'shared');
    writeYaml(
      path.join(sharedDir, 'common.yaml'),
      `
workflow: |
  Common workflow.
`,
    );
    writeYaml(
      path.join(sharedDir, 'formatting.yaml'),
      `
extends: common.yaml
formatting: |
  Shared formatting.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'projects', 'slang', 'global-overlay.yaml'),
      `
extends:
  - ../../shared/common.yaml
  - ../../shared/formatting.yaml
workflow: |
  Slang workflow.
`,
    );

    const generated = composeClaudeMd({ projectRoot, manifestName: 'global' });

    expect(generated.match(/Common workflow\./g)).toHaveLength(1);
    expect(generated).toContain('Slang workflow.');
    expect(generated).toContain('Shared formatting.');
  });

  it('rejects prompt template keys outside extends and the six supported sections', () => {
    const projectRoot = makeTempProject();
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'base', 'global.yaml'),
      `
title: Global
role: |
  Base role.
`,
    );

    expect(() => composeClaudeMd({ projectRoot, manifestName: 'global' })).toThrow(
      'Unknown prompt template key "title"',
    );
  });

  it('supports multi-parent coworker inheritance and dedupes repeated ancestors', () => {
    const projectRoot = makeTempProject();
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'base', 'global.yaml'),
      `
role: |
  Base role.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'sections', 'coworker-extensions.yaml'),
      `
workflow: |
  Shared coworker workflow.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'shared', 'common-role.yaml'),
      `
capabilities: |
  Common capabilities.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'foundation-role.yaml'),
      `
extends: shared/common-role.yaml
workflow: |
  Foundation workflow.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'review-role.yaml'),
      `
extends: shared/common-role.yaml
constraints: |
  Review constraints.
`,
    );
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'leaf-role.yaml'),
      `
role: |
  Leaf role.
`,
    );
    fs.writeFileSync(
      path.join(projectRoot, 'groups', 'coworker-types.json'),
      JSON.stringify(
        {
          foundation: {
            template: 'groups/templates/foundation-role.yaml',
            focusFiles: ['a.cpp'],
            allowedMcpTools: ['mcp__tool__common'],
          },
          reviewer: {
            extends: 'foundation',
            template: 'groups/templates/review-role.yaml',
            focusFiles: ['b.cpp'],
            allowedMcpTools: ['mcp__tool__review'],
          },
          specialist: {
            extends: ['foundation', 'reviewer'],
            template: 'groups/templates/leaf-role.yaml',
            focusFiles: ['a.cpp', 'c.cpp'],
            allowedMcpTools: ['mcp__tool__common', 'mcp__tool__leaf'],
          },
        },
        null,
        2,
      ),
    );

    const generated = composeClaudeMd({ projectRoot, manifestName: 'coworker', coworkerType: 'specialist' });
    const types = JSON.parse(fs.readFileSync(path.join(projectRoot, 'groups', 'coworker-types.json'), 'utf-8')) as Record<
      string,
      CoworkerTypeEntry
    >;
    const resolved = resolveTypeFields(types, 'specialist');

    expect(generated).toContain('# Leaf Role');
    expect(generated).toContain('Common capabilities.');
    expect(generated).toContain('Foundation workflow.');
    expect(generated).toContain('Review constraints.');
    expect(generated).toContain('Leaf role.');
    expect(generated.match(/Common capabilities\./g)).toHaveLength(1);
    expect(resolved.templates).toEqual([
      'groups/templates/foundation-role.yaml',
      'groups/templates/review-role.yaml',
      'groups/templates/leaf-role.yaml',
    ]);
    expect(resolved.focusFiles).toEqual(['a.cpp', 'b.cpp', 'c.cpp']);
    expect(resolved.allowedMcpTools).toEqual(['mcp__tool__common', 'mcp__tool__review', 'mcp__tool__leaf']);
  });

  it('stops inheritance walk on cycles instead of looping forever', () => {
    const types: Record<string, CoworkerTypeEntry> = {
      alpha: { extends: ['beta'], template: 'alpha.yaml' },
      beta: { extends: ['alpha'], template: 'beta.yaml' },
    };

    const chain = resolveTypeChain(types, 'alpha');
    expect(chain).toHaveLength(2);

    const resolved = resolveTypeFields(types, 'alpha');
    expect(resolved.templates).toEqual(['beta.yaml', 'alpha.yaml']);
  });
});
