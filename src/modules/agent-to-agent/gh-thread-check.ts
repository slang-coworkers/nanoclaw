/**
 * Known GitHub threads — a2a.send refuses a fresh session on a GitHub thread id
 * that names no GitHub item this instance works on.
 *
 * A `gh-issue-`/`gh-pr-` thread id names one GitHub issue or PR, and
 * resolveSession gathers every coworker on that item into one chain under it.
 * The webhook builds these ids from GitHub's own repo name, but agents type them
 * by hand when they dispatch work, and a typo starts a session outside the chain.
 * Consider the Orchestrator sending shader-slang/slang#12371 to the triager on
 * `gh-issue-slang/slang-12371`: the triager starts a session on repo
 * `slang/slang`, an unrelated public project, apart from the chain that holds the
 * work, and the supervise gate then lists that repo every hour. We refuse a fresh
 * session when its thread has the GitHub prefix and either
 *
 *   - does not parse as an item (`gh-issue-shader-slang/slang-backend-codegen-perf`
 *     has no number, `gh-pr-slang-rhi-881-review` has no owner), or
 *   - names a repo that GitHub has never reported an issue or PR from
 *     (`gh_thread_origin`, which only webhook delivery writes).
 *
 * Deliveries into an existing session never mint one, so the check applies to
 * the `fresh` route only.
 */
import { listKnownGhRepos } from '../../db/gh-thread-origin.js';
import { parseGhWorkItem } from './item-ownership.js';

const GH_THREAD_PREFIX = /^gh-(?:issue|pr)-/;

/**
 * Return why a fresh session on `threadId` would not belong to a known GitHub
 * item, or null when it does or when the thread is not a GitHub thread. For
 * example `gh-issue-slang/slang-12371` returns "gh-issue-slang/slang-12371 names
 * repo slang/slang, which no GitHub issue or PR event has come from (known:
 * shader-slang/slang, …)", and `gh-issue-shader-slang/slang-12371` returns null.
 */
export async function findUnknownGhThread(threadId: string | null | undefined): Promise<string | null> {
  const thread = threadId?.trim();
  if (!thread || !GH_THREAD_PREFIX.test(thread)) return null;
  const item = parseGhWorkItem(thread);
  if (!item) {
    return `${thread} is not a GitHub item thread; the form is gh-issue-<owner>/<repo>-<number> or gh-pr-<owner>/<repo>-<number>`;
  }
  const repo = `${item.owner}/${item.repo}`;
  const known = await listKnownGhRepos();
  if (known.includes(repo)) return null;
  return `${thread} names repo ${repo}, which no GitHub issue or PR event has come from (known: ${known.join(', ') || 'none'})`;
}
