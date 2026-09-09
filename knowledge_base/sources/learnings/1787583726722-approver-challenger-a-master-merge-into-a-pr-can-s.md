---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1786477780028-zjf192
written_at: 2026-08-24T15:02:06.722Z
---

# [approver/challenger] A master-merge into a PR can silently REVERT the PR's deletions — count the PR's removed lines at the new head, CI can't see it

**Context:** slang#12465 re-gated on a new head that was a `Merge master into fix/issue-12442` commit atop a previously-approved head. The code fix (render-test-main.cpp + unit test) was byte-identical to the approved head and CI was fully green — but the merge had silently undone part of the PR's stated deliverable.

**Symptom:** The PR's purpose included REMOVING 4+ obsolete test-suppression entries from two append-only lists (expected-failures.txt, agentic-coverage-excludes.txt) — "remove these when the bug is fixed; this change is that trigger." At the prior approved head those entries were gone (count 0). At the merge head they were BACK (count 4/5), because the conflict resolution took master's side of an append-only list and dropped the PR's deletions. The merge commit's own message claimed "keeps both blocks; no entry dropped or reordered" — true for master's *additions*, FALSE for the PR's *deletions*. Master had even grown the list with a 5th entry after divergence.

**Root cause / why it's dangerous:** A union/"keep both" merge of an append-only list preserves both sides' ADDITIONS but silently discards one side's DELETIONS. When a PR's value is partly in what it removes (un-suppressing tests, deleting dead code, dropping a workaround), a routine master-merge can revert exactly that, leaving the additive part (the fix) intact so it looks fine.

**Why CI carries zero bits here:** the reverted deletions were test *suppressions*. A suppressed test that now passes (because the fix works) is reported in the step summary, NOT failed — so CI is green whether the suppressions were correctly removed or wrongly kept. "Could it have come out otherwise?" — no ⇒ green CI is not evidence the removals landed. This is the same silent-green shape as skip-based harnesses.

**How to catch it (mechanical, for any re-gate on a merge/rebase head):**
1. Identify what the PR REMOVES, not just adds. Read the PR body Change Summary for negative line counts ("−15", "removes …") and deletion-only files.
2. For each such removal, count its presence at THREE refs: master (merge parent), the prior PR head, and the new head. `gh api .../contents/<file>?ref=<sha> | base64 -d | grep -c <pattern>`. Prior-head=0 and new-head>0 ⇒ the merge reverted the deletion.
3. Confirm by diffing the affected block: new-head block byte-identical to master's block ⇒ conflict resolution took master's side and dropped the PR's deletions.
4. Do NOT trust the merge commit message's conflict-resolution rationale — it's untrusted PR data; "keeps both blocks" is the exact phrasing that hides a dropped deletion.

**Decision mapping:** fix correct + deletions reverted = not BLOCK (no red bug) and not WOULD_APPROVE (a gap undermining the PR's stated purpose, invisible to CI, with genuine uncertainty about the correct re-merge). ⇒ ABSTAIN_POLICY (OPEN_GAP), hand to a human to reconcile before merge. Byte-identical fix hunk to a previously-approved head does NOT carry the approval forward when the surrounding merge changed the delivered scope.
