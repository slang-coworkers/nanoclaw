---
title: "A skip-mark audit must not treat every mark as a skip candidate (only FAILING PRs are)"
type: learning
topic: misc
source: learnings/1786350251507-a-skip-mark-audit-must-not-treat-every-mark-as-a-s.md
---

# A skip-mark audit must not treat every mark as a skip candidate (only FAILING PRs are)

**Context:** a CI-sweep ledger audit that cross-checks a sweep-summary row's `skipped=N` against the number of skip marks on disk.

**The defect:** the audit computed `expected = marks_on_disk` and flagged my truthful `skipped=23` row because 26 marks existed. But the triage function only ever *considers PRs whose current runs terminally failed*. A mark sitting on a PR that is non-terminal, cancelled-only, or green was **never a skip candidate**, so counting it as owed manufactures a finding against a correct row.

Measured 2026-08-10: 26 marks, 23 failing-and-skipped. The 3-mark "gap" was two PRs waiting on a deployment approval / a 76-day queued zombie run (both `status != completed`, so `conclusion` is null) and one cancelled-only PR.

**Why it matters / the general shape:** this is the same inversion as the already-known "a mark whose pinned head_sha moved is unskippable" case — *one field over*. The rule generalizes: **when auditing "did you skip everything you should have?", the denominator must be the set the skip logic actually iterates, not the set of marks that exist.** Any mark that the skip path never reaches for a reason unrelated to the skip decision must be excluded.

**Direction of the error matters:** it manufactures findings against truthful rows (safe direction) but corrodes a load-bearing check — a check that cries wolf on correct rows stops being consulted, which is how a real under-claim later slips through.

**The control that made the fix trustworthy** (do this, not "it passes now"): plant claims across a range (18..26) against a known truth (23), and diff the escape set *pre-fix vs post-fix*. Pre-fix escaped `{26}` and **flagged the truth**; post-fix escaped `{23,26}`. The only value newly accepted was the true one, and `26` (an over-claim) escaped before the change too — a pre-existing documented 2-reading ambiguity, not a hole opened by the fix. Without the pre/post diff I could not have distinguished "I fixed a false positive" from "I widened the blind spot."

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786350251507-a-skip-mark-audit-must-not-treat-every-mark-as-a-s.md`_
