---
name: project_12392_entrypoint_calls_entrypoint_constref_segv
description: "slang#12392 — slangc SIGSEGV, zero diagnostics, when an entry point calls an entry-point-tagged function. FULLY ROOT-CAUSED: gdb $rdi=0x0 ⇒ null decoration (candidate 1; malformed-decoration excluded), guard deleted in Release by SLANG_ASSERT→SLANG_ASSUME. Tag×target asymmetry is compiler-side (bare slangc). Verdict 5207284302 + sibling #12397. RESUME on maintainer ruling only"
metadata: 
  node_type: memory
  type: project
  originSessionId: dc370b43-6b29-4d6b-87b0-231e0389495a
---

# slang#12392 — entry point calling an entry point → release-only null deref

## ✅ CLOSED WITH THE MAINTAINER 2026-08-06 16:14Z — verified live by me, not from the report

| artifact | state (verified) |
|---|---|
| **#12392 verdict** | comment `5207284302`, 11,069 chars, leads with the `:241-250` finding, names #12397 resolvably |
| **#12392 metadata** | `labels=[bug, reproduced]`, **`type=Bug`** (was unset), 3 comments |
| **Sibling FILED as #12397** | *"SPIR-V: `[numthreads]` on a called ordinary function emits an `OpExecutionMode` for a non-entry-point, crashing slangc"* — `bug`+`spirv_vulkan`+`reproduced`, `type=Bug`, open, cross-linked |
| **obsolete text** | `may well share a fix` → **absent** (patched pre-reader; 0 comments) |

## ⛔ RE-OPENED BY MAINTAINER 2026-08-14, AND I DROPPED IT FOR 3 DAYS

**`tangent-vector` (the assignee) posted a direct `@nv-slang-bot` investigation request 08-14 22:39Z
(`5298861595`)** — two questions + an analysis/recommendation ask (see below). I **confirmed it live
twice** (08-12 assignee handoff, 08-14 the ask) and **routed neither**, treating each as
"no-response-requested." **08-17 14:48Z `jhelferty-nv` pinged `"Any update?"` (`5317159354`)** — a human
chasing a task that had zero bot footprint for 3 days. Routed to `slang-triager` on 08-17.
⇒ ⭐⭐⭐ **A direct `@nv-slang-bot` + a substantive ask is a DISPATCH TRIGGER, not a status webhook.**
CLAUDE.md's own rule: *"A substantive human comment re-opens a closed or holding chain."* I read "chain
closed" as license to no-op the exact inbound the rule names. **A maintainer question with a mention is
never terminal-turn silence.**

**The three deliverables `tangent-vector` asked for:**
1. Does AST-to-IR lowering **still** have wrong-by-design logic detecting whether a `FuncDecl` is an
   entry point and lowering it / its params differently (incl. attaching `IREntryPointDecoration` in
   lowering)?
2. Does the back-end have a **rock-solid IR pass** that detects `IRFunc`s with `IREntryPointDecoration`
   *also* used as ordinary functions / otherwise referenced, and **clones/splits** them?
3. Own analysis of the fallout of removing the wrong-by-design lowering logic, and a recommendation:
   **dedicated IR clone/split pass** vs. **dedicated AST-to-IR lowering path for `EntryPoint`s**.

⭐ **Two leads THIS CHAIN already surfaced that bear directly on Q1/Q2:**
- **Q2** — the chain found `fixEntryPointCallsites` (`slang-ir-fix-entrypoint-callsite.cpp`) already
  clones a called entry point and strips its `EntryPoint`/`Layout` decorations, but runs at
  `slang-emit.cpp:2192` **after** the constref pass at `:1059` — i.e. a clone/split pass *exists* but
  the earlier passes see the un-split shape. That is very likely the "I thought we already had code
  doing this" tangent-vector refers to. **Verify whether it is rock-solid or just late/incomplete.**
- **Q1** — closed PR **#9869 (csyonghe), _"Don't rewrite entrypoint `in` to `borrow` during ir
  lowering"_** is exactly about wrong-by-design entry-point handling in lowering. Start there.
- Root-cause already pinned (gdb `$rdi=0x0`, null layout decoration on an **orphaned** entry point) is
  tangent-vector's predicted symptom: an `IRFunc` with `IREntryPointDecoration` but no layout in the
  back-end. His demand: that shape *"should be ruled out earlier… not hand-waved with a cowardly
  early-out null test."*

**RESUME TRIGGER (was: triager verdict — discharged):** the **maintainer's ruling** on (a) the
producer-side fix direction and (b) whether the `SLANG_ASSERT(x); if (!x)` class gets its own issue.
D3D12/Metal remain **unmeasured and labelled as such** — and the available L40S **cannot** cover them
(no D3D12 on Linux, no Metal), so there is no fallback environment queued.

## ✅ THE SURVIVOR CELL IS EXPLAINED — and it CONFIRMS the root cause (16:22Z, verified by me)

I had flagged the `IRCudaKernelDecoration`-exclusion lead as *"the kind of plausible mechanism that
becomes known through repetition."* `slang-triager` still had the builds and **tested it for 2 dump
runs**. Result:

⛔ **The lead was wrong IN KIND, not merely unverified — it is an INCLUSION.** I confirmed at source:
`slang-ir-call-graph.cpp:104-106` visits a func as a call-graph **root** if it has
`IREntryPointDecoration` **or** `IRCudaKernelDecoration`. An inclusion cannot explain a cell being
*skipped*, so it was never a candidate. ⭐⭐ **"Untested" and "not a candidate" are different states, and
only reading distinguishes them** — I had queued it as the former.

✅ **MEASURED** (identical source, `-dump-ir-before translateEntryPointInParamToBorrow`, 3 targets):

| target | `[entryPoint]` on `%k` | `[layout]` | outcome |
|---|---|---|---|
| `cuda` | **ABSENT** | — | rc=0 |
| `hlsl` | `[entryPoint(6,"k","inner")]` | none | assert |
| `spirv` | `[entryPoint(6,"k","inner")]` | none | assert |

**Every other decoration is byte-identical across all three** (`[CudaKernel]`, `[numThreads]`,
`[hlslExport]`, `[keepAlive]`, `[externCpp]`, `[export]`, `[nameHint]`) ⇒ `[entryPoint]` is the only
variable. I verified the consuming gate: `shouldProcessFunction`
(`slang-ir-transform-params-to-constref.cpp:437-444`) returns true **iff**
`findDecoration<IREntryPointDecoration>() != nullptr`. ⇒ no `[entryPoint]` ⇒ never processed ⇒ **no
layout is ever demanded.**

⭐⭐⭐ **So the anomaly that looked like a threat to the root cause turned out to CONFIRM it.** A cell
that resists explanation is not evidence against a diagnosis until someone checks which way it cuts.

⚠️ **Still open, published as measured-but-unexplained (correctly, not guessed):** *which step declines
to promote `[CUDAKernel]` to an entry point on CUDA.* Ruled out by reading:
`removeTorchAndCUDAEntryPoints` (`slang-emit.cpp:1310`) is target-gated in the right direction but only
strips `[keepAlive]`/`[hlslExport]` — **and both survive on `%k` in the crashing cells**, so it is not
the mechanism.

## ✅ CANDIDATE 1 CONFIRMED BY LIVE REGISTER STATE — `gdb`, 2026-08-06 21:50Z (`5209351799`)

`slangpy-fixer` got `gdb` 13.1 installed and settled the issue's own two-candidate question:
**`$rdi = 0x0` at the fault ⇒ `getLayout()` called on a null `this` ⇒
`findDecoration<IRLayoutDecoration>()` returned null.** The *"malformed decoration with
`getOperandCount()==0`"* alternative is **excluded by construction** — it requires a **non-null** `this`.
⇒ **The optimizer-deleted guard is the ENTIRE mechanism, and the guard's stated intent was correct for
this input all along.** What remains is Slang's design call: make the guard survive, or fix whichever
producer fails to attach the decoration.

⭐⭐ **This CONFIRMS `slang-triager`'s verdict rather than correcting it** — I checked: `5207284302`
already named candidate 1 and does **not** claim a Debug build is required (`needs_debug:false`,
`says_candidate1:true`). Two independent routes, same answer; the verdict inferred it from the IR, this
measured it from a register. ⭐ *Note the issue text had said only a Debug build could distinguish the
candidates — false: a **register read on the Release binary** did it, because the discriminator was
`this`, not an assert message.*

✅ **The tag×target asymmetry is COMPILER-SIDE — reproduced in bare `slangc`, no slangpy, no GPU:**

| inner tag | `-target cuda` | `-target spirv` |
|---|---|---|
| `[shader("compute")]` | rc=139 | rc=139 |
| `[CUDAKernel]` | **rc=0** | rc=139 |

Mirrors the SlangPy CUDA/Vulkan matrix exactly. The `[CUDAKernel]`/spirv arm was **checked** to fault at
the same frame with the same null `this`, not assumed. ⇒ Whatever attaches the layout decoration differs
by target; **CUDA+`[CUDAKernel]` is the one combination where it is present — that is the thread to the
producer**, and it is the most useful thing on the issue for whoever fixes it.

⭐⭐ **Sweep applied PROACTIVELY this time** (not after being told): resolving an open question stales
prior *"still unresolved / needs a Debug build / two candidates"* framings exactly as a retraction does.
Four spots patched — #12392 body, the two-candidates paragraph in `5205479202`, and the #820 paragraph
in `5205485825` that argued the upstream fix *might be large because the null source was unknown*
(load-bearing for "fix #820 on our side rather than waiting" — that reasoning no longer holds). Bot
filter and grep pattern **both positive-controlled first** (4 and 1) so a zero couldn't be a false
all-clear.

⚠️ **I verified the patches and initially mis-read two of them.** My greps for the stale phrases
returned **true** on the #12392 body and on `5205479202` — but both are **annotated-for-the-record**,
with a `**[RESOLVED … see 5209351799 …]**` block placed *immediately above* the retained text.
⇒ ⭐⭐⭐ **A stale-phrase grep matches `cited-as-history` exactly as it matches `asserted` — the speech-act
distinction applies to VERIFYING a sweep, not just to running one.** Read the surrounding lines before
calling a hit a defect; I nearly reported a correct artifact as unpatched.

⏱ **Cost note for scheduling:** loading this codebase's **346 MB** DWARF takes minutes per `gdb` run and
blew a 7-min foreground timeout (moved to a file-backed run + wait-on-condition). Budget **~10 min per
`gdb` invocation**. `backtrace_symbols_fd` + `addr2line` stays far faster for *identifying a frame*;
`gdb` earns its cost only for **live state** — a register or variable — which is precisely what settled
this.

**What the verdict established** (master `d7d59f374`, Release build at that SHA): the `SLANG_ASSUME`
mechanism corroborated on an **independent** binary (different version + compile ⇒ second data point);
`entry-point-uniforms.cpp:241-250` as the lead — the tree documents this exact input as expected, with
**no preceding assert**, so that guard survives Release; the issue's own open question answered as
**candidate 1**, with an IR table showing an **orphaned entry point** (`fixEntryPointCallsites` strips
the clone but leaves the original decorated and unreferenced); the antipattern list as **audit
candidates, not crash sites**, with window sensitivity disclosed (25/26/26/28 for 1/2/3/5-line windows);
and the Release non-termination as a mode distinct from the null deref.

⭐ **Three void cells were discarded across this chain, none reached a claim:** a missing `/usr/bin/time`,
a CPU sampler matching its own shell, and `rc=255` across *all* spirv cells from a missing
`slang-glslang`. ⛔ **And one edit-mechanics lesson worth keeping: a rewrapped line silently defeated a
multi-line string replacement, shipping an obsolete sentence; the sibling edit whose anchor carried an
`assert` failed LOUDLY.** ⇒ **assert every edit anchor, and derive verification needles from the
PUBLISHED body, not the draft.**

**Filed 2026-08-06 13:39Z by `nv-slang-bot[bot]`** (our own chain, spun out of
[[project_slangpy_820_tagged_kernel_dispatch_segv]]). Routed to `slang-triager` on canonical thread
`gh-issue-shader-slang/slang-12392`. **RESUME TRIGGER:** the triager's verdict / GitHub 5-bullet.

## What it claims — and what is actually true

`slangc outer.slang -target cuda -entry compute_main -stage compute` → **rc=139, no diagnostic**, on
**cuda / spirv / hlsl**, 3/3 each, no GPU or downstream compiler involved. That much reproduced.

## ✅ MECHANISM SETTLED — `:466` was RIGHT; the guard is deleted by its own assert

⛔ **Three-way tangle, resolved 2026-08-06 15:29Z. Sequence matters:** the issue body's *prose*
mechanism was wrong (it implied a missing/misplaced guard); **the issue self-corrected at 13:46Z**
(comment `5205479202`); `slang-triager` then produced a refutation at **14:55Z — 69 min later, against
the superseded text** — and I nearly relayed it as a maintainer-facing catch. **Nobody re-fetched the
issue between my briefing and the analysis.**

✅ **The settled mechanism, verified by me at source:** the guard **is** present
(`slang-ir-transform-params-to-constref.cpp:463-469` at HEAD — `SLANG_ASSERT(layoutDecoration)`, then
`if (!layoutDecoration) return false;`, then the `:466` deref) but is **deleted from the Release
binary**, because in Release `SLANG_ASSERT(VALUE)` → `SLANG_ASSUME(VALUE)` → on GCC
`do { if (!(X)) __builtin_unreachable(); } while(0)` (I confirmed in `source/core/slang-common.h` @
`v2026.12`). The assert **promises** `layoutDecoration` is non-null, making the guard provably dead.
The issue backs this with **disassembly of the shipped `.so`** (no `test`/`cmp` between
`findDecoration` and `getLayout`) plus a reduced GCC-12 `-O2` repro.
⇒ **`:466` matches the faulting deref. "The guard is present, therefore impossible" is not a
refutation.** Full lesson: [[feedback_a_present_guard_can_be_deleted_by_its_own_preceding_assert]].

⚠️ **`slang-ir-legalize-varying-params.cpp:433-436` is a REAL and WORSE hazard — but it is NOT this
crash's general explanation.** I verified `SLANG_ASSERT(entryPointLayoutDecoration)` at `:433-434` then
`->getLayout()` at `:436` with **no guard even in source**, inside `processEntryPoint` (`:413`). But its
only subclasses are **CUDA (`:1107`) and CPU (`:2400`)**, and `legalizeEntryPointVaryingParamsFor*`
exists only for CPU/CUDA/Metal/WGSL ⇒ **it cannot explain the hlsl or spirv crashes** (2 of the 3
reported targets). The triager's CUDA frames are consistent with it; the general claim is not.

⭐⭐⭐ **The unifying finding — worth more than any `file:line`:** both sites are instances of one
codebase-wide antipattern, `SLANG_ASSERT(x); if (!x) …`, whose defensive branch cannot survive its own
assert in Release. `:433-436` is the worse instance (no source guard at all). **That generalization is
the maintainer-facing deliverable.**

⚠️ **Still open on the issue (author deferred it, correctly):** whether the null is (1)
`findDecoration` returning null for a param genuinely lacking layout, or (2) a non-null but malformed
decoration with `getOperandCount()==0`, so `getOperand(0)` reads past the array — note `getOperand` has
the **same** assert-then-deref hazard at `slang-ir.h:709-712`, and its `.get()` **is** the reported top
frame (`slang-ir.h:116`). **The top frame is consistent with either candidate.** A **Debug** build
distinguishes them in one run: whichever `SLANG_ASSERT` trips names the broken invariant.

## Release has TWO distinct failure modes on this input

Not one. The reporter's "no segfault within 500s on 2026.14.1" was **the second bug**, not a fix:

- **Mode 1 — SIGSEGV** (varying-params, above).
- **Mode 2 — SPIN.** Release at HEAD-equivalent: **900 s to timeout, utime linear 111→4325, RSS flat
  at 194 MB.** Localized *empirically*, not inferred: `-dump-ir-before/-after` shows it **reaches**
  `translateEntryPointInParamToBorrow` and **never reaches the next pass**, on all three targets.
- ⭐⭐ **Instrument defect worth keeping:** the triager's first CPU sampler matched *its own shell's*
  command line and read `utime=0 / RSS=3.6 MB` — a **void cell** that would have read as "not
  spinning". Discarded and re-run. Pair every null with a control proving the probe landed.

⇒ ⭐⭐⭐ **A TIMEOUT WAS NEVER A PASS — here it was a different bug wearing a pass's clothes.**

## ⚠️ ARTIFACT STATE 2026-08-06 15:41Z (re-fetched, not inferred)

**Two corrections posted on #12392, both by `slangpy-fixer`** (not `slang-triager`, whom I had routed
it to — a peer got there first; harmless here, but the assignment did not determine the actor):

- `5205479202` (13:46Z) — withdraws the wrong *mechanism* prose; establishes the `SLANG_ASSUME` story
  with shipped-binary disassembly.
- `5207068960` (15:41Z) — withdraws the `[CUDAKernel]` narrowing; publishes the corrected 2×3 matrix;
  states "3 of 4 tagged cells crash, CUDA+`[CUDAKernel]` is the lone survivor"; keeps CUDA-clean as an
  **open, diagnostically-useful** question; flags D3D12/Metal unmeasured.

✅ **BODY PATCHED 15:45:53Z by `slangpy-fixer`, verified by me at source** (not from its report):
Summary generalized; the discriminator struck inline with the corrected matrix + pointer to
`5207068960` + *"(Verified 2026-08-06.)"*; the superseded "Suspected root cause" heading now carries a
`> **⚠️ Superseded — read 5205479202 instead**` block with the old text kept for the record.
⭐⭐⭐ **The sweep found 2 MORE instances neither I nor `slangpy-triager` listed** — #768
`5197987080` and `5206900197` both still asserted "#820's premise is half-true" (patched 15:47:34/35Z).
**My hand-list was 3 of 5.** ⇒ enumerate by grepping the claim across the issue family, never from the
dispatch's list. Full lesson: [[feedback_a_new_comment_does_not_correct_the_body]].

## ⛔ MY POINT-3 DISCRIMINATOR IS REFUTED — do not re-cite it

I briefed *"the trigger is `[shader("compute")]` specifically, not 'callee is already an entry
point'"*, adding *"~2× the size the evidence supports"* against a broader fix, with the caveat *"that
arm was measured on CUDA only."* **Measured by the triager: `[CUDAKernel]` DOES crash — on hlsl and
spirv** (assert at `constref:463`). It is clean on **cuda only** — the single target the parent chain
had sampled. So the tag-specificity was an artifact of a one-target sample, and **the real trigger is
the broader premise I argued against.** The caveat I attached names the exact confound that kills the
conclusion. Full lesson: [[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]].

## ✅ The likely LAYER answer — a pass-ordering bug, and this is what goes to a maintainer

`fixEntryPointCallsites` (`slang-ir-fix-entrypoint-callsite.cpp`) **already exists** to clone a called
entry point and strip its `EntryPoint`/`Layout` decorations — i.e. this exact input shape is *supposed*
to be handled. But it runs at `slang-emit.cpp:2192`, **after** the constref pass at `:1059`. ⇒ The
earlier passes see the un-fixed shape. That ordering — not a null guard — is the principled fix
direction, and it is the thing to put in front of a maintainer. (Note this also answers `CLAUDE.md`'s
input-shape question the right way: the shape is *invalid* and a producer already exists to eliminate
it, so adding a guard downstream would be the masking fix the methodology forbids.)

## The lead the issue body does NOT cite

⭐⭐ **Closed PR #9869 (csyonghe, 2026-02-04) — *"Don't rewrite entrypoint `in` to `borrow` during ir
lowering"*** — is about this exact rewrite, and its stated motivation is the same class of hazard:
*compiling a function that does **not** carry `[shader()]` via `findAndCheckEntrypoint` can generate
invalid SPIR-V, because lower-to-ir silently changes the parameter-passing convention.* #12392 is the
mirror image (the callee **does** carry the tag). Read #9869 before proposing a layer — it is the
strongest available evidence about which layer owns the invariant, and a maintainer will ask.

## Inherited caveats — do not let these get dropped in a summary

- ✅ **"Not reproducing on 2026.14.1" is NOT a fix claim — CONFIRMED AND UPGRADED.** The reporter saw a
  500s timeout; the triager reproduced a **900s spin** with a linear utime curve and IR-dump
  localization. It is mode 2 above, a second bug. Never summarize it as fixed.
- ⚠️ **One machine, one Linux x86_64, GCC Release.** 3/3 per target is replication, not
  machine-independence (same limit as the parent chain's 6/6 on one L40S). Still true after the
  triager's independent repro — that is a **second** machine for the segv, so this caveat is now
  weaker than it was, but the spin/segv split may itself be environment-dependent.
- ⛔ **Discriminator RETRACTED — see the refutation section above.** `[CUDAKernel]` crashes on
  hlsl/spirv; it is clean on cuda only.
- **Backtrace method:** libc `backtrace_symbols_fd` SIGSEGV handler via `LD_PRELOAD`, symbolized
  against the `.dwarf` sidecar — **no gdb**. Frames are plausible but not debugger-verified.
- **Silence positive-controlled:** an injected undefined symbol on the same path *does* surface
  `error[E30015]`, so the zero-diagnostic finding is a real absence, not a capture gap. The only
  output is an incidental `warning[E38040]` about `k`'s `tid` — which points attribution the wrong
  way (see the parent chain, where that same warning was retracted as incidental).

## Sibling crash — RULED: file separately, and the mechanism is now named

Same trigger shape, **different defect**. Single-file two-entry-point variant, `-target spirv` only,
2026.12 and 2026.14.1. Originally described as a crash in `GlslangDownstreamCompiler::_invoke`; the
triager identified the actual cause: **Slang emits invalid SPIR-V** — a stray
`OpExecutionMode %k LocalSize 32 1 1` for a `%k` that is **not an `OpEntryPoint` operand**.

- Slang's own validator says so: `SLANG_RUN_SPIRV_VALIDATION=1 -O0` →
  `error: line 5: OpExecutionMode Entry Point <id> '15[%k]' is not the Entry Point operand of an
  OpEntryPoint`. SPIRV-Tools then aborts in `def_use_manager.cpp:56` during optimization.
- **`-O0` alone (validation off) → rc=0, 952 B** ⇒ the abort is downstream of the real defect.
- **Control:** untagged callee validates clean.

⭐⭐ **The crash site was the SPIRV-Tools abort; the defect is our own invalid emission.** Ruling:
**file separately** — different site, different mechanism, same trigger shape. ⚠️ Not yet filed as of
the interim report; **if the triager's #12392 verdict scopes to the varying-params/ordering fix, this
needs its own artifact or it has none.**
