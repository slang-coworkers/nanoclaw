---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1787145675546-0xabla
written_at: 2026-08-24T15:50:21.701Z
---

# [approver/confirmed] Main-merge synchronize: re-validate against the new merge base, but don't re-litigate byte-identical PR content — and never approve on pending CI

**Class:** A `synchronize` webhook fires on a PR, but the new head is a
**2-parent merge commit** (e.g. "Merge branch 'main' into <branch>") rather than
a real content push. The compare old-head→new-head looks alarming (here:
sanitizer/vcpkg/CMake churn, +200 lines across 11 files), but that is the
**merged-in main delta, not PR scope growth**.

**How to tell it's a main-merge, not a content change:**
- `gh pr view <pr> --json files,additions,deletions,baseRefOid` → the PR's
  diff-vs-**base** is what's under review. For slangpy#1117 R2 it was byte-identical
  to R1 (+19/-0, same 2 files).
- `gh api .../pulls/<pr>/commits` → the new commit has `parents: 2` and a
  "Merge branch 'main'" message by a maintainer.
- Use the compare endpoint (old→new head) only to *understand* what got merged in;
  never treat that delta as the PR's change set (it double-counts main).

**What to still do (don't shortcut):** re-run the FULL procedure for the new
commit — fresh clauses, fresh harvest+Devin, fresh challenger, one new ledger row.
The reason it's not busywork: the **merge base changed**, so CI re-runs the whole
suite against current main. A test that was green on the old base can go red on the
new one. So the decisive re-check is the CI positive control on the NEW head, not
the (unchanged) diff.

**The discipline that paid off:** on the new head CI was initially **pending**.
Per [approver/false-safe] (Devin-clean ≠ test-clean), I did NOT record WOULD_APPROVE
on the pending signal — I waited (~monitor on `gh pr checks` until no "pending" and
no "fail") for green settle, then confirmed `test_scalar_return_with_torch_input`
PASSED (not skipped) on the self-hosted CUDA job for cf09ffb. Only then recorded.
Note `ci_green_on_sha` clause passes vacuously ("policy does not require CI green")
under v0-shadow-wide — so this wait is a *challenger* discipline, not a clause; the
scripted clause will not enforce it for you.

**Outcome (calibration):** WOULD_APPROVE matched the human outcome — jhelferty-nv
(MEMBER) APPROVED the exact head and MERGED it. Confirmed: a bot-authored,
test-only regression PR whose new test is green in CI on the settled head, re-merged
from main with byte-identical content, is safe to approve. The host joins the human
verdict automatically from GitHub (no `record_human_verdict` call needed — and that
tool isn't exposed to the approver anyway; `record_decision`'s own doc says the join
is automatic).
