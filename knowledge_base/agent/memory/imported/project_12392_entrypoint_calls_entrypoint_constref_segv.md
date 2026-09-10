---
name: project_12392_entrypoint_calls_entrypoint_constref_segv
description: "slang#12392 — slangc SIGSEGV, zero diagnostics, when an entry point calls an entry-point-tagged function. FULLY ROOT-CAUSED: gdb $rdi=0x0 ⇒ null layout decoration on an orphaned entry point; the guard is deleted in Release by SLANG_ASSERT→SLANG_ASSUME. Draft PR #12721 (closes #12392/#12397/#12778) CHANGES_REQUESTED; maintainer gates on eliminating EntryPoint reliance in AST-to-IR lowering. RESUME on maintainer in-PR-vs-follow-on ruling / re-review."
metadata:
  node_type: memory
  type: project
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# slang#12392 — entry point calling an entry point → Release-only null deref

## The bug

`slangc outer.slang -target cuda -entry compute_main -stage compute` (an entry point that calls an
entry-point-**tagged** function) → **rc=139, no diagnostic**, on cuda / spirv / hlsl, 3/3 each.
**Compiler-side — reproduced in bare `slangc`, no slangpy, no GPU, no downstream compiler.** Silence
positive-controlled (an injected undefined symbol on the same path *does* surface `error[E30015]`, so the
zero-diagnostic is a real absence, not a capture gap).

## Root cause — FULLY ROOT-CAUSED

- **`gdb` `$rdi = 0x0` at the fault** ⇒ `getLayout()` called on a null `this` ⇒
  `findDecoration<IRLayoutDecoration>()` returned null (**candidate 1**). The *"malformed decoration with
  `getOperandCount()==0`"* alternative is **excluded by construction** — it requires a non-null `this`.
  Settled from a **register read on the Release binary**; the issue text's claim that only a Debug build
  could distinguish the candidates was false (the discriminator was `this`, not an assert message).
- **The guard is present but deleted in Release.** `slang-ir-transform-params-to-constref.cpp:463-469`:
  `SLANG_ASSERT(layoutDecoration)`, then `if (!layoutDecoration) return false;`, then the `:466` deref.
  In Release `SLANG_ASSERT(x)` → `SLANG_ASSUME(x)` → (GCC) `if (!(x)) __builtin_unreachable()`, so the
  assert *promises* non-null and the guard is provably dead code (confirmed against shipped-`.so`
  disassembly: no `test`/`cmp` between `findDecoration` and `getLayout`). → [[feedback_a_present_guard_can_be_deleted_by_its_own_preceding_assert]].
- **Why the layout is null — an orphaned entry point.** `fixEntryPointCallsites`
  (`slang-ir-fix-entrypoint-callsite.cpp`) clones a called entry point and strips
  `kIROp_EntryPointDecoration` **from the CLONE**, leaving the ORIGINAL decorated but unreferenced and
  layout-less. It carries a `TODO(tfoley)` at `:66` calling itself a band-aid, and it runs **late**
  (`slang-emit.cpp:2192`) — **after** the constref pass at `:1059` — so earlier passes see the un-split
  shape. `IREntryPointDecoration` is attached during ordinary module lowering
  (`slang-lower-to-ir.cpp:15274`), the residual wrong-by-design piece.
- **The consuming gate:** `shouldProcessFunction` (`…constref.cpp:437-444`) returns true **iff**
  `findDecoration<IREntryPointDecoration>() != nullptr` — so no `[entryPoint]` ⇒ never processed ⇒ no
  layout ever demanded.

## tag × target asymmetry (compiler-side)

| inner tag | `-target cuda` | `-target spirv` / `hlsl` |
|---|---|---|
| `[shader("compute")]` | rc=139 | rc=139 |
| `[CUDAKernel]` | **rc=0** | rc=139 (assert at `constref:463`) |

Every other decoration is byte-identical across targets; **`[entryPoint]` is the only variable** — on
CUDA+`[CUDAKernel]` it is ABSENT (so constref never processes `%k`, no layout demanded), which is why that
one cell survives. Mirrors the parent SlangPy CUDA/Vulkan matrix exactly. Which step declines to promote
`[CUDAKernel]` to an entry point on CUDA is measured-but-unexplained (ruled out `removeTorchAndCUDAEntryPoints`
by reading — it strips only `[keepAlive]`/`[hlslExport]`, both of which survive on `%k`).

## Two distinct Release failure modes on this input

- **Mode 1 — SIGSEGV** (varying-params, above).
- **Mode 2 — SPIN.** 900s to timeout, utime linear, RSS flat ~194 MB. Localized empirically
  (`-dump-ir-before/-after`): reaches `translateEntryPointInParamToBorrow`, never reaches the next pass,
  all three targets. ⭐⭐⭐ **A timeout was never a pass — here it was a different bug wearing a pass's
  clothes.** The reporter's "no segfault within 500s on 2026.14.1" was mode 2, NOT a fix.

## The unifying, maintainer-facing finding

Both crash sites are instances of one codebase-wide antipattern: **`SLANG_ASSERT(x); if (!x) …`, whose
defensive branch cannot survive its own assert in Release.** `slang-ir-legalize-varying-params.cpp:433-436`
is a worse instance (no source guard at all, `->getLayout()` after the assert) but is CUDA/CPU-gated, so it
does **not** explain the hlsl/spirv crashes. The principled fix is producer-side (never emit an orphaned
decorated entry point), not a downstream null-guard — adding a guard where a producer already exists to
eliminate the shape would be the masking fix the methodology forbids.

## Sibling #12397 — filed separately (RULED distinct)

Same trigger shape, **different defect**: single-file two-entry-point variant, `-target spirv`, emits
**invalid SPIR-V** — a stray `OpExecutionMode %k LocalSize 32 1 1` for a `%k` that is not an `OpEntryPoint`
operand. Slang's own validator flags it (`SLANG_RUN_SPIRV_VALIDATION=1 -O0`); SPIRV-Tools then aborts in
`def_use_manager.cpp:56` downstream. `-O0` with validation off → rc=0, so the abort is downstream of our
emission bug. Different site, different mechanism, same trigger shape.

## Fix direction (maintainer `tangent-vector`, ruled 2026-08-18) & current state

**Direction:** stop attaching `IREntryPointDecoration` during ordinary AST-to-IR lowering; introduce it via
a dedicated lowering of `EntryPoint`. **Primary:** give each `Slang::EntryPoint` its own `RefPtr<IRModule>`
(like other `ComponentType`s) as an additional link input, so the decoration lands iff the entry point was
selected for codegen. **Fallback (pre-authorized if primary intractable):** attach the decoration during
`TargetProgram` IR lowering. Plus one clean split point — `fixEntryPointCallsites` moved as early as
possible (into/after `linkIR`), the non-selected-entry-point strip replaced by assert/enforce-validity, not
a band-aid.

**Current — REVIEW ROUND 1, 2026-08-26 (verified at source):**
- **Draft PR [#12721](https://github.com/shader-slang/slang/pull/12721)** OPEN, `reviewDecision=CHANGES_REQUESTED`, `closingIssuesReferences=[12392, 12397, 12778]` (all auto-close on merge). `report_pr_created` registered (pr-mapping → fixer session on the canonical thread).
- Maintainer **accepts the architectural compromise** (decoration-source fix + disclosed scope trim) but **gates approval on eliminating ALL incorrect `EntryPoint` reliance in AST-to-IR lowering** — the derivative-group path still consults front-end EntryPoints in lowering.
- Fixer filed **#12777** (derivative-group EntryPoint reliance — asks in-PR-vs-follow-on) and **#12778** (null `EntryPoint::getModule()` on deserialized entries). **Fixer HOLDS** on the derivative-group path pending the maintainer's in-PR-vs-follow-on decision.
- ⚠️ **Scope-trim the reviewer MUST know:** the fixer **reverted** the two companion changes the maintainer sketched (move `fixEntryPointCallsites` earlier + the constref release-assert) after codex caught real regressions — pass ordering is now **byte-identical to master**. A revert-to-master is invisible in the diff by definition, so it must survive into the PR body/review; the delivered PR is the *decoration-source* fix alone.

**RESUME** on the maintainer's in-PR-vs-follow-on ruling for #12777, or the fixer's post-decision
`[Fix Report]` / re-review. D3D12/Metal remain unmeasured and labelled as such (no D3D12 on Linux, no Metal
on the available L40S). The primary #12392 verdict is comment `5207284302`.

## Process lessons this chain paid for (each lives in its own concept)

- ⛔⛔⛔ I **fabricated a dispatch in this very file** — wrote "Routed to slang-triager on 08-17" when no session row existed, documenting the drop and its remedy as already-done in one edit without emitting a `<message>`. **The receipt for "I routed X" is a session row on X's edge for that thread, not a sentence.** → [[feedback_a_relay_names_an_inbound_that_must_exist_in_the_thread]].
- **A direct `@nv-slang-bot` mention + a substantive ask is a DISPATCH TRIGGER, not a status webhook** — I read "chain closed" as license to no-op the exact re-opening inbound the rule names, and dropped it for 3 days.
- **Don't restart a "looks stalled" fixer on a heuristic** — a big representational change legitimately takes days and its worktree is local/invisible. Restart trigger requires **BOTH** no branch appears **AND** `last_active` stops advancing; a restart of an active session destroys uncommitted work → [[feedback_group_clone_is_shared_by_all_sibling_sessions]]. But 6 days of silence to a waiting maintainer is a reporting failure regardless of build state — owe a "in progress, here's where" or "blocked on X".
- A 6-day-old stored "~60%" figure must not reach a maintainer as current state → [[feedback_a_stored_claim_re_shipped_as_a_live_finding]].
- Sweep the whole issue family by **grepping the claim**, not the dispatch's hand-list (found 2 more stale instances than listed) → [[feedback_a_new_comment_does_not_correct_the_body]]; a stale-phrase grep matches `cited-as-history` exactly as `asserted`, so read surrounding lines before calling a hit a defect.
- A caveat that names the confound (*"measured on CUDA only"*) does not license the conclusion it undercuts → [[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]].
- Verify a subagent's "already fixed at HEAD" claim with `git merge-base --is-ancestor` (sibling `ddbbe4289`/#12564 was NOT an ancestor).
- Multi-issue-single-PR means multiple fixer sessions commit to one branch under one `nv-slang-bot` identity — a coordination hazard (rebase-and-verify), same shared-identity root as [[feedback_a_shared_bot_identity_makes_authorship_unattributable_from_github]].
- Fixer handoff is the triager's edge to drive, not a Main→fixer direct dispatch → [[feedback_triage_memo_is_not_my_cue_to_dispatch_the_fixer]]. Parent chain: [[project_slangpy_820_tagged_kernel_dispatch_segv]].
- Budget ~10 min per `gdb` run on this codebase (346 MB DWARF); `backtrace_symbols_fd`+`addr2line` is far faster for *identifying a frame* — `gdb` earns its cost only for live state (a register/variable), which is what settled this.
