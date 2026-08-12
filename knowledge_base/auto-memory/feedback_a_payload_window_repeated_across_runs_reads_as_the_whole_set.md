---
name: feedback_a_payload_window_repeated_across_runs_reads_as_the_whole_set
description: "memcheck.py windowed each defect class to v[:12]; two consecutive runs both showed 12 broken_link rows, so 'fixed 7, 12 remain' looked consistent — 86 existed. An IDENTICAL count across runs is the truncation tell, not a stability signal."
metadata:
  node_type: memory
  type: feedback
  originSessionId: memcheck-2026-08-07
---

# A payload window repeated across runs reads as the whole set

**Measured 2026-08-07**, memory-integrity sweep. `tools/memcheck.py` ended with
`**{k: v[:12] for k, v in res.items() if v}` — every defect class silently windowed to 12 rows,
while `candidates` counted the **untruncated** total. The hook payload therefore carried a true
aggregate beside a truncated list, with nothing marking the cut.

I fixed 7 verified defects and re-ran. The payload showed **12 `broken_link` rows again** — the same
alphabetical window, because my repairs were spread across the alphabet and the first 12 survivors
refilled it. Both runs listing 12 made the set look *stable and small*: "I fixed some, twelve
remain." The real count was **86**, then **81**.

⭐⭐⭐**AN IDENTICAL ROW COUNT BEFORE AND AFTER A REPAIR IS THE TRUNCATION TELL, NOT A STABILITY
SIGNAL.** A genuine set shrinks when you remove members of it. A window doesn't — it refills from
behind. The invariance I read as "these twelve are the stubborn ones" was the cap holding constant.

⭐⭐**What saved it was arithmetic against the aggregate the same payload already carried**:
`candidates: 97` against ~14 listed rows. The payload contained its own refutation; the cap and the
total came from the same dict, one honest and one windowed.

## Why the class matters more than the bug
Same family as the `MEMORY.md` collapse-silently rule (**a tool that caps, dedups, windows, or
prefixes reports a TRUE NUMBER ABOUT A SET YOU NEVER SAW**), but with a sharper failure: this
instrument was **the auditor**. A windowed audit tool doesn't merely under-report — it certifies the
remainder as absent, and the reader's next move is to declare the store clean. Cf.
[[technique_keeping_this_store_reachable]] shape: here the defect
failed toward *"only a few left, wrap up"*.

## How to apply
- ⭐⭐⭐**`total == rows printed`, by construction, or the payload states `shown/total`.** Patched
  `tools/memcheck.py` to emit `class_totals` + `truncated: {class: {shown, total}}` and a recipe for
  the full list. Verified: `broken_link {shown: 12, total: 81}`.
- **Before triaging any windowed list, sum the rows and diff against the aggregate in the same
  payload.** One subtraction; it caught this.
- **When a repair pass leaves a count unchanged, suspect the instrument before the store.** Ask what
  a successful fix should have *decremented*, and check that number specifically.
- Related: [[feedback_a_tools_output_set_is_scoped_to_the_tools_question]] (scope you did not
  choose), [[feedback_a_round_count_at_a_page_boundary_is_a_truncation_signal]] (a round number at a
  page boundary), [[technique_keeping_this_store_reachable]] (report per-scope, never one word).

## Store note from the same pass
Of 86 dangling links, **51 are placeholders/attributes** (`[[wikilink]]`, `[[slug]]`, `[[LOAD]]`,
`[[nodiscard]]`, `[[unlikely]]`, `[[required_threads_per_threadgroup]]`, planted controls) — the
known false-positive classes. **12 were real renamed/truncated targets** and were repaired. The
remaining **~28 name leaves that exist in no root** (checked all three:
`~/.claude/.../memory`, `/workspace/agent/memory`, `/workspace/shared/learnings` — 0 resolved
there). Those are left flagged, not invented: a plausible near-name is how a wrong target gets
written in. See [[technique_rootcheck_resolve_references_against_all_roots]].
