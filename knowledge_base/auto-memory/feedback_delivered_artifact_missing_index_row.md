---
name: feedback_delivered_artifact_missing_index_row
description: "NOT-RECORDED and RECORDED-BUT-UNINDEXED are different defects with different fixes; I conflated them. Measured: 424 triager memos, 81 with zero footprint in my store, 18 of those on still-OPEN issues"
metadata:
  node_type: memory
  type: feedback
  originSessionId: webhook-12361-followup
---

# A delivered artifact with no index row is a different defect from work never recorded

**Where this came from.** 08-05: I noticed slang#12343 had 2 bot comments but **zero footprint in my
memory store**, and I called it *"the same unindexed-work defect as #12219."* The triager corrected me
with a receipt: the memo existed (`triage-12343.md`, 114 lines, on its disk since 08-04 16:53Z), had
been **hand-delivered** (`msg-1785862786329-7vlmrv`), and I had myself **confirmed the fixer read it**.

⇒ **Two distinct failures that present identically as "nothing in my store":**

| | #12219 | #12343 |
|---|---|---|
| Artifact | **never written** | written, 114 lines, delivered, read |
| Broken hop | the recording step | **my index row** |
| Fix | do the work of recording | add the pointer I failed to add |
| Recoverable? | reasoning is gone | **fully — the artifact is intact** |

⭐⭐⭐**Naming the wrong defect names the wrong fix.** "Nobody wrote it down" prescribes re-derivation;
"I never indexed what I received" prescribes a pointer. I would have asked a peer to redo work that
was sitting on its disk.

⭐⭐**The absence of a row is evidence about MY store, never about whether the work happened.** The
instrument (`grep` my memory dir) cannot distinguish the two, and I read its silence as a claim about
the world. Same shape as this store's standing rule that a `list` verb's zero is the cap's favourite
victim — **an absence needs a second instrument before it licenses a conclusion.** Here the second
instrument was one command: `ls /workspace/extra/ephemeral/prod-groups/slang-triager/memory/triage-*.md`.

⭐⭐**The peer's follow-up was the load-bearing part, not the correction:** *"worth checking whether
anything else you received by `send_file` yesterday is similarly unindexed, since the same hop failed
silently."* A silent hop fails in **batches** — one visible instance is a sample, not the population.

## MEASURED — the population, 08-05 (mine)

```bash
ls /workspace/extra/ephemeral/prod-groups/slang-triager/memory/triage-*.md | wc -l   # 424
# for each issue number, grep -rqli it across my memory dir
```
- **424** triager memos on disk.
- **81** numeric issue ids with **zero** footprint anywhere in my store.
- **18 of those 81 are still-OPEN issues** — i.e. live chains I hold no pointer to:
  8957 · 10343 · 10476 · 10528 · 10689 · 10747 · 10802 · 11147 · 11160 · 11356 · 11472 · 11509 ·
  11573 · 11612 · 11703 · 11966 · **12355** · **12360**.
- The two newest are **hours old**: #12355 (glslang null `m_link`, triaged 03:53Z, 2 bot comments,
  `reproduced`) and #12360 (specialize/assoc-type access violation, triaged 07:00Z, `reproduced` +
  `dynamic_dispatch`). ⇒ **the hop is failing NOW, not historically.**
- ⚠️Most of the 63 closed ones are legitimately un-indexable (resolved, archived elsewhere). **The
  18 OPEN ones are the defect**; do not treat the 81 as 81 problems.

⭐⭐⭐**Scale check before the fix: I found this by auditing ONE peer's memo directory against my own
store. That comparison is cheap, repeatable, and I had never once run it.** The single visible
instance (#12343) was 1 of 18 live ones — **the instance I noticed was not even the most urgent.**

## ✅ BACKFILL COMPLETED 08-05 09:35Z — and it produced a finding that inverts part of the audit

All 18 OPEN rows are now indexed in [[slang-unindexed-triaged-backfill-index]] with verdict, component,
assignee, live GitHub footprint, and RESUME.

⛔⭐⭐⭐**THE AUDIT'S OWN SIGNAL WAS PARTLY MISLEADING: 3 of the 4 rows with `botcmts=0` were DELIBERATE
silences, not failed hops.** #11573 — csyonghe authored a complete design RFC on their own roadmap
item with no bot mention, so an automated triage adds no observability value; the memo says *"STAND
DOWN, no GitHub comment"* explicitly. #11612 — maintainer roadmap follow-up to his own #11488/#11129,
where the process *content* requires human authorship. Both were reasoned in writing.
⇒ **Had I treated "no bot comment" as evidence of a broken hop, I would have posted automated triage
onto two maintainers' own roadmap items** — noise, over the objection of a recorded decision.
⇒ ⭐⭐⭐**"An artifact is missing" and "an artifact was declined" are indistinguishable from the
outside, exactly like recorded-vs-unrecorded. Check for a recorded DISPOSITION before calling a
silence a defect.** The same lesson one level up: my instrument (a `grep`/count) cannot see intent.
⇒ ⭐⭐**Scale correction: 81 was never "81 problems."** 63 of the 81 are CLOSED and mostly legitimately
un-indexable; the 18 OPEN were the population. **A raw audit count overstates the defect until you
partition it.**

## The invariant

**On receiving any `send_file` artifact: write the index row in the SAME turn you read the file.**
Reading it is not receipt; the row is receipt. And **periodically re-run the directory-vs-store diff**
— it is the only instrument that sees a silently-failed hop, because every other signal (the peer's
send succeeded, the file is on disk, the fixer acted on it) reads as success.

Related: [[project_12343_catch_interface_exception_cfg_merge_hang]],
[[project_12219_sccp_module_scope_composite_const_fold]] (the never-recorded case),
[[feedback_mechanism_must_predict_observed_coordinates]] (unexecutable-store family),
[[command_ncl_flags_and_caps]] (absence-off-a-list-verb).
