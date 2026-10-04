---
name: project_slang_scrub_fanout_22_issues
description: "My view of jkiviluoto-nv's 2026-08-05 mkeshavaNV-departure scrub (22 slang issues in 25s, I got 1 webhook): two chains dropped at birth by pre-dispatch 429s, my rescues, and four same-direction census decays (0→1) that turned 'gaps' into duplicate posts. Batch is CLOSED; the terminal record is project_slang_scrub_batch_22_closed."
metadata:
  node_type: memory
  type: project
  originSessionId: 28c13999-0f66-44db-958c-f36d72509bee
---

# The 08-05 scrub fan-out: one webhook, two stranded chains, four stale censuses

**CLOSED.** The batch-level terminal record is [[project_slang_scrub_batch_22_closed]] (and the
sibling session's [[project_jkiviluoto_22_issue_scrub_fanout_closed]]). This file keeps what
**my** session saw and got wrong.

**Burst:** `jkiviluoto-nv` posted the same "Mukund (mkeshavaNV) won't be returning … please
scrub" body on **22 issues in 25 s** (18:40:15–40Z): 10181 9872 9736 9661 9004 8527 7672 7670
7462 7209 6607 6578 6572 6542 6540 6524 6520 6519 6518 6471 6434 4846. I received **#6542 only**
(verdict `cmt 5196535395`, [[project_6542_nested_parameterblock_precompile_ice]]). It was the
second fan-out of the same ask that day; the slangpy one produced
[[feedback_a_fanned_out_webhook_delivers_per_issue_verify_the_set]], which predicted this one.

## Dropped at birth — `sessions=1` is the tell

| issue | orch session | fate |
|---|---|---|
| #7672 | `sess-1785955223061-13kbb2` | 429 @18:48Z + 19:08Z before dispatch; no triager session |
| #6578 | `sess-1785955230323-p261v4` | same |

I dispatched both at 20:2xZ on their canonical threads, ~1h40m after birth. A healthy chain has
2 sessions (orch + triager), so **1 means the dispatch never happened**. That count is a cheap,
non-circular coverage probe: nothing inside a session can move it.

⚠️ **A 429 before dispatch costs the whole chain; a 429 after costs nothing.** Same error string,
opposite consequence, so when triaging a 429 ask *where in the chain* it landed →
[[feedback_a_timeout_and_a_429_are_different_evidence_about_the_work]].

⚠️ `sessions=1` cannot tell "never dispatched" from "about to be dispatched by another rescuer".
It detects missing coverage; it does not license a dispatch.

## Four census decays, all 0→1

| claim | measured | went false | result |
|---|---|---|---|
| "#6578 dropped at birth, dispatch it" | 20:25Z | sibling rescuing in the same window | double post (`5197101225` + `5197133805`) |
| "#7672 clean, 0 bot comments" | 20:57Z | sibling posted 20:56:31Z | **already false when written** |
| "#9872 bot=0, clear to work" | 21:01:05Z | sibling posted 21:01:33Z | +28 s |
| "2 doubles in 22" | ~21:0xZ | 5 by 21:31Z (#10181 #9872 #9736 #7672 #6578) | a sibling's "3" was also stale |

⭐⭐⭐ **A census over ~20 concurrent writers is draining while you read it: a `0` means "not
yet".** Every decay ran 0→1, so a stale census always reads as *worse* than reality and invites
redundant dispatch — which is how the #6578 double was born. A pre-action re-check **narrows the
window; it does not close it** (my race check failed on its first use →
[[feedback_a_remedy_that_can_reproduce_its_own_bug]]). The durable defence is the **delegate's
pre-post drift check** plus a willingness to downgrade to a delta or silence; the #6578 triager
did exactly that. Detail: [[feedback_clear_to_write_is_a_perishable_fact_not_a_grant]],
[[feedback_a_shared_bot_identity_makes_duplicate_posts_invisible]].

When two observers disagree on a live count, **check the clock before the arithmetic**. A
"terminal" memo about a live fleet-wide batch is a snapshot; no single session can certify it.
Report doubles as a timestamped structural observation, not a defect count — the pairs examined
(#10181, #6578, #7672) were complementary, not contradictory.

⭐⭐ **Outcome inverts my framing: 21/22 were answered by siblings I never dispatched.** Every
"gap" I found was a gap in *my view*. On a batch other orchestrators can see, ask "am I the one
who should cover it?", not just "is this uncovered?" →
[[feedback_a_batch_census_needs_the_owner_column_not_the_reply_column]].

## Per-issue notes worth keeping

- **#9872:** the departing person is the **reporter**; assignee is `kaizhangNV` (verified on a
  single-subject fetch with a #9736 control — the field I once got wrong via parallel-fetch bleed,
  [[feedback_a_parallel_fetch_lets_a_fact_land_on_the_wrong_subject]]). A perf issue has no exit
  code to reproduce; "cannot assess as written, reporter unavailable" is a legitimate verdict →
  [[project_9872_neural_hlsl_never_a_target]].
- **#6578:** full record at [[project_6578_dup_entrypoint_silent_exit0]]. I verified the
  silent-exit-0 mechanism myself: `slang-emit.cpp:3419-3421` returns `SLANG_FAIL` with no
  `diagnose()`, and no link-failure diagnostic exists in `slang-diagnostics.lua`.
- **#7672** is an explore/scoping task, not a bug → [[project_7672_cuda_compute_enablement_scrub]].
- **#9736** already had an 08-04 verdict; the scrub ask re-opened it as a fresh inbound.

## Build-environment lesson (from the #6578 cell divergence)

A peer's Release slangc gave exit 255 where mine gave 0. It controlled before publishing: the
same binary failed on a plain shader with `E00100 failed to load 'spirv-opt'` + missing
`slang-glslang`, so the cell was environment, not #6578. Two independent axes:

1. **Which config is built.** I claimed a "mirror image" (its Release vs my Debug lacking the
   lib); my `build/Debug/lib` and `build/Debug/bin` held 0 entries — no Debug build at all.
   "Absent lib" and "absent build" give the same grep output; the entry count separates them.
2. **Which version is baked into the .so name.** `slang-glslang-compiler.cpp:554` loads
   `"slang-glslang-" + SLANG_VERSION_NUMERIC`; a shallow clone stamps `0.0.0` →
   [[feedback_a_repro_binary_is_not_the_sha_you_checked_out]],
   [[feedback_shallow_clone_makes_your_head_the_graft_root]].

A cell that contradicts an already-confirmed peer result is the last to publish and the first to
control.

## If a third scrub fan-out appears

Enumerate first by commenter + date (`gh api "search/issues?q=repo:<r>+commenter:<u>+updated:<date>"`),
then check sessions **and** replies per issue. A phrase search on the comment body returned 0 —
GitHub does not index comment bodies that way.
