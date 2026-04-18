import fs from 'fs';
import path from 'path';

import yaml from 'js-yaml';
import { describe, expect, it } from 'vitest';

interface ManifestConfig {
  base: string;
  sections?: string[];
  project_overlays?: boolean;
}

function loadManifest(relativePath: string): ManifestConfig {
  const filePath = path.join(process.cwd(), relativePath);
  return yaml.load(fs.readFileSync(filePath, 'utf-8')) as ManifestConfig;
}

function templateExists(dir: string, stem: string): boolean {
  return ['.yaml', '.yml', '.md'].some((ext) => fs.existsSync(path.join(dir, `${stem}${ext}`)));
}

describe('v2_main architecture alignment', () => {
  it('base prompt manifests should only reference section files that exist', () => {
    const sectionDir = path.join(process.cwd(), 'groups', 'templates', 'sections');
    const manifests = [
      loadManifest('groups/templates/manifests/main.yaml'),
      loadManifest('groups/templates/manifests/global.yaml'),
      loadManifest('groups/templates/manifests/coworker.yaml'),
    ];

    for (const manifest of manifests) {
      for (const section of manifest.sections || []) {
        expect(templateExists(sectionDir, section), `missing section file for "${section}"`).toBe(true);
      }
    }
  });

  it('base manifests should reconstruct upstream main/global and keep extensions additive', () => {
    const mainManifest = loadManifest('groups/templates/manifests/main.yaml');
    const globalManifest = loadManifest('groups/templates/manifests/global.yaml');
    const coworkerManifest = loadManifest('groups/templates/manifests/coworker.yaml');

    // Base main/global stay clean; dashboard and slang layer through project overlays.
    expect(mainManifest.sections || []).toEqual([]);
    expect(mainManifest.project_overlays).toBe(true);
    expect(globalManifest.sections || []).toEqual([]);
    expect(globalManifest.project_overlays).toBe(true);
    expect(coworkerManifest.sections || []).toContain('web-formatting');
    expect(coworkerManifest.sections || []).toContain('coworker-extensions');
    expect(coworkerManifest.project_overlays).toBe(true);
  });

  it('base main/global prompts should stay v2-native and avoid v1-only host details', () => {
    const baseGlobal = fs.readFileSync(path.join(process.cwd(), 'groups', 'templates', 'base', 'global.yaml'), 'utf-8');
    const baseMain = fs.readFileSync(path.join(process.cwd(), 'groups', 'templates', 'base', 'main.yaml'), 'utf-8');

    for (const content of [baseGlobal, baseMain]) {
      expect(content).not.toContain('@./.claude-global.md');
      expect(content).not.toContain('/workspace/ipc/');
      expect(content).not.toContain('available_groups.json');
      expect(content).not.toContain('registered_groups table');
      expect(content).not.toContain('/workspace/project/store/messages.db');
    }

    expect(baseGlobal).not.toContain('create_agent');
    expect(baseGlobal).not.toContain('wire_agents');
    expect(baseMain).toContain('mcp__nanoclaw__create_agent');
    expect(baseMain).toContain('mcp__nanoclaw__wire_agents');
  });

  it('bootstrap skills should point at the current v2 skill branches', () => {
    const dashboardSkill = fs.readFileSync(
      path.join(process.cwd(), '.claude', 'skills', 'add-dashboard', 'SKILL.md'),
      'utf-8',
    );
    const slangSkill = fs.readFileSync(path.join(process.cwd(), '.claude', 'skills', 'add-slang', 'SKILL.md'), 'utf-8');

    expect(dashboardSkill).toContain('git fetch slang skill/v2_dashboard');
    expect(dashboardSkill).toContain('git merge slang/skill/v2_dashboard');
    expect(dashboardSkill).toContain('groups/templates/projects/dashboard/formatting.yaml');
    expect(dashboardSkill).toContain(
      'No direct edits to `groups/main/CLAUDE.md` or `groups/global/CLAUDE.md` are needed.',
    );
    expect(dashboardSkill).toContain('npm run rebuild:claude');
    expect(dashboardSkill).not.toContain('via IPC');
    expect(slangSkill).toContain('git fetch slang skill/v2_slang');
    expect(slangSkill).toContain('git merge slang/skill/v2_slang');
  });

  it('add-slang should use prompt layering instead of patching base CLAUDE files', () => {
    const slangSkill = fs.readFileSync(path.join(process.cwd(), '.claude', 'skills', 'add-slang', 'SKILL.md'), 'utf-8');

    expect(slangSkill).toContain('No direct edits to `groups/main/CLAUDE.md` or `groups/global/CLAUDE.md` are needed.');
    expect(slangSkill).toContain('groups/templates/projects/slang/main-overlay.yaml');
    expect(slangSkill).toContain('groups/templates/projects/slang/global-overlay.yaml');
    expect(slangSkill).toContain('groups/templates/projects/slang/coworker-base.yaml');
    expect(slangSkill).toContain('npm run rebuild:claude');
    expect(slangSkill).toContain('ls container/skills/slang-templates/templates/*.yaml');
    expect(slangSkill).not.toContain("printf '\\n---\\n' >>");
  });
});
