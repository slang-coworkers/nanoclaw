/**
 * scripts/fetch-skills.sh replaces a fetched skill without rewriting any file of
 * the live copy, so a skill script that is running during the hourly refresh
 * finishes on the bytes it started with.
 *
 * Consider a review runner script that an agent started from
 * container/skills/<skill>/scripts/ before the refresh. bash reads the script
 * it runs from the open file as it goes; when `gh skill install --force` wrote
 * the new version into the same file, the running bash continued at its old
 * offset in the new bytes and failed with a syntax error. The test runs the real
 * fetch-skills.sh in a throwaway project with a stub `gh` whose install writes
 * files the way gh does (truncate and rewrite), while a script of the old copy
 * is sleeping, and checks that the script ends exactly as the old copy says.
 */
import { spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import { afterEach, describe, expect, it } from 'vitest';

const REPO = path.resolve(__dirname, '..');
const SKILL = 'demo-skill';
const OLD_SHA = 'a'.repeat(40);
const NEW_SHA = 'b'.repeat(40);

// The old script: sleeps, then prints one line. The new script is longer
// before that point, so reading it from the old script's offset lands in the
// middle of a line.
const OLD_SCRIPT = '#!/bin/bash\nsleep 2\necho OLD-DONE\n';
const NEW_SCRIPT =
  '#!/bin/bash\n# This comment line makes the new version longer than the old one.\necho NEW-START\necho NEW-DONE\n';

function skillMd(sha: string): string {
  return [
    '---',
    `name: ${SKILL}`,
    'description: demo',
    'metadata:',
    '    github-path: skills/demo-skill',
    '    github-ref: refs/heads/main',
    '    github-repo: https://github.com/acme/skills',
    `    github-tree-sha: ${sha}`,
    '---',
    'Demo.',
    '',
  ].join('\n');
}

// A stub `gh` that answers the calls fetch-skills.sh makes. `skill install`
// writes into an existing file with a truncating write, as gh does, so the
// test also shows the old in-place failure when pointed at the live copy.
const GH_STUB = `#!/bin/bash
case "$1 $2" in
  "skill --help") exit 0 ;;
  "skill install")
    dir=""; while [ $# -gt 0 ]; do [ "$1" = "--dir" ] && dir="$2"; shift; done
    mkdir -p "$dir/${SKILL}/scripts"
    cat "$STUB_DIR/new-SKILL.md" > "$dir/${SKILL}/SKILL.md"
    cat "$STUB_DIR/new-run.sh" > "$dir/${SKILL}/scripts/run.sh"
    echo "Installed ${SKILL}"; exit 0 ;;
esac
if [ "$1" = "api" ]; then
  case "$2" in
    repos/acme/skills) echo acme/skills ;;
    repos/acme/skills/contents/skills*) echo ${NEW_SHA} ;;
    *) echo "unexpected api call: $*" >&2; exit 1 ;;
  esac
  exit 0
fi
echo "unexpected gh call: $*" >&2
exit 1
`;

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) fs.rmSync(d, { recursive: true, force: true });
});

/** Build a throwaway project with the real fetch-skills.sh and one fetched skill. */
function project(): { root: string; stub: string } {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'fetch-skills-test-'));
  dirs.push(root);
  fs.mkdirSync(path.join(root, 'scripts/lib'), { recursive: true });
  fs.copyFileSync(path.join(REPO, 'scripts/fetch-skills.sh'), path.join(root, 'scripts/fetch-skills.sh'));
  fs.copyFileSync(path.join(REPO, 'scripts/lib/gh-token.sh'), path.join(root, 'scripts/lib/gh-token.sh'));
  fs.mkdirSync(path.join(root, 'dist'));
  fs.writeFileSync(
    path.join(root, 'dist/claude-composer.js'),
    `exports.readCoworkerTypes = () => ({ demo: { skills: ['${SKILL}'], skillSource: 'acme/skills@main' } });
exports.resolveTypeChain = (types, name) => [types[name]];
`,
  );
  const skillDir = path.join(root, 'container/skills', SKILL);
  fs.mkdirSync(path.join(skillDir, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(skillDir, 'SKILL.md'), skillMd(OLD_SHA));
  fs.writeFileSync(path.join(skillDir, 'scripts/run.sh'), OLD_SCRIPT);
  fs.writeFileSync(path.join(skillDir, 'scripts/removed-upstream.sh'), 'echo gone\n');

  const stub = path.join(root, 'stub');
  fs.mkdirSync(stub);
  fs.writeFileSync(path.join(stub, 'gh'), GH_STUB, { mode: 0o755 });
  fs.writeFileSync(path.join(stub, 'new-SKILL.md'), skillMd(NEW_SHA));
  fs.writeFileSync(path.join(stub, 'new-run.sh'), NEW_SCRIPT);
  return { root, stub };
}

function env(stub: string): NodeJS.ProcessEnv {
  return { ...process.env, PATH: `${stub}:${process.env.PATH}`, STUB_DIR: stub, GH_TOKEN: 'test-token' };
}

/** Start the old copy's script and resolve with its output once it exits. */
function runOldScript(root: string, stub: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  const child = spawn('bash', [path.join(root, 'container/skills', SKILL, 'scripts/run.sh')], { env: env(stub) });
  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (b) => (stdout += b));
  child.stderr.on('data', (b) => (stderr += b));
  return new Promise((resolve) => child.on('close', (code) => resolve({ stdout, stderr, code })));
}

describe('fetch-skills.sh replaces a fetched skill without rewriting the live copy', () => {
  it('lets a script that runs during the refresh finish on its old bytes', async () => {
    const { root, stub } = project();
    const running = runOldScript(root, stub);
    // Let bash read the first command and start sleeping.
    await new Promise((r) => setTimeout(r, 500));

    const fetch = spawnSync('bash', [path.join(root, 'scripts/fetch-skills.sh')], {
      env: env(stub),
      encoding: 'utf-8',
    });
    expect(fetch.status, fetch.stdout + fetch.stderr).toBe(0);
    expect(fetch.stdout).toContain('Done: 1 fetched, 0 cached, 0 failed.');

    const old = await running;
    expect(old).toEqual({ stdout: 'OLD-DONE\n', stderr: '', code: 0 });

    // The live copy is now exactly the upstream one: new bytes, the new stamp,
    // and no file that upstream no longer has.
    const skillDir = path.join(root, 'container/skills', SKILL);
    expect(fs.readFileSync(path.join(skillDir, 'scripts/run.sh'), 'utf-8')).toBe(NEW_SCRIPT);
    expect(fs.readFileSync(path.join(skillDir, 'SKILL.md'), 'utf-8')).toContain(NEW_SHA);
    expect(fs.existsSync(path.join(skillDir, 'scripts/removed-upstream.sh'))).toBe(false);
    // No staging directory is left behind.
    expect(fs.readdirSync(root).filter((n) => n.startsWith('.fetch-skills-staging'))).toEqual([]);
    expect(fs.readdirSync(path.join(root, 'container/skills')).sort()).toEqual(['.external-skills.json', SKILL]);
  }, 20_000);

  it('installs a skill that is not there yet', () => {
    const { root, stub } = project();
    fs.rmSync(path.join(root, 'container/skills', SKILL), { recursive: true });

    const fetch = spawnSync('bash', [path.join(root, 'scripts/fetch-skills.sh')], {
      env: env(stub),
      encoding: 'utf-8',
    });
    expect(fetch.status, fetch.stdout + fetch.stderr).toBe(0);
    expect(fs.readFileSync(path.join(root, 'container/skills', SKILL, 'scripts/run.sh'), 'utf-8')).toBe(NEW_SCRIPT);
  });
});
