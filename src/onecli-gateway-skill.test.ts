/**
 * `CLAUDE.md` tells the reader that the container agent learns the credential
 * model from `container/skills/onecli-gateway/SKILL.md`. That directory went
 * missing on this fork: upstream `1240a0cf` replaced the in-repo copy with a
 * runtime fetch plus `SKILL.fallback.md`, and the fork absorbed the deletion
 * without either the fetch logic or the fallback.
 *
 * The skill still reached agents — but only because OneCLI installs it into the
 * container's skill dir at runtime, so there was no copy in the repo, no
 * fallback if that delivery stopped, and a documented path that did not exist.
 *
 * These tests pin the file's presence and the two claims that make it
 * load-bearing, so a future sync that drops it again fails here instead of
 * silently degrading credential handling.
 */
import fs from 'fs';
import path from 'path';

import { describe, expect, it } from 'vitest';

import { resolveAllowedSkillNames } from './claude-composer/skill-scope.js';

const SKILL_DIR = path.join(process.cwd(), 'container/skills/onecli-gateway');

describe('onecli-gateway container skill', () => {
  it('exists at the path CLAUDE.md documents', () => {
    expect(fs.existsSync(path.join(SKILL_DIR, 'SKILL.md'))).toBe(true);
  });

  it('carries the always-use-the-proxy directive the agent needs', () => {
    const skill = fs.readFileSync(path.join(SKILL_DIR, 'SKILL.md'), 'utf-8');

    // Without this the agent reaches for browser automation or an OAuth CLI.
    expect(skill).toMatch(/MUST use this skill/);
    // The rules that keep secrets out of chat. Collapse whitespace first: the
    // source wraps mid-sentence, so a line-anchored regex silently misses them.
    const flat = skill.replace(/\s+/g, ' ');
    expect(flat).toMatch(/never see or handle credential values/i);
    expect(flat).toMatch(/Never\*\* ask the user for API keys or tokens/i);
    expect(flat).toMatch(/Never\*\* use browser extensions/i);
  });

  it('ships the instructions fragment alongside it', () => {
    const instructions = fs.readFileSync(path.join(SKILL_DIR, 'instructions.md'), 'utf-8');

    expect(instructions).toMatch(/connect_url/);
    expect(instructions).toMatch(/Never ask the user for API keys or tokens/);
  });

  // The composer reaches it through the unclaimed-skill tier — no coworker type
  // declares it, so nothing has to be registered for it to be loadable. If that
  // tier ever stops covering it, a typed coworker loses credential guidance.
  it('is loadable by a typed coworker without any type claiming it', () => {
    const allowed = resolveAllowedSkillNames(process.cwd(), 'default');

    expect(allowed?.has('onecli-gateway')).toBe(true);
  });

  it('is documented at the path it actually occupies', () => {
    const doc = fs.readFileSync(path.join(process.cwd(), 'CLAUDE.md'), 'utf-8');
    const cited = doc.match(/`(container\/skills\/onecli-gateway\/[^`]+)`/);

    expect(cited).not.toBeNull();
    expect(fs.existsSync(path.join(process.cwd(), cited![1]))).toBe(true);
  });
});
