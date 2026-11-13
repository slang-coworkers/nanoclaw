// Fork-owned. Shared by the Claude provider (createPreToolUseHook), the
// OpenCode hook bridge and the Pi hooks extension, so every provider blocks an
// issue close the same way.

/**
 * Detect a Bash command that would CLOSE a GitHub issue. Closing a
 * contributor's issue (even a genuine duplicate of a maintainer-owned issue)
 * is a maintainer privilege — coworkers triage and comment, they do not close.
 * This is a deterministic backstop for the instruction-level guardrail: the
 * #11719 regression closed an issue as a duplicate after the prose guardrail
 * (scoped to "PRs", not issues) let it through and the orchestrator authorized
 * it. We block the command's *content* because the close rides inside a Bash
 * `gh` / GraphQL call, which the SDK's tool-name `disallowedTools` can't see.
 *
 * Covers the two paths observed in the wild:
 *   - REST:    gh issue close … / gh api … issues/<n> -f state=closed / state_reason=…
 *   - GraphQL: a `closeIssue(` mutation (used because REST state_reason 403s for the App token)
 *
 * Deliberately does NOT match `gh pr close` or `closePullRequest` — PR close is
 * a separate surface the fixer/reviewer legitimately use. Returns the matched
 * fragment (for the block message) or null.
 */
export function detectIssueClose(command: string | undefined): string | null {
  if (!command || typeof command !== 'string') return null;
  // GraphQL mutation: closeIssue( … ). PR equivalent is closePullRequest, which
  // won't match this because of the trailing `(` boundary after "Issue".
  if (/\bcloseIssue\s*\(/i.test(command)) return 'GraphQL closeIssue mutation';
  // REST via gh CLI: `gh issue close <n>` (allow flags/`-R` between).
  if (/\bgh\s+issue\s+close\b/i.test(command)) return 'gh issue close';
  // REST via gh api: a PATCH to issues/<n> that sets state=closed or any
  // state_reason. Require an issues path so we don't catch PR endpoints.
  if (/\bgh\s+api\b/i.test(command) && /\/issues\/\d+/i.test(command) && /\bstate(_reason)?=/i.test(command)) {
    return 'gh api issues state change';
  }
  return null;
}

/**
 * The refusal for a Bash command that would close a GitHub issue, or null when
 * the command closes none or the group may close issues. The opt-out is the
 * per-group env flag NANOCLAW_ALLOW_ISSUE_CLOSE=1 (unset everywhere today), so
 * a maintainer-grade group can get the capability through container config.
 */
export function issueCloseRefusal(command: string | undefined, env: NodeJS.ProcessEnv = process.env): string | null {
  if (env.NANOCLAW_ALLOW_ISSUE_CLOSE === '1') return null;
  const match = detectIssueClose(command);
  if (!match) return null;
  return (
    `Closing a GitHub issue (${match}) is a maintainer-only action — coworkers triage and comment, they do not close. ` +
    `Post your duplicate/wontfix verdict as an issue comment and leave the close to a human maintainer.`
  );
}
