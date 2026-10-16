---
type: chain
title: slang#13631 — workgroupUniformLoad synchronizes only on WGSL
description: "albertrodriguezclo, human-filed bug: workgroupUniformLoad is barrier+load on WGSL but a plain load on SPIR-V/HLSL/GLSL/Metal/CUDA, so portable code races. Triaged 10-15 (P2); draft PR #13659 shipped @c136bcb after 2 REQUEST_CHANGES rounds; gaps filed #13675/#13683. PARKED on maintainer (kaizhangNV) acceptance of the semantics."
---

# slang#13631

**2026-10-15 13:15Z, webhook `issue_opened`.** Live read before dispatching: OPEN, 0 comments, no
labels, human-filed by albertrodriguezclo (part of the #13631–#13642 batch), `updated_at` =
`created_at`. The only session on `gh-issue-shader-slang/slang-13631` was this Main webhook session.
Dispatched to `slang-triager` on the canonical thread.

**13:32Z, [Triage] (msg 10, memo `/workspace/inbox/a2a-1792071128547-hst20u/triage-13631.md`):**
bug / high / P2, core-module, cross-target. Reproduced on ToT 6597ec920. `hlsl.meta.slang:35582`
emits the WGSL built-in on WGSL and `default: return v;` elsewhere; the doc comment ("no-op on other
targets") is wrong. Intrinsic came from #5597 to silence WGSL uniformity errors; only a WGSL test.
Approach A (recommended): barrier → load → barrier on non-WGSL GPU targets, cpp stays a plain load
(matches Tint `lower.cc:246-266`). Main verified: triage cmt 6193295113 (bot, 13:31:47Z), `reproduced`
label, slang-fixer session `sess-1792071076644-3e37xa` running on the canonical thread.

**14:16:59Z, reporter comment 6194249872** (live re-read: unedited, no bot mention). Prefers (a);
asks a **maintainer** whether (a) is accepted, and is holding a docs-only PR until answered.
Forwarded to the triager with NO post authorization (acceptance is a maintainer call). Triager
relayed the preference to the fixer; nothing posted. Told the operator (dashboard) that a maintainer
should answer the reporter (optional).

**15:16Z, triager report (msg 20):** draft PR **#13659** "Synchronize the workgroup in
workgroupUniformLoad on every GPU target". Main verified: draft, OPEN, author nv-slang-bot, head
`fix/issue-13631`, label `pr: breaking change`, body references 13631 and has an "Open question"
(blocks merge) on accepting the semantics. Breaking because target-only `[require]` callers now get
E36104 from the barrier's capability, and non-uniform code now executes a barrier. Metal deferred-load
caveat tracked as #13409. Test covers 7 targets (5 fail on master). pr-mapping row → fixer session
`sess-1792071076644-3e37xa`. Issue delta cmt 6195528987 (bot, 15:16:26Z) states the PR as proposed,
not accepted, and leaves the reporter's question to a maintainer.

**15:29Z, fixer [Report] direct to Main (msg 24):** head **3f73000ac** (verified), new test 7/7 at head
vs 2/7 on master, full suite 0 new failures, peer review requested from slang-reviewer. Metal load
deferral #13409 is fixed in draft PR #13421 (verified OPEN draft). No question; no reply sent.

**17:57Z, slang-reviewer [Report] (msg 26), R1 @3f73000: REQUEST_CHANGES** (sent to the fixer, not posted on GitHub;
PR has 0 reviews, verified). Reviewer's finding, not re-run by Main: fragment/vertex callers now get a workgroup
barrier → invalid SPIR-V (slangc exits 0) and DXC rejects it, where master emitted a plain load. Fix: `__stage_switch`
guard, tested with an identical full suite. Also `-target slangvm` compute now fails with E41011. Compute path is
judged correct. Asks the fixer for the stage guard, a frag/vert validation test, an E36104 diagnostic test, then R2.
Shepherd: **kaizhangNV**, who is assignee on both #13631 and #13659 and review-requested on #13659 (verified). No maintainer comment yet.

**18:48Z, fixer [Report] (msg 28): R2 pushed**, head **5d7986f8c** (verified, still draft, 0 GitHub reviews, no
human comments on PR or issue since 15:16Z). Barriers now only in compute/mesh/amplification; other stages keep
the plain load. New tests: stage behaviour, E36104, vk/cuda runtime (CI-only). Full suite 8024/8025 (gfx-smoke CPU
also fails on master). R2 review request with slang-reviewer.
⚠️ **Bot-filed follow-up #13675** ("slangvm: specializeTargetSwitch reports E41011 for a callee reachable only from
an unselected __target_switch case", verified OPEN, author nv-slang-bot) is **OWNED by this chain** (fixer session
`sess-1792071076644-3e37xa`). On its `issue_opened` webhook, dispatch nothing.

**18:28Z, R2 pushed** (`01618a3425` tests, `4bf6419ceb` stage gate; later head `5d7986f8cd`). Agreed fixer↔reviewer at 18:07–18:11Z:
drop the dead `slangvm` arm, no `HostVM→slangvm` caps change, file the dead-callee E41011 separately.

**18:38Z, #13675 filed** (bot, by slang-fixer) — `specializeTargetSwitch` diagnoses a callee reachable only from an
unselected `__target_switch` case on `-target slangvm` (empty caps). Linked from #13659's body ("Slang VM target"
limitation, "filed separately as #13675"). The #13675 webhook Main session (`yw8oir`) ran the owner ladder: owned by this
chain (rungs 5/7), no fixer dispatched (fix layer is a design call; master already has the bug), and armed one
`--process-after` re-check `rechase-13675-slangvm-de-58e4` for 10-17T19:00Z. The fixer's own filing report had not
landed after a ~3 min poll.

**21:09Z, slang-reviewer [Report] (msg 30), R2 @5d7986f: REQUEST_CHANGES, final round** (to the fixer; 0 GitHub
reviews, verified). Reviewer's findings, not re-run by Main: R1 frag/vert bug fixed + tests fail without it, 0 new
suite failures. Still open, reproduced by the reviewer: (1) `[CudaDeviceExport]` caller not reached from any kernel →
E99999 internal error, **new in R2**; (2) `-target host-cpp` compute → E41011, undocumented (reviewer retracted its R1
claim that master already fails). New gap: work-graph node shaders lose the barriers. Devin page still showed R1.
Fixer ships the better diff and lists unresolved findings.
**Check on the fixer's final report:** at 21:1xZ the PR body did NOT yet mention `CudaDeviceExport`, `host-cpp`, or
node/work-graph (verified by grep). If the final body still omits any of them, ask the fixer (thread
`gh-issue-shader-slang/slang-13631`) to disclose it. Then send the operator ONE consolidated update.

**22:09–22:10Z, [Triage Resolution] (triager msg 36) + fixer [Report] (msg 40): shipped after the 2-round cap.**
Main verified: head **c136bcb54**, draft, OPEN, 8 files +392/−7, 0 GitHub reviews; includes
`slang-ir-specialize-stage-switch.cpp` (unrooted functions take `default:`), which is **not peer-reviewed**. Disclosure check
PASSED: body Risk line lists #13409/#13675/#13683; the doc comment covers work-graph nodes, slangvm and host-cpp
(→ #13675). #13683 ("specializeStageSwitch removes a stage-specific callee still called from a function no entry point
reaches", bot, OPEN) is OWNED by this chain; its Main webhook session `e79y25` already ran. Issue cmt 6195528987 was edited
in place at 22:09:13Z with c136bcb and is still the newest comment. CI run 38813244400 (workflow_dispatch @c136bcb) shows
`waiting`, so it is draft/approval-gated, not green. Triager's chain is closed. Operator sent one consolidated update.

**Resumes on:** kaizhangNV's answer on the semantics or a review on #13659, a reporter comment, or the PR's
merge/close. Parked-chain timer: one-shot `rechase-13631-pr13659-se-8806` (10-20T15:00Z; `ncl tasks create` timed out at 30 s but the row exists, exactly one). #13675 resumes on `rechase-13675-slangvm-de-58e4` (10-17T19:00Z). #13675 resumes on `rechase-13675-slangvm-de-58e4` (10-17T19:00Z) or a maintainer-comment webhook.
