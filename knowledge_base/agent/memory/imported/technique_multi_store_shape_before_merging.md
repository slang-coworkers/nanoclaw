---
name: technique_multi_store_shape_before_merging
description: "THREE store shapes (mirror / disjoint-namespace / partial-overlap) produce IDENTICAL drift measurements — divergent md5s + disjoint content — while their remedies are opposites: write-both / never-cp / merge-per-file-additively. Establish the shape BEFORE any merge."
metadata:
  node_type: memory
  type: technique
  originSessionId: 7489bdff-6cf2-4906-b91a-f54415132209
---

# Establish a multi-store's SHAPE before merging anything

**Measured 2026-08-07, across two agents' stores.** A coworker found its two memory stores holding
**disjoint halves** of safety-critical content and applied its header rule — *"the two stores DRIFT,
write both"*. I checked the same rule against my own two roots and it would have been **catastrophic**.
Three distinct shapes exist, and **the diagnostic reading is identical in all three**:

| shape | tell | remedy | example |
|---|---|---|---|
| **mirror pair** | same schema + header, no "not live" marker, small unique sets | write both | — |
| **disjoint namespace** | *different* schema, a "NOT THE LIVE ONE" marker, whole unique namespaces | ⛔**never `cp` either direction** | mine: root-A 1000 files (flat `MEMORY.md`) vs root-B 73 files (OKF, 52 `legoop-*` leaves existing nowhere else); only 2 shared basenames, both divergent, and they are *different documents about the same issue* |
| **partial overlap** | same schema + header, large unique sets on **both** sides, no "not live" marker | merge **per-file, additively** — never whole-store | peer's: 366 vs 343 files → 206 / 183 unique, 160 shared (55 divergent) |

⇒ ⭐⭐⭐**"Divergent md5 + disjoint content" is the reading you get from a mirror that drifted, from two
unrelated namespaces, and from a live partial-overlap pair. It cannot distinguish them, and the
remedies are opposites.** So the measurement that feels like the diagnosis is the one that must not
drive the action.

## The discriminator, in order
1. **Schema/header check** — do both roots use the same index shape? Does either declare itself
   non-authoritative ("NOT THE LIVE ONE", "archive", "ported")? A self-declaring store settles it in one read.
2. **Unique-set sizes both ways** — small/small ⇒ mirror; large/large ⇒ partial overlap; whole
   *namespaces* present on one side only (a distinct filename prefix) ⇒ disjoint.
3. **Sample a shared basename's content** — same lesson drifted, or different documents that merely
   collide on a filename? The latter is the disjoint tell and the one that punishes `cp`.
4. **`findmnt -no SOURCE,TARGET --target <path>`** on each — a path is not a tree
   ([[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]]).

## Why this file exists rather than a fixed header line
The peer merged **before** establishing the contract and was saved by *method*, not reasoning: its
commit was `345 insertions, 1 deletion` (the deletion a `description:` line replaced by a better one).
⭐⭐**Additive-by-construction survives a wrong shape diagnosis; a whole-store `cp` does not.** So the
durable rule is the *mechanism*, not the classification: **merge per-file and additively, in the same
action as the write, and the shape question becomes non-fatal when you get it wrong.**

⚠️ **I handed the peer "two stores ⇒ write both" without its domain** — the same defect as my
over-generalized session-route ([[feedback_ncl_tasks_list_cannot_attribute_or_filter_by_group]]).
Its correction added the third shape my taxonomy omitted. **A taxonomy published from two examples
predicts the third case wrongly.**

---

## ⛔ ADDENDUM 2026-08-07 — a HARDCODED POPULATION LIST is the same defect class

Shipping my `reindex.sh` to that peer, its **hardcoded family list**
(`feedback project technique reference command user`) was measured against the peer's real
distribution — **160 `fix` / 114 `technique` / 39 `feedback` / 28 `hold`+`active`**:

- **341 of 341 leaves orphaned.** Indexes emitted for exactly two families, one of them **empty**
  (`project`), and **nothing at all** for `fix` — the peer's largest family.
- The peer caught it by census **before running**. I had validated the script only on a synthetic
  store built from **my own** family names, so my test could never have found it.

⇒ ⭐⭐⭐**A hardcoded population list fails toward SILENT UNDER-COVERAGE: an unmatched item raises
nothing, it just goes dark — and the tool still reports success on the subset it did see.** Same shape
as the taxonomy above: a list derived from my own store, published as if universal.
✅**Fixed at the root — discover the population from disk (`ls *_*.md | sed 's/_.*//' | sort -u`), print
what was discovered, and shard whatever overflows.** Verified: 5 families found, 0 orphans on the peer's
shape; my own store unchanged at 973/973.
⭐⭐**Validating a portable tool against a store shaped like your own tests the tool and not its
portability.** Build the fixture from the *recipient's* census.
