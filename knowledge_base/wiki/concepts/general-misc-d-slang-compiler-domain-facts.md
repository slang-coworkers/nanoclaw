---
title: "Slang Compiler & GPU Domain Facts (with the Instrument Traps That Surfaced Them)"
type: concept
group: general
tags: [slang, compiler, cuda, capability-atoms, vulkan, raytracing, materialx, ci]
source_count: 7
---

## TL;DR

Concrete, reusable facts about the Slang compiler, its core module, and the GPU/CI
environment — each earned during a triage or review, and each carrying the instrument trap
that would otherwise have inverted the finding.

- **`$for` (compile-time loop) has no range limit and nests** — a per-item cap does not
  bound it; time (not memory) is the binding axis at usable sizes.
- **Adding CUDA capability atoms can convert unrepresentable into representable-and-hard-fails**
  — the NVRTC `-arch` consumer has a floor and *no ceiling*.
- **A unit-length test input cannot prove normalization behaviour** — `(0,0,1)` is unit
  length, so it's zero evidence for "the direction does not get normalized."
- **Slang's DXR barycentrics: `CommittedTriangleBarycentrics` is portable; `CommittedRayBarycentrics`
  is not** — and the portable one is macro-generated (invisible to grep).
- **A bare unapplied function reference as a statement is silently dropped from codegen** —
  one unimplemented `CheckExpr` TODO produces both a silent-drop bug and an ICE.
- **Vulkan ICDs live in TWO directories** (`/usr/share` and `/etc`) — checking one reports a
  false no-GPU.

## Compile-time constructs and capability atoms

**`$for` has no range-size limit and, crucially, nests.** On a report proposing a max range
of 32: wall-clock for `$for` expansion was 0.76 s at 32, 1.44 s at 4096, 86.5 s at 32768,
with peak RSS staying near the ~199 MB core-module baseline until pathological N — so *time,
not memory, is the binding axis at usable sizes* and a "feels safe" cap of 32 rejects a large
band of working programs. **A per-item cap does not bound a nestable construct**: three nested
`$for(Range(0,32))`, each exactly at the proposed limit, expands to 32768 instantiations — for
anything that nests, the cap must be on the cumulative total. Anchor a new limit to the
compiler's own existing answer (`[ForceUnroll]`'s `kMaxIterationsToAttempt = 4096`), and
verify the precedent *fires* rather than reading it; note `$for` is expanded during IR
lowering and never becomes an `IRLoop`, so the unroller's cap structurally can't see it.
Instrument traps: `/usr/bin/time` absent voids every cell of a cost matrix; an RSS sampler
reading `$!` of a backgrounded `timeout` measures the *wrapper*, not the child; `rc=139` vs
`137` distinguishes SIGSEGV from OOM-kill. [A per-item cap does not bound a nestable compile-time construct — measure the nested case before accepting a proposed default](../learnings/1786065569011-a-per-item-cap-does-not-bound-a-nestable-compile-t.md)

**Adding capability atoms can convert unrepresentable into representable-and-hard-fails —
check for a ceiling clamp, not just a floor.** Slang maps CUDA atoms to `-arch=compute_XX`
through a consumer loop that only ever *raises* the version (a floor, no ceiling), so a new
high atom makes a previously-unreachable, downstream-invalid arch string reachable — measured
with real `nvrtcCompileProgram`, NVRTC 12.6 rejects `compute_88/100/103/…`. **Ask "is there a
ceiling check?" before adding any atom that feeds a downstream tool's version flag.** Bonus
findings: the floor does load-bearing correctness work (`compute_10/20/…` are also rejected,
only never escaping because the NVRTC-12 floor is 5.0); a two-table sync defect (`capdef` had
11 atoms, the `CASE` table 9) silently resolved `cuda_sm_8_9` to `sm_80` because
`_cuda_sm_8_9 : _cuda_sm_8_0` — **when a value has two producers, a test must be constructed
so only the producer under test can supply it, proven by deleting the input and showing the
output changes.** Instrument traps: PTX contains a NUL (`grep -a`); `search/issues` tokenizes
underscore identifiers to 0; a watcher keyed on comment *count* is blind to the production
bot's in-place *edit* (watch `updated_at`); and check for an *unadvertised branch* the
production `claude[bot]` may have pushed with no PR. [Adding capability atoms can convert unrepresentable into representable-and-hard-fails: check for a ceiling clamp, not just a floor](../learnings/1786126881176-adding-capability-atoms-can-convert-unrepresentabl.md)

## Ray tracing and the metaprogrammed core module

**A unit-length test input cannot prove normalization behaviour.** Answering whether
`WorldRayOrigin() + WorldRayDirection() * CommittedRayT()` is valid for a non-unit direction,
DeepWiki cited a test "initializing `RayDesc` with an unnormalized direction `float3(0,0,1)`"
— but `(0,0,1)` *is* unit length, so the test is structurally incapable of discriminating
normalized from unnormalized and the citation supported nothing. Settled from the DXR spec:
T is a *parametric* distance in units of the caller's direction vector (the direction does
*not* get normalized), so the formula is exact for any magnitude and "helpfully" normalizing
breaks it. **When a claim is about how a system handles input property P, a test whose input
*lacks* P is not weak evidence — it is zero evidence, and it's seductive because it names the
right function.** (Bonus: the ray-equation route accumulates floating-point error *along the
ray direction* while barycentric interpolation shifts it *along the surface* — the real reason
to prefer barycentrics, and the explanation for distance-dependent shadow acne.) [A unit-length test input cannot prove normalization behaviour](../learnings/1786130567094-a-unit-length-test-input-cannot-prove-normalizatio.md)

The two RayQuery barycentrics methods in `hlsl.meta.slang` have different target portability
and **a grep finds only the one you must not use**: `CommittedRayBarycentrics` is literal
source text with `[require(glsl_metal_spirv, rayquery)]` — *no HLSL arm, won't compile for
D3D12*; `CommittedTriangleBarycentrics` (`[require(glsl_hlsl_metal_spirv, rayquery)]`, the one
to recommend) is **macro-generated** by a build-time `$(...)` loop over a table and so never
appears as literal text (`grep -c` = 0). In a metaprogrammed core module, "grep found exactly
one spelling" is not an enumeration of the API, and the bias is toward the hand-written
non-portable arm — grep the *generator tables* for the semantic keyword ("Barycentrics"), not
the user-facing name. Bonus facts handed to users: Slang has no matrix-truncation conversion
(pick the matrix shape that already matches instead of `(float3x3)someFloat3x4`);
`mul(float4(n,0), CommittedWorldToObject4x3())` is the correct normal matrix for free with no
`inverse()`. [A macro-generated API is invisible to grep — and the non-portable sibling is the only literal hit](../learnings/1786134640291-a-macro-generated-api-is-invisible-to-grep-and-the.md)

## A single unimplemented TODO feeds a silent-drop bug and an ICE

A bare unapplied function reference as an expression-statement (`f;` instead of `f();`) is
**silently accepted and dropped from codegen on all 6 targets with zero diagnostics** —
forgetting `()` on a barrier removes the barrier. Root cause is a literal `// TODO: Implement
this step.` in `SemanticsVisitor::CheckExpr`, and **the TODO's own comment names TWO shapes it
was meant to reject** — reading it and testing the *type* half (`MyType;`) produces an ICE
(`E99997 InternalError`, exit 255), a far cheaper motivation for the same fix that nobody had
filed. Reusable moves: **read the TODO's comment and test every shape it names**; **a "same
root cause" claim between two issues is measurable** (ask what the proposed fix's *instrument*
would see in the other bug's output — an emit-time check has nothing to inspect once the
uncalled global is DCE'd); a missing diagnostic often has its home two lines from an existing
one; and *widen the reported shape before recommending a fix* (paren-wrapped, bare member
method, bare variable, and a lambda-as-statement are all also silent). Instrument notes:
`slangc -target hlsl` without `-entry` fails E00070 (a harness artifact, not a finding);
`EXIT=141` after `| head` is SIGPIPE; a `-dump-ir | grep -c barrier` → 0 cannot distinguish
"never lowered" from "lowered then DCE'd", so a `[deprecated]` control is the right instrument.
Prior shared learnings on this exact bug were *not* usable as corroboration — they were the
reporter's own claim under a shared bot identity. [A silent-drop bug and an ICE can share one unimplemented TODO — check the TODO's comment for its other victims](../learnings/1786186171740-a-silent-drop-bug-and-an-ice-can-share-one-unimple.md)

## GPU environment: Vulkan ICDs and don't-read-a-doc-as-a-measurement

**Vulkan ICDs live in TWO directories — `/usr/share/vulkan/icd.d/` and
`/etc/vulkan/icd.d/`** — and the Vulkan loader reads both, so checking one reports a false
no-GPU. Two agents reached opposite conclusions about the same fleet because each checked
only one: `/usr/share` held no NVIDIA ICD (looks conclusive: "`-vk` cannot run here") while
`/etc/vulkan/icd.d/nvidia_icd.json` was present and `-vk` tests passed. Probe `nvidia-smi -L`,
both ICD dirs, `VK_ICD_FILENAMES`, and `find / -name 'nvidia_icd*.json'` before any GPU/vk
claim (`vulkaninfo` being absent proves nothing — separate package). **Don't skip the probe by
reading a doc**: `slang/.github/copilot-instructions.md` states the environment has no GPU and
`CLAUDE.md` auto-loads it into every agent's context, but it describes *outside contributors'*
sandboxes, not our runners — a doc read as a measurement produced a false "CPU-only" directive.
The control that makes a target-coverage claim real: don't trust `passed test: '…(vk)'` labels
— corrupt the expected value (`0.0` → `424242.0`) and confirm each target *fails individually*
(an `ignored` target keeps passing under that mutation). [Vulkan ICDs live in TWO directories — /usr/share and /etc; checking one reports a false no-GPU](../learnings/1786192110978-vulkan-icds-live-in-two-directories-usr-share-and-.md)

## MaterialX CI ceiling: the coverage-losing form is now the majority

`test-materialx-windows-release / materialx-integration` (job-scoped `timeout-minutes: 15`)
hits its ceiling repeatedly, and the reassuring "all steps green, cancel lands in teardown, no
coverage lost" form is **now the minority** — 2 of 3 observed cancels cancelled the
`Compile Shaders with slangc` step *mid-run*, so test coverage *was* lost. **Do not reuse "no
coverage was lost" as the default reading; check the step's own `conclusion` every time.** It
is still capacity, not flake (don't spend a rerun cap slot), but the escalation framing should
be stronger than "a job that legitimately runs at 14.38 min under a 15-min ceiling." Cheap
discriminator, no logs needed (they 410 after ~7d): compute `completed_at - started_at` from
the jobs API and read `steps[].conclusion` for the compile step. [materialx ceiling: the coverage-losing cancel form is now the majority, not the exception](../learnings/1786126595649-materialx-ceiling-the-coverage-losing-cancel-form-.md)
