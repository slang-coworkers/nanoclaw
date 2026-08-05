---
name: project_12185_bindless_texture_nv_desc_handle_nonimage
description: "#12185 spvBindlessTextureNV aborts on non-image/sampler DescriptorHandle — triaged P2, fixer handoff"
metadata: 
  node_type: memory
  type: project
  originSessionId: 6f619349-0ea3-4cf3-977d-4a8b6c4b3e69
---

# #12185 — spvBindlessTextureNV InternalError for non-texture/sampler DescriptorHandle

> ⚠️ **CONTROLLING STATE — read this block first; everything below is chronological history and
> earlier entries may be SUPERSEDED.** (This file exceeded the 24.4KB Read limit; ⚠️*(The `~24.4KB Read limit` premise was FALSIFIED 2026-08-04 — see [[project_memory_files_over_read_limit_backlog]]. The restate-in-full practice still stands on its own merit: conclusions up front beat pointing into a long append-only file.)* append-only order
> would otherwise truncate the newest, most authoritative content. See
> [[project_memory_files_over_read_limit_backlog]].)
>
> **As of 2026-08-03 ~23:28Z — ✅APPROVED, NON-DRAFT. Held PURELY on a maintainer merge.**
> - PR **#12186 non-draft**, head **`65338dbef9`**, 17 files, `Closes #12185`. Review `4849248355` =
>   **APPROVED by pdeayton-nv @23:11:11Z binding to `65338dbef9`, which IS the current head** ⇒ the
>   approval is **live, not stale**. `mergeable: true`, `mergeable_state: **blocked**` (was `behind`
>   @23:28Z) = **branch staleness + required-check bookkeeping, NOT a code defect** — needs a
>   maintainer **"Update branch"**.
> - ⛔⛔**STALE-REPLAY TRIPWIRE — inbounds arrive DAYS-to-WEEKS late, verbatim, out of order.** Any
>   message mentioning **E55215** · **`4fbe216b0e`** · **`f4004c3f90`** · **`107f158ffe`** · **"8 review
>   rounds"** · **"approved / awaiting merge" (pre-redesign)** is **HISTORY** ⇒ check its timestamp, then
>   settle with one live probe (E55215 has **0 matches** at head — it was removed in the redesign).
>   **Do NOT let such a message move this block; acting on one would regress a verified state — and a
>   public verdict — to an abandoned approach.** Fired twice in one session, at two tiers.
>   ⇒ [[feedback_stale_replayed_inbound_can_regress_state]]
> - 🔒**APPROVAL-LOCKED — do NOT push, rebase, dispatch, or ready-flip.** Any commit or rebase
>   dismisses pdeayton's approval. `mergeable_state: behind` may need a maintainer **"Update branch"**
>   first — **the bot cannot do it** (same dismissal). Approval ≠ merge auth; nothing closed.
> - ✅**CI is now GENUINELY CLEAN** (08-04 13:18Z, 128 rows = `total_count`): **82 success / 46 skipped
>   / 0 failures**; legacy `license/cla` + `SlangPy Tests` pass; combined `success`. The two
>   formerly-red jobs (`check-ci`, `test-falcor`) now succeed in both suites — a sibling **reran** them,
>   and **a rerun creates no commit ⇒ the approval is unaffected.** ⚠️Supersedes the earlier
>   "80/46/2" reading; that older tally was correct-at-the-time (both failures were cumulative
>   per-head history from a **manual-dispatch** suite, not the `pull_request` suite) — sibling of the
>   suite-vs-commit basis trap below.
> - ⚠️**An auth failure can surface AS A DATA ROW.** The first tally was corrupted by a OneCLI
>   `app_not_connected` error appearing as a **pseudo-row**, inflating the counts. Cure: re-probe auth on
>   **the exact path** (got 200, `X-Ratelimit-Limit: 6000`), then page explicitly with a sum-check.
>   ⇒ a transport error that parses as data is indistinguishable from data unless you sum-check.
> - **On merge:** **#12192 UNPARKS** (it was blocked on this landing) · #12191 likely moot · #12219
>   already merged as #12263. Then re-read the merged diff against the close-out checks, refresh the
>   verdict to "merged", forward the final resolution.
> - ⚠️**The LIVE public verdict is a SIBLING's comment `5179347248`** (12:53Z, edited 13:12Z) — posted by
>   another session under the same `nv-slang-bot[bot]` identity, verified accurate and better-sourced,
>   and it **supersedes** ours. Our `5065523733` was PATCHed to point at it ("superseded by the newer
>   update below"); the sibling's was left untouched. ⇒ **before posting here, enumerate the comments
>   and read any bot comment you don't recognize — "I was last" is unverifiable under a shared
>   identity** ([[feedback_tell_the_footprint_owner_when_you_post_yourself]]). Both carry the
>   **kind-gating caveat**, so the closed issue won't be read as a type-level guarantee.
> - ⚠️**TWO WRITERS EDIT THE PUBLIC VERDICT COMMENTS** (the fixer edits them too) ⇒ **fetch before
>   editing**; never assume the body you last wrote is what's live. ✅**"bot can't PATCH issue comments
>   (403)" was STALE** — re-probed with an idempotent re-PATCH of `5065523733`: succeeded, `updated_at`
>   moved, body intact at 2528 chars (the shorter API echo was **CRLF normalization, not truncation**).
>   ⇒ at close-out **PATCH first and re-fetch to confirm**, don't default to a redundant fresh comment.
>   Current state: `5041198434` carries a superseded-approach warning (it had still claimed
>   "approved / awaiting merge" — actively misleading post-redesign); `5065523733` refreshed with the
>   layout + inlining fixes, stale head SHA dropped. Design trail intact, not rewritten.
>   ⇒ [[feedback_published_negative_env_claims_need_rederivation]] fired AGAIN — a capability-negative
>   held for weeks, cleared by one probe.
>   **The inlining fix SHIPPED:** five case labels present at
>   `slang-ir-legalize-global-values.cpp:119-123` (`CastUInt2ToDescriptorHandle`,
>   `CastUInt64ToDescriptorHandle`, `CastDescriptorHandleToUInt2`, `CastDescriptorHandleToUInt64`,
>   `kIROp_Select`) beside pre-existing `kIROp_BitCast` (:111); new regression test
>   `desc-handle-nv-bindless-global-width.slang`. 17/17 exit-code-clean under spirv-val (first harness
>   only grepped stderr — codex caught it; re-run held).
> - **Outcome: pdeayton's own ~10-line proposal beat all four fixer guard variants AND the
>   producer-side gating the triager had assessed as the root fix** — the real constraint was
>   **representation survival**, not emit-side handling. ⭐Worth remembering: the maintainer saw a
>   simpler layer than either bot tier.
> - **Kind-gating stays OPEN as a separate semantics question** (gap verified `hlsl.meta.slang:27474-83`
>   / `:27529-44`). The fixer did NOT claim the fix settles it — it separated *representation survival*
>   from *expressibility* and stated plainly that a cross-width round-trip **still compiles silently**
>   (defined, not crashing), so pdeayton/csyonghe decide knowingly whether they want it diagnosed.
> - CI red = benign priority-yield — only failures are `check-ci` + `wait-for-human-priority`; **every
>   build/test job `skipped` ⇒ no code/test job executed**, nothing to investigate.
>   `retry-yielded-bot-ci` reruns.
> - ⚠️**CI COUNTING BASIS — suite-level ≠ commit-level; comparing them manufactures a phantom
>   discrepancy at merge.** Head `142627d4d6` carries **12 check-suites**: the cited suite
>   `83668874200` = 36 runs (33 skipped / 2 failure / 1 success) — exact for that suite; the
>   **commit-level** query returns **80** runs (2nd 36-run suite `83667598325` concluded `skipped`, ten
>   single-run suites, + 2 queued app suites github-pages/coderabbitai). Both figures correct, different
>   questions. ✅Truncation self-check passed: 74+4+2 = 80 = `total_count`
>   ([[feedback_gh_paginate_401s_on_page2_use_explicit_pages]]).
> - **Shape that shipped (3 things, nothing else):** option-(a) **kind-dependent handle width**
>   (uint64 for texture/sampler family, uint2 for buffers+AS) · the `sizeof`/`alignof` layout-rule fix
>   · the ~10-line `isInlinableGlobalInst` addition. **No diagnostic, no descope, no `.meta.slang`
>   change.** All four earlier guard variants dropped (E39033 commit dropped, iteration-4 stashed);
>   ~86 lines of cross-width machinery deleted (proven dead, 0/10 reach) — at close-out confirm the
>   deletion **and** that no dangling refs to the removed helpers remain. E55215 shape long gone; the
>   abort is fixed **by construction**, not diagnosed.
> - **Kind-gating gap** (what the escalation was about): width conversions are capability-gated but
>   **NOT kind-gated** in both directions (`hlsl.meta.slang:27474-27483` write / `:27529-27544`
>   read-back, triager-verified at master) ⇒ cross-width use is expressible in the type system. The
>   inlining fix addresses **representation survival**, NOT this **expressibility** question.
> - ⚠️**The mechanism is NOT "a surviving runtime `OpBitcast`"** (correcting an earlier expectation —
>   verifying against that would be wrong): once the initializer chain inlines, **ordinary constant
>   folding resolves the width outright** (`OpConstant %ulong` → `OpIAdd %ulong`; the malformed
>   `OpCompositeExtract`-on-a-scalar folds to a `%uint_3` index) ⇒ **no bitcast emitted for the
>   constant case at all.**
> - **CLOSE-OUT — re-read the MERGED diff, never progress echoes** (shape churned ~6×):
>   · Record that cross-width round-trip is now **silently DEFINED, not diagnosed** — satisfies
>     #12185's text, but is **NOT** a type-level guarantee anyone may infer from the closed issue.
>   · ⛔**RETIRED CHECK — do NOT run "verify `gh-9916.slang` unmodified"; it FALSE-ALARMS now.**
>     Written when only the E39033 commit touched it; branch-wide it is **+5/−1** from option-a commit
>     `6efff26dcb` (opcode-CHECK correction, legitimate). The revert that mattered already happened.
>   · Lean on the empirical `spirv-val` result, **not** spec prose.
>   · ⭐**TEST ADEQUACY (pdeayton, 08-03 21:27Z): a single `-O1` lane is INERT for this fix** — at
>     `-O1` both bitcasts have already folded, so it verifies the end state and can never show the
>     global initializer was legally sunk. Require **all three lanes**: `-O0` spirv-asm with SSA ids
>     bound · `-O0` binary via `-o <file>` · `-O1` folded `OpConstant`. **Plus confirm `kIROp_Select`
>     is genuinely exercised** — it's one of the five ops this PR adds and was riding along untested.
>     `CHECK-NOT` must be **bounded between positives spanning `OpLabel`…`OpFunctionEnd`**; an
>     end-of-file-bounded `-NOT` misses a bitcast right before the `OpIAdd` — exactly where the bridge
>     would reappear. ⇒ [[feedback_optimized_lane_can_be_inert_for_the_fix]]
> - ⚠️**MEASUREMENT BASIS — do not quote "−100/+4 in `slang-emit-spirv.cpp`" publicly.** That is a
>   *per-commit* figure; **branch-vs-master is +58/−7** there (`git diff --numstat
>   origin/master...PR-head`), because the option-a work also adds to that file. Not a defect — a
>   basis mismatch. Always state which basis a diffstat is on.
> - ⚠️**TWO LAYERS, DO NOT CONFLATE** — the shipped mechanism (`kIROp_Select` + the four
>   `Cast*DescriptorHandle*` ops added to `isInlinableGlobalInst`, beside pre-existing `kIROp_BitCast`)
>   is **representation SURVIVAL**. Whether a cross-width round-trip should be **legal-and-bitcast** or
>   **type-system-rejected** is **EXPRESSIBILITY** — a semantic call for pdeayton/csyonghe that this
>   fix does NOT settle. The fixer stated that distinction in its reply rather than claiming otherwise.
> - Spin-offs: **#12219** (SCCP const-fold, separate chain) · **#12191/#12192 MOOT** (they were about
>   the removed E55215) · heap-path spirv-opt crash (`const_folding_rules.cpp:129`).
> - Lessons born here: [[feedback_descope_recheck_original_acceptance_bar]] ·
>   [[feedback_fix_can_invert_into_overrejection]]

**Repo:** shader-slang/slang · **Author:** pdeayton-nv (MEMBER) · opened 2026-07-22
**Canonical thread:** `gh-issue-shader-slang/slang-12185`

---

## History (chronological — earlier entries may be superseded by the block above)

With `-capability spvBindlessTextureNV`, converting `DescriptorHandle<T>` → SPIR-V aborts
(`E99997 InternalError: Unsupported result type for CastDescriptorHandleToResource`, exit 255)
for ConstantBuffer / StructuredBuffer / RWStructuredBuffer / ByteAddressBuffer **and**
RaytracingAccelerationStructure. Image/sampler kinds compile fine. Same cases compile without
the capability.

## Original root cause (triager-verified @d148787f2) — the reported abort
Producer/consumer breadth mismatch: producer `hlsl.meta.slang:27784-85` (`case
spvBindlessTextureNV:`) forwarded **every** descriptor kind through
`__castDescriptorHandleToResource<T>` unconditionally (sibling arms all `switch(T.kind)`), while
consumer `slang-emit-spirv.cpp:5121-5147` handled only `TextureType`/`SamplerStateType` →
`SLANG_UNEXPECTED` at :5145. `SPV_NV_bindless_texture` encodes uint→image/sampler only; buffers have
no encoding; AS has `OpConvertUToAccelerationStructureKHR` (existed ~:7490-97, not wired in).
Correction to reporter: he expected AS to work — **AS also aborted**.

## 📁 Superseded fix shapes → [[project_12185_superseded_fix_shapes_history]]
Two abandoned shapes + the escalation that replaced them, moved out to keep this file readable:
**shape #1** E55215-in-legalization (reached APPROVED @`4fbe216b0e`, then csyonghe re-opened the
design; E55215 + guard/predicate no longer exist ⇒ #12191/#12192 MOOT, verdict cmt 5041198434 refresh
held) · **shape #2** the E39033 arc (all four guard variants dropped) · how option (a) was chosen and
first pushed (`f4004c3f90`) · pdeayton's 2 investigation Qs (Q1 → issue #12219; **Q2's first answer was
wrong and got corrected** — real layout bug, fixed in `107f158ffe`) · the 08-03 escalation and its
verified kind-gating crux. **Read the child before re-proposing anything in this space.**

### Chain-shape summary (detail in the child)
Reported abort → E55215-in-legalization (APPROVED, then re-opened by the project lead) → option-(a)
kind-dependent width (`f4004c3f90`) → 2 investigation Qs, one answered wrong then corrected into a
real layout fix (`107f158ffe`) → descope + 4 E39033 guard variants, all dropped → **escalation → the
maintainer's own ~10-line `isInlinableGlobalInst` fix, which shipped.** Six shape changes; the
kind-gating expressibility question is still open for pdeayton/csyonghe.

- Classified bug / medium / **P2** / SPIR-V emit. Issue Type `Bug`; `reproduced` applied.
- **PR #12186 — NON-DRAFT / ready-for-review.** jkwak-work flipped draft→ready @15:54:57Z
  (ReadyForReviewEvent; isDraft=false, reviewDecision=REVIEW_REQUIRED, jkwak COMMENTED not
  approved). `Closes #12185`, branch `fix/issue-12185`, `pr: non-breaking`. **Now the public
  artifact carrying the trail.**
- **Round-3 (jkwak's 8 inline comments) folded in @ head `ec7d8d83f6`** (was `5c0694b537`):
  5 mechanical (comment removals/revert + rename `diagnose…`→`maybeDiagnose…`) + 2 on-thread
  answers (findOuterGeneric generic-skip; predicate is a type-classifier not an NV-ext detector)
  + **1 OPEN pushback:** fixer DECLINED jkwak's `SLANG_ASSERT(getErrorCount()==0)` because
  legalization legitimately raises E55215 (count deliberately non-zero), citing existing
  `if(getErrorCount()!=0) return SLANG_FAIL` precedent — **left as jkwak's call**. Also jkwak
  offered a `isTextureOrSamplerStateType` rename. No logic changed round-3 (comments+rename only).
- **Rounds 3–7 (maintainer review jkwak + pdeayton) CLOSED @ HEAD `b0167a5c3a`** — all resolved
  or agreed-deferred; fixer stood down pending APPROVE. pdeayton's 2 correctness catches folded:
  (a) SamplerComparisonState, (b) OpConvertUToImageNV-vs-SampledImage image/combined split.
  Early-vs-late diagnostic placement settled = legalization-worklist case. Final push was a
  behavior-identical nit (`as<IRTextureType>` in the shared predicate). `reviewDecision=
  REVIEW_REQUIRED` (no APPROVE yet).
- **2 agreed-deferred follow-ups filed (separate cleanup, bot-authored, NOT folded into this
  chain):** **#12191** (E55215 diagnosed in post-OpKill dead code) + **#12192** (ConstantBuffer
  E55215 lacks a valid source location). Will surface as their own triage inbounds if routed.
- CI on fresh head green-so-far (some pending); only red across cycle = documented Falcor D3D12
  GBuffer-RT flake, unreachable from SPIR-V-only diff — not a regression.
- Verified locally (6 variants pass GPU-less w/ spirv-val, desc-handle suite 5/5, buffer arms
  assert E55215 + zero E99997); codex CODE+OUTPUT approve. Real `pull_request` CI run 29937049157
  queued. **CI-red webhook = cosmetic priority-yield** (redundant workflow_dispatch; builds/tests
  SKIPPED, only check-ci/wait-for-human-priority red) — NOT a failure. Also known: D3D12 Falcor
  `test_GBufferRTTexGrads_d3d12` image flake, blast-radius-cleared (SPIR-V-only change).
- **All 4 reviewer items folded in & re-verified by triager at source (head 5c0694b537):**
  Gap #1 fixed via shared `isBindlessTextureNVEncodableResourceType` predicate in slang-ir-util
  (`unwrapAttributedType` → `kIROp_TextureType || as<IRSamplerStateTypeBase>`) used by BOTH the
  legalize guard AND the emit switch (single source of truth; emit adds
  `case kIROp_SamplerComparisonStateType → OpConvertUToSamplerNV`) — also closes the C001 latent
  AttributedType-unwrap re-abort. `SamplerComparisonStateType` confirmed nested under
  `SamplerStateTypeBase` in slang-ir-insts.lua so predicate genuinely accepts it. #2 message adds
  texel buffers / no over-claim; #3 SAMPLER_COMPARISON + BYTE_ADDRESS_BUFFER test arms +
  `CHECK-NOT: E99997` on all buffer arms; #4 shared-predicate rename + comment. codex approve.
- Issue verdict (cmt 5041198434) refreshed in place → "reviewed clean, ready-for-review, in
  maintainer review".
- codex PLAN+CODE+OUTPUT approve; [Fix Review Request] → slang-reviewer.
- **Reviewer verdict (2026-07-22, head 3e5cccb28e / diff ea76331334b2): `APPROVE_WITH_NITS`** —
  0 bugs, 3 gaps, 1 clarity. Advisory, 0 GitHub writes. A (correctness) + C (clarity) completed;
  B (Devin) timed out → skipped. Gaps to fold in while draft:
  1. **[correctness completeness] slang-ir-spirv-legalize.cpp:1860** — allow-list accepts only
     `kIROp_TextureType`/`kIROp_SamplerStateType`; `SamplerComparisonState`
     (`kIROp_SamplerComparisonStateType`, `DescriptorKind.Sampler` @meta.slang:27401, encodable
     via `OpConvertUToSamplerNV`) is falsely diagnosed E55215 → PR turns old abort into a *wrong
     diagnostic*. Fix: widen guard to `as<IRSamplerStateTypeBase>` + add case to emit switch
     (mirror emit:2746); also verify `CombinedTextureSampler`.
  2. **slang-diagnostics.lua:5628** — E55215 message omits texel buffers, lists "samplers" while
     rejecting comparison sampler. Align after #1.
  3. **test** — no `ByteAddressBuffer.Handle` arm (distinct `translateToStructuredBufferOps` path;
     untested). Add `-DBYTE_ADDRESS_BUFFER` asserting E55215.
  4. **[clarity C001, latent]** accept-set hand-duplicated vs emitter; guard unwraps
     `AttributedType`, emitter doesn't (latent re-abort) → factor shared predicate
     `isBindlessTextureNVEncodableResultType`.
- Relayed to slang-triager on canonical thread + full `combined-review.md` attached; triager
  forwards to slang-fixer for PR update.
- **Next human action:** review draft, flip ready, merge. Close-out when #12186 merges.
- Related (not dup): [[project_12161_nonuniform_descriptorhandle_nonspirv_verify]], #12116, #12051.

## ⚠️ 2026-08-03 ~20:2xZ — #12186 head MOVED; the "MERGED" report was FALSE

GitHub-verified: **#12186 is STILL OPEN and STILL DRAFT — not merged.** But its head moved: was `107f158ffe`, now **`1ea307608a6b`** — 17 files, **+483/−71**, new commit that day 18:33Z *"Inline DescriptorHandle representation casts out of module scope"*.

⚠️**`slang-fixer` reported #12186 as MERGED and banner-ed its `hold-12192` file on that premise — FALSE, and corrected.** The underlying *design* claim is real, though: the diff does carry a kind-dependent representation (**70× `uint64`, 74× `uint2`, 51× `kind`**), so **the E55215 path may still be re-scoped ⇒ re-verify the repro at HEAD before implementing Approach A.**

⭐**A design call can be resolved by a commit, not only by a reply** — so this chain's RESUME has two arms, and the *act* arm must be checked first: **pdeayton's design call (answer), OR #12186 merges / its head moves again ⇒ re-read the diff + re-verify the repro at HEAD before implementing.** Same class as the #12219 discharged-debt trap: chasing a question someone already answered in code wastes a maintainer's turn.

## Operational state (moved from MEMORY.md index, 2026-08-04)

⚠️ **`mergeable_state` re-probed 2026-08-04: now `blocked` (was `behind`).** Per the #12148 lesson, that
value names only *that a requirement is unmet*, never **which** — so do **NOT** infer "needs Update
branch" from it any more. ⚠️**The first poll returned `unknown`: GitHub computes merge state LAZILY.
Re-poll until it resolves; never record `unknown` as a state.**

🔒 **APPROVAL-LOCKED.** #12186 carries pdeayton-nv's APPROVE (review `4849248355`, binding to head
`65338dbef9` — live, not stale) and is **non-draft** (was `mergeable_state: behind`, now `blocked`).
**No push / rebase / ready-flip — any new commit dismisses the approval.** The "Update branch"
button requires a MAINTAINER; we cannot clear `behind` ourselves.
**RESUME = maintainer merge** (then #12192 UNPARKS and #12191 becomes moot).

⚠️ **An aggregate red X ≠ failure.** The real `pull_request` check suite `83685090805` has **0
failures**; the reds visible on the PR are cumulative per-head history from an earlier manual
dispatch. Key CI judgments on `check_suite.id`, never on the commit-level aggregate.

⚠️ **kind-gating stays OPEN.** The cross-width `DescriptorHandle` round-trip is now silently
**DEFINED, not diagnosed** — whether the type system should instead *reject* a cross-width
round-trip is an unresolved semantic question. This limitation is stated in the public verdict on
the PR, so it is disclosed rather than hidden, but it is not fixed.

⛔ The retired check "gh-9916 unmodified" **FALSE-ALARMS** — do not reinstate it.

⭐ pdeayton's ~10-line inlining fix beat all 4 fixer variants *and* the proposed "root fix": the
real constraint was **representation survival**, not emit handling.
