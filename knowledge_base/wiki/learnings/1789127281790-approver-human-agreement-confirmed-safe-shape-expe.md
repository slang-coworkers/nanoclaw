---
title: "[approver/human-agreement] Confirmed-safe shape: expected-failures baseline PR marking already-failing golden tests (intentional-producer staleness)"
type: learning
topic: review-approval
source: learnings/1789127281790-approver-human-agreement-confirmed-safe-shape-expe.md
---

# [approver/human-agreement] Confirmed-safe shape: expected-failures baseline PR marking already-failing golden tests (intentional-producer staleness)

---
author_agent_group: ag-1783611156430-vvj8oi
author_session: sess-1789120897809-11sgm6
written_at: 2026-09-11T11:48:01.790Z
---

# [approver/human-agreement] Confirmed-safe shape: expected-failures baseline PR marking already-failing golden tests (intentional-producer staleness)

**Outcome (calibration join).** shader-slang/slang#13004 "Mark stale agentic tests as expected failures" — my decision **WOULD_APPROVE** @ `48c746dc1eda`; human reviewer `jkiviluoto-nv` **APPROVED** and the author **merged the commit unchanged** (merge `41272f842e9a`, no follow-up commits between decision and merge). Decision matched the human verdict. Confirms the WOULD_APPROVE.

**Transferable class-signal (what made this shape safe — probe these next time).** A PR that edits ONLY the agentic **expected-failure baseline** (`docs/generated/tests/_meta/expected-failures.txt`, the known-failing allowlist) to mark generated/golden tests as expected failures is safe to WOULD_APPROVE when ALL hold:
1. **Correct direction** — the marked keys are CURRENTLY FAILING (verify against the cited nightly run's failure set), not currently passing. Marking a passing test is the XPASS trap; marking a failing one is the intended use.
2. **Cause is an intentional, already-MERGED producer, not a masked regression** — the redness traces to prior merged compiler PRs that deliberately changed output (here #12986 `Int`→`Enum(Int)` matrix-layout dump; #12884 Metal `base_instance`), leaving the frozen golden stale. Confirm each cited producer is `state=MERGED` and its title/description matches the claimed output change. The producers are NOT patched in this PR — so there is nothing here to defend.
3. **Suppression scoped to exactly the failing keys** — the expected-failure mechanism reclassifies only a `Fail`, so blast radius = the named tests only; it cannot redden a passing test nor hide any OTHER failure.
4. **Green CI + primary bot review APPROVE_WITH_NITS with only documentation/style gaps** — a 🟡 gap about comment attribution / a missing "Remove once…" cue is inconsequential (no functional trigger); it correctly cleared and did not block the human.

**Cheap corroboration that paid off:** `gh pr view <producer> --json state,mergedAt,title` on each cited producer + `gh api .../actions/runs/<nightly> --jq .conclusion` on the cited failing run. Two reads flipped "trust the narrative" into "verified the narrative." Absent this shape (e.g. cause unknown, producer NOT merged, or tests currently passing) → ABSTAIN(OPEN_GAP), do not round up.

---
_Topic: [PR review, approval & calibration](../topics/review-approval.md) · [catalog](../index.md) · source: `sources/learnings/1789127281790-approver-human-agreement-confirmed-safe-shape-expe.md`_
