/**
 * Offer Claude-assisted debugging when a setup step fails.
 *
 * Flow:
 *   1. Check `claude` is on PATH — if not, offer to install it via
 *      setup/install-claude.sh. Then check auth via `claude auth status`
 *      — if not signed in, offer to run `claude setup-token` (browser
 *      OAuth with code-paste fallback for headless/remote systems).
 *      If either is declined or fails, silently skip.
 *   2. Ask the user for consent ("Want me to ask Claude for a fix?").
 *   3. Build a minimal prompt: the one-paragraph situation, the failing
 *      step's name/message/hint, and a short list of *file references*
 *      (not contents) so Claude can Read what it needs on its own.
 *   4. Spawn `claude -p --output-format text` with a 2-minute timeout and
 *      a spinner that shows elapsed time.
 *   5. Parse `REASON:` / `COMMAND:` out of the response. Show the reason
 *      in a clack note, then hand off to `setup/run-suggested.sh` for
 *      editable pre-fill + exec.
 *
 * Skippable with NANOCLAW_SKIP_CLAUDE_ASSIST=1 for CI/scripted runs.
 */
import { execSync, spawn, spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';

import * as p from '@clack/prompts';
import k from 'kleur';

import { extractClaudeOAuthToken } from './captured-token.js';
import { ensureAnswer } from './runner.js';
import { brandBody, fitToWidth, fmtDuration, note } from './theme.js';

export interface AssistContext {
  stepName: string;
  msg: string;
  hint?: string;
  /** Absolute path to the per-step raw log, if the caller has one. */
  rawLogPath?: string;
}

/**
 * File-path hints per step. Claude reads these on its own via its Read tool
 * rather than us stuffing contents into the prompt. Keys are step names as
 * they appear in fail() calls; values are repo-relative paths.
 */
export const STEP_FILES: Record<string, string[]> = {
  bootstrap: ['setup.sh', 'setup/install-node.sh', 'nanoclaw.sh'],
  environment: ['setup/environment.ts'],
  container: [
    'setup/container.ts',
    'setup/install-docker.sh',
    'container/Dockerfile',
  ],
  onecli: ['setup/onecli.ts'],
  auth: [
    'setup/auth.ts',
    'setup/register-claude-token.sh',
    'setup/install-claude.sh',
  ],
  mounts: ['setup/mounts.ts'],
  service: ['setup/service.ts'],
  'cli-agent': ['setup/cli-agent.ts', 'scripts/init-cli-agent.ts'],
  timezone: ['setup/timezone.ts', 'setup/lib/tz-from-claude.ts'],
  channel: ['setup/auto.ts'],
  verify: ['setup/verify.ts'],
  // Channel-specific sub-steps:
  'telegram-install': ['.claude/skills/add-telegram/SKILL.md', 'scripts/skill-apply.ts', 'setup/channels/telegram.ts'],
  'telegram-validate': ['setup/channels/telegram.ts'],
  'pair-telegram': ['setup/pair-telegram.ts', 'setup/channels/telegram.ts'],
  'discord-install': ['.claude/skills/add-discord/SKILL.md', 'scripts/skill-apply.ts', 'setup/channels/discord.ts'],
  'slack-install': ['.claude/skills/add-slack/SKILL.md', 'scripts/skill-apply.ts', 'setup/channels/slack.ts'],
  'slack-validate': ['setup/channels/slack.ts'],
  'imessage-install': ['.claude/skills/add-imessage/SKILL.md', 'scripts/skill-apply.ts', 'scripts/photon-setup.ts'],
  'imessage': ['setup/channels/run-channel-skill.ts', 'scripts/photon-setup.ts'],
  'teams-install': ['.claude/skills/add-teams/SKILL.md', 'scripts/skill-apply.ts', 'setup/channels/run-channel-skill.ts'],
  'teams-manifest': ['setup/lib/teams-manifest.ts', 'setup/channels/teams-manifest-build.ts'],
  'init-first-agent': [
    'scripts/init-first-agent.ts',
    'setup/channels/telegram.ts',
    'setup/channels/discord.ts',
  ],
};

export const BIG_PICTURE_FILES = ['README.md', 'setup/auto.ts'];

/**
 * Returns `true` if the user ran a Claude-suggested fix command; callers
 * can use that signal to offer a retry instead of aborting outright.
 * Returns `false` for every other outcome (skipped, declined, no command,
 * Claude unreachable, user chose not to run).
 */
export async function offerClaudeAssist(
  ctx: AssistContext,
  projectRoot: string = process.cwd(),
): Promise<boolean> {
  if (process.env.NANOCLAW_SKIP_CLAUDE_ASSIST === '1') return false;
  if (!(await ensureClaudeReady(projectRoot))) return false;

  const want = ensureAnswer(
    await p.confirm({
      message: 'Want me to ask Claude to diagnose this?',
      initialValue: true,
    }),
  );
  if (!want) return false;

  const prompt = buildPrompt(ctx, projectRoot);
  const response = await queryClaudeUnderSpinner(prompt, projectRoot);
  if (!response) return false;

  const parsed = parseResponse(response);
  if (!parsed) {
    p.log.warn(brandBody("Claude responded but I couldn't parse a command out of it."));
    p.log.message(k.dim(response.trim().slice(0, 500)));
    return false;
  }

  note(
    `${parsed.reason}\n\n${k.cyan('$')} ${parsed.command}`,
    "Claude's suggestion",
  );

  const run = ensureAnswer(
    await p.confirm({
      message: 'Run this command? (you can edit it before executing)',
      initialValue: true,
    }),
  );
  if (!run) return false;

  await runSuggested(parsed.command, projectRoot);
  return true;
}

/** One `git status --porcelain=v1 --untracked-files=all` entry. */
export interface StatusEntry {
  /** The two-character XY status code. `??` marks an untracked path. */
  code: string;
  /** Repo-relative path. */
  path: string;
}

/**
 * Everything uncommitted in the tree: staged, unstaged, AND untracked.
 *
 * `git diff --quiet` — the test this replaces — reports a clean tree for both of
 * the last two. An assist that committed its merge but left a staged fixup or a
 * half-written file behind therefore passed validation, and the setup step that
 * consumed the "composed" tree next picked up uncommitted agent output.
 *
 * A `git status` that cannot run returns a synthetic entry rather than an empty
 * list: not being able to inspect the tree must never read as "the tree is clean".
 */
export function worktreeResidue(projectRoot: string): StatusEntry[] {
  const r = spawnSync('git', ['status', '--porcelain=v1', '--untracked-files=all', '-z'], {
    cwd: projectRoot,
    encoding: 'utf-8',
  });
  if (r.status !== 0) {
    return [{ code: '!!', path: `<git status failed: ${(r.stderr ?? '').trim()}>` }];
  }

  const fields = (r.stdout ?? '').split('\0');
  const entries: StatusEntry[] = [];
  for (let i = 0; i < fields.length; i++) {
    const f = fields[i];
    if (!f) continue;
    const code = f.slice(0, 2);
    entries.push({ code, path: f.slice(3) });
    // Rename/copy entries carry the ORIGINAL path as a separate NUL field.
    if (code[0] === 'R' || code[0] === 'C') i++;
  }
  return entries;
}

/**
 * Delete exactly `paths` (repo-relative), then prune any directory they emptied.
 *
 * Deliberately NOT `git clean -fdx`. That would also take node_modules, .env,
 * local build caches — everything a developer's tree legitimately holds and git
 * ignores. Destroying those to tidy up after a failed merge assist is a far worse
 * outcome than the residue itself, so only paths this run OBSERVED appearing are
 * removed. Anything outside `projectRoot` is refused.
 */
export function removeRecordedFiles(projectRoot: string, paths: string[]): void {
  const root = path.resolve(projectRoot);
  const inside = (abs: string): boolean => abs.startsWith(root + path.sep);

  for (const rel of paths) {
    const abs = path.resolve(root, rel);
    if (!inside(abs)) continue;
    // eslint-disable-next-line no-empty -- best-effort cleanup; the caller re-checks
    try { fs.rmSync(abs, { force: true }); } catch {}
  }

  // Deepest first, so `a/b/c` is gone before we try `a/b`.
  const dirs = [...new Set(paths.map((rel) => path.dirname(rel)))]
    .filter((d) => d && d !== '.')
    .sort((a, b) => b.length - a.length);
  for (const d of dirs) {
    let cur = path.resolve(root, d);
    while (inside(cur)) {
      try {
        fs.rmdirSync(cur); // throws if the directory still holds anything
      } catch {
        break;
      }
      cur = path.dirname(cur);
    }
  }
}

/**
 * Is `maybeAncestor` reachable from `descendant`?
 *
 * Exit status is the whole answer: 0 yes, 1 no, anything else means git could
 * not tell us (a ref that does not exist, a broken repo). An unknown answer must
 * read as NO — this gates whether a composition is reported successful, and
 * "could not verify" is not "verified".
 */
export function isAncestor(projectRoot: string, maybeAncestor: string, descendant: string): boolean {
  const r = spawnSync('git', ['merge-base', '--is-ancestor', maybeAncestor, descendant], {
    cwd: projectRoot,
    stdio: 'ignore',
  });
  return r.status === 0;
}

/** Everything observed about the tree after the assist ran. */
export interface CompositionFacts {
  built: boolean;
  /** `git rev-parse --abbrev-ref HEAD` — the literal "HEAD" when detached. */
  branchNow: string;
  branchBefore: string;
  headBefore: string;
  headNow: string;
  /** origin/<branch> is reachable from HEAD. */
  overlayLanded: boolean;
  /** headBefore is reachable from headNow. */
  descendsFromStart: boolean;
  residueCount: number;
}

export type CompositionFailure =
  | 'build-failed'
  | 'uncommitted-residue'
  | 'branch-switched'
  | 'detached-head'
  | 'overlay-not-in-history'
  | 'history-rewritten'
  | 'no-new-commit';

/**
 * Did the assist actually do what the caller is about to rely on?
 *
 * Extracted as a pure function ON PURPOSE. The predicate used to be an inline
 * `built && advanced && residue.length === 0`, which is untestable without
 * driving a real Claude session — so the cases that mattered were never tested,
 * and two of them were wrong. Returning the SPECIFIC failure also stops a branch
 * switch from being reported with the same message as a merge conflict.
 *
 * Order matters: report the most fundamental problem first, since a rewritten
 * history also fails the "descends from start" check and would otherwise mask it.
 */
export function evaluateComposition(f: CompositionFacts): CompositionFailure | null {
  if (f.residueCount > 0) return 'uncommitted-residue';
  if (f.branchNow === 'HEAD') return 'detached-head';
  if (f.branchNow !== f.branchBefore) return 'branch-switched';
  if (f.headNow === f.headBefore) return 'no-new-commit';
  if (!f.descendsFromStart) return 'history-rewritten';
  if (!f.overlayLanded) return 'overlay-not-in-history';
  if (!f.built) return 'build-failed';
  return null;
}

function formatResidue(entries: StatusEntry[]): string {
  const shown = entries.slice(0, 10).map((e) => `  ${e.code} ${e.path}`);
  if (entries.length > shown.length) shown.push(`  … and ${entries.length - shown.length} more`);
  return shown.join('\n');
}

/**
 * LLM-assisted merge fallback (opt-in; the caller gates on NANOCLAW_LLM_MERGE).
 * Used when deterministic merge-train couldn't compose `branch` — a conflict
 * outside nv-main's owned set, or a merge whose is_owned resolution dropped an
 * overlay's shared-source edits so the tree no longer builds. Hands the merge to
 * Claude to resolve keep-both, then re-validates the build OURSELVES — the build,
 * not Claude's summary, is the source of truth. Rolls back to the clean
 * pre-attempt tree on any failure. Returns true iff the tree is composed + builds.
 *
 * "Composed" means committed. Leftover staged or untracked files are a HARD
 * failure, not a detail: the caller's next step reads the tree, and uncommitted
 * agent output there is indistinguishable from work that landed.
 */
export async function composeMergeViaClaude(
  branch: string,
  projectRoot: string = process.cwd(),
): Promise<boolean> {
  // Checked before anything else, including installing/authenticating Claude:
  // rollback restores tracked files from `startHead` and deletes untracked ones
  // this run saw appear. Neither is safe if the tree was already dirty — we would
  // discard the developer's uncommitted work, or fail to attribute residue.
  const before = worktreeResidue(projectRoot);
  if (before.length > 0) {
    p.log.error(
      `Not running the merge assist: ${projectRoot} has uncommitted changes, so a ` +
        'rollback could not restore it. Commit or stash them first.',
    );
    p.log.message(k.dim(formatResidue(before)));
    return false;
  }

  if (!(await ensureClaudeReady(projectRoot))) return false;

  const rev = (args: string): string =>
    execSync(`git ${args}`, { cwd: projectRoot, encoding: 'utf-8' }).trim();
  const startHead = rev('rev-parse HEAD');
  const currentBranch = rev('rev-parse --abbrev-ref HEAD');

  await queryClaudeUnderSpinner(buildMergePrompt(branch, currentBranch, startHead), projectRoot);

  // Source of truth: a committed merge that actually builds. Don't trust Claude's
  // text — verify the tree.
  //
  // "HEAD moved and it builds" is NOT enough, and that was the bug. An unrelated
  // or empty commit moves HEAD. So does switching to another branch and
  // committing there. Both used to be reported as a successful composition of
  // `branch`, and the caller then read a tree that never received the overlay.
  // So verify the three things the caller actually relies on:
  //
  //   1. we are still on the branch we started on (not detached, not switched)
  //   2. the requested overlay is genuinely in this history
  //   3. it was built ON TOP of where we started, rather than by resetting away
  //
  // Ancestry alone is not sufficient either — `origin/<branch>` can be an
  // ancestor while unrelated commits also landed — so (3) pins the base and the
  // caller gets the exact range in the log.
  const built =
    spawnSync('pnpm', ['run', 'build'], { cwd: projectRoot, stdio: 'ignore' }).status === 0;
  const head = rev('rev-parse HEAD');
  const branchNow = rev('rev-parse --abbrev-ref HEAD');
  const residue = worktreeResidue(projectRoot);

  const failure = evaluateComposition({
    built,
    branchNow,
    branchBefore: currentBranch,
    headBefore: startHead,
    headNow: head,
    overlayLanded: isAncestor(projectRoot, `origin/${branch}`, head),
    descendsFromStart: isAncestor(projectRoot, startHead, head),
    residueCount: residue.length,
  });

  if (failure === null) {
    const landed = rev(`rev-list --count ${startHead}..HEAD`);
    p.log.success(
      `Claude composed ${branch} and the tree builds ` +
        `(${landed} commit(s) on ${currentBranch}, ${startHead.slice(0, 9)}..${head.slice(0, 9)}).`,
    );
    return true;
  }

  // Say WHICH invariant failed. "couldn't compose" with no reason is how a
  // branch switch looked identical to a merge conflict.
  const EXPLAIN: Record<CompositionFailure, string> = {
    'uncommitted-residue': '', // reported in detail below, with the file list
    'detached-head': `Claude left the repo on a detached HEAD instead of '${currentBranch}'.`,
    'branch-switched': `Claude ended on '${branchNow}' instead of '${currentBranch}' — the composition did not land where the caller will read it.`,
    'no-new-commit': 'Nothing was committed — the overlay was not composed.',
    'history-rewritten': `HEAD is no longer a descendant of ${startHead.slice(0, 9)} — history was reset or rewritten rather than merged.`,
    'overlay-not-in-history': `The tree builds, but origin/${branch} is not in HEAD's history — whatever was committed, it was not this overlay.`,
    'build-failed': `The composed tree does not build.`,
  };
  if (EXPLAIN[failure]) p.log.error(`${EXPLAIN[failure]} Treating ${branch} as not composed.`);

  if (residue.length > 0) {
    // The build passing does not redeem this: a green build over uncommitted
    // files is precisely how unreviewed agent output reached the next step.
    p.log.error(
      `Claude left ${residue.length} uncommitted change(s) after composing ${branch} — ` +
        'treating that as a failed composition.',
    );
    p.log.message(k.dim(formatResidue(residue)));
  }

  spawnSync('git', ['merge', '--abort'], { cwd: projectRoot, stdio: 'ignore' });
  // Get back onto the branch we started on BEFORE resetting. `reset --hard`
  // moves whatever ref is currently checked out: if Claude switched branches (or
  // detached), the old code reset the WRONG branch to our start commit and left
  // the developer standing on it — destroying an unrelated branch's history
  // while reporting a tidy rollback.
  if (rev('rev-parse --abbrev-ref HEAD') !== currentBranch) {
    const back = spawnSync('git', ['checkout', '--force', currentBranch], {
      cwd: projectRoot,
      stdio: 'ignore',
    });
    if (back.status !== 0) {
      // Refuse to reset from an unknown ref. Leaving the tree visibly wrong beats
      // silently moving a branch we did not intend to touch.
      p.log.error(
        `Rollback stopped: could not return to '${currentBranch}' (now on ` +
          `'${rev('rev-parse --abbrev-ref HEAD')}'). Not resetting — resolve this by hand; ` +
          `the pre-assist commit was ${startHead}.`,
      );
      return false;
    }
  }
  spawnSync('git', ['reset', '--hard', startHead], { cwd: projectRoot, stdio: 'ignore' });
  // `reset --hard` restores tracked files and leaves untracked ones exactly where
  // they are; the pre-flight check above guarantees every untracked path here
  // appeared during the assist, so removing precisely these is both sufficient
  // and the most this may safely delete.
  removeRecordedFiles(
    projectRoot,
    residue.filter((e) => e.code === '??').map((e) => e.path),
  );

  const after = worktreeResidue(projectRoot);
  if (after.length > 0) {
    p.log.warn(`Rolled back ${branch}, but the tree is still not clean — inspect it:`);
    p.log.message(k.dim(formatResidue(after)));
    return false;
  }
  p.log.warn(`Claude couldn't compose ${branch} into a building tree — rolled back.`);
  return false;
}

function buildMergePrompt(branch: string, currentBranch: string, startHead: string): string {
  return [
    `Compose the NanoClaw fork overlay branch \`origin/${branch}\` into \`${currentBranch}\`.`,
    '',
    'Steps:',
    `1. Run: git merge origin/${branch} --no-edit`,
    `2. Resolve EVERY conflict by keeping BOTH sides' intent. ${branch} is an overlay whose`,
    "   source edits ADD to nv-main's — they do not replace them. If nv-main and this branch",
    '   both changed a symbol (e.g. in create-agent.ts, agent-groups.ts), the result must',
    '   contain both changes. Never drop one side.',
    '3. For pure-infra files take nv-main outright: package.json, pnpm-lock.yaml, .github/*,',
    '   tsconfig.json, vitest.config.ts, vitest.setup.ts, versions.json.',
    '4. Run `pnpm run build`. Fix every TypeScript error — they usually mean a file you kept',
    '   references a symbol you dropped from another file; restore it so both sides cohere.',
    '5. When `pnpm run build` exits 0, commit: git commit --no-edit. Do NOT push.',
    '6. Leave NOTHING uncommitted. `git status --porcelain --untracked-files=all` must',
    '   print nothing when you stop — no staged fixups, no scratch files, no leftover',
    '   build artifacts. A non-empty status is treated as a failed composition and',
    '   rolled back, however good the merge itself was.',
    '',
    `If you cannot make it build, run \`git reset --hard ${startHead}\`, delete any files`,
    'you created, and stop.',
  ].join('\n');
}

function isClaudeInstalled(): boolean {
  try {
    execSync('command -v claude', { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

function isClaudeAuthenticated(): boolean {
  try {
    execSync('claude auth status', { stdio: 'ignore', timeout: 5_000 });
    return true;
  } catch {
    return false;
  }
}

/**
 * True when the Claude CLI is already installed AND signed in — the only
 * state in which a non-claude install may be offered a Claude debugger.
 * Unlike `ensureClaudeReady`, this never prompts and has no side effects.
 */
export function isClaudeReady(): boolean {
  return isClaudeInstalled() && isClaudeAuthenticated();
}

export async function ensureClaudeReady(projectRoot: string): Promise<boolean> {
  if (!isClaudeInstalled()) {
    const install = ensureAnswer(
      await p.confirm({
        message:
          'Claude CLI is needed to diagnose this. Install it now?',
        initialValue: true,
      }),
    );
    if (!install) return false;

    const code = spawnSync('bash', ['setup/install-claude.sh'], {
      cwd: projectRoot,
      stdio: 'inherit',
    }).status;
    if (code !== 0 || !isClaudeInstalled()) {
      p.log.error("Couldn't install the Claude CLI.");
      return false;
    }
    p.log.success('Claude CLI installed.');
  }

  if (!isClaudeAuthenticated()) {
    const auth = ensureAnswer(
      await p.confirm({
        message:
          "Claude CLI isn't signed in. Sign in now? (a browser will open)",
        initialValue: true,
      }),
    );
    if (!auth) return false;

    // setup-token has an interactive TUI; reset terminal to cooked mode
    // so its prompts render correctly after clack's raw-mode prompts.
    spawnSync('stty', ['sane'], { stdio: 'inherit' });

    // Run under script(1) to capture the OAuth token from PTY output
    // while preserving interactive TTY for the browser OAuth flow.
    // Same approach as register-claude-token.sh, but we set the env var
    // instead of writing to OneCLI.
    const tmpfile = path.join(os.tmpdir(), `claude-setup-token-${process.pid}`);
    try {
      const isUtilLinux = (() => {
        try {
          return execSync('script --version 2>&1', { encoding: 'utf-8' }).includes('util-linux');
        } catch { return false; }
      })();
      const scriptArgs = isUtilLinux
        ? ['-q', '-c', 'claude setup-token', tmpfile]
        : ['-q', tmpfile, 'claude', 'setup-token'];

      spawnSync('script', scriptArgs, {
        cwd: projectRoot,
        stdio: 'inherit',
      });

      if (!isClaudeAuthenticated() && fs.existsSync(tmpfile)) {
        const token = extractClaudeOAuthToken(fs.readFileSync(tmpfile, 'utf-8'));
        if (token) process.env.CLAUDE_CODE_OAUTH_TOKEN = token;
      }
    } finally {
      // eslint-disable-next-line no-empty -- best-effort temp cleanup
      try { fs.unlinkSync(tmpfile); } catch {}
    }

    if (!isClaudeAuthenticated()) {
      p.log.error("Couldn't complete Claude sign-in.");
      return false;
    }
    p.log.success('Claude CLI signed in.');
  }

  return true;
}

function buildPrompt(ctx: AssistContext, projectRoot: string): string {
  const stepRefs = STEP_FILES[ctx.stepName] ?? [];
  const references = [
    ...BIG_PICTURE_FILES,
    ...stepRefs,
    'logs/setup.log',
    ctx.rawLogPath
      ? path.relative(projectRoot, ctx.rawLogPath)
      : 'logs/setup-steps/',
  ].filter((v, i, a) => a.indexOf(v) === i);

  const hintLine = ctx.hint ? `Hint shown to the user: ${ctx.hint}\n` : '';

  return [
    "I'm trying to set up NanoClaw on my machine and ran into an issue",
    'during the setup flow. Please read the referenced files to understand',
    'the flow and the step that failed, look at the logs to see what went',
    'wrong, then suggest a single bash command I can run to fix it.',
    '',
    `Failed step: ${ctx.stepName}`,
    `Error shown to the user: ${ctx.msg}`,
    hintLine,
    'References (read as needed with your Read tool):',
    ...references.map((r) => `  - ${r}`),
    '',
    'Respond in EXACTLY this format, nothing before or after:',
    '',
    'REASON: <one short line describing the root cause>',
    'COMMAND: <single bash command, one line, no backticks>',
    '',
    'If no safe single command can fix it, respond with:',
    'REASON: <why>',
    'COMMAND: none',
  ].join('\n');
}

/**
 * Fixed-height scrolling window for Claude's progress.
 *
 * Clack's spinner only owns one line, so long tool-use breadcrumbs wrap
 * and blow out the gutter. Instead we manage a 4-line window ourselves:
 * a spinner header + 3 lines showing the most recent tool actions. On
 * each update we use raw ANSI (cursor up, clear line) to redraw in
 * place. When the query finishes we clear the whole block and emit a
 * single `p.log.success` / `p.log.error` so the flow continues in
 * standard clack style.
 */
const WINDOW_SIZE = 3;
const SPINNER_FRAMES = ['◒', '◐', '◓', '◑'];
const HIDE_CURSOR = '\x1b[?25l';
const SHOW_CURSOR = '\x1b[?25h';

async function queryClaudeUnderSpinner(
  prompt: string,
  projectRoot: string,
): Promise<string | null> {
  const out = process.stdout;
  const start = Date.now();
  const actions: string[] = [];
  let frameIdx = 0;

  const redraw = (): void => {
    // Move cursor back to the start of the block (WINDOW_SIZE + 1 = header + window).
    out.write(`\x1b[${WINDOW_SIZE + 1}A`);

    const icon = SPINNER_FRAMES[frameIdx % SPINNER_FRAMES.length];
    const suffix = ` (${fmtDuration(Date.now() - start)})`;
    const header = fitToWidth('Asking Claude to diagnose…', suffix);
    out.write(`\x1b[2K${k.cyan(icon)}  ${header}${k.dim(suffix)}\n`);

    for (let i = 0; i < WINDOW_SIZE; i++) {
      const idx = actions.length - WINDOW_SIZE + i;
      const action = idx >= 0 ? actions[idx] : '';
      out.write('\x1b[2K');
      if (action) {
        out.write(`${k.gray('│')}  ${k.dim(`▸ ${fitToWidth(action, '')}`)}`);
      } else {
        out.write(k.gray('│'));
      }
      out.write('\n');
    }
  };

  const clearBlock = (): void => {
    out.write(`\x1b[${WINDOW_SIZE + 1}A`);
    for (let i = 0; i < WINDOW_SIZE + 1; i++) {
      out.write('\x1b[2K\n');
    }
    out.write(`\x1b[${WINDOW_SIZE + 1}A`);
  };

  // Seed the block: move cursor to a fresh line, then write (header + window)
  // blank lines so `redraw()`'s cursor-up math lands correctly. Hide the
  // cursor for the duration so the redraw doesn't flicker.
  out.write(HIDE_CURSOR);
  for (let i = 0; i < WINDOW_SIZE + 1; i++) out.write('\n');
  redraw();

  // If the user Ctrl-C's during the query, we never reach `finish()` —
  // add an exit hook so the cursor comes back regardless.
  const restoreCursorOnExit = (): void => {
    out.write(SHOW_CURSOR);
  };
  process.once('exit', restoreCursorOnExit);

  const frameTick = setInterval(() => {
    frameIdx++;
    redraw();
  }, 250);

  return new Promise((resolve) => {
    let lineBuf = '';
    let finalText = '';
    let stderr = '';
    let settled = false;

    const finish = (
      kind: 'ok' | 'error',
      payload: string | null,
    ): void => {
      clearInterval(frameTick);
      clearBlock();
      out.write(SHOW_CURSOR);
      process.off('exit', restoreCursorOnExit);
      const suffix = ` (${fmtDuration(Date.now() - start)})`;
      if (kind === 'ok') {
        p.log.success(`${brandBody(fitToWidth('Claude replied.', suffix))}${k.dim(suffix)}`);
        resolve(payload);
      } else {
        p.log.error(
          `${fitToWidth("Claude couldn't help here.", suffix)}${k.dim(suffix)}`,
        );
        const tail = stderr.trim().split('\n').slice(-3).join('\n');
        if (tail) p.log.message(k.dim(tail));
        resolve(null);
      }
    };

    // No hard timeout — debugging can take a long time, and the cost of
    // cutting Claude off mid-investigation is worse than letting the
    // spinner run. The user can Ctrl-C if they want to abort.
    //
    // Resume the same session on repeat invocations so Claude carries
    // context across failures in one setup run.
    const claudeArgs = [
      '-p',
      '--output-format',
      'stream-json',
      '--verbose',
      '--permission-mode',
      'bypassPermissions',
    ];
    if (claudeSessionId) {
      claudeArgs.push('--resume', claudeSessionId);
    }
    const child = spawn('claude', claudeArgs, {
      cwd: projectRoot,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    child.stdout.on('data', (c: Buffer) => {
      lineBuf += c.toString('utf-8');
      let idx: number;
      while ((idx = lineBuf.indexOf('\n')) !== -1) {
        const line = lineBuf.slice(0, idx);
        lineBuf = lineBuf.slice(idx + 1);
        if (!line.trim()) continue;
        try {
          const event = JSON.parse(line) as StreamEvent;
          // Capture the session id on the very first claude invocation of
          // this process so later calls can --resume it.
          if (
            !claudeSessionId &&
            event.type === 'system' &&
            event.subtype === 'init' &&
            typeof event.session_id === 'string'
          ) {
            claudeSessionId = event.session_id;
          }
          handleStreamEvent(event, {
            setAction: (a) => {
              actions.push(a);
              redraw();
            },
            appendText: (t) => {
              finalText += t;
            },
          });
        } catch {
          // Malformed or non-JSON line — ignore.
        }
      }
    });
    child.stderr.on('data', (c: Buffer) => {
      stderr += c.toString('utf-8');
    });
    child.on('close', (code) => {
      if (settled) return;
      settled = true;
      if (code === 0 && finalText.trim()) finish('ok', finalText);
      else finish('error', null);
    });
    child.on('error', () => {
      if (settled) return;
      settled = true;
      finish('error', null);
    });

    child.stdin.end(prompt);
  });
}

// Minimal shape of the stream-json events we care about. Claude emits
// many more, but we only read tool_use blocks (for breadcrumbs), text
// blocks (to reassemble the final REASON/COMMAND answer), and the
// session_id on the init event so follow-up invocations can resume the
// same conversation.
interface StreamEvent {
  type: string;
  subtype?: string;
  session_id?: string;
  message?: {
    content?: Array<
      | { type: 'text'; text: string }
      | { type: 'tool_use'; name: string; input: Record<string, unknown> }
    >;
  };
}

// The session id from the first claude-assist invocation in this process.
// Subsequent invocations pass `--resume <id>` so Claude sees prior failures
// as conversation history instead of treating each failure in isolation.
let claudeSessionId: string | null = null;

function handleStreamEvent(
  event: StreamEvent,
  cb: { setAction: (a: string) => void; appendText: (t: string) => void },
): void {
  if (event.type !== 'assistant') return;
  const blocks = event.message?.content ?? [];
  for (const block of blocks) {
    if (block.type === 'text') {
      cb.appendText(block.text);
    } else if (block.type === 'tool_use') {
      cb.setAction(formatToolUse(block.name, block.input));
    }
  }
}

function formatToolUse(name: string, input: Record<string, unknown>): string {
  const truncate = (v: string, n: number): string =>
    v.length > n ? v.slice(0, n) + '…' : v;
  if (name === 'Read') {
    const f = String(input.file_path ?? '');
    return `Reading ${shortenPath(f)}`;
  }
  if (name === 'Bash') {
    const cmd = String(input.command ?? '').replace(/\s+/g, ' ').trim();
    return `Running ${truncate(cmd, 60)}`;
  }
  if (name === 'Grep') return `Searching for "${truncate(String(input.pattern ?? ''), 40)}"`;
  if (name === 'Glob') return `Finding ${truncate(String(input.pattern ?? ''), 40)}`;
  return `Using ${name}`;
}

function shortenPath(abs: string): string {
  const root = process.cwd();
  return abs.startsWith(`${root}/`) ? abs.slice(root.length + 1) : abs;
}

function parseResponse(
  raw: string,
): { reason: string; command: string } | null {
  // Accept the fields anywhere in the output — Claude sometimes wraps the
  // answer in a trailing explanation we can safely ignore.
  const reasonMatch = raw.match(/^\s*REASON:\s*(.+?)\s*$/m);
  const commandMatch = raw.match(/^\s*COMMAND:\s*(.+?)\s*$/m);
  if (!reasonMatch || !commandMatch) return null;
  const command = commandMatch[1].trim();
  if (!command || command.toLowerCase() === 'none') return null;
  return { reason: reasonMatch[1].trim(), command };
}

function runSuggested(command: string, projectRoot: string): Promise<void> {
  const script = path.join(projectRoot, 'setup/run-suggested.sh');
  if (!fs.existsSync(script)) {
    p.log.error(`Missing helper: ${script}`);
    return Promise.resolve();
  }
  return new Promise((resolve) => {
    const child = spawn('bash', [script, command], {
      cwd: projectRoot,
      stdio: 'inherit',
    });
    child.on('close', () => resolve());
    child.on('error', () => resolve());
  });
}
