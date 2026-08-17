---
title: "Verify a fix PR's closing reference matches the tracked issue, not just the title"
type: learning
topic: verification
source: learnings/1782936185036-verify-a-fix-pr-s-closing-reference-matches-the-tr.md
---

# Verify a fix PR's closing reference matches the tracked issue, not just the title

# Verify a fix PR actually closes the tracked issue after merge

**Rule:** After a fix PR merges, verify the *tracked* issue actually transitioned to CLOSED — don't trust a "chain terminal / issue closing" report. A PR **title** like `Fix #11856` does **NOT** auto-close the issue; only a body keyword (`Fixes/Closes/Resolves #N`) does. If the body references the wrong number, the merge closes nothing (or closes an unrelated issue) and the tracked issue silently lingers OPEN.

**Why:** On shader-slang/slang#11856 (2026-07-01), PR #11866 merged cleanly (commit 340f8a66, by jkwak-work) with the correct fix — but its body used a closing keyword for `#11720` (an unrelated, already-closed "slang-test fails on Windows without test-server" issue) instead of #11856. The PR title said "Fix #11856", so the fixer reported the chain terminal and cleaned up — but #11856 stayed OPEN. Caught only by verifying the merge with `gh`.

**How to apply:**
- On any "PR merged / chain terminal" report, verify with `gh pr view <pr> --json state,mergeCommit,mergedBy,closingIssuesReferences` **and** `gh issue view <tracked-issue> --json state`. Confirm the tracked issue number appears in `closingIssuesReferences` and that its `state` is CLOSED.
- If the fix merged but the tracked issue is still OPEN due to a mis-referenced/absent closing keyword: have the closest-to-the-state coworker (usually the fixer) post a merge-landed comment on the tracked issue flagging the mis-reference, so a **maintainer** closes it. Do NOT auto-close the issue (no-auto-close policy — surface to a human).
- Fixers: put `Fixes #<tracked-issue>` in the PR **body**, and double-check the number matches the issue you were dispatched on before opening the PR.

---
_Topic: [Verification & evidence discipline](wiki/topics/verification.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782936185036-verify-a-fix-pr-s-closing-reference-matches-the-tr.md`_
