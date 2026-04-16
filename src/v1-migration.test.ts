import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

import { extractLegacyCustomInstructions, recomposeLegacyTemplate } from './v1-migration.js';

const tempDirs: string[] = [];

function makeTempProject(): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'nanoclaw-v1-migration-'));
  tempDirs.push(dir);

  fs.mkdirSync(path.join(dir, 'groups', 'templates'), { recursive: true });
  fs.cpSync(path.join(process.cwd(), 'groups', 'templates'), path.join(dir, 'groups', 'templates'), {
    recursive: true,
  });
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

describe('v1 migration helpers', () => {
  it('reconstructs a typed coworker from YAML templates and extracts only the legacy custom tail', () => {
    const projectRoot = makeTempProject();
    writeYaml(
      path.join(projectRoot, 'groups', 'templates', 'leaf-role.yaml'),
      `
role: |
  Leaf role.
workflow: |
  Leaf workflow.
`,
    );
    fs.writeFileSync(
      path.join(projectRoot, 'groups', 'coworker-types.json'),
      JSON.stringify(
        {
          leaf: {
            template: 'groups/templates/leaf-role.yaml',
          },
        },
        null,
        2,
      ),
    );

    const template = recomposeLegacyTemplate(projectRoot, { isMain: false, coworkerType: 'leaf' });
    expect(template).not.toBeNull();
    expect(template).toContain('# Leaf Role');
    expect(template).toContain('## Workflow');
    expect(template).toContain('Leaf workflow.');

    const legacyCustomTail = [
      '### Legacy custom instructions',
      '',
      '- Keep this raw markdown block intact',
      '- Do not force it into the six template sections during export',
    ].join('\n');

    const actualClaudeMd = `${template!.trimEnd()}\n\n---\n\n${legacyCustomTail}\n`;
    const extracted = extractLegacyCustomInstructions(actualClaudeMd, template!);

    expect(extracted).toBe(legacyCustomTail);
  });

  it('returns null when there is no custom legacy tail beyond the composed template', () => {
    const projectRoot = makeTempProject();
    const template = recomposeLegacyTemplate(projectRoot, { isMain: true });

    expect(template).not.toBeNull();
    expect(extractLegacyCustomInstructions(template!, template!)).toBeNull();
  });
});
