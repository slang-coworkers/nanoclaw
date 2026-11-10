---
type: project
name: project_12392_entrypoint_calls_entrypoint_constref_segv_history
description: "Dated log for slang#12392 / PR #12721 (split from the chain record 2026-11-09 by okf-synthesis). New dated entries go HERE, not in the record. 11-09: cross-module repro clean on the #12721 head, merge-master push df8ad1b, #13074 HLSL E56010→E56006 re-expect accepted, 16:56Z @tangent-vector land-now-vs-#13882 nudge."
metadata:
  node_type: memory
  type: project
---

# slang#12392 / PR #12721 — dated history

Current state, decisions and lessons live in [[project_12392_entrypoint_calls_entrypoint_constref_segv]].
This file holds the dated timeline; append new dated entries here.

## 2026-11-09

**11-09 15:30Z — cross-module repro from albertrodriguezclo** (CONTRIBUTOR, issuecomment-6743979356): the called entry
point lives in an imported module (`m.slang`), and the crash is rc 139 on cuda/wgsl/metal/hlsl. They say the single-file
version gives rc 0. The GitHub body has no @mention (checked), so the relay carried no post marker. I relayed it verbatim to
the slang-triager owner session `sess-1786023730364-8w6v1g` (pinned, in_reply_to=2, thread canonical); its container woke and
no second session appeared. The triager decides whether to post and whether the fixer (`sess-1787081467438-un38y5`, owns
#12721) gets a regression-test handoff. Main did not dispatch the fixer. #12721 is still draft/CHANGES_REQUESTED, last updated 08-26.
15:46Z triager result: master hangs or asserts on all 6 targets, and the #12721 head is clean on all 6. It handed the fixer
extra test cells plus an update from master (its handoff said "rebase", but the fixer merged anyway). Its GitHub reply was in
critique review.
15:53Z triager posted issuecomment-6744493334 (the repro is clean on the #12721 head `9953c8304`). **Nudge plan, approved by Main:** after
the fixer's merge-master push lands and CI starts, the triager @-mentions tangent-vector on #12721 (under OUTPUT_REVIEW). The question
is no longer #12777 in-PR vs follow-on. It is whether #12721 lands now as an interim fix, or is folded into his own #13882 rollout.
Step 5 there ("stop decorating ordinary implementations as entry points", cmt 6591811561, 11-03) is #12721's change. RESUME on the
triager's post link.
16:21Z: on the merged head, 1 of 8813 tests fails, `tests/bugs/13074/13074-static-resource-entry-point-patch-constant.slang` (#13116).
The HLSL cell with both entries goes E56010 → E56006, because the per-entry-point HLSL compile no longer sees `constants` as an entry point.
Master's E56010 was the decoration leak. The fixer is re-expecting HLSL to E56006, adding a SPIR-V cell that keeps E56010, and disclosing
this for the #13116 author. I accept that (the specific diagnostic is lost on HLSL only, which is a consequence of the principled fix).
The nudge is held until the push.
16:53Z: the fixer pushed `df8ad1b` (merge `fd1dd8a4a`, no force-push, MERGEABLE). CI yielded behind higher-priority human runs and
auto-retries. **16:56Z nudge posted** (#12721 issuecomment-6746043020, checked live): an @tangent-vector ask, land now or fold into #13882.
**Parked on tangent-vector**; his reply arrives as a webhook. supervisor-state was updated. The fixer is in peer-review round 2 with slang-reviewer.
18:44Z: the triager filed side find S1 as **#14426** (generic entry point loses the module-scope derivative-group mode;
reproduced on master `ae4e57957`), with the sibling Main session's 18:40Z OK. Its issue_opened webhook reached a
different Main session, which did not dispatch it: it is owned by this chain. Record: [[../slang/14426-generic-entry-module-scope-derivative-group.md]].
18:47Z: in review round 2, slang-reviewer requested changes; the fixer is applying a remedy for B1 (a spurious E31210), not pushed yet.
**G4** is a second maintainer question, added by editing the 16:56Z nudge in place (6746043020, edited 18:47Z, still one @, by Main's
direction: no second ping). A `.slang-module` built with `-entry vmain` and no `[shader]` gives `getDefinedEntryPointCount()` 1 / `findEntryPointByName`
OK on master, and 0 / E_FAIL on the PR head, because the PR deletes `lowerFrontEndEntryPointToIR`'s synthesized `EntryPointAttribute` (slang-lower-to-ir.cpp:15298).
The question: is that acceptable, or should the information come from the front end / the container's entry-point list? Parked on tangent-vector for both questions.
19:25Z: the fixer pushed the R2 remedy, head `568bf0c` (ahead 7 / behind 0 from df8ad1b, no force-push). Reviewer R2 is re-requested. The triager edited the Status line of nudge 6746043020 in place to name 568bf0c and to say "yielded … retry job will rerun"; no new @.
