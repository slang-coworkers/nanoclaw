---
title: "slang#12002 SHIPPED: refute-then-fix triage of a 'misattributed OpName' that was a coincidental stdlib name collision"
type: learning
topic: slang-compiler
source: learnings/1783746988745-slang-12002-shipped-refute-then-fix-triage-of-a-mi.md
---

# slang#12002 SHIPPED: refute-then-fix triage of a "misattributed OpName" that was a coincidental stdlib name collision

Full chain outcome for shader-slang/slang#12002 — PR #12053 MERGED to master 2026-07-11 by jkwak-work (APPROVED, merge commit 4d91d47bf3, issue auto-closed COMPLETED). Confirms the earlier root-cause learning ([[slang#12002 spirv_asm named registers leak into OpName]]) end-to-end.

## What shipped
Approach A (narrow, producer-side): renamed the internal spirv_asm result register `%sampled`→`%__sampled` in `source/slang/hlsl.meta.slang` — the fixer found **94** whole-token sites (my triage grep undercounted at ~20; the register spans OpImageSample{Implicit,Explicit}Lod + OpImageFetch + OpImageRead + sparse OpCompositeExtract + the `$(spvLoadInstName)` splice). Added regression `tests/spirv/texture-sample-internal-opname.slang` (`CHECK: OpName %{{...}} "__sampled"` + `CHECK-NOT: "sampled"`). Reporter (external, maxime-modulopi) explicitly asked for the `__` prefix, so Approach A doubled as honoring their request.

## Triage lessons that held up
1. **Rename-drill discriminator is decisive for "debug name on the wrong inst" claims.** Renaming the user's variable and seeing whether the disputed OpName follows it (→ real propagation) or stays (→ intrinsic/emitter-baked name) settled a counterintuitive premise cheaply and correctly. Refuting the reporter's stated hypothesis (name migration into the callee) did NOT mean "not a bug" — there was still a real cosmetic defect (stdlib-internal asm register name leaking into user-facing OpName). Lead the public verdict with the refutation, then the real defect.
2. **Approach B correctly left maintainer-scope.** The emitter auto-emit-OpName-for-every-named-spirv_asm-register loop (slang-emit-spirv.cpp:11616-11617, idMap :11233) is a DOCUMENTED, TESTED feature (`tests/language-feature/spirv-asm/opname.slang`: "the implicit OpName inserted for spirv_asm IDs can coexist with an explicit OpName"). Also plain user OpNames are ungated (maybeEmitName :3575, NameHintDecoration :6028), so a "gate on -g0" variant would make asm names inconsistent with user names. Shipping the narrow producer fix + flagging B in the PR body was the right call; maintainer accepted without asking for B.

## Process
- Verified every relayed artifact against live GitHub before propagating (draft-PR facts at handoff; MERGED state + merge commit + issue CLOSED/closedBy at ship). The `merged` field is NOT valid for `gh pr view --json` — use `state=MERGED` + `mergedAt`/`mergedBy`/`mergeCommit.oid` instead (a bad `merged` field silently errors the whole JSON parse).
- `report_pr_created` must be called by the PR-OWNING session (the fixer), NOT the triager — calling it from the triager would bind #12053's webhooks to the wrong session. Confirmed live by the fixer's `github.ci_failed` webhook routing to its own session.
- Merged non-draft PR with `Closes #N` = permanent public footprint; no issue re-post needed at ship.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783746988745-slang-12002-shipped-refute-then-fix-triage-of-a-mi.md`_
