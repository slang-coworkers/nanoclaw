---
type: chain
title: "slang#14517 — E56020/E56021 resource-selection warnings omit source locations (dispatched under operator correction)"
description: MERGED 2026-11-19 02:20:34Z (PR #14522 → a22c14207, by tangent-vector; issue auto-closed completed via Fixes). Filed 11-16 23:55Z by pdeayton-nv (MEMBER), assigned to the author 10 s later; wrongly rung-4 HELD overnight; released under the operator's 11-17 correction and run end-to-end: triage → fix A+B → peer review → maintainer approval 00:2xZ 11-19 → merge. Follow-up #14555 (general legalization sourceLoc mechanism) open per tangent-vector's request. Derived filing: maintainer-requested issue #14555 (general sourceLoc/decoration transfer through legalization) filed by the fixer 11-17, no dispatch.
tags: [slang, diagnostics, E56020, E56021, resource-selection, source-location, pdeayton-nv, dispatched, operator-correction]
---

# slang#14517 — E56020/E56021 omit source locations — DISPATCHED (operator correction 11-17)

- **Issue:** filed 2026-11-16 23:55:09Z by **pdeayton-nv** (MEMBER, collaborator `write`). Resource-selection
  warnings E56020 ("conditional execution of a derivative operation") and E56021 ("unknown control-flow
  requirements") print with **no source location** when the selected sampler crosses a function boundary inside
  a texture-containing struct argument (`sampleWrapped({ texture }, cond > 0 ? firstSampler : secondSampler)`).
  Expected: location of the `sampleWrapped` call in `main`. Repro: two `slangc repro.slang -target spirv` variants
  (`-DUNKNOWN` flips `SampleLevel`/`Sample`). Slang 2026.22.
- **Live state at routing (23:5xZ):** open, 0 comments, 0 labels, assignee pdeayton-nv (assigned 10 s after
  filing; per supervisor-state the assigner was jhelferty-nv, per the original note self-assigned — either way
  an assignee, which per the corrected rule is NOT a stand-down), `author_association=MEMBER`.
- **Original disposition (WRONG, pre-correction): HELD — no dispatch, no bot post**, under the "rung-4"
  maintainer-ownership rule. **Operator correction 2026-11-17** (learning
  `operator/1794884111425-correction-only-an-explicit-stand-down-stops-the-bot`): only an explicit stand-down
  (`no-bot` label, or issue text/comment/operator asking the bot to stay off) stops the bot; an assignee or
  self-assignment is not one. #14517 was named as the wrongly-held case.
- **Corrected disposition (11-17 03:3xZ):** 👀 reaction posted (id 661584108); slang-triager dispatched on the
  canonical thread `gh-issue-shader-slang/slang-14517` with `<github-post-authorized />` — normal triage flow,
  same as #14333 (same author, same shape, where dispatching anyway was confirmed correct).
- **Substance note for the triager/fixer:** E56020/E56021 belong to the resource-selection warning pass
  (same family as E56004/#14101). The missing-location shape — warning fires with no `ISourceLoc` when the
  conditional resource use is *inside the callee* while the selection is at the call site — suggests the diagnostic
  is raised where the use is detected (callee body, no inlining yet) rather than carried back to the call site /
  selection expr. Check where the warning is emitted and whether its source loc comes from the use-site inst.

# Citations
- https://github.com/shader-slang/slang/issues/14517

## Resolution (2026-11-17, fix-complete, resting on human review)

- **Triage** (slang-triager, comment 6937206721, later PATCHed to final verdict): bug / medium / P2, reproduced on
  fresh ToT `da04f0426` (4/4 variants loc-less; both controls located at the call site), not a regression (warning
  family new in #14358, merged 11-09), no duplicate. Verified root cause: `LegalCallBuilder::_emitCall`
  (slang-ir-legalize-types.cpp:461) drops `m_call->sourceLoc` when rebuilding legalized calls; diagnostics read
  `originalConsumer->sourceLoc` with no fallback (slang-ir-resource-selection-diagnostics.cpp:77,83).
- **Fix** — draft PR **#14522** "Preserve source locations on calls rebuilt by type legalization" (final head
  `f6df2151f` after review rounds; initial head ac4d8a1ca, fix commits c46ba6566 / 2c7145a79; pr: non-breaking;
  explanation comment 6939153999): 9 commits / 6 files / +124−9 — sourceLoc preservation on every legalizer
  rebuild path (`_emitCall` :479, generic recreate :859, printf :2371, coop-mat functors :2390/:2517), shared
  `getDiagnosticSourceLoc` fallback (slang-ir-util.h:392) at both warning sinks, WGSL E56004 annotation moved
  to its call site (asymmetry documented). Peer review APPROVE_WITH_NITS (0 bugs) — all 5 nits applied; reviewer
  ruled KEEP the annotation move; PLAN/CODE/OUTPUT gates all approve. A (required) `_emitCall` copies
  `m_call->sourceLoc` (:476); B (recommended) `findFirstUseLoc` fallback at both E56020/E521 sinks. Revert drill:
  without A, 4/5 test variants fail loc-less; B alone anchors at `return` (21:5) not the call `(` (21:25) — the
  pinning test pins A; B is pure hardening. Suite 12320/12323 (3 pre-existing fp8-cuda PTX-JIT env failures,
  re-verified on unpatched master).
- **Pinning test:** tests/spirv/resource-selection-call-locations.slang — the issue's exact
  `sampleWrapped({ texture }, …)` shape, 5 variants; no prior test pinned locations for these warnings.
- **Open ruling for the maintainer review:** fix A moves an existing E56004 annotation
  (optional-resource-generic-none-wgsl.slang) from the inlined `none` to the subscript call site — a consequence
  of the early-inliner's documented call-site-first loc policy (slang-ir-inline.cpp:558-598), previously masked
  by this loc-drop; not a regression of the fix.
- **Next human action:** merge of #14522 — **tangent-vector APPROVED it 11-19 ~00:2xZ** (review 5967370097,
  no findings; verified live). PR mergeable, ready-for-review, head `f6df2151f`; CI run 44034394921 queued
  at last check. He flipped it ready himself 11-17 ("probably fine with landing as-is"), so no weekly-list
  entry was needed. Follow-up he requested in review (r4603677652) was filed as **#14555** ("A general
  mechanism for preserving source locations and decorations through type legalization", with his
  transferSourceLocAndDecorationsToLegalizedInst sketch at processInst, slang-ir-legalize-types.cpp:3897);
  both his design questions answered in-thread (r4603816456). Chain bot-complete 11-19 00:23Z; remaining
  events (merge, CI) are webhook-routed to the fixer.

## Derived filing (2026-11-17 18:0xZ): issue #14555 — maintainer-directed

During review of #14522, **tangent-vector** (comment 4603677652, 18:01Z) asked for a general
bookkeeping bottleneck ("`transferSourceLocAndDecorationsToLegalizedInst(inst, legalizedVal)`" at the
core `processInst` worker, slang-ir-legalize-types.cpp ~:3933) and explicitly requested an issue:
"I'd probably be fine with landing this PR as-is, but I'd want us to open an issue for adding a more
general-purpose mechanism…". The fixer chain (session lys3k9, running on the #14517 canonical thread)
filed **#14555** "A general mechanism for preserving source locations and decorations through type
legalization" (nv-slang-bot, open, 0 labels, 0 assignees) with the verified rebuild-path inventory
from the #14522 fix. **Disposition: filed-only.** Its `issue_opened` webhook was dispositioned by Main
with NO triage/fixer dispatch (own chain's Terminal filing; maintainer-directed). Any implementation
chain on #14555 is the operator's / maintainer review's call — note the 4 per-site sourceLoc fixes in
#14522 become redundant once #14555 lands, so sequencing #14522 → #14555 matters.
- **Update 11-19:** PR #14522 **MERGED 02:20:34Z** (head f6df2151f) — per-site sourceLoc fixes are in master;
  #14555's remaining substance = the general `transferSourceLocAndDecorationsToLegalizedInst` bottleneck +
  decoration preservation (call/printf/coopmat paths still drop decorations). #14555 open, 0 comments, labeled
  "Tess's Label", **assigned to tangent-vector**. Operator requested triage 11-19 11:33 → dispatched to
  slang-triager on the canonical `gh-issue-shader-slang/slang-14555` thread.
- **Triage verdict (11-19 11:41, slang-triager):** enhancement / medium / P2 / IR type-legalization; anchors
  HELD through merge+reorg (`processInst` :3897, `legalizeInst` :3933, `registerLegalizedValue` :3934 in
  `source/slang/ir-passes/slang-ir-legalize-types.cpp`); found ~12 extra unaudited decomposition sites dropping
  BOTH loc and decorations; issue semantics SOUND; **ready-for-fix: YES, Approach A** (bottleneck post-process,
  delete per-site copies; needs a LegalVal leaf-walker + only-if-unset loc-assign). Artifact:
  issue comment 7008057070. Fixer start parked on operator "go" (reported 11:33Z roll-up).
  **Triage memo (solution brief for the fixer): [14555-triage-memo.md](14555-triage-memo.md)** — Approach A
  wire points, risks (order-vs-requeue, re-add-after-transfer readers, order reversal), acceptance
  criteria (3 tests).
- **GO executed (11-19 12:10Z):** operator answered the 11:47Z park ask; sibling Main ruled GO → triager
  [Triage handoff] to slang-fixer 12:11Z on `gh-issue-shader-slang/slang-14555` (fixer session 4oln45,
  building master baseline in worktree 12:40Z). Supervisor-state park cleared to fixer-owned. Acceptance
  criteria include #14522's pinning test staying green as the regression baseline; PR should list decoration
  classes covered vs deferred.
- **Draft PR #14637 (11-19 13:47Z):** "Preserve source locations and decorations through type legalization"
  (head 526b7bd, fix/issue-14555 → master, +165/−21, 3 files, draft; CI run 44535620356; pr-mapping verified
  → fixer session 4oln45). Fix = 4-commit series (repro test → mechanism → per-site deletions → guard test).
  Suite 12375/12378 — only the 3 standing fp8-cuda PTX-JIT env failures (pre-existing on master; receipts
  from #14522/#13387/#13011/#10232 chains delivered to the fixer). Explanation HTML delivered to Main; peer
  review (slang-reviewer) next, [Fix Report] follows its verdict; ready-flip → weekly undraft list.
- **[Fix Report] (11-19 14:08Z):** fixed — one post-process at `processInst`
  (`transferSourceLocAndDecorationsToLegalizedInst` + recursive LegalVal leaf-walker; simple one-for-one → loc
  only-if-unset + decoration move, identity/IRConstant targets excluded; coopmat paths on deferred-removal
  contract); 6 per-site copies deleted. Repro fails at master / passes at head; #14522 baseline 5/5; guard
  green; suite 12375/12378 (fp8-cuda env baseline only, stated in PR desc per my msg-6 disposition). Critique
  gates PLAN/CODE/OUTPUT approve (lean re-record after a session reset; CODE re-audited all 38 simple sites).
  Peer review in flight (max 2 rounds per workflow); CI 44535620356 queued at report time. Receipts verified
  by Main 14:12Z (explanation comment 7010963126 at head 526b7bd; PR desc fp8 line). Next: webhook-driven
  (peer verdict → CI → maintainer review); ready-flip entry goes on the weekly undraft carry-over when the
  reviewer verdict is green.
- **Peer review r1 (11-19 14:34Z): REQUEST_CHANGES** — 3 reviewers on head 526b7bd (drift 0): 1 bug
  (convergent: none/tuple rebuilt calls lose call-site sourceLoc — regression vs master) + 3 gaps; the
  reviewer's differential build confirmed the fixer's failing-first repro; maintainer direction met. Verdict
  + combined-review.md relayed to fixer 4oln45 at 14:35Z (delivery verified). Fixer applies r1 edits
  (round 1 of max-2), then requests re-review.
- **r1 applied → round 2 (11-19 15:30Z):** head 526b7bd → **85749a0f** (verified). Headline bug fixed per
  reviewer suggestion (`_emitCall` stamps loc + moves decorations for every result flavor — none/tuple rebuilt
  calls sat outside the returned LegalVal); pass-through guard (forwarded values get locs, not decorations);
  2 test gaps deferred with documented reasoning; new failing-first WRAPPED-TUPLE loc test. Suite
  12376/12379 (fp8 env trio only). Round 2 in flight — last of the max-2 budget: on further REQUEST_CHANGES
  the fixer ships the better diff + lists unresolved findings; on APPROVE → [Fix Report].
- **r2 verdict (11-19 16:09Z): APPROVE_WITH_NITS — 0 bugs, 11 nits** (doc-accuracy + test-coverage; two
  supersede the fixer's deferrals with concrete no-GPU test designs). r1 bug verified fixed via failing-first
  repro; Devin's one title-only r2 bug unsubstantiated by two traces (advisory). Review budget exhausted —
  fixer applies nits without another round, pushes, then final [Fix Report]. Verdict delivered to fixer via
  three rows (reviewer-direct + combined review + Main relay, 16:10Z). After the final report: ready-flip
  carry-over → weekly undraft list (live-verify draft/head), roll up to operator.
- **Final [Fix Report] (11-19 16:47Z): fixed, review closed.** Head **9f5c1bdc4** (verified live; explanation
  comment refreshed; CI 44568470127 queued) — 8 commits / 5 files / +307−26. One post-process owns pass-wide
  replacement bookkeeping; `_emitCall` + loop-branch emission stamp the two shapes whose product sits outside
  the returned LegalVal (discarded none/tuple calls, rebuilt terminators — loop pragmas feed loop-unroll);
  7 hand-rolled copies deleted; decoration transfer narrowed to fresh non-constant replacements; coopmat on
  the deferred-removal contract. 2 failing-first repros + 3 guards (incl. tuple-result call-site E56020 loc,
  verified failing at 526b7bd). Suite 12377/12380 (fp8 env trio only). Declined nits recorded with reasoning.
  **Follow-up flagged (not established):** conditionally-selected sampler in a plain local passed inout gave
  an unlocated E56020 in one probe (build-logs/probes/p16-impderef.slang, reproduced at head; the
  straightforward inout shape IS located). Remaining step: human review/merge of draft #14637.
