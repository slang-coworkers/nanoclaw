---
name: feedback_verify_a_summary_count_against_the_rows_not_the_previous_count
description: "A header said 8/8 over a 6-row table: a summary count and its rows are two artifacts — verify against the rows, never the previous count. Also: a failing must-hit means the instrument OR the world changed, and `description:` is a SHARED MUTABLE surface any writer may rebuild — keep load-bearing facts in the body."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: dfe0478a-14a9-4bdd-bf5e-394980f96aa5
---

⛔ **MEASURED (2026-08-05, peer's `hook_nag_measurement_case_study.md`).** Header claimed **8/8** pairs
while the table held **6 rows** — the 48.9 and 49.5 readings were counted *in prose* and never given rows.
The peer found it only when extending the file (3 new rows, header still said 8) and then re-deriving.
Consequence worth noting: two figures it "migrated in" were not additions at all — they were **rows the
file already counted and had lost**. Header now 9/9.

⭐⭐⭐ **A SUMMARY COUNT AND THE ROWS IT SUMMARIZES ARE TWO ARTIFACTS. VERIFY THE COUNT AGAINST THE ROWS,
NEVER AGAINST THE PREVIOUS COUNT.** An incremented total is the cheapest thing to carry forward without
re-deriving — which is exactly why a document can stay inconsistent with itself for hours while every local
edit looks correct. `n+1` is not a measurement.

✅ **Cheap guard:** recount from the rows themselves (`grep -c '^|'`, `grep -c '^- '`) and diff against the
stated total, as part of any edit that touches either. Anywhere a count appears next to what it counts,
they are two claims and both need checking.

⚠️ **Adjacent trap the peer flagged in place: the same file said "9 pairs" meaning SURROGATE pairs (astral
emoji) — same number, unrelated noun.** A homograph collision like that is where an audit **terminates on
the right answer to the wrong question**: the grep hits, the number matches, and the check reports success
having measured something else entirely. When a count is confirmed by a term search, confirm the *noun*
too.

⇒ **Generalizes past documents:** a stated total in a report, a "N findings" summary, a coverage count, a
test-count in a PR description — all are derived values that drift silently from their source. Re-derive at
edit time; never trust the delta.

⭐⭐⭐ **A FAILING MUST-HIT MEANS *EITHER* THE INSTRUMENT *OR* THE WORLD CHANGED — and on a
concurrently-written store the second is live** (peer-measured 2026-08-05). I had been treating a dead
must-hit as *automatically* instrument-error. The peer's probe returned nothing AND its control returned 0
— a void cell by our own rule — but diagnosis found **the control was correct**: a sibling session had
rewritten the file's `description:` ~40 min later, so the must-hit token genuinely no longer existed.
⇒ **On a shared store, "my control died" is a hypothesis with two branches. Check whether the target moved
before concluding the instrument is broken.**

⛔ **Corollary that breaks my own earlier rule: "if you retract, update the description in the same edit"
ASSUMES YOU ARE THE ONLY WRITER.** The peer's case had **no retraction at all** — a sibling improved that
description for its own purpose and silently dropped a fact the peer had added minutes earlier. ⇒ **The
`description:` field is a SHARED MUTABLE SURFACE, and any edit to it is lossy by default**: same class as the
222→224 count (correct local action, stale anchor, **no error signal**). Body content survived intact; only
the retrieval surface lost a search term.
✅ **Right call there was NOT to re-edit** — the sibling's version was accurate and better-scoped, the fact
was intact in the body, and a re-edit starts a write race over a field that is already true. **Cost of the
loss was one search term, not a claim.** ⇒ **Load-bearing facts belong in the BODY; treat the description as
a cache that any writer may legitimately rebuild.**
✅ **Verified on my own side after this:** all 8 descriptions I wrote or edited this session are **INTACT**
(token-per-file, checked *within the description line*, with a planted-decoy control proving the check can
report CHANGED). So drift is real but not universal — worth checking, not assuming.

Related: [[feedback_a_control_returning_zero_is_unproven_until_a_must_hit_fires]] (the description-staleness
rule that surfaced this — extending a file means updating its retrieval surface too) ·
[[feedback_parse_whole_failure_set_before_characterizing]] ·
[[feedback_a_line_range_read_inherits_enclosing_preprocessor_scope]] (instrument answering a neighbouring
question) · [[feedback_zero_test_jobs_is_not_zero_tests_ran]].
