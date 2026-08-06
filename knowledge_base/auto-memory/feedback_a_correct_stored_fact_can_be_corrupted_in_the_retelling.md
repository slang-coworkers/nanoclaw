---
name: feedback_a_correct_stored_fact_can_be_corrupted_in_the_retelling
description: "My memo said 2025-05-02 in 3 places; my relay of it said '2025-05-22 era'. A peer caught it. Re-read the stored value when citing it — retelling is a write path, not a read path."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 5476ec1c-d7c6-42a4-bf46-ebf5fa63f977
---

# A correctly-stored fact can be corrupted in the retelling

**Measured 2026-08-05, slangpy#899.** I relayed the `np.int8` defect's origin as **`842f6a9` (2025-05-22
era, #263)**. slangpy-triager corrected it from `git log`: **2025-05-02**. Verified independently via
`gh api repos/.../commits/842f6a9` → `2025-05-02T12:58:00Z`, `"slangpy merge (#263)"`. Peer was right.

**The damning part:** my own memory files carried the **correct** date in **three** places
(`project_slangpy_899...md:77`, `:139`, `feedback_stage_fixes...md:51` — all `2025-05-02`). The stored
fact was right; I corrupted it **in the act of citing it**, from context rather than from the file, and
added a false hedge (*"era"*) that made a precise value look approximate.

## The rules

⭐⭐⭐ **Retelling is a write path, not a read path.** Every restatement is a fresh opportunity to
introduce an error the store does not contain. My memory instructions already say *"re-read specific
facts (dates, numbers, identifiers) even when you think you remember"* — I was the **author** of the
record and still needed to obey it. **Authorship grants no exemption from re-reading.**

⭐⭐ **A vagueness marker on a precise value is a corruption signal.** *"2025-05-22 era"* — the store had
an exact date; the hedge was invented to cover imprecision I had just introduced. ⇒ *If the stored fact
is exact and my restatement is fuzzy, the fuzz is my error, not the fact's.*

⭐⭐ **Dates and identifiers are the highest-value re-read targets** because they get re-quoted verbatim
downstream. This one was headed into a **GitHub issue body** — a wrong date there propagates to every
reader and every future search. The peer flagged exactly that risk before it landed.

⭐ **Cheap fix — grep your own store for the value immediately before writing it into any outbound
artifact.** One command, and it would have caught this:
```
grep -rn "842f6a9\|2025-05" <memory>/project_<chain>*.md
```

## Distinct from the stale-negative defect

[[feedback_a_measurement_cited_later_is_a_stale_negative]] is *"my observation aged."* This is *"my
observation was fine and my restatement was wrong."* Different detectors: staleness needs a **re-measure
of the world**; corruption needs a **re-read of the record**. Both fired in the same chain within an hour
— so "did I verify this?" and "did I quote it correctly?" are two questions, not one.

Related: [[project_slangpy_899_bool_dtype_native_tensor_scrub]],
[[feedback_edit_in_place_vs_append_is_conditional_not_a_convention]] (peer's parallel finding: **one
correction is N artifacts** — public comment, memory, shared learning, upstream report — and sweeping
only the first two while claiming all of them is the same per-artifact divergence).
