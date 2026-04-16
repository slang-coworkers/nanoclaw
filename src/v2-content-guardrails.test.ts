import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

function read(relativePath: string): string {
  return fs.readFileSync(path.join(process.cwd(), relativePath), 'utf-8');
}

describe('v2 content guardrails', () => {
  it('onboard-coworker skill should use v2 primitives', () => {
    const skillPath = path.join(process.cwd(), '.claude', 'skills', 'onboard-coworker', 'SKILL.md');

    expect(fs.existsSync(skillPath)).toBe(true);

    const source = fs.readFileSync(skillPath, 'utf-8');
    expect(source).toContain('coworkers/*.yaml');
    expect(source).toContain('mcp__nanoclaw__create_agent');
    expect(source).toContain('mcp__nanoclaw__wire_agents');
    expect(source).not.toContain('register_group');
    expect(source).not.toContain('claudeMdAppend');
    expect(source).not.toContain('/workspace/ipc');
  });

  it('base main prompt should teach v2 coworker orchestration primitives', () => {
    const source = read('groups/templates/base/main.yaml');

    expect(source).toContain('mcp__nanoclaw__create_agent');
    expect(source).toContain('mcp__nanoclaw__wire_agents');
    expect(source).toContain('groups/templates/instructions/');
    expect(source).not.toContain('register_group');
    expect(source).not.toContain('claudeMdAppend');
    expect(source).not.toContain('registered_groups');
    expect(source).not.toContain('target_group_jid');
    expect(source).not.toContain('/workspace/ipc');
    expect(source).not.toContain('store/messages.db');
  });

  it('instruction overlay templates should exist and contain substantive guidance', () => {
    const expectedTemplates = ['ci-focused.md', 'code-reviewer.md', 'terse-reporter.md', 'thorough-analyst.md'];

    for (const template of expectedTemplates) {
      const templatePath = path.join(process.cwd(), 'groups', 'templates', 'instructions', template);
      expect(fs.existsSync(templatePath), `missing instruction template ${template}`).toBe(true);

      const source = fs.readFileSync(templatePath, 'utf-8').trim();
      expect(source.length, `instruction template ${template} should not be empty`).toBeGreaterThan(40);
      expect(source.startsWith('## '), `instruction template ${template} should start with a heading`).toBe(true);
    }
  });

  it('base main prompt should document instruction overlays', () => {
    const source = read('groups/templates/base/main.yaml');
    expect(source).toContain('Instruction overlays');
    expect(source).toContain('thorough-analyst');
    expect(source).toContain('groups/templates/instructions/');
  });
});
