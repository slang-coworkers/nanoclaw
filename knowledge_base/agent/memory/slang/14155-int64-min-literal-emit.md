---
type: chain
title: slang#14155 — C-like targets emit INT64_MIN as `-9223372036854775808LL`
description: Human-filed (albertrodriguezclo, external, cloth-sim batch) 2026-11-02 10:04:28Z. CLikeSourceEmitter::emitSimpleValueImpl BaseType::Int64 writes decimal + "LL", so INT64_MIN becomes unary minus on an out-of-range literal; Metal/clang/nvcc warn (-Werror fails). Reporter has a fix prepared. TRIAGED 10:17Z (bug/medium/P2; IntPtr + GLSL sites and a switch-case hard error beyond the report). Reporter PR #14168 (Int64 case only; approved by jkwak-work 11-02) queued for the paused approver; IntPtr + GLSL gaps put to the operator 11-02 ~16:30Z. #14168 MERGED 11-02 17:59Z (8b351e2613), issue closed; IntPtr + GLSL sites still open on master 6d43c8d88f. The operator ask was withdrawn; the triager re-verified both sites at 6d43c8d88 and filed follow-up #14382 (11-06 10:36Z). Closed on our side.
tags: [emit, c-like, metal, hlsl, cuda, cpp, int64, literal, r6, triage, community-pr]
---

# slang#14155 — INT64_MIN literal emitted out of range

**Report.** `outputBuffer[0] = -9223372036854775807LL - 1;` → MSL `-9223372036854775808LL`; Apple metal
`-Wconstant-conversion` warning. Shared emitter → Metal, HLSL, CUDA, C++. Hits
`tests/language-feature/constants/integer-corners-i64.slang`, `conversions/conversion-to-bool.slang`,
`conversions/conversion-to-int64.slang` on Metal. Master `6815ed82d`.

**Verified by me (11-02 10:07Z, master 6815ed82d5).** `source/slang/slang-emit-c-like.cpp:1380-1385`:
`emitInt64(int64_t(v)); emit("LL")`, no INT64_MIN case. Also seen: the `BaseType::IntPtr` case
(~:1394-1400, 64-bit pointer) writes `int64_t(<decimal>)` with **no** suffix, so the same value there is an
unsuffixed out-of-range literal. Whether the reporter's fix covers it is unknown — passed to the triager as a
note, not a claim.

**Reporter has a fix prepared** (`(-9223372036854775807LL - 1LL)` in the Int64 case, new test
`tests/language-feature/constants/int64-min-literal-emit.slang`, metal/hlsl/cuda/cpp text lanes + cpu run).
This reporter usually opens their own PR soon after filing (#14010 → #14011 in 38 min), so no bot fixer
unless the reporter does not and the operator agrees.

**Dedup (11-02 ~10:06Z).** `grep -rl 14155 memory/slang/` → only an unrelated comment-id hit in the #13732
record. No PR names 14155; reporter's open PRs #14147–#14150 are other topics. Same-value but different
layer: [#13986](../imported/project_13986_int64_min_div_neg1_sigfpe.md) (SCCP/front-end fold SIGFPE). Older
literal work: PR #11357 (merged).

**R6.** Human-filed, no labels, the fenced block is a downstream compiler warning, not a crash word → hold until
**2026-11-06T10:04:28Z**: no bot comment, PR, or commit naming the issue.

**Ownership.** Webhook → Main `sess-1793613870819-mi04ot` → slang-triager on `gh-issue-shader-slang/slang-14155`
(dispatched 11-02 ~10:08Z). Batch siblings, each its own Main session: #14151, #14154, #14156–#14159.

**Triager [Report] (10:17Z).** Bug / medium / P2 / target-emit, reproduced at 6815ed82d (Metal text-level only, Linux
host). Not a duplicate (6 query sets); #13986 is related, not a dup (draft PR #13991). No reporter PR at 10:16Z.
Memo [raw/triage-14155.md](raw/triage-14155.md); held draft [raw/comment-14155-held.md](raw/comment-14155-held.md)
(5-bullet + three findings put to the reporter as suggestions).
- **Two more sites the reporter's Int64-only fix misses** — code paths verified by me at 6815ed82d5:
  c-like `BaseType::IntPtr` (`:1394-1409`, writes `int64_t(<decimal>)`, no suffix) and the GLSL override
  (`slang-emit-glsl.cpp:1415-1422`, Int64+IntPtr share it, writes `<decimal>L`).
- **Severity is higher than the issue says:** `emitSwitchCaseSelectorsImpl` (`:3697`) prints `case` values through
  `emitOperand`, so `case INT64_MIN:` is a hard error. The triager reports nvrtc 12.6, dxc 1.9, glslang and LLVM
  host-callable errors, and only a warning from gcc (its runs; I verified the code path, not the compiler outputs).
- Recommended fix (triager): the reporter's spelling at all three sites through one helper, plus a switch-case lane
  and `-vk -emit-spirv-via-glsl` / `-cuda` run lanes.
- R6 still holds: a hard error found by us is not a crash word in the report.

**Resume on:** the triager's report; R6 release timer `r6-release-14155-755e` (11-06 10:08Z).

**Reporter PR (supervisor tick 321).** albertrodriguezclo opened [#14168](https://github.com/shader-slang/slang/pull/14168) (`Fixes #14155`) at 11-02 10:39Z. It is non-draft and BLOCKED, waiting on a maintainer review. No bot fixer: the R6 release one-shot must reconcile with this PR instead of posting a planned fix.

**PR #14168 ready_for_review webhook (11-02 ~16:21Z, Main `sess-1793636508331-mwm9p1`).** Head `eb56b2cc`, jkwak-work
APPROVED 14:32Z, CI 55 pass / 0 fail. slang-pr-approver is paused, so I did not forward it; it is queued in
`data/approver-pause-queue.md`. I read the diff: it fixes **only** the c-like `BaseType::Int64` case. At master `8229f27423`
the c-like `IntPtr` case (`:1394-1408`) and the GLSL Int64/IntPtr override (`slang-emit-glsl.cpp:1416-1420`) are unchanged.
c-like `case INT64_MIN:` labels are fixed as a side effect (they go through `emitOperand`), but the PR has no switch-case lane,
and GLSL switch cases are still broken. This is the PR branch of the R6 one-shot, done 4 days early because a maintainer
has already approved and the PR could merge first. I told the operator the missing sites and asked whether to raise them;
I posted nothing. R6 waiting period is retired (Core Memory), so the 11-06 hold is stale; the one-shot is repurposed as a re-check.

**Re-check one-shot `r6-release-14155-755e` (11-06 ~10:10Z).**
- jkwak-work merged #14168 at 11-02 17:59:32Z (`8b351e2613`); #14155 closed 17:59:34Z. No comments on the issue.
- I found no operator answer. I read the dashboard session from seq 509402 (10-30) to 511528 (11-06 09:30Z), and the asking Main session `sess-1793636508331-mwm9p1`.
- On master `6d43c8d88f` (11-06) both sites are unchanged, by my code read: c-like `IntPtr` at `slang-emit-c-like.cpp:1402-1409` and the GLSL Int64/IntPtr override at `slang-emit-glsl.cpp:1416-1422`. No open issue or PR tracks them (GitHub search for `9223372036854775808` and "INT64_MIN GLSL").
- I posted nothing on GitHub and sent nothing to the triager. I told orchestrator-dashboard **once** (msg id 19, thread `gh-issue-shader-slang/slang-14155`) and gave three options: raise the sites with the reporter, have the triager reproduce and file a follow-up (allowed by the filing rule), or leave them. **Do not re-ask.**

**Resume on:** an operator reply only. If they say file, send it to slang-triager on `gh-issue-shader-slang/slang-14155` (session `sess-1793614086392-0zk9h0`, `in_reply_to` = my own row). The triager must re-verify on master and dedupe first; [raw/comment-14155-held.md](raw/comment-14155-held.md) has the findings. Otherwise the chain is closed.

**11-06 ~10:15Z: the operator question is withdrawn and the filing is delegated (me).** As with #13674, the
filing rule covers this case, so asking the operator was wrong. I sent slang-triager its owner session
`sess-1793614086392-0zk9h0` (row id 511537 on my side): re-check the c-like `IntPtr` and GLSL Int64/IntPtr
(+ `case INT64_MIN:`) sites at HEAD, dedupe, and file ONE follow-up issue. It posts nothing on #14155 or
#14168 and starts no fixer chain. I told the dashboard (511539). **Resume on:** the triager's report
with the issue number. Record it here and in slang/index.md. Its issue_opened webhook needs NO dispatch.
**11-06 10:37Z: filed as #14382 (verified on GitHub: OPEN, bot-authored, labels `GLSL` + `reproduced`, no @-mentions, no "Fixes").**
The triager reproduced both sites at master `6d43c8d88`, which includes the #14168 fix:
- c-like `IntPtr` still writes `int64_t(-9223372036854775808)`. It warns on LLVM and gcc, and dxc gives a hard error on `case`.
- GLSL writes `case -9223372036854775808L:`. glslang fails it with "scalar integer expression required" in the `-emit-spirv-via-glsl` lane.

No duplicates; the #13986 family is a different layer. The held #14155 draft is superseded and will not be posted. #14382 is
FILED-ONLY with no fixer chain, and **its issue_opened webhook needs NO dispatch**. Side finding, already tracked: the
runtime `intptr_t` local crash on SPIR-V is #13200 (draft PR #13202). **This chain is closed.**

**11-06 10:37Z: follow-up filed as [#14382](https://github.com/shader-slang/slang/issues/14382)** (triager [Report], its
seq 19; the report also reached the dashboard, row 511554). Both sites reproduce at master `6d43c8d88`:
- c-like `IntPtr` (`slang-emit-c-like.cpp:1402-1416`) emits `int64_t(-9223372036854775808)`: clang/gcc warn, nvrtc silent,
  `-cpu`/`-cuda` run lanes correct; dxc hard-errors on `case intptr_t(INT64_MIN):`.
- GLSL Int64/IntPtr override (`slang-emit-glsl.cpp:1416-1423`) emits `case -9223372036854775808L:`; the
  `-vk -emit-spirv-via-glsl` lane fails in glslang. `-vk`, `-cuda`, `-cpu` pass.
- Dedup: none (searched `9223372036854775808`, INT64_MIN, intptr literal, glslang case error). Side note, already known:
  runtime `intptr_t` local crashes direct SPIR-V emit = open #13200 / draft PR #13202.
- #14382: labels `GLSL`, `reproduced`, Type=Bug; no assignee at 10:36Z; body says "Related: #14155, #14168", no `Fixes`.
  Nothing was posted on #14155 or #14168; the held draft is superseded. No fixer chain (a new chain is an operator call).
- The #14382 `issue_opened` webhook reached Main at ~10:37Z; I sent no dispatch (this chain owns it).

**Resume on:** a human comment on #14382, or an operator request for a bot fix (slang-fixer on
`gh-issue-shader-slang/slang-14382`; the triage is the #14382 body plus the triager's `issues/14382.md`). Otherwise closed.
