---
name: project_slang_scrub_batch_22_closed
description: "TERMINAL 2026-08-05 21:10Z — jkiviluoto-nv's mkeshavaNV-departure scrub fan-out (22 slang issues, 18:40:15-40Z) is 22/22 answered; 3 issues carry two bot comments each (all reconciled, none contradictory); no metadata changed anywhere"
metadata: 
  node_type: memory
  type: project
  originSessionId: 59d6244a-f806-44fd-b917-b741ba4576a1
---

# The 22-issue departure scrub closed 22/22 in ~2h30m

**Population** (enumerated twice independently via the repo-wide comments feed, not `search/issues`):
`4846 6434 6471 6518 6519 6520 6524 6540 6542 6572 6578 6607 7209 7462 7670 7672 8527 9004 9661
9736 9872 10181` — 22 members, burst 18:40:15Z→18:40:40Z, identical 184-byte body.

**Final stamp 21:10Z: answered 22, outstanding 0, partition asserted, classifier total.**

## Convergence, measured

Five consecutive censuses each found its predecessor stale — 16 (20:30Z) → 17 (20:3xZ) → 18 (20:45Z)
→ 19 (20:51Z) → 20 (20:58Z) → 22 (21:10Z). Never once an instrument disagreement; always a sibling
landing a verdict in the interval. ⭐⭐**"A census is a stamp, not a state"** is the operative rule —
publish the measurement time and expect divergence, don't relitigate.

## Three issues carry TWO bot comments — all reconciled, none contradictory

| issue | comments | relationship |
|---|---|---|
| **#6578** | 20:41:41Z (5,642 B) + 20:45:04Z (3,441 B) | 2nd is explicitly *"Follow-up … two things the previous comment left open. No change to its verdict."* |
| **#9736** | 20:59:00Z (3,657 B) + 21:06:25Z (3,303 B) | 2nd fills the 1st's **stated caveat** (it verified source lines but did not re-run the repros). Overlap probe: 7 of 8 citation fragments appear in the 1st and **0** in the 2nd ⇒ genuinely additive, not a restatement. |
| **#10181** | 20:19:39Z + 20:19:49Z — **raced by 10 seconds** | Both recommend `close as not planned`; the 1st was **edited at 20:22:58Z** to fold in the 2nd (*"Treat the pair as one conditional recommendation to close, not two independent ones"*), the 2nd edited 20:25:49Z. |

⇒ ⭐⭐**A duplicate bot comment is not automatically a defect — the discriminator is whether the second
one CONTRADICTS or COMPLETES.** All three here complete. The #10181 pair is the interesting case: two
sessions posted 10 s apart (below any plausible check-then-post window), and the recovery was an
**edit that reconciled them into one conditional recommendation** rather than a deletion.
⚠️Per [[feedback_an_in_place_edit_notifies_nobody]], that edit did *not* notify — acceptable here
only because both comments were already delivered and agree.

## What the batch cost, and where the real risk was

**Not the duplicates — the drops.** #7672 and #6578 were **dropped at birth**: the orchestrator
session took the webhook, 429'd before dispatching, so no triager session existed for ~1h40m
([[project_slang_scrub_fanout_22_issues]]). `sessions=1` was the whole tell; #7670 also shows
`sessions=1` but *is* answered (it completed before the storm) ⇒ **a low session count is a suspicion
trigger, not a verdict.**

⭐⭐**Every one of the 22 replies held the no-write line** — zero labels, assignees, milestones or
states changed across the batch. Recommendations only. That is the correct posture for a bot answering
a maintainer's relevance question.

## Substantive findings worth reusing

- **#6607** (SPIR-V `-incomplete-library` export parity): repros verbatim 17 months on; gap localized
  to the three `symbolsEmitted` sites in `slang-emit-spirv.cpp:12214-12254`, guard at `:12256`. Two
  plausible one-line fixes pre-empted (`-whole-program` no help; exporting a *function* no help,
  because `IRDownstreamModuleExportDecoration` is applied in `Module::precompileForTarget` on the
  `-embed-downstream-ir` path, not from a plain CLI). Cited test path
  `tests/library/sample-count.slang` **does not exist in-tree** ⇒ never covered.
- **#6542** nested `ParameterBlock` ICE — see [[project_6542_nested_parameterblock_precompile_ice]].
- **#9736** CUDA atomics/`ForceInline`: a **public retraction** of the prior day's *"internal linkage
  is necessary but not sufficient"* — that conclusion came from a harness defect (one module copied
  twice ⇒ duplicate entry point). With distinct entry points, `static` on the helpers takes
  `Multiple definition` 2→0. ⇒ [[feedback_a_false_caveat_is_the_least_audited_claim]].
- **#9872** is assigned to **kaizhangNV, not mkeshavaNV** ⇒ the departure premise doesn't apply; the
  scrub was arguably mis-targeted there.

Related: [[project_slang_scrub_fanout_22_issues]] (the fan-out + drop analysis),
[[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]],
[[feedback_a_quote_has_two_halves_text_and_addressee]] (the attribution incident this batch produced),
[[feedback_ncl_sessions_messages_limit_returns_first_n_not_last_n]].
