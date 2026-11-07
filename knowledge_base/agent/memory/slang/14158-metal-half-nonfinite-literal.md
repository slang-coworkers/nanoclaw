---
type: chain
title: slang#14158 — Metal emits a `half` NaN/Inf constant as the float expression `(1.0 / 0.0)`
description: Human-filed (albertrodriguezclo, external) 2026-11-02 10:04:34Z. MetalSourceEmitter::emitSimpleValueImpl kIROp_FloatLit writes non-finite literals as float `(x / 0.0)` regardless of IR type, so `as_type<ushort>` of a half Inf/NaN is rejected by Apple metal. Reporter has a fix prepared. Dispatched to slang-triager under R6 (release 11-06 10:04:34Z).
tags: [metal, emit, half, nan, r6, triage, community-pr]
---

# slang#14158 — Metal `half` NaN/Inf literal typed as `float`

**Report.** `bit_cast<uint16_t>(half(1.0/0.0))` → MSL `as_type<ushort>((1.0 / 0.0))`; Apple metal rejects
the float→ushort size mismatch. Constant folding reaches it from ordinary code
(`half(bit_cast<float>(0x477ff000u))` → +inf); `tests/compute/half-constant-rounding.slang` has no Metal lane.
The emitter comment already names it "a known remaining gap" (after #11837). Master `6815ed82d`.

**Related.** WGSL counterpart #13672 (bot draft #13680, [13635 cluster](13635-wgsl-nonfinite-const-expr-cluster.md)).
Reporter's open PR #13927 rewrites the float NaN path in the same function (neighbouring lines).

**Reporter has a fix prepared** (wrap a half-typed NaN/Inf in `half(...)`, new test
`tests/metal/half-nonfinite-literal.slang` METAL+METALLIB). This reporter usually opens their own PR soon after
filing, so no bot fixer unless the reporter does not and the operator agrees.

**Dedup (11-02 ~10:10Z).** `grep 14158 memory/slang/` → no hits. No open PR by the reporter names it yet
(open: #14147–#14150, other topics). No duplicate issue found.

**R6.** Human-filed, no labels, fences hold a downstream compiler diagnostic, not a crash word → hold until
**2026-11-06T10:04:34Z**: no bot comment, PR, or commit naming the issue.

**Ownership.** Webhook → Main `sess-1793613876870-ff8b84` → slang-triager on `gh-issue-shader-slang/slang-14158`.

**Triage (slang-triager, 11-02 10:17Z, master 6815ed82d; the triager's findings, not reproduced by me).**
Bug/medium/P2/target-emit, `reproduced` + Type=Bug set 10:13:41Z, 0 comments. Emitted MSL matches the issue byte for byte;
Apple `metal` not run (rejection is the reporter's). Site `slang-emit-metal.cpp:1242-1256`, gap comment :1261-1263. Not a
regression (#11837 left it). **#13927 does not cover `half`** (its comment says a half NaN keeps `0.0 / 0.0`); text-only
conflict in the NaN arm. Rec **A** = reporter's `half(...)` wrap (GLSL already emits `float16_t(1.0 / 0.0)`,
`slang-emit-glsl.cpp:1347`). Alt B bits via `as_type<half>(ushort(..))`, C shared helper (3-way #13927 collision).
Memo: `/workspace/inbox/a2a-1793614634751-rxbyer/triage-14158.md`; held draft `memory/issues/comment-14158.md` (triager).
Timer **t-03c361** 11-06 10:10Z: reporter PR → check it against the acceptance criteria; else re-verify + post + report.

**HLSL side bug (triager, DXC 1.9):** `slang-emit-hlsl.cpp:1763-1781` always emits `(1.0f / 0.0f)` → `asuint16` of a half
Inf fails. 11-02 10:2xZ I told the triager to file it under the filing policy (dedupe first, no reference to #14158 or
#13927, filed-only, no fixer).

**Filed 11-02 10:20:32Z: bot issue #14161** ("HLSL: a `half` infinity/NaN constant is emitted as the `float` expression
`(1.0f / 0.0f)`…"), Type=Bug + `reproduced`, deduped. The body names only #11837 (not #14158, #13927, or the reporter), and the #14158
timeline has no cross-ref. **#14161 is owned by this chain: its issue_opened needs no dispatch.** Filed-only; no fixer
(that needs a decision from me or the operator). A fix touches the HLSL NaN arm that #13927 also edits. If it lands second, update by merge, not rebase, once reviewed.
The held #14158 draft now points to #14161.

Its `issue_opened` webhook reached Main 11-02 (after 10:20Z). It was checked against this record and **not dispatched**.

**11-06 10:23Z re-check t-03c361 (the triager's report; I did not reproduce it).** **Reporter PR #14165** (`Fixes #14158`), opened
11-02 10:28Z, non-draft, MERGEABLE @ `39e216318`, approach A (+20/−13 in `slang-emit-metal.cpp`, new
`tests/metal/half-nonfinite-literal.slang`). Fork CI is `action_required` (no lane has run, METALLIB included). Shepherd jhelferty-nv
(auto-assigned), no human review yet. Triager built the head on the L40S: the half wrap also covers the module-scope `constant
array<half,3>` and `min`/`select`; float MSL is byte-identical; 271/271 metal/constants tests pass. The one `*half*` failure,
`fp8-cuda-half-acc (cuda)`, also fails on master `6d43c8d88`. Gap: the test checks only the 3 bit_cast lines, with no table and
no overloaded call. No bot comment on #14158 (the PR carries the trail). No fixer. #13927 is still open (the PR body says they
compose). #14161 is untouched.
11-06 I authorized ONE optional PR comment on #14165 with the two test-coverage suggestions (the reporter has a Mac and can run
METALLIB). Owner of CI approval and review: maintainers.

**Posted 11-06 10:28:20Z: PR #14165 comment 6682714331** (nv-slang-bot). It suggests two optional tests: a runtime-indexed
module-scope `static const half[3]` table and `min(..., half(1.0 / 0.0))`. The suggested snippet passes the METAL lane at the head and
would fail on master. The comment says Apple `metal`/METALLIB were not run. Codex OUTPUT_REVIEW approved it. The triager posts nothing more.
A reporter reply on #14165 counts as a live inbound.

**Resume on:** a reporter reply, #14165 review/merge, or t-fce8b1 (11-13 10:10Z).

**Reporter PR (supervisor tick 321).** albertrodriguezclo opened [#14165](https://github.com/shader-slang/slang/pull/14165) (`Fixes #14158`) at 11-02 10:28Z. It is non-draft and BLOCKED, waiting on a maintainer review. No bot fixer: the R6 release one-shot must reconcile with this PR instead of posting a planned fix.
