// Integration tests for container/hooks/gate-ste-writing.sh (+ lib/ste_gate.py).
//
// Text that other people read follows the slang-ste-writing skill. The gate finds
// the skill's checker in the group, runs it on every PR or issue body the Bash
// command sets, and refuses a body with findings. A group without the skill is
// never checked. The tests install a tiny stand-in checker (flags "utilize") so
// they verify the plumbing, not the skill's rules.
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-ste-writing.sh');
let tmp: string;
let checker: string;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-ste-'));
  checker = path.join(tmp, 'ste_check.py');
  fs.writeFileSync(
    checker,
    [
      'def check_text(text):',
      '    out = []',
      '    for n, ln in enumerate(text.split("\\n"), 1):',
      '        if "utilize" in ln.lower():',
      '            out.append((n, "unapproved word \'utilize\': use"))',
      '    return out',
      '',
    ].join('\n'),
  );
});
afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

function run(command: string, env: Record<string, string> = {}) {
  return runTool('Bash', { command }, env);
}

function runTool(toolName: string, toolInput: Record<string, unknown>, env: Record<string, string> = {}) {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify({ tool_name: toolName, tool_input: toolInput, cwd: tmp }),
    env: { PATH: process.env.PATH || '', HOME: tmp, STE_CHECK: checker, ...env },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: (proc.stderr ?? '').trim() };
}

const heredoc = (cmd: string, body: string) => `${cmd} --body "$(cat <<'EOF'\n${body}\nEOF\n)"`;

describe('gate-ste-writing.sh', () => {
  it('refuses a PR description with findings and names them on one line', () => {
    const r = run(heredoc('gh pr create -R o/r --title t', '**Motivation.** We utilize a cache.'));
    expect(r.status).toBe(2);
    expect(r.stderr.split('\n')).toHaveLength(1);
    expect(r.stderr).toContain('WRITING CHECK for gh pr create');
    expect(r.stderr).toContain("unapproved word 'utilize'");
    expect(r.stderr).toContain('slang-ste-writing');
  });

  it('checks issue bodies and comments too', () => {
    expect(run(heredoc('gh issue create -R o/r --title t', 'Utilize the flag.')).status).toBe(2);
    expect(run(heredoc('gh issue comment 7 -R o/r', 'Utilize the flag.')).stderr).toContain('gh issue comment');
    expect(run(heredoc('gh issue comment 7 -R o/r', 'Use the flag.')).status).toBe(0);
  });

  it('allows clean text, other commands, and groups without the skill', () => {
    expect(run(heredoc('gh pr create --title t', '**Motivation.** We use a cache.')).status).toBe(0);
    expect(run('gh pr view 1 --json body').status).toBe(0);
    expect(run('echo utilize').status).toBe(0);
    expect(
      run(heredoc('gh pr create --title t', 'Utilize it.'), { STE_CHECK: path.join(tmp, 'missing.py') }).status,
    ).toBe(0);
    expect(run(heredoc('gh pr create --title t', 'Utilize it.'), { STE_WRITING_GATE: '0' }).status).toBe(0);
  });

  it('reads --body-file and leaves unreadable issue text to the description gate', () => {
    const f = path.join(tmp, 'b.md');
    fs.writeFileSync(f, 'Utilize it.');
    expect(run(`gh issue create --title t --body-file ${f}`).status).toBe(2);
    expect(run('gh issue create --title t --body "$DESC"').status).toBe(0);
  });

  it('checks gh pr comment / review and gh api comment endpoints', () => {
    expect(run(heredoc('gh pr comment 7 -R o/r', 'Utilize the flag.')).stderr).toContain('gh pr comment');
    expect(run(heredoc('gh pr review 7 -R o/r --comment', 'Utilize the flag.')).stderr).toContain('gh pr review');
    expect(run(`gh api -X POST repos/o/r/issues/7/comments -f body='Utilize it.'`).stderr).toContain(
      'gh api …/comments',
    );
    expect(run(`gh api -X POST repos/o/r/pulls/7/reviews -f body='Utilize it.' -f event=COMMENT`).status).toBe(2);
    expect(run(`gh api -X POST repos/o/r/issues/7/comments -f body='Use it.'`).status).toBe(0);
    expect(run(`gh api repos/o/r/issues/7/comments`).status).toBe(0);
  });

  it('checks the body fields of GitHub MCP write tools', () => {
    const r = runTool('mcp__github__add_comment_to_pending_review', {
      body: 'Utilize a cache.',
      path: 'a.cpp',
      line: 3,
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('github add_comment_to_pending_review');
    expect(
      runTool('mcp__github__submit_pending_pull_request_review', { body: 'Use a cache.', event: 'COMMENT' }).status,
    ).toBe(0);
    expect(runTool('mcp__github__get_pull_request', { pullNumber: 1 }).status).toBe(0);
  });

  it('refuses a numbered part of a split chat post in every group', () => {
    const discord = 'mcp__slang-mcp__discord_send_message';
    const noSkill = { STE_CHECK: path.join(tmp, 'missing.py') };
    for (const content of ['(part 2/5)\n**Report**', 'Part 1 of 3: report', '[2/4] report']) {
      const r = runTool(discord, { channel_id: '1', content }, noSkill);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('thread_id');
    }
    expect(
      runTool(discord, { channel_id: '1', content: 'Weekly report. Details in the thread.' }, noSkill).status,
    ).toBe(0);
    const slack = runTool(
      'mcp__slang-mcp__slack_post_message',
      { channel_id: 'C1', text: '(part 1/2) report' },
      noSkill,
    );
    expect(slack.status).toBe(2);
    expect(
      runTool('mcp__slang-mcp__slack_reply_to_thread', { channel_id: 'C1', thread_ts: '1', text: 'Utilize it.' })
        .status,
    ).toBe(2);
  });

  it('runs the writing checker on a Discord post when the skill is installed', () => {
    const discord = 'mcp__slang-mcp__discord_send_message';
    const r = runTool(discord, { channel_id: '1', content: 'Utilize the thread.' });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('WRITING CHECK for the chat post');
    expect(runTool(discord, { channel_id: '1', content: 'Use the thread.' }).status).toBe(0);
    expect(runTool(discord, { channel_id: '1', content: 'Utilize it.' }, { STE_WRITING_GATE: '0' }).status).toBe(0);
  });
});
