---
name: project_12367_functype_kernel_emit_armed_cotrigger
description: "ARMED CO-TRIGGER — slang#12367 (functype reaches 4 kernel emitters as an undefined type) is owned-but-NOT-decided; dispatch slang-fixer ONLY when a maintainer answers the design fork or says 'make a PR'. Spin-off #12372 filed. RESUME on any human comment on either issue."
metadata: 
  node_type: memory
  type: project
  originSessionId: 9f9f7b0e-e9ed-4eb0-8ecf-7cff86871b38
---

# slang#12367 — `functype` reaches kernel emitters as an undefined type name

**Written 2026-08-05 after a container restart revealed this chain had NO durable project row** — it
existed only in 11 *lesson* files as an example, plus the live conversation. The operational state below
is what a restart would otherwise have dropped. ⭐ **A chain that repeatedly closes and re-opens never
gets a `project_` row written, because every closing turn feels terminal.** That is the gap this file
closes.

## ✅ TRIGGER FIRED 2026-08-05 ~23:1xZ — NO LONGER ARMED

`jkwak-work`, cmt **`5198405565`**: *"@nv-slang-bot , let's have a disgnostic error message for the
targets that doesn't have the implementation until we have the implementations. **Make a PR**"*

⇒ **The design fork is ANSWERED: Approach A (diagnose), explicitly framed as an interim measure "until we
have the implementations"** — so the PR must not read as closing the feature question. Authorization is
an explicit `@nv-slang-bot` mention ⇒ GitHub post-back authorized.
**Routed through `slang-triager`** (owns the chain, holds the 380-line memo + repro files, is last
commenter) rather than dispatching `slang-fixer` myself — **both of us were armed, and parallel dispatch
to the same peer mints duplicate sessions.** I explicitly stood down my own dispatch; triager owns it.
⚠️ `slang-fixer` already had an unrelated live session on **#12372** (`sess-1785964795135-xlefpr`) at
dispatch time — different chain, do not conflate.

## HANDOFF COMPLETE 2026-08-05 ~23:13Z — waiting on `[Fix Report]`, DO NOT POLL

`slang-triager` dispatched `slang-fixer` on canonical thread `gh-issue-shader-slang/slang-12367`; memo
`triage-12367.md` (453 lines) delivered as `msg-1785971475238-im8ckf`. Fixer read back all six
constraints correctly. **Workflow Step 10 is explicit: wait, do not poll or re-dispatch.**
⚠️ Dispatch required the `<message>` block channel — the routing gate refuses the MCP call for a missing
`in_reply_to` on a *fresh* dispatch (same gate + workaround as #12302 / #12311).

**What gets checked on the report — re-read the actual DIFF, never the progress summary:**
four silent targets genuinely covered (⛔ Metal's op-name fallback is the trap: a CPP-only fix looks
complete and isn't) · `host-cpp`/PyTorch `[DllImport]` still works · kernel-target `functype` test
coverage exists · PR body carries **both** the interim framing **and** the HLSL/GLSL exclusion as an
explicit note rather than silence.
**Then:** fresh comment on #12367 with the PR link (**last commenter is human `jkwak-work` ⇒ fresh, not
an edit — an edit notifies no one**), and `[Triage Resolution]` upstream.

## ✅ PR #12378 OPEN 2026-08-06 02:23Z — draft, awaiting review

`fix/issue-12367` → master · **draft** · `pr: non-breaking` · `Fixes #12367` · **+419/−0, 10 files** ·
`mergeable=true` · `jkwak-work` requested reviewer **and** assignee · 0 reviews · CI red is a bot-CI
priority yield, so **nothing is validated yet**. Public trail on the issue: cmt `5199718759`.

**Approach: E55216 in `checkUnsupportedInst`** — not the CPP emitter. **I verified the two claims most
expensive to get wrong:**
- ✅ **Diagnostic code.** Highest at master is **55214**, so `55215` reads free *there* — but it is
  **claimed by UNLANDED PR #12249** (`slang-diagnostics.lua:5579`). #12378 correctly took **55216**
  (`:5562`). ⭐⭐⭐ **"Free at master" and "free" are DIFFERENT POPULATIONS** — a correct `git grep` on
  `origin/master` answering a subtly different question than the one that mattered. Two PRs would have
  merged the same code, colliding only *after* both landed.
- ✅ **Target scope.** `isTargetWithoutFuncTypeSupport` (`slang-ir-check-unsupported-inst.cpp:135-150`)
  = CPPSource/CPPHeader/CUDASource/CUDAHeader/PTX/ShaderSharedLibrary/ShaderHostCallable + Metal + WGPU.
  **`HostCPPSource` is ABSENT ⇒ `[DllImport]` keeps working** — the one regression risk, clear.

⚖️ **Deliberately excluded and flagged, not folded in:** `hlsl`/`glsl` (they fail *loudly* with
`E99999` — an internal error on valid input, arguably also E55216, but a larger blast radius and
outside the authorization). ⚠️ **Known limitation stated in the PR:** `checkUnsupportedInst` is skipped
under `-minimum-slang-optimization` (`slang-emit.cpp:2737`), so this closes the hole at **default
optimization levels only** — pre-existing, affects the two sibling checks too.

## RESUME TRIGGER (now)

**A review/merge on PR #12378**, or any new human comment on #12367 / #12372. Also resume if asked
"what's armed" / "what's in flight". ⛔ **Do NOT re-dispatch or nudge on silence** — the PR is a draft
awaiting a human reviewer; absence of movement is the expected state, not a stall.
**Triager's queued follow-ups (tasks #4/#5), NOT mine to do:** on merge → re-read the *merged diff* →
refresh the issue comment → `[Triage Resolution]`; then file 2 spin-offs (`[DllImport]`+`hpp` SIGSEGV;
the `-minimum-slang-optimization` gate design question).

## State (verified live 2026-08-05 ~21:00Z)

| | #12367 | #12372 |
|---|---|---|
| state | open, Type=Bug | open, Type=Bug |
| labels | `cuda`, `bug`, `reproduced`, `Office-Yong` | `reproduced` |
| assignee | `jkwak-work` — **routed by `jhelferty-nv`** @18:23:05Z, NOT self-assigned | unassigned |
| milestone | Q3 2026 (Summer) — set by `jhelferty-nv` @18:23:33Z | none |
| comments | 4 (newest is ours, `5197180868` @20:49:58Z) | 0 |

⛔ **OWNED ≠ DECIDED.** A human holds it, but the design fork has **no answer**. jkwak's words are future
tense — *"I **will** discuss with @csyonghe about **how to** schedule this"* — and the milestone
**predates his comment by 2h08m**, so it is not the product of his decision either. **Do not stand the
trigger down on the strength of the milestone.**

## THE ARMED CO-TRIGGER — exact dispatch conditions

**Fire only when** jkwak-work or csyonghe (a) answers the (a)/(b) split, or (b) says "make a PR".
**Then:** dispatch `slang-fixer` on thread `gh-issue-shader-slang/slang-12367` with:

- **Approach A only** — diagnose at emit time, preferably in `slang-ir-check-unsupported-inst.cpp`
  (already target-aware, already runs at the right point). NOT the CUDA-prelude alias (Approach B: a
  language-surface commitment that does nothing for Metal/WGSL).
- **Diagnostic must cover the FOUR silent targets:** `cuda`, `cpp` (kernel), `metal`, `wgsl`.
- ⛔ **`slang-emit-cpp.cpp:1207` covers neither Metal nor WGSL** — Metal has a *different producer* (no
  `kIROp_FuncType` case in `slang-emit-metal.cpp` at all; it falls into
  `MetalSourceEmitter::emitSimpleTypeImpl`'s op-name fallback, and the op's name is `Func`).
- **HLSL/GLSL fail BEFORE emit** (`E99999`, exit 255) — a separate, lesser fix (they misreport user input
  as an internal compiler error). **HLSL is NOT in the `:1207` list.**
- **Add kernel-target `functype` test coverage** — zero of the 11 existing `functype`/lambda tests target
  a kernel text target, which is why this survived since 2022.

**Item (b)** — that `slangc` exits 0 writing unbuildable output regardless of feature status — was raised
**once** in `5197180868` and **is not to be nagged**. If they schedule only the feature and say nothing
about (b), re-raise at most once more.

## The verdict (survived 5 rounds of instrument correction unchanged)

**REACHABLE**, reproduced end-to-end at HEAD `7175a561b` (re-confirmed at `b0e43d657`). `slangc -target
cuda` → **exit 0, no diagnostic** → emitted `Slang_FuncType<int, int>  gFn_0;` → `nvcc` *"Slang_FuncType
is not a template"*. Reachable because `specializeHigherOrderParameters` (`slang-emit.cpp:1429`, gated
only on `requiredLoweringPassSet.higherOrderFunc` at `:541-543`, so target-independent) is
**best-effort**: `slang-ir-specialize-function-call.cpp:267-268` returns `canSpecializeCall == false` on
an unsuitable arg and the call is **silently skipped, not diagnosed**. No downstream guard —
`checkUnsupportedInst`'s two `IRFuncType` mentions are both `String` checks. **Not a regression:** emit
case + host-only prelude definition landed in the same commit `65c2e7f1c` (`[DllImport]`, #2181,
2022-04-12).

**The 4/2 table is the CORRECT one.** A mid-chain "correction" to 5/1 was **wrong** and was publicly
retracted — it measured a runtime-ternary variant the issue never publishes. See
[[feedback_a_correction_must_re_measure_the_published_input]]. **#12372** = spirv-opt asserts at default
`-O` on a functype value (`ir_context.cpp:1106`), `-O0` clean — a *separate* defect, downstream of a
working emit.
