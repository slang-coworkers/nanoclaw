// Integration tests for container/hooks/gate-eval-sandbox.sh and its classifier
// container/hooks/lib/eval_sandbox.py.
//
// The hook is a symmetric opt-in like gate-critique-on-deliver.sh: it exits 0
// unless `<OVERLAY_MARKER_DIR>/.overlay-eval-sandbox` exists or
// EVAL_SANDBOX_ACTIVE=1 is in the environment. When active it refuses (exit 2,
// reason on stderr) every write to a GitHub repository outside
// EVAL_ALLOWED_REPOS and the two MCP tools that reach humans or write files,
// while reads pass.

import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const SCRIPT = path.resolve(process.cwd(), 'container', 'hooks', 'gate-eval-sandbox.sh');
const hasPython = spawnSync('python3', ['--version']).status === 0;
const hasJq = spawnSync('jq', ['--version']).status === 0;

interface RunResult {
  status: number;
  stderr: string;
}

let tmpRoot: string;
let overlayDir: string;
let markerFile: string;
let repoDir: string;

function run(payload: object, env: Record<string, string> = {}): RunResult {
  const proc = spawnSync('bash', [SCRIPT], {
    input: JSON.stringify({ cwd: repoDir, ...payload }),
    env: { PATH: process.env.PATH || '', OVERLAY_MARKER_DIR: overlayDir, ...env },
    encoding: 'utf-8',
  });
  return { status: proc.status ?? -1, stderr: proc.stderr ?? '' };
}

const bash = (command: string, env: Record<string, string> = {}) =>
  run({ tool_name: 'Bash', tool_input: { command } }, env);

function activate(): void {
  fs.writeFileSync(markerFile, 'eval-sandbox\n');
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'gate-eval-sandbox-'));
  overlayDir = path.join(tmpRoot, 'overlay');
  fs.mkdirSync(overlayDir, { recursive: true });
  markerFile = path.join(overlayDir, '.overlay-eval-sandbox');
  // A checkout whose `origin` is the fork and `upstream` is production, so the
  // git-push rule has real remotes to resolve.
  repoDir = path.join(tmpRoot, 'wt');
  fs.mkdirSync(repoDir);
  spawnSync('git', ['-C', repoDir, 'init', '-q']);
  spawnSync('git', ['-C', repoDir, 'remote', 'add', 'origin', 'git@github.com:slang-coworkers/slang-eval.git']);
  spawnSync('git', ['-C', repoDir, 'remote', 'add', 'upstream', 'https://github.com/shader-slang/slang.git']);
});

afterEach(() => {
  fs.rmSync(tmpRoot, { recursive: true, force: true });
});

describe.skipIf(!hasJq)('activation', () => {
  it('marker absent → a production PR create passes (the gate is opt-in)', () => {
    expect(fs.existsSync(markerFile)).toBe(false);
    const r = bash('gh pr create --repo shader-slang/slang --title x --body y');
    expect(r.status).toBe(0);
    expect(r.stderr).toBe('');
  });

  it('marker present → the same command is refused with a reason', () => {
    activate();
    const r = bash('gh pr create --repo shader-slang/slang --title x --body y');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('EVAL SANDBOX: refused');
    expect(r.stderr).toContain('shader-slang/slang');
    expect(r.stderr).toContain('slang-coworkers/slang-eval');
  });

  it('EVAL_SANDBOX_ACTIVE=1 gates without the marker; =0 disables despite the marker', () => {
    expect(bash('gh pr create --repo shader-slang/slang --title x', { EVAL_SANDBOX_ACTIVE: '1' }).status).toBe(2);
    activate();
    expect(bash('gh pr create --repo shader-slang/slang --title x', { EVAL_SANDBOX_ACTIVE: '0' }).status).toBe(0);
  });

  it('ignores tools it has no rule for', () => {
    activate();
    expect(run({ tool_name: 'Write', tool_input: { file_path: '/x', content: 'gh pr create' } }).status).toBe(0);
  });
});

describe.skipIf(!hasJq)('MCP tools that reach humans or write files', () => {
  it('refuses discord_send_message outright', () => {
    activate();
    const r = run({
      tool_name: 'mcp__slang-mcp__discord_send_message',
      tool_input: { channel_id: '1', content: 'hi' },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('never messages humans');
  });

  it('refuses github_create_or_update_file outright', () => {
    activate();
    const r = run({
      tool_name: 'mcp__slang-mcp__github_create_or_update_file',
      tool_input: { owner: 'slang-coworkers', repo: 'slang-eval', path: 'x', content: 'y' },
    });
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('git push to the fork');
  });

  it('lets the two tools through when the gate is inactive', () => {
    expect(run({ tool_name: 'mcp__slang-mcp__discord_send_message', tool_input: { content: 'hi' } }).status).toBe(0);
  });
});

describe.skipIf(!hasJq || !hasPython)('Bash: gh pr / gh issue', () => {
  beforeEach(activate);

  it('allows a draft PR on the fork', () => {
    expect(bash('gh pr create --repo slang-coworkers/slang-eval --draft --title "eval t1" --body b').status).toBe(0);
    expect(bash('gh pr create -R https://github.com/slang-coworkers/slang-eval --title t').status).toBe(0);
  });

  it('refuses a mutating gh pr command that names no --repo', () => {
    const r = bash('cd /workspace/agent/wt && gh pr create --draft --title t --body b');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('names no --repo');
  });

  for (const cmd of [
    'gh pr comment 12 --repo shader-slang/slang --body "looks good"',
    'gh pr review 12 -R shader-slang/slang --approve',
    'gh pr edit 12 --repo shader-slang/slang --title x',
    'gh pr merge 12 --repo shader-slang/slang --squash',
    'gh pr close 12 --repo shader-slang/slang',
    'gh issue create --repo shader-slang/slang --title t --body b',
    'gh issue comment 7 --repo=shader-slang/slang --body hi',
    'gh issue edit 7 --repo shader-slang/slang --add-label bug',
    'gh issue close 7 --repo shader-slang/slang',
    'gh repo fork shader-slang/slang --clone',
    'gh release create v1 --repo shader-slang/slang',
  ]) {
    it(`refuses: ${cmd}`, () => {
      const r = bash(cmd);
      expect(r.status).toBe(2);
      expect(r.stderr).toContain('EVAL SANDBOX');
    });
  }

  for (const cmd of [
    'gh pr view 12 --repo shader-slang/slang --json title,body',
    'gh pr list --repo shader-slang/slang --state open',
    'gh pr diff 12 --repo shader-slang/slang',
    'gh pr checks 12 --repo shader-slang/slang',
    'gh pr checkout 12 --repo shader-slang/slang',
    'gh issue view 7 --repo shader-slang/slang --comments',
    'gh issue list --repo shader-slang/slang --label bug',
    'gh repo clone shader-slang/slang /tmp/slang',
    'gh run view 123 --repo shader-slang/slang --log',
    'gh search issues "crash" --repo shader-slang/slang',
  ]) {
    it(`allows a read: ${cmd}`, () => {
      expect(bash(cmd).status).toBe(0);
    });
  }
});

describe.skipIf(!hasJq || !hasPython)('Bash: gh api', () => {
  beforeEach(activate);

  it('allows GET reads of production, explicit or implicit', () => {
    expect(bash('gh api repos/shader-slang/slang/pulls/1').status).toBe(0);
    expect(bash('gh api --method GET repos/shader-slang/slang/commits/abc/check-runs --jq .total_count').status).toBe(
      0,
    );
    expect(
      bash('gh api -H "Accept: application/vnd.github+json" repos/shader-slang/slang/issues?state=open').status,
    ).toBe(0);
    expect(bash('gh api --paginate repos/shader-slang/slang/pulls -q ".[].number"').status).toBe(0);
  });

  it('refuses a non-GET method or -f/-F fields against production', () => {
    expect(bash('gh api -X PATCH repos/shader-slang/slang/pulls/1 -f title=x').status).toBe(2);
    expect(bash('gh api --method DELETE repos/shader-slang/slang/issues/1/labels/bug').status).toBe(2);
    expect(bash('gh api repos/shader-slang/slang/issues/1/comments -f body=hi').status).toBe(2);
    expect(bash('gh api repos/shader-slang/slang/issues/1/labels -F labels[]=bug').status).toBe(2);
    expect(bash('gh api repos/shader-slang/slang/pulls --input body.json').status).toBe(2);
    expect(bash('gh api https://api.github.com/repos/shader-slang/slang/pulls -f title=x').status).toBe(2);
  });

  it('allows the same writes against the fork', () => {
    expect(bash('gh api repos/slang-coworkers/slang-eval/pulls -f title=x -f head=b -f base=main').status).toBe(0);
    expect(bash('gh api -X PATCH repos/slang-coworkers/slang-eval/pulls/3 -f draft=false').status).toBe(0);
  });

  it('allows GraphQL queries and refuses GraphQL mutations', () => {
    expect(bash('gh api graphql -f query=\'query { repository(owner:"a", name:"b") { id } }\'').status).toBe(0);
    const r = bash(
      'gh api graphql -f query=\'mutation { addComment(input:{subjectId:"x", body:"y"}) { clientMutationId } }\'',
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('GraphQL');
  });

  it('honours EVAL_ALLOWED_REPOS', () => {
    const env = { EVAL_ALLOWED_REPOS: 'acme/eval-a, acme/eval-b' };
    expect(bash('gh api repos/acme/eval-b/pulls -f title=x', env).status).toBe(0);
    expect(bash('gh api repos/slang-coworkers/slang-eval/pulls -f title=x', env).status).toBe(2);
  });
});

describe.skipIf(!hasJq || !hasPython)('Bash: git push', () => {
  beforeEach(activate);

  it('allows pushing to the fork by remote name, resolved from the checkout', () => {
    expect(bash('git push origin fix/eval-t1').status).toBe(0);
    expect(bash('git push -u origin HEAD').status).toBe(0);
    expect(bash('git push --force-with-lease origin fix/eval-t1').status).toBe(0);
    expect(bash(`cd ${repoDir} && git push origin HEAD`, {}).status).toBe(0);
    expect(bash('git push').status).toBe(0);
  });

  it('refuses pushing to production by remote name or URL', () => {
    const byName = bash('git push upstream fix/eval-t1');
    expect(byName.status).toBe(2);
    expect(byName.stderr).toContain('shader-slang/slang');
    expect(bash('git push https://github.com/shader-slang/slang.git HEAD:refs/heads/x').status).toBe(2);
    expect(bash('git push git@github.com:shader-slang/slang.git HEAD').status).toBe(2);
  });

  it('refuses a remote it cannot resolve (fail closed)', () => {
    const r = bash('git push mystery main');
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('could not be resolved');
  });

  it('leaves fetch, pull and local git alone', () => {
    expect(bash('git fetch upstream master && git rebase upstream/master').status).toBe(0);
    expect(bash('git pull --rebase upstream master').status).toBe(0);
    expect(bash('git commit -am "push the fix" && git log --oneline -3').status).toBe(0);
  });
});

describe.skipIf(!hasJq || !hasPython)('Bash: direct API calls', () => {
  beforeEach(activate);

  it('allows GET calls to api.github.com', () => {
    expect(bash('curl -s https://api.github.com/repos/shader-slang/slang/pulls/1').status).toBe(0);
    expect(
      bash('curl -sS -H "Accept: application/json" https://api.github.com/repos/shader-slang/slang/commits/abc/status')
        .status,
    ).toBe(0);
  });

  it('refuses mutating calls to production and allows them to the fork', () => {
    expect(
      bash('curl -X POST -d \'{"body":"hi"}\' https://api.github.com/repos/shader-slang/slang/issues/1/comments')
        .status,
    ).toBe(2);
    expect(bash('curl --json \'{"title":"x"}\' https://api.github.com/repos/shader-slang/slang/pulls').status).toBe(2);
    expect(bash("wget --post-data='{}' https://api.github.com/repos/shader-slang/slang/issues").status).toBe(2);
    expect(
      bash(
        'python3 -c "import requests; requests.post(\'https://api.github.com/repos/shader-slang/slang/issues\', json={})"',
      ).status,
    ).toBe(2);
    expect(
      bash("node -e \"fetch('https://api.github.com/repos/shader-slang/slang/pulls/1/reviews', {method: 'POST'})\"")
        .status,
    ).toBe(2);
    expect(
      bash("curl -X POST -d '{}' https://api.github.com/repos/slang-coworkers/slang-eval/issues/1/comments").status,
    ).toBe(0);
  });

  it('refuses GraphQL mutations over curl', () => {
    const r = bash(
      'curl -H \'Authorization: bearer x\' --json \'{"query":"mutation { addComment(input:{}) { clientMutationId } }"}\' https://api.github.com/graphql',
    );
    expect(r.status).toBe(2);
    expect(r.stderr).toContain('GraphQL');
  });
});

describe.skipIf(!hasJq || !hasPython)('Bash: command shapes', () => {
  beforeEach(activate);

  it('does not read heredoc bodies as commands', () => {
    const cmd = "cat > /tmp/notes.md <<'EOF'\ngh pr create --repo shader-slang/slang --title x\nEOF\necho written";
    expect(bash(cmd).status).toBe(0);
  });

  it('finds a write in a later segment of a compound command', () => {
    const cmd = 'cd /tmp && git fetch upstream && gh pr comment 1 --repo shader-slang/slang --body done';
    expect(bash(cmd).status).toBe(2);
  });

  it('passes commands that only mention gh in text', () => {
    expect(bash('echo "run gh pr create later" && ls -la').status).toBe(0);
    expect(bash('npm test && make build').status).toBe(0);
  });
});
