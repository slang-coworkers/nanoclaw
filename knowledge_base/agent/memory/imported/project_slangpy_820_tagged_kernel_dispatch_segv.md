---
name: project_slangpy_820_tagged_kernel_dispatch_segv
description: "slangpy#820 — functional API + an entry-point-tagged kernel SIGSEGVs at PIPELINE CREATION (not dispatch). Root cause is slang-side = slang#12392 (reproduced in bare slangc). ⛔ My '[shader(\"compute\")] specifically' tag-specificity claim is RETRACTED: [CUDAKernel] crashes on Vulkan/hlsl/spirv; cuda-clean is the lone exception. slangpy's own generator.py fix is still wanted. 3 harness traps that fake a clean run; #1089 distinct by backend spread."
metadata:
  node_type: memory
  type: project
  originSessionId: main-slangpy-832-768-844
---

# slangpy#820 — entry-point-tagged kernel SIGSEGV at pipeline creation

**Published across 4 comments — cite the newest:** #768 `5196679064`, `5197116445`, **`5197987080`**
(narrows the trigger); #820 **`5197942798`** (child-issue correction). No issue state mutated; #768 still
`mkeshavaNV` / `slangtorch_parity_polish` / Q1 2026. Owner of #820: **@ccummingsNV** (active). It is a
crash defect reachable from ordinary user code, so worth fixing regardless of the `.dispatch()`
retire-vs-keep ruling (that ruling now gates only `dispatchdata.py`'s deletion).

## Finding

Functional API (`module.func(...)`) on a kernel already tagged as an entry point → **rc=139 SIGSEGV**,
deterministic. The generated source imports the user module **and** emits its own
`[shader("compute")] void compute_main(...)` — a collision. `.dispatch()` with the same kernel is rc=0.
Three-arm design: the untagged control (byte-identical source) passed **before** the crash arm was
admitted, so a crash can't be confounded with a broken harness.

Measured matrix (slangpy 0.43.1, L40S, eager compilation, identical `void`+`out` body, 3/3 per cell):

| arm | cuda | vulkan |
|---|---|---|
| untagged (control) | OK, data correct | OK, data correct |
| `[CUDAKernel]` + `[numthreads]` | OK | **rc=139** |
| `[shader("compute")]` + `[numthreads]` | **rc=139** | **rc=139** |

**Root cause is compiler-side — slang#12392** [[project_12392_entrypoint_calls_entrypoint_constref_segv]]
(that leaf is the authority for the mechanism). Reproduced in bare `slangc`, no GPU/Python: `[CUDAKernel]`
rc=0 on cuda / rc=139 on spirv; `[shader("compute")]` rc=139 on both — mirrors the GPU matrix. The
CUDA-clean cell is explained: on `cuda`, `%k` never gets an `[entryPoint]` decoration, and the consuming
gate (`shouldProcessFunction`, `slang-ir-transform-params-to-constref.cpp:437-444`) fires iff
`IREntryPointDecoration` is present. Open sub-question: which step declines the `[CUDAKernel]`→entry-point
promotion on CUDA (not `removeTorchAndCUDAEntryPoints`, `slang-emit.cpp:1310`).
**Does NOT retire slangpy's fix:** `generator.py:768` should still not emit the collision, gated on
**both** tags.

## ⛔ Retracted claims — do not re-cite

1. **"Fault is at dispatch."** It is at pipeline creation: with `defer_target_compilation: False` the
   traceback is `calldata.py:524` (`_try_build_shader`) → `:318` → `function.py:362`.
   `defer_target_compilation` defaults to `True` (`calldata.py:513-515`), which collapses the traceback
   and lets the log print `Dispatching …` before the deferred compile faults. **A log line is not a
   program counter.**
2. **"Slang only warns E38040."** E38040 was incidental (a param lacking a system-value semantic); with a
   semantic-carrying param the crash is identical and **zero diagnostics** appear. Positive-controlled
   (an injected bad symbol surfaces E30015), so the silence is real. An incidental diagnostic pointing
   attribution the wrong way is worse than none.
3. **"The trigger is `[shader("compute")]` specifically; #820's title is half-true."** Artifact of a
   CUDA-only sample. #820's wide title ("compute shader **or cuda kernel**") was right. Published on two
   issues; corrected. Lesson: a published "untested but likely X" borrows the authority of the measured
   rows beside it — test the caveat or state it with no predicted direction
   [[feedback_a_caveat_that_names_the_confound_does_not_license_the_conclusion]],
   [[feedback_a_correction_on_the_epic_does_not_reach_the_child_issue]].

## Still open

- **D3D12/Metal unmeasured on every arm**, and the triager's L40S box cannot close them (Linux, no
  Metal) — that needs a different machine. I once offered that box's "D3D12/Metal coverage" — wrong;
  an offer of someone else's capability is a capability claim
  [[feedback_published_negative_env_claims_need_rederivation]].
- **One machine, one driver, one GPU.** Replication, not a second case
  [[feedback_publish_a_claim_as_wide_as_your_evidence]].

## ⛔ Harness traps — each fakes a clean rc≠139

1. Bare `spy.Device(type=...)` omits slangpy's shader include path → every arm dies at
   `load_module("slangpy")`; a single-arm probe reads that as "this tag is clean."
2. `defer_target_compilation` is a `Module.load_from_file` **option**, not a call kwarg — as a kwarg it is
   a phantom parameter that fails before codegen.
3. `[CUDAKernel]` rejects a non-void return (E31213), so a return-value body makes arms incomparable —
   use `void` + `out`. ⚠️ This trap did **not** cause the original CUDA rc=0 (that reproduces with the
   trap removed): check whether an anomaly survives the fix before crediting a newly found trap.

Harness: `slangpy-triager`'s container, `/workspace/agent/memory/repro-820-tag-matrix.py` (asserts data
correctness, not exit code). Per-container path — request the file, don't open the path.

## Novelty vs #1089 (checked, holds)

All six #820 cross-refs (#782, #822, #844, #768, #821, #899) checked; repo-wide `segfault`/`SIGSEGV`
search finds #1089 and #1051 (closed) as nearest. #1089 also faults at `create_compute_pipeline`, but in
slang-rhi's Vulkan pipeline cache (`getPipelineCacheKey` → `vkGetPipelineKeyKHR`, gated on
`shader_cache_path`), structurally Vulkan-only. **Durable discriminator = backend spread:** ours
reproduces on CUDA, where a Vulkan pipeline cache can't be implicated — phase-independent, so it survives
relocalization (my first "different phase" ground died when the localization moved; re-run every
distinctness call when localization moves). Cite `vkGetPipelineKeyKHR`, not the function name — D3D12
has a same-named `getPipelineCacheKey`.

⛔ **Cite the submodule pin, not its `main`.** At slangpy's pin `external/slang-rhi` @ `1a97687412`
(1030 lines) the function opens `:152`, called `:391`; slang-rhi `main` (`fcbacea743`, 1084 lines) gives
`:157`/`:445`. Both greps were right — a line-number disagreement between careful readers is usually a
ref disagreement; compare refs (`wc -l` fingerprint, `git ls-tree <super-sha> external/slang-rhi`) before
conceding.

## Verified code anchors

- `generator.py:767-768` — `[shader("compute")]` emission gated on
  `build_info.pipeline_type == PipelineType.compute`.
- `generator.py:937` — `need_trampoline = context.call_mode != CallMode.prim`; never checks whether the
  target is already tagged.
- `calldata.py` has 0 references to `.entry_points`; the only such inspection is
  `dispatchdata.py:84-87` (`calldata.py:518` always builds its own `compute_main`).

Related: [[technique_scrub_a_checklist_issue_per_item_per_path]] (the #768 scrub this came out of).
