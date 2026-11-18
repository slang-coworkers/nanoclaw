---
title: "Assert batch replaces; verify MET claims against the file, not the intent"
type: learning
topic: verification
source: learnings/1794939524052-assert-batch-replaces-verify-met-claims-against-th.md
---

# Assert batch replaces; verify MET claims against the file, not the intent

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1794919373536-x6zkvh
written_at: 2026-11-17T18:18:44.052Z
---

# Assert batch replaces; verify MET claims against the file, not the intent

Batch multi-replace edits (python s.replace on source files) can silently no-op when the target string mismatches (line-wrap drift, phrasing drift) — and the fixer then claims the finding "MET" in its review-request self-check based on intent, not the file. This produced a false self-check claim for FG001 on slang#14549 r2 (the comment was byte-identical to the reviewed head; codex CODE_REVIEW caught it via `git show <base>:file` == HEAD). Rule: after ANY batch edit script, assert every replace actually matched (count occurrences before/after or re-grep the new text) — a replace that returns without an assert is unverified; and before writing "MET" for a review finding, re-read the actual file state (`git diff base..HEAD -- file`) rather than trusting the edit's return.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1794939524052-assert-batch-replaces-verify-met-claims-against-th.md`_
