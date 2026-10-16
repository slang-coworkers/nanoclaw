---
type: chain
title: slang#13409 / #13412 — settled decisions, review rounds, and re-chase log (2026-10-02 → 10-14)
description: History behind drafts #13421 and #13431 — the Approach A + emitter-guard scope, the G1/G2 review gaps, the corrected-B decision and escape check for #13412, finding 3's per-target behaviour, the 10-05 lost-report incident, the #13465/#13466 filings and tangent-vector's inout ruling, and the 10-06→10-14 no-change re-chases. Split 2026-10-15; live state is in [[slang/13409-metal-groupshared-barrier-forwarding.md]].
tags: [slang, ir, metal, groupshared, history]
---

# slang#13409 / #13412: decisions and history

Live state, routing and sessions: [[slang/13409-metal-groupshared-barrier-forwarding.md]].

## Scope decisions for #13409 (mine)

- 10-02 ~19:05Z: GO on Approach A, through the triager. "No emitter change."
- 10-02 23:10Z: **scope widened to (b).** One draft PR, two commits: (1) strict A, where any call, even a
  `[noSideEffect]` one, may read or write a GroupShared root; (2) a C-like emitter guard in `emitVar` +
  `emitStore` so a store is never folded into a `threadgroup` declaration, which MSL rejects. Why: A keeps the
  var alive in mesh/object shaders, and the fold would then turn a wrong value into a compile error.
- The fold already happens on master. **Verified at `6ba151dcfc`:** `s = tid.x; barrier; InterlockedAdd(s,1,old);`
  with no other globals emits `threadgroup uint s_0 = tid_0.x;`; adding a buffer global, or dropping the atomic,
  makes it disappear (my 4 shapes plus a buffer-carrying atomic shape all came out bare). ⇒ A repro claim that
  depends on the shape needs that exact shape run before anyone disputes it.
- MSL evidence: the spec has no sentence stating the rule; cite SPIRV-Cross `spirv_msl.cpp:3868`, and the fixer
  adds a `-target metallib` test.
- PR #13421 opened 10-03 at `6ad57af497` (2 commits as decided), both by `286953280`. The triager's request for a
  re-author force-push was bundled 10-03 05:35Z with the operator's still-open CLA decision from 10-02 (signing
  the CLA makes the push unnecessary).

## Review round 1 and the G1/G2 decisions (10-04)

- slang-reviewer at 10-03 06:33Z: **REQUEST_CHANGES (small), 0 bugs, 2 gaps.** Revert check master 0/11 vs head
  11/11; full A/B shows no regressions; 131/136 groupshared outputs byte-identical, the other 5 are Metal outputs
  moving to the correct order. The fixer did not act on it for ~37 h.
- **G1 → Option 1:** narrow the GroupShared early return to `isGroupSharedAddr(root) && isChildInstOf(root, func)`.
  The global path already handles barriers on HLSL/GLSL/SPIR-V; I verified on master that a `[noSideEffect]`
  reader of a global groupshared keeps the earlier store on HLSL/GLSL, so strict A everywhere would cost those
  targets forwarding with no test behind it. **G2:** `METALLIB: result code = 0`.
- 10-04 21:18Z [Triage Resolution]: head `c42049e18f`, 3 commits, commit 3 (G1+G2) App-authored (`274397474`).
  Reviewer R2 APPROVE_WITH_NITS, 0 bugs. Terminal handoff as a draft held pending review; triager closed until merge.

## #13412: corrected B and the escape check

- Bot-filed by the triager 10-02 19:20Z, `reproduced`: pointer roots get the same exemption. Finding 3 (a
  `RWStructuredBufferGetElementPtr` root; a device-buffer load moved across barriers) is comment 5963139346.
- **GO 2026-10-04** (thread `gh-issue-shader-slang/slang-13412`): **corrected B.** Immune roots are an unpassed
  non-GroupShared local `IRVar`, plus out/inout/borrow params (copy semantics). Everything else (loaded or
  computed ptr, `T*` param, `rwstructuredBufferGetElementPtr`) takes the global path; `__ref` gets an explicit
  decision; one named helper composing with #13421; perf/semantics A/B required; draft only. Naive B breaks
  copy-in/copy-out after `undoParameterCopy`.
- 10-04 19:59Z the triager added an **escape check**: on master, a local var whose address escapes through a
  by-value struct arg (`isValueType(Struct)` skips it in the arg loop) or through global memory is forwarded too.
  I reproduced the CUDA case (`w_0(&_S1); outb = 1U`) and saw the `alias_inout` test (`y=x; w(); return y` with
  `x`=`g[0]`) is wrong in HLSL. Default if escape grows the change: split, B first, escape filed separately.
- **Finding 3 per target** (10-04 19:53Z, checked on GitHub): direct SPIR-V keeps the order; HLSL/GLSL/WGSL move
  the read; Metal/CUDA dereference after the barrier. So "every target" (reviewer) and the PR body's "on all
  targets" were both wrong; the reviewer's "separate issue" was finding 3 again.
- Result: draft #13431 (`fix/issue-13412-v2`, `bf9f3fd05a`, 8 commits). The triager sent [Triage Resolution]
  10-05 15:55Z; its 5-bullet is comment 5963139346.

## 10-05/06: lost reports and the follow-up filings

- ⚠️ **Lost reports:** the triager's 10-05 updates and asks went to my 10-04 re-chase session after it had closed;
  nobody saw them for ~28 h. Lesson: read the `-13412` triager session directly.
- 10-05 17:12Z jhelferty-nv reassigned #13421's reviewer and assignee from jvepsalainen-nv to themself.
- 10-06 19:45Z decision: **file** both out-of-scope candidates (they still reproduced at `c8e02397a7`), filing
  only, no fix until both PRs land; the dead-store issue leads with the pointer-root shape (the escaped-local
  shape is unsupported). Sent as msg 739 on `-13412`, pinned to `sess-1791142972332-o68o4g`; dashboard msg 741.
- 10-06 20:26Z: **#13465** and **#13466** filed (bot-authored, `reproduced`, both still fail with #13431 applied,
  fix direction open; triager report row 33). The `issue_opened` webhooks (one reached fresh Main session
  `sess-1791318403627-u82a8r`) were owned no-ops.

## tangent-vector's ruling on #13465 (10-07)

- 18:22Z comment 6044142513: `inout` is an **unchecked exclusive mutable borrow**; copy-in/copy-out and
  pass-by-reference are both the compiler's choice, so the repro's call site is UB and the Metal/CUDA codegen is
  permitted. Proposed direction: a **diagnostic** for groupshared storage passed to `inout` (a warning, arguably an
  error); interprocedural overlap checks are best-effort. Routed verbatim to the triager on `-13465` (msg 65).
- 18:51Z the triager's reply 6044596724 (verified: bot author, 1258 chars) accepts the ruling and asks Q1/Q2.
- Correction: the language reference moved to **shader-slang/spec** in #13439 (merged 10-07 09:06Z); the right
  citation is `specification/declarations.md:216-219` (the `docs/language-reference/` path I gave the triager is
  404 on master). Shared as a learning.
- 10-07 17:40Z jhelferty-nv assigned #13466 to kaizhangNV (milestone Q4); #13465 milestoned Q4 at 19:45Z.

## Re-chase log (all checked live)

| date (Z) | finding | report |
|---|---|---|
| 10-08 19:07 | no PR change; 24 behind; dispatch runs still `waiting`; #13466 assignee news | dashboard msg 31 (`-13409`) |
| 10-10 19:10 | no change; 32 behind; **dispatch runs deleted (404)** in the Actions purge (~10-01 20:05Z → 10-05 19:34Z), so no CI pending and the ready-flip gate is circular | dashboard msg 19 (`-13409`), once |
| 10-12 19:05 | no change; 36 behind; 0 Actions runs on either head | none |
| 10-14 19:01 | no change; 50 behind; 0 Actions runs; #13465 still at 2 comments; triager last row seq 37 | none |
