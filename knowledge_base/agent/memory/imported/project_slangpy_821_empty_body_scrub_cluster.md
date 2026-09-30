---
name: project_slangpy_821_empty_body_scrub_cluster
description: "slangpy#821 scrub RESOLVED 08-05: verdict published (cmts 5196835011 patched + 5197948085 new). #821/#820 nominated-not-accepted (ccummingsNV never ack'd); GENUINELY orphaned = #822/#832/#844/#768. Gated on #768 retire-vs-keep. Latent dispatchdata.py:108 substring defect MINE-VERIFIED wider than reported."
metadata:
  node_type: memory
  type: project
  originSessionId: 771a61c5-e510-491d-9a7d-355d99fd785c
---

# slangpy#821 — "minimal wrapper when only the compute/cuda-kernel tag is missing" (scrub)

**RESUME TRIGGER (person-independent — see the void-gate lesson in
[[project_slangpy_823_tensorview_interop_buffer_noncuda]]):** (a) any `issue_comment` on
shader-slang/slangpy#821, or (b) `slangpy-triager` reports on thread `gh-issue-shader-slang/slangpy-821`.
**The gate that actually decides this issue is the retire-vs-keep ruling on epic #768** (#821 is
formal sub-issue 3 of 7 on #768, confirmed via `/sub_issues`).

## State (terminal until #768 rules)
- **Inbound:** `jkiviluoto-nv` cmt `5195827127` (2026-08-05T18:41Z): *"Mukund (mkeshavaNV) won't be
  returning … scrub this issue."* Part of a **fleet-wide batch** — byte-identical text in 8 s across
  slangpy #1001/#899/#822/#821/#820/#768/#844/#823 and slang #9661. A batch mention's stated reason is
  a template, a hypothesis per artifact — see [[feedback_a_reporters_framing_is_a_hypothesis_not_a_finding]].
- **Published verdict:** `nv-slang-bot` cmt `5196835011` (20:13Z, by #820's sibling batch session,
  patched in place 22:07Z) + **new** cmt `5197948085` (22:07Z) carrying only the ownership delta,
  because an in-place edit notifies nobody ([[feedback_an_in_place_edit_notifies_nobody]]).
- **Ownership finding: "nominated, not accepted."** #821/#820 `assignees=[ccummingsNV]` since
  2026-03-13, but both `assigned` events have `actor: mkeshavaNV`, and ccummingsNV has 0 comments / 0 PRs
  / no self-assign on #820/#821/#822/#768. The field records the departing owner's intent, not the
  receiver's assent. Commit activity in the area (#870/#876/#879) was deliberately treated as
  non-load-bearing.
- **Premise scope (12 legs):** wrong person — #820, #821; never assigned — #510, #1001; genuinely
  orphaned — #768, #822, #832, #844 (+ #899, #274, #823); orphaned-but-close — #779.
- **Disposition deferred:** close-as-satisfied / rescope-to-port / hold, selected by #768's ruling.
  **No fixer dispatched** — nothing to fix until #768 rules. Main did not post on GitHub.

## The cluster (read together, not in isolation)
#820/#821/#822 filed 2026-02-26 within 24 s by mkeshavaNV, label `slangtorch_parity_polish`, milestone
Q1 2026, **all with `body: ""`** — the title is the whole ask, so "still relevant?" must be answered
against slangpy HEAD, never the issue text:

| # | title (the entire ask) | assignee |
|---|---|---|
| 820 | call an already compute/cuda-kernel-tagged entry point without a CallData trampoline | ccummingsNV |
| 821 | generate a minimal wrapper when only that tag is missing | ccummingsNV |
| 822 | wrap a raw entry point for the backward pass; infer `[CUDAKernel]` from forward | mkeshavaNV |

Parent candidate #768 "Support raw dispatch in slangpy" has a real body and says
`mymodule.myfunc.dispatch` "should be retired."

## Latent defect — MINE-VERIFIED at HEAD (`slangpy/core/dispatchdata.py`)
- Cites verified: `:84-135` whole block, `:100` `if ep is None:`, `:103-113` param validation,
  `:117` emits `{declaration}: SV_DispatchThreadID`, `:122-123` default `uint3(32,1,1)`, `:126-135`
  the emitted `[shader("compute")] [numthreads(...)]` mini-kernel.
- `:108` is `not "uint" in slang_function.parameters[0].type.full_name` — a **substring** test.
  `full_name` is `getFullName()` (`src/sgl/device/reflection.cpp:243-248`), and Slang renders vectors
  canonically, so `uint3` reflects as `vector<uint,3>` (`test_reflection.py:511-514`); the two green
  tests (`test_raw_dispatch.py:19`, `uint3 dispatchThreadID`) pass *only* via that substring match.
- **Genuinely accepted wrongly:** `uint4`, `uint64_t`, `uint16_t`, and matrices (`uint4x4`, `uint2x3`
  — matrix spelling unverified: `grep -c 'matrix<'` in `test_reflection.py` is 0). A wrong param binds
  to a thread-id semantic and fails in generated Slang, far from the cause.
- **Not a one-line fix.** A correct predicate must accept `vector<uint,N≤3>` and bare `uint` while
  rejecting sized ints and matrices, so it must test reflection `kind`/`scalar_type`/`row_count`;
  naive tightening to `uint1/2/3` regresses the only tested path. If raw-dispatch validation work
  opens, treat it as a reflection-API change with those two tests as the regression guard.

## Lessons (durable)
- **Bucket by the field's state, then map states to actions; never bucket by your verdict on the ask.**
  "Premise false" is a predicate over the question; "wrong person" and "never assigned" are facts about
  the field. Test: if a bucket's members would prompt different next actions, it is the wrong bucket
  (#510/#1001 need an owner; #820/#821 need nothing). An empty `assignees` is an unasked question —
  [[feedback_a_null_from_an_instrument_with_no_field_is_an_unasked_question]].
- **Recompute a headline count from the enumeration at write time.** I closed with "2 of 10" after
  having 4/12 right earlier in the session. A retrospective aggregate deserves *more* re-derivation than
  a published claim, because nobody downstream can notice it is wrong.
- **A per-thread session query is evidence about routing, never about work.** The verdict was posted
  100 min before my dispatch by a sibling batch session on #820's thread; `comments_count` on the
  issue I had already fetched was the receipt — [[feedback_a_memo_is_not_a_receipt]]. Write a status
  verb only after the call returns; on resume, distrust your own last lines.
- **A hand-built input set is a hypothesis about the domain.** I listed `vector<uint,3>` and `uint` as
  defects — they are the check working; I fed invented type names to a predicate and read the output as
  measurement.
- **Verify a citation by grepping the artifact, never by retyping it from a working summary.** The
  triager's subagent "confirmed" a wrong path that only existed in the triager's own prompt. A 404 on a
  path typed from memory is evidence about the typing, not the repo.
- **Grep for a field the output actually contains**, and control the instrument before reading a zero:
  `ncl sessions list` carries `agent_group_id`, not the group name —
  [[feedback_control_the_instrument_not_the_reasoning]],
  [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].

## Related
- [[project_slangpy_823_tensorview_interop_buffer_noncuda]] — same batch; source of the void-gate lesson.
- [[project_9661_cuda_getdimensions_scrub]] — same batch on slang; there the trap was body-vs-thread
  disagreement, here it is no body at all.
- [[feedback_a_guard_can_be_inert_and_read_as_passing]] — "assignee is set" reads like "someone owns it."
- [[slang-slangpy-tooling-chains-index]] — routing index for slangpy chains.
