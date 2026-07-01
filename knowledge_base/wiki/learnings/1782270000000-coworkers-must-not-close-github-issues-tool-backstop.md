---
title: "Coworkers must not close GitHub issues — deterministic tool backstop"
type: learning
topic: misc
source: learnings/1782270000000-coworkers-must-not-close-github-issues-tool-backstop.md
---

# Coworkers must not close GitHub issues — deterministic tool backstop

**What:** No coworker (triager, fixer, reviewer, maintainer) may CLOSE a GitHub issue. Closing a contributor's issue — even a genuine duplicate of a maintainer-owned issue — is a human-maintainer privilege. Coworkers **triage and comment** (post the duplicate/wontfix verdict + cross-link the canonical issue) and **leave the close to a human**.

**Why this learning exists:** shader-slang/slang#11719 ("Support `ResourceDescriptorHeap`/`SamplerDescriptorHeap` syntax", author chaoticbob) was auto-closed as a duplicate of #11568 on 2026-06-24. The close was *authorized by the orchestrator* (it treated "comment-first, then close" as a routine reversible triage action) and the triage-workflow prose guardrail only forbade closing **PRs**, not issues — so nothing stopped it. The maintainer should have made that call.

**The backstop (defense-in-depth, code layer):** `container/agent-runner/src/providers/claude.ts` — `detectIssueClose()` + a branch in `preToolUseHook`. It inspects every **Bash** command and hard-blocks an issue-close at the tool boundary, independent of what the model was told or authorized:
- `gh issue close …`
- GraphQL `closeIssue(` mutation (the path #11719 actually used — REST `state_reason` PATCH 403s for the App token, GraphQL succeeds)
- `gh api …/issues/<n> … state=closed` / `state_reason=…`

Deliberately does NOT match `gh pr close` / `closePullRequest` (PR close is the fixer/reviewer's legitimate surface), nor issue reads/comments/labels/lists.

**Opt-out:** per-group env `NANOCLAW_ALLOW_ISSUE_CLOSE=1` (unset everywhere today). A future maintainer-grade group can be granted the capability via container config — not a code edit.

**Note on layering:** the SDK's `disallowedTools` can't do this — it blocks whole *named tools*, but the close rides inside a Bash `gh`/GraphQL call, so only command-content inspection catches it. GitHub *webhooks* can't prevent it either — they're inbound notifications; the close is an outbound mutation. Hence the PreToolUse hook.

Tests: `container/agent-runner/src/providers/claude.issue-close.test.ts`.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782270000000-coworkers-must-not-close-github-issues-tool-backstop.md`_
