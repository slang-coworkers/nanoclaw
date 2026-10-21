---
type: project
name: project_13611_fwd_diff_interface_size_mismatch_tangent_padding
description: "slang#13611 (saipraveenb25, assigned to self via jhelferty-nv, 10-13 19:31Z): fwd_diff through an IDifferentiable interface value holding two differently sized structs reads the smaller struct's tangent from AnyValue padding (A: expected (3,1), got (3,0)). Reporter's hypothesis: typeflow MakeDifferentialPair decomposes to tuple-of-unions, dispatch param keeps union-of-pairs; upcastSet packs tuple wholesale, maybeUnpackArg unpacks as concrete pair. Sibling #13612 independent. TRIAGED 10-13 (cmt 6154195515): P1 regression from #9808, hypothesis confirmed; saipraveenb25 PR #12466 head fixes repro. Parked on assignee; 10-20 re-chase: no movement; next re-chase rechase-13611-fwd-pair-p-3ac4 10-27."
---

# slang#13611: fwd_diff tangent read from padding for differently sized interface values

**10-13 19:31Z, `issue_opened`.** Live read ~19:36Z: open, human author saipraveenb25, assignee saipraveenb25
(assigned 19:31:14Z by jhelferty-nv), no labels/milestone, 0 comments, body 3439 chars. The only session on
`gh-issue-shader-slang/slang-13611` was my webhook session `sess-1791919864881-snek3u`. There were no tasks,
conversations or open PRs for it, and dedup searches found nothing. Its code pointers resolve at local master
`5841033344`: `analyzeMakeDifferentialPair` at slang-ir-typeflow-specialize.cpp:3024,
`specializeMakeDifferentialPair` :7360, `upcastSet` slang-ir-typeflow-set.cpp:75, `maybeUnpackArg`
slang-ir-lower-dynamic-dispatch-insts.cpp:45.

**Reporter's claim (unverified):** the call site packs two `AnyValue8` into an `AnyValue16` as `[x, 0, dx, 0]`. The
dispatch wrapper then unpacks a concrete `DifferentialPair<A>` and reads `dx` from word 1. If the structs are
the same size, the result is correct.

**Disposition:** same as sibling [[project_13612_bwd_diff_e50101_interface_factory_early_return]] (filed one minute
later, same author, stated independent) and [[project_13527_sm610_vector_interlocked_accumulate_signature]]. I
dispatched `slang-triager` on the canonical thread to reproduce (HLSL/CPU, no GPU), check the
tuple-of-unions vs union-of-pairs hypothesis with an IR dump, dedup, and post one 5-bullet. No PR, and no fixer
unless the assignee asks.

**10-13 19:45Z, triager progress (its report, not yet checked by Main):** reproduced on CPU at master (sel=0 → (3,0)).
Release window: v2026.5.2 OK, v2026.7 bad. The suspect is #9808 "Refactor auto-diff implementation" (saipraveenb25, merged
04-01, `45ccce9a37`, which Main looked up); a parent-vs-merge build is running. The IR shows the tuple packed wholesale
into the union of pairs. bwd_diff and plain tuple/struct-of-existential controls pass, so the bug is fwd-pair specific.
Write-up pending.

**10-13 20:08Z, TRIAGED.** I checked the comment, the labels and #12466 myself. slang-triager posted
[6154195515](https://github.com/shader-slang/slang/issues/13611#issuecomment-6154195515): nv-slang-bot author, 5076 chars.
Labels `reproduced`/`Autodiff`/`regression`, Type=Bug. Rated bug / high (silent wrong derivative) / **P1 regression**.
- It reproduces on `-cpu` at master 584103334 (`3,0,6,2`, expected `3,1,6,2`). An interface-returning factory fails too. SPIR-V passes
  spirv-val and is still wrong.
- **The regression is #9808** (`45ccce9a3`). Its parent `473afb979` packs a concrete DiffPair_A contiguously.
  v2026.5.2 is OK; v2026.7, v2026.19 and master are bad.
- Hypothesis 3 is confirmed after specializeModule. `analyzeMakeDifferentialPair` (:3024) builds a tuple of tagged unions.
  The dispatch param is `UntaggedUnion(TypeSet(DiffPair A, DiffPair B))`, and the wrapper unpacks it as DiffPair<A>
  (`maybeUnpackArg` :45/:93). They meet in `upcastSet`'s non-union-to-union branch (typeflow-set.cpp:192-200), which
  assumes the arg is a set member without checking.
- The non-canonical side is an inference, and the comment labels it as one. `makeInfoForConcreteType` (:645, called from
  getParamInfos :5067) has no DifferentialPair case and falls back to a flat union (:746). `substituteSets` (:3931/:3995)
  maps a pair to a tuple. That points at the dispatch-param side.
- Scope: bwd_diff on the same shape and the non-autodiff struct/Tuple/generic-holder controls are all correct. No
  duplicate; #13612 is separate, and #10728/#13301/#13226 are related but distinct.
- **saipraveenb25's open PR #12466** "Support autodiff through abstract properties" (head `06f7cd79e`, non-draft,
  CONFLICTING) already carries the pair as a tuple through dispatch. Built locally, it passes this repro and the factory
  variant. The full suite was not run. Its test uses equal-size conformers, so it misses this bug.
- Also offered: fallback A (convert at upcastSet) and a membership assert. Memo:
  `/workspace/inbox/a2a-1791922180179-lv6i6d/triage-13611.md`.

**Parked on the assignee:** fold the fix into #12466 or fix it separately. No fixer, no bot PR. Re-chase
`rechase-13611-fwd-pair-p-b4cd` is a one-shot at 10-20 18:00Z. Resume earlier on a bot-addressed comment (it arrives
as a webhook).

**10-20 18:00Z, re-chase (`rechase-13611-fwd-pair-p-b4cd`): no movement.** #13611 is open, assigned to saipraveenb25,
with the same labels. The only comment is still the triage comment 6154195515, and no comment mentions the bot. #12466 is
open and non-draft, still CONFLICTING, head `06f7cd79e` unchanged, last updated 08-22, and its body does not reference
#13611. A search found no PR that references #13611. saipraveenb25's newer #13677 (function-extension synthesis) and the
bot's #13742 (fix/issue-13301) are unrelated. I sent one line to orchestrator-dashboard on the canonical thread.
`ncl tasks update --process-after` on the firing one-shot failed with `no live task matched`. This is known behavior; see
[feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun.md](feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun.md).
I re-armed it as a fresh one-shot, **`rechase-13611-fwd-pair-p-3ac4` at 10-27 18:00Z**. Its prompt now says to re-arm with
`create`, not `update`.
