import { describe, expect, it } from 'bun:test';
import path from 'path';

import { issueCloseHookResult } from './issue-close-hook.js';

// Codex runs this as a PreToolUse hook command; Claude, OpenCode and Pi run the
// same check (issueCloseRefusal) in process.

describe('issue-close hook command', () => {
  it('blocks a Bash command that closes an issue, unless the group allows it', () => {
    const close = { tool_name: 'Bash', tool_input: { command: 'gh issue close 5 -R o/r' } };
    expect(issueCloseHookResult(close, {})).toMatchObject({
      code: 2,
      stderr: expect.stringContaining('maintainer-only'),
    });
    expect(issueCloseHookResult(close, { NANOCLAW_ALLOW_ISSUE_CLOSE: '1' })).toEqual({ code: 0, stderr: '' });
  });

  it('passes other commands, other tools and a pull request close', () => {
    expect(issueCloseHookResult({ tool_name: 'Bash', tool_input: { command: 'gh pr close 5' } }, {}).code).toBe(0);
    expect(issueCloseHookResult({ tool_name: 'Write', tool_input: { command: 'gh issue close 5' } }, {}).code).toBe(0);
    expect(issueCloseHookResult(null, {}).code).toBe(0);
  });

  it('runs as a command: exit 2 with the reason on stderr', () => {
    const proc = Bun.spawnSync(['bun', path.join(import.meta.dir, 'issue-close-hook.ts')], {
      stdin: Buffer.from(JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'gh issue close 1' } })),
      env: { PATH: process.env.PATH ?? '' },
    });
    expect(proc.exitCode).toBe(2);
    expect(proc.stderr.toString()).toContain('maintainer-only');
  });
});
