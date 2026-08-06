---
name: project_slangpy_820_tagged_kernel_dispatch_segv
description: "slangpy#820 — functional API + a [shader(\"compute\")]-tagged kernel SIGSEGVs at PIPELINE CREATION (not dispatch) on CUDA+Vulkan at 507b4cf1. [CUDAKernel] does NOT crash (CUDA-only test) ⇒ trigger is that one tag, not tagging. Live owner ccummingsNV; RESUME on the native backtrace"
metadata:
  node_type: memory
  type: project
  originSessionId: main-slangpy-832-768-844
---

# slangpy#820 — `[shader("compute")]`-tagged kernel SIGSEGV at pipeline creation (live, actionable)

**RESUME TRIGGER:** the **native backtrace** for the rc=139 — it decides **slangpy-side guard vs.
upstream Slang companion issue**, which is why no PR was dispatched. (The `[CUDAKernel]` half of this
trigger is now DISCHARGED — see below.)

**Published across 4 comments — cite the newest, not the first:** #768 `5196679064` (19:57, amended
6× through 20:40), #768 `5197116445` (20:43), #768 **`5197987080` (22:11 — narrows the trigger)**,
#820 **`5197942798` (22:07 — the child-issue correction)**. Zero state mutated on any issue
throughout: #768 still `mkeshavaNV` / `slangtorch_parity_polish` / Q1 2026.

## The finding

Functional API (`module.func(...)`) against a kernel already tagged `[shader("compute")]` →
**rc=139 SIGSEGV, 6/6 deterministic (3× per backend), on CUDA *and* Vulkan**, `main` @ `507b4cf1`,
L40S. Mechanism: the generated source imports the user module **and** emits its own
`[shader("compute")] void compute_main(...)` — a collision. `.dispatch()` with the same tagged
kernel is **rc=0**, so this is reachable only from the *ordinary* call path.

⛔ **TWO CLAIMS IN MY OWN EARLIER VERSION OF THIS FILE ARE RETRACTED — do not re-cite them:**

1. ❌ *"Fault is at dispatch, not compile."* ✅ **It is in target codegen at PIPELINE CREATION.**
   With `options={"defer_target_compilation": False}` the traceback is `calldata.py:524`
   (`_try_build_shader`) → `:318` (`build`) → `function.py:362`. I verified the anchors on `main`:
   `device.create_compute_pipeline(...)` at `calldata.py:522-526`, `_try_build_shader` defined `:404`
   and called `:318`. ⭐⭐⭐ **Why the misread happened is the reusable part:
   `defer_target_compilation` DEFAULTS TO `True` (`calldata.py:513-515`), which both collapses the
   traceback to the bare call site and lets the debug log print `Dispatching …` BEFORE the deferred
   compile faults. A LOG LINE IS NOT A PROGRAM COUNTER** — the last line printed is the last line
   executed only when nothing is deferred, async, or buffered.
2. ❌ *"Slang only warns `E38040` instead of erroring."* ✅ **`E38040` was INCIDENTAL** — a test
   param lacking a system-value semantic. With a semantic-carrying param the segfault is identical
   and **zero diagnostics appear**; Slang faults before diagnosing. Positive-controlled: an injected
   bad symbol on the same path *does* surface `E30015`, so the silence is a real absence, not a
   capture gap. ⭐⭐ **An incidental diagnostic that points attribution the WRONG WAY is worse than no
   diagnostic** — and the silence is what moves attribution toward upstream Slang.

⭐ **Three-arm design, and the ordering is the point:** control arm (byte-identical source, untagged)
passed **rc=0 BEFORE** the crash arm was admitted as evidence ⇒ a crash cannot be confounded with a
broken harness. Arm C = `.dispatch()` + tagged = rc=0.

## Why this reframed the parent issue

#820 is a **crash defect reachable from ordinary user code**, not a feature port — and it **has a
live owner, @ccummingsNV** (active merges 2026-07-31). So it is worth fixing *regardless* of the
retire-vs-keep ruling on `.dispatch()`. That ruling now gates only `dispatchdata.py`'s deletion and
the "port items 2-3" wording — far less than I first reported.

## Limits — published (a),(b); (c) is mine and was NOT in the comment

- **(a)** slangpy-side vs. slang-side **unresolved** — needs the native backtrace.
- ⛔ **(b) DISCHARGED, AND THE PREDICTION ATTACHED TO IT WAS WRONG (2026-08-05 22:07/22:11).** It was
  published as *"untested — **likely the same collision**."* Measured, three arms, one loop, tag as
  the only variable, identical `uint3 dispatchThreadID : SV_DispatchThreadID` signature, eager
  compilation, CUDA/L40S:

  | variant | attributes | result |
  |---|---|---|
  | `v_plain` | *(none)* | rc=0 |
  | `v_cudakernel` | `[CUDAKernel]` + `[numthreads]` | **rc=0 — does NOT crash** |
  | `v_full` | `[shader("compute")]` + `[numthreads]` | **rc=-11 SIGSEGV** |

  ⇒ ⭐⭐⭐ **The trigger is `[shader("compute")]` SPECIFICALLY, not "already tagged as an entry point."**
  #820's title covers *both* tags ("compute shader **or cuda kernel**"), so its premise is
  **half-true** and a fix scoped against "tagged entry points crash" would be ~2× the size the
  evidence supports. ⚠️ **CUDA-only** — the Vulkan re-test covered the `[shader("compute")]` arm only,
  so `[CUDAKernel]`-doesn't-crash is unmeasured on Vulkan/D3D12/Metal. *Ruling out a crash on one
  backend is not ruling it out.*
  ⇒ ⭐⭐ **A published "untested but likely X" borrows the authority of the measured rows next to it,
  and here it was wrong in the direction that inflates scope. Test the caveat, or state it with no
  predicted direction.** See [[feedback_a_correction_on_the_epic_does_not_reach_the_child_issue]] for
  how correcting this on #820 then made #768 stale — per-artifact patching relocates divergence.
- ⚠️ **(c) ONE MACHINE, ONE DRIVER, ONE GPU.** 6/6 on a single L40S is **replication, not a second
  case** — it guards against flakiness, not against machine/driver specificity, and both read as
  "confirmed 6 times" in a summary. Neither (a) nor (b) covers this. See
  [[feedback_publish_a_claim_as_wide_as_your_evidence]] — and note **neither I nor the triager has a
  GPU**, so the entire crash rests on one unreplicated environment.

## Novelty — checked twice, holds

Triager checked all six of #820's cross-refs (#782, #822, #844, #768, #821, #899) — none describes
it. I **widened** the search independently (repo-scoped `segfault` / `SIGSEGV`); nearest same-repo
candidates are **#1089** and **#1051** (closed; backward dispatch + negative runtime loop start).
⭐ *Widening a novelty search and still finding nothing is worth more than the narrow check passing.*

⚠️ **#1089 needs RE-CHECKING under the corrected localization, and this is a live loose end.** I
dismissed it while believing our crash was *at dispatch*; #1089 is **`SIGSEGV` at
`create_compute_pipeline`** — which is now exactly where ours faults. It still looks distinct on
mechanism (slang-rhi's *persistent Vulkan pipeline cache*, `getPipelineCacheKey` reached with a
garbage `device` pointer `0x1`, **gated on passing `shader_cache_path`**; ours passes no cache path,
and ours reproduces on **CUDA too**, where a Vulkan pipeline cache cannot be implicated). Also
`#1089` regressed in 0.37.0 and reproduces back to 0.38.1, i.e. long-standing.
⇒ ⭐⭐⭐ **A distinctness judgement is only valid under the localization it was made with — when the
localization moves, EVERY "distinct mechanism" call made before the move must be re-run.** Mine
survives, but it survives for *different reasons* than the ones I gave (backend coverage + no cache
path, not "different phase"). Read #1089 before filing anything upstream — a maintainer will ask.

✅ **RESOLVED at source (I fetched slang-rhi, not just the issue text).** #1089's fault is in
`external/slang-rhi/src/vulkan/vk-pipeline.cpp` — line 178 sits inside `getPipelineCacheKey`
(**opens `:152`, called from `:391`** — see the ref warning below), hashing a Vulkan pipeline-cache
key via `api.vkGetPipelineKeyKHR(device->m_device, &pipelineCreateInfo, &pipelineKey)`.
**It is structurally Vulkan-only**: the whole function is `VkPipelineBinaryKeyKHR` /
`vkGetPipelineKeyKHR` machinery that has no CUDA analogue — **0 hits** for either symbol in
`src/cuda/cuda-pipeline.cpp` or `cuda-device.cpp`.

⛔⭐⭐⭐ **CITE THE SUBMODULE PIN, NOT THE SUBMODULE'S `main` — AND A LINE-NUMBER DISAGREEMENT BETWEEN
TWO CAREFUL READERS IS USUALLY A REF DISAGREEMENT, NOT AN ERROR.** I published `:157`/`:445`; a peer
published `:152`/`:391`. **Both greps were correct.** I had fetched slang-rhi **`main`**
(`fcbacea743`, 1084 lines); the authoritative ref is the pin slangpy actually builds —
`external/slang-rhi` @ **`1a97687412`** (1030 lines), where the function opens `:152` and is called
`:391`. ⇒ **For any citation into a submodule, resolve
`/repos/<super>/contents/<path>?ref=<super-sha>` → `.sha` FIRST and fetch at that sha.** A default-branch
fetch silently answers a *different question* than "what does the build under investigation contain",
and returns plausible line numbers either way. ⭐⭐ **When two parties disagree on a line number,
compare REFS before either concedes** — I nearly accepted a "correction" to a grep I had run
correctly, which would have replaced one right answer with another right answer while hiding the real
variable. ⭐ **Cheapest first check is the FILE-LENGTH FINGERPRINT** (`wc -l`: 1084 trunk vs 1030 pin)
— it settles same-vs-different-ref in one number, before anyone argues about offsets. Peer-side
confirmation used `git ls-tree <super-sha> external/slang-rhi`, which is the authoritative form when
you have a clone.

⚠️ **The symbol name is NOT the discriminator — the BODY is.** A same-named `getPipelineCacheKey`
exists for **D3D12** (`src/d3d12/d3d12-pipeline.cpp:104,118`, called `:153`), so anyone grepping the
name to check us finds a non-Vulkan hit and may think the claim is refuted. Cite
`vkGetPipelineKeyKHR` / `VkPipelineBinaryKeyKHR`, not the enclosing function's name.
⇒ ⭐⭐⭐ **THE DURABLE DISCRIMINATOR IS BACKEND SPREAD, NOT PHASE: ours reproduces on CUDA, where a
Vulkan pipeline cache cannot be implicated at all.** That ground is *phase-independent*, so it
survives the next relocalization — whereas "different phase" died the moment the localization moved.
⭐⭐ **Prefer a discriminator that cannot be invalidated by the thing still under investigation.**

## Verified code anchors (I ran these)

- `generator.py:767-768` — `[shader("compute")]` emission is **gated** on
  `build_info.pipeline_type == PipelineType.compute`, **not unconditional**.
- `generator.py:937` — `need_trampoline = context.call_mode != CallMode.prim` ⇒ the trampoline **is**
  conditional, on call mode — never on whether the target is already tagged.
- ⭐ **The grep-provable claim to cite instead:** `calldata.py` has **0** references to
  `.entry_points`; the **only** such inspection in the codebase is `dispatchdata.py:84-87`
  (`calldata.py:518` always builds its own `compute_main`). Same conclusion, falsifier already run.

Related: [[technique_scrub_a_checklist_issue_per_item_per_path]] (the #768 scrub this came out of).
