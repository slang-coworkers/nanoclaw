---
name: feedback_a_clean_orphan_count_does_not_validate_range_labels
description: "reindex.sh's ORPHANED=0 validates REACHABILITY ONLY — the shard range labels in MEMORY.md's routing table are a separate, unchecked artifact that drifts on every repack, so a reader routes to the wrong shard while every gate reads green"
metadata: 
  node_type: memory
  type: feedback
  title: A clean orphan count does not validate the range labels
  tags: 
    - memory-store
    - instrument-defect
    - gate-blind-spot
  originSessionId: 67912aa9-ab11-43ae-8cf8-515bfed44987
---

# `ORPHANED=0` validates reachability only — the range labels are a separate, unchecked artifact

**Measured 2026-08-10.** After adding one leaf, `reindex.sh` reported
`leaves=1127 reachable=1127 ORPHANED=0`, tightest-shard headroom 10,402 chars. Clean on every axis
the script measures. Meanwhile MEMORY.md's project-family routing table said:

| row | claimed range | actual on disk |
| --- | --- | --- |
| shard 10 | `…` … `slang_rhi_811_shader_object…` | `…` … `slang_rhi_598_optix_coopvec…` |
| shard 11 | `slang_rhi_818_metal_short_v…` … `upstream_sync_incident` | `slang_rhi_800_evidence_meth…` … `stacked_pr_shared_base_clob…` |
| shard 12 | **"`workspace_deletion_incident` (1 row)"** | `stall_sweep_incident` … `workspace_deletion_incident` (~40 rows) |

All three wrong, and the "1 row" claim off by ~40×.

## Why the gate cannot see it

`reindex.sh` packs shards **by size** and re-derives every boundary on each run. The shard *files*
regenerate with correct `Range:` frontmatter (`sed -n 3p index-<fam>-*.md` is authoritative). The
**routing table in MEMORY.md is hand-maintained** and does not follow. Reachability is unaffected —
every leaf still has an inbound link from its shard, and every shard still has a root row — so
`ORPHANED=0` is **true and useless** for this failure mode.

⭐⭐⭐**The two metrics are independent. A reader routing by these labels opens the wrong shard while
every gate reads green.** This is the same family as the prefix-metric blind spot already recorded in
[[technique_keeping_this_store_reachable]]: a link that stays in the transitive closure but falls out
of the readable prefix. Reachability-shaped checks are blind to *navigability*.

## The trap that produced it

The stale row was itself a **lesson about staleness** — it warned that repacking mints new shards
without root rows, and cited its own 08-10 firing. Being a correct warning about drift did not make
it immune to drift. ⇒ **a row that documents a repack hazard is exactly the row most likely to have
been written at one repack and never revisited.**

⚠️And it asserted a **row count**. Per the standing no-counts rule already in MEMORY.md's table
header (`NO ROW COUNTS IN THIS TABLE — they were stale on 5 of 7 shards within hours`), that was a
violation of a rule sitting ~10 lines above it. **A rule and its violation coexisted in one table.**

## 2nd firing, same day (2026-08-10) — and this time the gate DID catch it, for an unrelated reason

Adding 2 feedback leaves repacked the family **14 → 15 shards**. `reindex.sh` reported
`leaves=1147 reachable=1146 **ORPHANED=1**` naming `feedback_zero_test_jobs_is_not_zero_tests_ran`
— because the newly-minted `index-feedback-15.md` had **no root row at all**, so its rows lost
their only inbound. Fixed by adding the shard-15 row and rewriting rows 10-14 from
`sed -n 3p`; re-ran → `ORPHANED=0`, disk 15 == table 15.

⭐⭐**The distinction worth keeping: a mint-without-a-root-row is a REACHABILITY failure (gate sees
it); a stale range LABEL on an existing row is a NAVIGABILITY failure (gate is blind).** The same
repack produces both, so `ORPHANED=1` was the loud symptom and the 5 wrong labels rode in behind it
silently — I would have fixed only the orphan had I not diffed the labels.

⇒ ✅**Cheapest coupled check, run after EVERY reindex:**
`ls index-<fam>-*.md | wc -l` vs `grep -c 'index-<fam>-' MEMORY.md`. A count mismatch means a shard
was minted; **the labels are then guaranteed stale too**, because the boundaries all shifted.

## Checks

- ✅**After every `reindex.sh`, diff the labels against disk:**
  `for i in index-<fam>-*.md; do sed -n 3p $i; done` and compare to the MEMORY.md rows. Cheap, and it
  is the only probe that catches this.
- ⛔**Never write a row count into the routing table** — stale by construction.
- ⭐**Report per-scope:** `ORPHANED=0` + headroom + *labels-verified*. Three facts, not one word. A
  bare "clean" collapses an axis that was never measured.

Cf. [[technique_keeping_this_store_reachable]] (the three passes and their bounds),
[[feedback_a_stored_claim_re_shipped_as_a_live_finding]] (a stored figure is a conclusion).
