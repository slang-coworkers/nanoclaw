---
okf_version: "0.1"
name: slang-unindexed-triaged-backfill-index
description: "Backfill index for the 18 still-OPEN slang issues that slang-triager triaged but that had ZERO footprint in my store. One row per issue: verdict, component, owner, GitHub footprint, RESUME. Closes the recorded-but-unindexed hop."
metadata:
  node_type: memory
  type: index
  title: Slang triaged-but-unindexed OPEN issues (backfill 2026-08-05)
  originSessionId: webhook-12361-followup
---

# Slang issues triaged by slang-triager with no row in my store — backfilled 2026-08-05

**Why this file exists.** Audit on 08-05 (prompted by the #12343 miss): **424** memos in
`/workspace/extra/ephemeral/prod-groups/slang-triager/memory/`, **81** issue ids with zero footprint
anywhere in my store, **18 of those still OPEN**. The artifacts were written and delivered; my index
row was the broken hop. See [[feedback_delivered_artifact_missing_index_row]] — recorded-but-unindexed
is a *different defect* from never-recorded and needs a pointer, not re-derivation.

⚠️**Source of the verdicts: the triager's memos, read by me. Live GitHub state (`state`, labels,
assignee, comment counts): MINE-verified 08-05 via `gh issue view`.** I did not re-derive any
diagnosis. Detail lives in `triage-<n>.md` in the triager's memory dir — **not visible from my
container's filesystem**; request by issue number if needed.

⭐**Ordering note:** these are backfill pointers, not live chains I'm driving. Each row's RESUME is
"the named human acts" unless stated otherwise. **None has an action of mine pending.**

## Rows

| # | verdict | component | assignee | GitHub footprint | RESUME |
|---|---|---|---|---|---|
| **8957** | bug / high / **P2** — **re-triage VERDICT: NOT resolved**, still repros at `55a994460` (jkwak-work suspected fixed at ToT) | target-emit SPIR-V/GLSL + IR/type-layout | jkwak-work | `Dev Reviewed`+`reproduced`, 11 cmts (1 bot) | jkwak-work acts on the not-resolved finding |
| **10343** | **feature/CI, NOT a bug** / P3 — Falcor2 CI stub; Slang-side surface is **one workflow file**, real cost is internal GPU-runner infra | CI | jkiviluoto-nv | `CI Improvement`, 1 bot cmt | ⭐cross-link #11292 (falcor2 CI already partly live internally) → **close-as-done if satisfied**. ⛔No fixer — no code change |
| **10476** | enhancement / low / **P3** — diagnose source-location *ranges* | Diagnostics (compiler-core + frontend) | expipiplus1 | `Dev Opened`+`Diagnostics low prio`, 3 cmts (2 bot) | maintainer prioritization |
| **10528** | bug / high / **P1** — Vulkan spec **mandates** `Volatile` on subgroup/SM builtins in RT stages; direct SPIR-V emit never emits the sibling `Volatile` | target-emit SPIR-V | szihs | `Dev Reviewed`+`raytracing`+`spirv_vulkan`, 3 cmts, ⚠️**0 bot** | szihs / a fixer. ⚠️Reporter (buggy213) has a **patch: good-shape-with-gaps** — GLSL450-only, missing vk-memory-model + negative tests, needs rebase for the `BuiltinSpvVarKey` ctor change. Precedent: #10916 Flat-decoration on the same path. ⚠️**DATE-STAMPED ASSESSMENT (2026-05-24), NOT re-verified 08-05** — the ctor may have moved again; treat as an assessment with a date, not current fact |
| **10689** | bug (compat/codegen) / high — **blocks slangpy neural-stress CI** | target-emit CUDA / NVRTC | jkiviluoto-nv | `Dev Reviewed`, 1 bot cmt | ⭐**Root cause is a version-guard mismatch, stated as FACT:** `slang-cuda-prelude.h:6633-6634` guards the whole `Slang_CUDA_WMMA` namespace behind CUDA/NVRTC **12.5+**, but `slang-emit-cuda.cpp:1672-1718` emits `Slang_CUDA_WMMA::WmmaFragment<…MatrixC>` **unconditionally** ⇒ under 12.4 the namespace is empty. Guard added by #8868, tests #10390 |
| **10747** | bug / medium / **P1 (confirmed)** — `E30027 'GetTriangleVertexPositions' is not a member of 'HitObject'` | frontend `hlsl.meta.slang` + IR/emit SPIR-V SER | szihs | `Dev Reviewed`+`bug`, 3 cmts (1 bot) | szihs. ⚠️Oldest of the set (`updated_at` **2026-04-15**) |
| **10802** | bug / medium / P2 — struct with indexed `SV_TARGET` used only by a **helper** fn (not an EP param/return) gets **duplicate** WGSL locations | target-emit WGSL | jkwak-work | `Dev Reviewed`+`WebGPU`+`reproduced`, 7 cmts (4 bot) | jkwak-work |
| **11147** | bug / test-intermittency / medium | slang-rhi Vulkan (+ possibly Slang reflection) | jkiviluoto-nv | `Dev Opened`+`Test Intermittency`, 1 bot cmt | ⭐**Producer/consumer asymmetry:** `vk-shader-object-layout.cpp:334` `addBindingRanges` stores ANY unrecognized `BindingType` via a permissive default; `bindAsValue` (`vk-shader-object.cpp:575`) has **no matching default** ⇒ producer accepts what consumer rejects. Repro `tests/compute/parameter-block.slang.2` (vk) |
| **11160** | bug / **regression** — slangc crash, mixed `fwd_diff` + `bwd_diff` | Autodiff / CUDA | saipraveenb25 | `regression`+`Autodiff`+`reproduced`, 5 cmts (3 bot) | saipraveenb25 |
| **11356** | bug / **regression in 2026.10** — `__bwd_diff` of a member method | Autodiff | saipraveenb25 | `regression`+`reproduced`, 3 cmts (2 bot) | saipraveenb25 |
| **11472** | design — formalize **type-equality constraint** semantics | Typesystem + Autodiff | csyonghe, tangent-vector, skiminki-nv | `Typesystem`+`Dev Opened`, 3 cmts (1 bot) | 3-way maintainer design call |
| **11509** | enhancement — wave/subgroup-**aggregated** coverage counter increments | shader-coverage instrumentation | jvepsalainen-nv | `Shader coverage`, 1 cmt, ⚠️**0 bot** | ⛔**NOT a drop-in** despite a clear mechanism — needs a design decision on how the pass references wave intrinsics. ⚠️**7 `*-atomics.slang` FileCheck tests need CHECK updates**; CPU/WGSL stay on the fallback path. Owner has no PR yet |
| **11573** | enhancement — reimplement `-zero-initialize` as an IR pass | IR pass / frontend | kaizhangNV | `Dev Reviewed`+`Dev Opened`, 3 cmts, ⚠️**0 bot** | ✅**DELIBERATE STAND-DOWN, not an omission:** csyonghe authored a complete design RFC on their own roadmap item, no bot mention ⇒ an automated triage adds no observability value. **Do not "fix" this by posting.** |
| **11612** | process — change process for Slang standard modules | process/docs | skiminki-nv | **no labels, 0 cmts** | ✅**DELIBERATE: no GitHub post** — maintainer-authored roadmap follow-up to his own #11488/#11129; the process *content* requires human authorship |
| **11703** | CI improvement — Falcor 1 CI | CI | jkiviluoto-nv | `Dev Opened`, 2 bot cmts | jkiviluoto-nv. Sibling of #10343 |
| **11966** | CI — enable tests on GitLab VM runners | CI | jvepsalainen-nv | `CI`, 1 bot cmt | jvepsalainen-nv |
| 🔴**12355** | bug / medium / **P2** — `GlslangDownstreamCompiler::link` calls a **null `m_link`** though `init` deliberately tolerates that symbol being absent ⇒ **SIGSEGV instead of a diagnostic** | compiler-core downstream-compiler + SPIR-V emit | *(none)* | `reproduced`, 2 bot cmts | ✅**CONFIRMED CRASH — the counterfactual was BUILT; verdict cmt `5187353230` (03:56:55Z) MINE-verified live, 5,070 ch, opens *"confirmed, and reachable — this is a real crash, not hygiene."*** 4 cells, both controls passing: real lib+2 modules ⇒ **0** (964 B linked SPIR-V); **stub+2 ⇒ 139 SIGSEGV**; stub+1 ⇒ 255 graceful diagnostic; real+1 ⇒ 0. Stub = `libslang-glslang-<ver>.so` exporting all 9 probed symbols **except** `glslang_linkSPIRV`, injected via **`-spirv-opt-path`** (⚠️not `LD_LIBRARY_PATH` — RUNPATH `$ORIGIN/../lib` wins). `SA_SIGINFO`: `si_addr=(nil)`, **`RIP=0x0`** ⇒ call through a null **function pointer**, not a data deref. Repro = in-tree `tests/library/precompiled-spirv-generics.slang:9-10` two-step. ⭐Siblings **do** guard (`validate` :361, `disassembleWithResult` :378, `disassemble` :401 → bare `SLANG_FAIL`); `link` :426 doesn't. ⛔**RETRACTED, my error: I indexed "no crashing repro produced" from the ISSUE BODY (line 52) — true at filing 03:28:13Z, superseded 28 min later.** Triaged @ `ff45b15ed` |
| 🔴**12360** | bug / high / **P2** — access violation specializing a generic method on an **associated type returned through dynamic dispatch** | frontend/IR (specialization + collect-global-uniforms) | *(none)* | `dynamic_dispatch`+`reproduced`, 1 bot cmt | ⭐**`SLANG_ASSERT` unset ⇒ first failure is `slang-ir-specialize.cpp(4051): baseGeneric`; `=release-assert-only` ⇒ SIGSEGV `si_addr=0x38`** in `discoverContext`→`IRBlock::getFirstParam` (`slang-ir-typeflow-specialize.cpp:4393`). OP tdavidovicNV; repro file **SHA-256 byte-identical** to OP's. Triaged @ `ff45b15ed` |

## ⛔⭐⭐⭐ AN ISSUE BODY IS A FROZEN PRE-TRIAGE SNAPSHOT — quoting it silently reverts the triage

**My error on #12355, caught by the triager 08-05.** I indexed *"body says no crashing repro produced
— it rests on a code read."* That sentence is really in the body (line 52) and was **true at filing,
03:28:13Z**. The verdict comment `5187353230` landed **03:56:55Z — 28 minutes later** — and confirms a
built counterfactual with a SIGSEGV. Both texts are live on the same issue; **the body is the stale
one, and it is the more cautious of the two, which is exactly why it reads as the safe summary.**

⇒ ⭐⭐⭐**This is the body-≠-body+comments noun rule one level up, with a nastier polarity: a body
written BEFORE triage is frozen, so quoting it doesn't just omit findings — it silently REVERTS every
one the triage added, in the conservative direction.** A hedge inherited from a stale body looks like
diligence.
⇒ ✅**Practical form: when summarizing an issue's confidence level, read the NEWEST bot verdict, not
the body. If they disagree, the verdict wins and the body is simply old.**
⇒ ✅**Cheap tell: `comments` > 0 means the body is not the whole record.** #12355 had `comments=2`, and
I had already fetched that count.
⇒ ✅**Independent settler: the `reproduced` LABEL.** It is applied only when a counterfactual earns it,
so `reproduced` + "unconfirmed code read" is a self-contradicting index row — a check that needs no
comment fetch at all.

## Lessons carried out of the backfill

⭐⭐⭐**Three of the four "0 bot comments" rows were DELIBERATE silences, not the missing-footprint
defect** (#11573 and #11612 explicitly reasoned; #10528 and #11509 have substantive analysis with no
post-decision recorded either way). **A missing GitHub comment is not automatically a gap** — reading
`botcmts=0` as "nobody posted, therefore something failed" would have produced two wrong "fix" actions
against maintainers' own roadmap items. **Check for a recorded disposition before calling silence a
defect.**

⭐⭐**The 63 CLOSED unindexed ids are mostly legitimately un-indexable** (resolved, superseded). The 18
OPEN ones are the population that mattered; **81 was never "81 problems."**

⭐**Two rows are hours old (#12355, #12360) — the hop is failing NOW, not historically**, which is why
the invariant is *index a `send_file` artifact in the same turn you read it.*

Related: [[feedback_delivered_artifact_missing_index_row]] (the defect + the audit method),
[[slang-frontend-docs-chains-index]], [[project_12219_sccp_module_scope_composite_const_fold]]
(the never-recorded contrast case).
