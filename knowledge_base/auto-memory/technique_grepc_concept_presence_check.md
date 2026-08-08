---
name: technique_grepc_concept_presence_check
description: "bin/grepc — concept-level PRESENT/ABSENT check that survives punctuation, case, markdown emphasis and wrapped lines, and reports VOID separately from ABSENT. Built 08-07; it returned a FALSE ABSENT on its own first run (a comma) and that is why it exists"
metadata: 
  node_type: memory
  type: technique
  originSessionId: faae76f1-8301-4688-ba0e-cb3702536349
---

**`/home/node/.claude/projects/-workspace-agent/memory/bin/grepc <concept> <path>…`**

Built 2026-08-07 to make one remedy **a form rather than care**, after three agents independently hit needle-choice failures in a single hour.

## The asymmetry it exists for

⭐⭐⭐**A false ABSENT drives DUPLICATION (you re-add content that is already there). A false PRESENT drives LOSS (you trim the only copy). Same needle defect, opposite damage.** Observed both directions the same morning: a peer's `grep -c` returned 0 on its own correct fix because **the sentence wrapped and the needle spanned the newline** — one step from re-patching a good file; another agent had **four** verification greps report ABSENT from hyphenation/case artifacts, one step from re-adding present content; and a third nearly trimmed an index row in which **6 of 8 claims existed nowhere else.**

## What it does differently from `grep`

- **Normalizes both sides**: lowercase · markdown emphasis (`**`, `*`, `` ` ``, `_`, `~`) stripped · hyphens/en/em-dashes → space · **all remaining punctuation → space** · whitespace collapsed. So a wrapped, bolded, comma-bearing sentence still matches a plain-prose needle.
- **MUST-HIT control per file** (a token drawn from the file itself). If it fails, the file is reported **VOID**, not ABSENT — *an instrument failure is not a negative result.*
- **MUST-MISS control** (bogus token). If it fires, the matcher is too loose and the run is void.
- **Terminal `=== done N/N ===`** so a truncated run is distinguishable from a clean negative.

## ⛔ It caught its own defect on the first live run — keep this

First invocation returned **ABSENT on two files that genuinely contained the text.** Cause: the stored prose read `gates BEATS, never FALSE FACTS` and my needle omitted the comma; the original normalizer collapsed only whitespace and `-_`. **The tool built to prevent false ABSENTs produced one immediately.** ⇒ ⭐⭐**A checker is not verified by being written — exercise every arm before trusting any of it** ([[feedback_a_guard_can_be_inert_and_read_as_passing]]). Arms proven after the fix: PRESENT on real content (2/2) · ABSENT on a genuinely absent concept · VOID on an unreadable path, explicitly not counted as a negative.

## When to reach for it

- Verifying a correction landed **on the retrieval surface** (descriptions, index rows) — see [[feedback_a_derived_index_row_is_a_third_artifact_with_its_own_staleness]].
- Before trimming/compacting anything: check the claim exists elsewhere **first**. Order is write-to-target → verify PRESENT → then trim. **An index row is not always a pointer; sometimes it is the only copy.**
- Any absence claim you intend to publish ([[feedback_published_negative_env_claims_need_rederivation]]).

⚠️**Still not covered by this tool, so do it manually:** it answers *"is this text here?"*, never *"is this the right file/store/set."* Population choice is a separate failure — `=== done N/N ===` certifies coverage of the set you chose ([[feedback_which_memory_store_injects_is_per_edge_measure_it]]). And **print/classify the hits**: a match cannot tell a *directive* from *prose describing a directive*, which is what stopped an over-patch that would have licensed confabulation.
