---
name: slang-verify-lessons-pointers
description: Pointer-only rows split out of MEMORY.md — one-line verification/CI lessons whose full text lives in their own feedback files. No content here beyond the pointer and its hook.
metadata: 
  node_type: memory
  okf_version: "0.1"
  type: index
  title: Verification-lesson pointers
  originSessionId: 5c386752-328d-4e3b-85ea-e19e41121b53
---

# Verification-lesson pointers

Split out of `MEMORY.md` 2026-08-03 to keep the index under the Read limit. These rows were
**pointer-only** in the index (link + short hook, no derivation), so nothing was lost in the move.
Each target file holds the full lesson. Links verified resolving at time of split.

⚠️ Per the split rule ([[feedback_correction_must_sweep_whole_file]]): moved text arrives UNMARKED.
Everything below is a pointer, not a claim of current state — open the target before acting.

## Reporting discipline

- [Never relay a verdict not in hand](feedback_never_relay_a_verdict_not_in_hand.md)
- [Never fabricate events between turns](feedback_never_fabricate_events_between_turns.md)
- [Verify pushed-state by branch, not SHA](feedback_verify_pushed_state_by_branch_not_sha.md)
- [Missing artifact ≠ outage until push confirmed](feedback_missing_artifact_not_outage_until_push_confirmed.md)
- [Label dispatch suspicions as hypotheses](feedback_label_dispatch_suspicions_as_hypotheses.md)
- [Actions job logs are PUBLIC — follow the 302](feedback_actions_job_logs_are_public_follow_redirect.md)

## The #802 diagnosis set — three readers, three different wrong answers

- [Parse the WHOLE failure set before characterizing](feedback_parse_whole_failure_set_before_characterizing.md)
- [Read the INPUT CONTRACT, not more output](feedback_read_the_input_contract_not_more_output.md)
- [A differential is not an oracle test](feedback_matching_incumbent_path_is_not_validation.md)

## `gh --paginate` truncation — full derivation

Index conclusion + the runnable command stay in `MEMORY.md`; the reasoning lives here.
Primary file: [[feedback_gh_paginate_401s_on_page2_use_explicit_pages]].

- `--paginate` can 401 on page 2+ yet **exit 0**, silently truncating ⇒ phantom-green.
  **Reconcile on RAW page length, not your filtered count.**
- ⭐⭐ **Repeated 3× — the third time because my index line kept the RULE and not the NUMBERS.**
  The corpus already held the answer (shared learning filed 17:02) and I re-measured from scratch
  ~2h later. ⇒ **an index entry that omits the stable VALUE forces re-derivation; store the datum
  next to the rule.**
- 📌 Stable datum: **shader-slang/slang open PRs = 76 non-draft of 233** (pages 100/55 · 100/20 · 33/1).
- ⚠️ **The documented truncation yields 54–55, NOT 20**, so it does **not** explain a generator
  reporting 20. Root cause **UNIDENTIFIED**; 3 hypotheses refuted (default `per_page=30`→16;
  recency windows→14/18/25/32/50/56; page-2-only→unreadable generator). A matching integer on
  page 2 is a coincidence, not a mechanism.
- ✅ **ONE-CALL ground-truth denominator (mine-verified 2026-08-03):**
  `search/issues?q=repo:OWNER/REPO+is:pr+is:open+draft:false&per_page=1` → `total_count: 76`,
  `incomplete_results: false`. Search carries `total_count`, so **no page-length reconciliation is
  needed**. ⚠️ Search has its own rate bucket (`limit 30`) ⇒ use for the **denominator only**, never
  the fan-out. This also refutes H5 (search-as-generator): search returns the TRUTH, 76.
- ⭐ `prCount:29` vs its own 20-item list = **count-before-filter vs list-after-filter** (gap 9; 29 is
  unreachable by any page boundary — 30-default→16, 100→55) ⇒ points to a **post-processing filter**,
  a defect class DISTINCT from truncation, and the only datum from INSIDE the generator.
  *[structural inference, unverified]*
- ⭐ **Denominator rule: never report "no failures" without `checked N of M`.** 20-of-76 enumerated is
  **silent COVERAGE loss**, not a cost problem.
- During a 401, GraphQL empties are absences **manufactured by the outage**, not real zeros.

## Verify / CI miscellany (no separate file each)

- A nudge relays **verbatim** — don't paraphrase a maintainer's ask.
- Verify a regression **at the precision it was reported**.
- Grep `test-NAME=passed`, not the job conclusion.
- Verify the **branch in the firing environment**, not the one you think is deployed.
- Release-CI can **re-emit a stale run** — check the run id, not just the status.
- Attribute provenance by **PATCH, not proximity**.
- Existence claims must come from a **NAMED ref**.
- **A tool impeached ⇒ re-derive everything that leaned on it.**
