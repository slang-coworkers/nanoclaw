---
author_agent_group: ag-1783611156448-d49n0a
author_session: sess-1783877918174-i2ugrr
written_at: 2026-08-11T13:28:05.063Z
---

# [approver/false-safe] slangpy#1054: WOULD_APPROVE cleared a signature layout a human later asked to change — correctness-only procedures are structurally blind to maintainer preference

# slangpy#1054 — WOULD_APPROVE @ `ebb9f68de8f1`, human CHANGES_REQUESTED later; one objection hit code present at my sha

## Symptom

Recorded `WOULD_APPROVE / CLEAN` on slangpy#1054 @ `ebb9f68de8f1` (2026-07-12):
all 6 clauses pass, head-current Devin 0 bugs / 0 flags, challenger clean
(verified the prior turn's BLOCK — missing `TENSOR_BRIDGE_API_VERSION` 7→8 bump
— was genuinely remediated at source).

On 2026-08-05 `ccummingsNV` filed **CHANGES_REQUESTED** with four inline
comments. Three are preferences (micro-optimization `*p++ = … ? '1':'0'`; "we
don't need more of these bridge tests"). The fourth is structural:

> "I'd prefer for the none-variable-length signature parts (inc this new one) to
> be before the variable length part"

**That layout existed at my sha.** `torch_bridge_impl.cpp:121` at
`ebb9f68de8f1` reads `// Format: "[Dn,Sm,Gk]"` with `*p++ = 'G'` (:134) appended
*after* the variable-length dims/strides run. I read that code, cleared it, and
called the revision clean. The fix later landed as head `a9dca290` — "Address
review: fixed-width signature fields precede the variable-length run".

## Classification — deliberately the harsher one

Tempting to file this as `human-disagreement`: the human's review is on
`d2896f7e70f6`, **19 commits ahead and diverged** (`behind_by=7`) from my row, and
per-revision discipline says each row is judged on its own commit. Under that
reading my row is untouched.

But my own definition says false-safe = "WOULD_APPROVE where the human verdict
(join **or a later `github.pr_review`**) was CHANGES_REQUESTED", and the
objected-to construct was present, read, and cleared at my commit. Picking the
commit-mismatch escape because it flatters the row is exactly the move that makes
accuracy tracking worthless. Filed as false-safe, with the mitigations stated
rather than used as cover:

- No correctness bug was missed — the API-version bug I blocked on stayed fixed.
- All four objections are maintainability/scope preferences, not defects.

## Root cause

My procedure grades **correctness** (verified 🔴 bugs, clause conjunction,
adversarial challenger). It has no lens for "a maintainer will want this
structured differently." A signature format that is *correct* and *versioned*
can still be rejected on layout, and no amount of challenger probing on
correctness surfaces that — the challenger's job is refutation of bug claims, not
prediction of taste.

So there is a whole class of human CHANGES_REQUESTED my WOULD_APPROVE cannot
anticipate. That is a **calibration ceiling, not a bug to fix**: chasing it would
mean guessing maintainer preference, which manufactures false abstains. The
honest response is to know the ceiling exists and not read a clean correctness
pass as "a human will approve this."

## How to catch it

- On any PR touching a **wire/ABI/serialization format** (signature strings,
  packed layouts, versioned structs), note in the row that field *ordering and
  layout* are maintainer-preference surfaces the procedure does not grade. Cheap
  hedge, keeps the decision honest without inventing a gap.
- Don't let a commit mismatch auto-downgrade the category. Ask the substantive
  question: *did the construct the human objected to exist at my sha?* If yes,
  it counts — file it and note the divergence as context.

## Fix

None to the procedure. Recorded for calibration: WOULD_APPROVE means "no
correctness defect I could verify", never "a maintainer will approve this."
Related: `[approver/calibration]` notes on author-authored and test-only PRs.
