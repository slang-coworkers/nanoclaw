---
name: feedback_a_state_row_carries_only_the_fields_you_asked_of_it
description: "Widening a latch to carry a peer object's STATE does not carry the state you did not enumerate. 8th defect on one guard: the xst= row held every HUMAN act on a cross-referencing PR (draft/mergeable/reviews/closing-links) and NO check-run field, so the real build failure the guard existed to catch was dark. Fix the class: derive each field from the DECISION it feeds, and re-ask the question of the fix itself."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6423c8f7-5f95-425a-8731-0f7d324e7159
---

# A state row carries only the fields you asked of it — including the row you added to fix the last blind spot

**Measured 2026-08-08 09:2xZ, guard `i12371-pr-guard.sh`, eighth defect in the same latch.**

The 5th fix had replaced a set-membership probe (`xprs` = "does a superseding PR exist") with a
per-PR state row (`xst` = nine cells: head sha, isDraft, state, mergedAt, closing links, human
comments, reviews, mergeable). Its stated reasoning: *a membership probe answers "does it exist",
never "what is it doing"*. Correct, and it caught a real event 15 h later.

Then PR #12408 acquired two genuinely failing check-runs
(`test-windows-{debug,release}-cl-x86_64-gpu / test-slang`) and **the fingerprint did not move a
byte.** None of the nine cells is a check-run field. A `failing_headsha` field did exist — for the
PR on the *watched branch* only, and the fix had migrated to a different branch.

## The transferable shape

⭐⭐⭐ **Each fix widened an aperture, and the next defect lived in the widened aperture's own blind
spot.** Field-set omissions (fixes 1–6) → instrument completeness (fix 7) → **the field set of the
thing fix 5 added (fix 8)**. "I fixed the field set" is not a state you reach; it is a claim about a
particular enumeration.

⭐⭐⭐ **The entailment I wrote down and did not follow.** Fix 5's own comment justified `mergeable`
and `isDraft` as *"a human acting is decision-relevant"*. A failing test is decision-relevant for the
identical reason — it is the input to the one dispatch decision the guard makes. The correct field
set was derivable from my own written rationale, at the moment I wrote it, without any new
information.

⇒ **Derive fields from the DECISIONS the latch feeds, not from "what could this object do next".**
Enumerate the decisions first (dispatch-or-not, report-or-not, cancel-or-not), then ask what input
each consumes, then check every watched object supplies it. Object-first enumeration produces a
plausible list that is silently partial; decision-first enumeration is closed.

⇒ **And run the same audit on the fix.** After widening a latch, immediately ask of the *new*
structure: which decision-relevant facts does this still not carry? That question caught nothing for
three fixes because I never asked it of the fix itself, only of the original.

## Sub-lessons, each of which cost something

⭐⭐ **A COUNT is not the field; the NAMES are.** The failing-check count was **2 before and 2
after** (`{check-ci, wait-for-human-priority}` → the two Windows jobs). A count-only cell would have
stayed silent through the whole event. The retroactive control is what proved this: seed the
pre-event row with every other cell identical, confirm it wakes, and note *which* cell fires. See
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]] on controls that fire by luck.

⭐⭐⭐ **A guard's PROMPT is as much a latch as its script, and a stale fact written as an
instruction does not merely mislead — it FORBIDS the correct action.** The task prompt said *"CI IS
INFRA-BY-DESIGN — DO NOT DISPATCH THE FIXER FOR IT … 0 real failures"*, with an escape hatch keyed on
a field covering only one of the two PRs. Had I fixed the script alone, the next correct wake would
have read "0 real failures, do not dispatch" and no-opped. ⇒ **When a measurement retires a fact,
grep the instructions that were built on it.**

⚠️ **A bail is not a pass — read WHICH guard fired.** My truncation test (`total_count` inflated to
500) "passed" from the wrong guard: the stub's `*per_page=1*` glob prefix-matches `per_page=100`, so
the page query returned bare `500` and the ARRAY guard fired, never the completeness guard. **This is
the same stub bug as fix 7, made a second time.** Fixing the glob ordering produced the intended
`rows 79 != total_count 500`.

⭐⭐ **"74 skipped" was never a weaker green — it was the ABSENCE of the measurement.** The sibling
PR carries a **md5-identical** copy of the failing test and has **zero** `test-windows*test-slang`
check-runs, because the gate skipped them. Its tidy red (`{check-ci, wait-for-human-priority}` only)
hid the same latent failure for two days. Unmeasured and clean are one report apart and opposite
facts. See [[feedback_published_negative_env_claims_need_rederivation]].

⇒ **One census, one implementation.** Fix 7 survived because `pr12200-guard.sh` already had the
correct explicit-page + `rows != total_count` gate while this file did not — same logic, two places,
one wrong. Widening the census to a second call site was the moment to hoist it into a single
function and **delete** the 62-line inline copy, not to copy it.
