---
title: SlangPy bug investigations — autodiff atomics (#222), descriptor/pool exhaustion (#665), CPU-backend regressions, and triage of silently-fixed issues
type: concept
group: slangpy
tags: [slangpy, slang-rhi, autodiff, atomics, d3d12, descriptor-heap, cpu-backend, triage, cross-repo]
source_count: 12
---

## TL;DR

Root-cause investigations that repeatedly cross the slangpy → slang-rhi → slang
boundary. Recurring findings:

- **#222 (AMD-Windows autodiff grads wrong)** is a slang-rhi bug, not Slang-core or an
  AMD driver bug: slang-rhi advertises float-atomic-ADD capability off the BASE
  atomics device bit, so on RDNA2 iGPUs Slang legally emits `OpAtomicFAddEXT` and the
  driver mis-executes. The symptom `[72,0,0,0]` = all gradients computed then
  atomic-added into element 0 (a scatter-address bug), NOT zero gradients — the
  issue title "always 0" only ever matched the D3D12 arm.
- **#665 ("Failed to get binding data")** is 100% upstream slang-rhi, D3D12-only,
  silently swallowed (bare `return;` skips the dispatch → wrong results, not a
  throw). It is a fixed-heap exhaustion under slangpy's zero-backpressure per-dispatch
  submit — NOT an unbounded leak. Static triage got the *mechanism shape* right but
  the *specific resource* wrong: the maintainer's A/B pinned it to the per-command-
  buffer 4 MiB constant-buffer pool (slang-rhi#844), not the descriptor/sampler heap.
- **CPU-backend dispatch regression (#1136/#1137)**: the slang-rhi CPU device is the
  only backend that never populates `DeviceLimits::maxComputeDispatchThreadGroups`
  (stays `{0,0,0}`); PR #995's large-dispatch clamp computes `min(0, ceiling)=0` →
  throw. Durable fix mirrors Metal's `0xFFFFFFFF` sentinel in slang-rhi; slangpy can
  carry a defensive fallback (must cover X, Y, and the generator).
- **Triage discipline for cross-repo meta-issues**: a vendored dep in `external/`
  is not proof it's integrated (verify call sites); a stale architecture-refactor
  issue is a prime silently-fixed orphan (verify closing PRs + the cross-reference
  timeline); and DeepWiki confidently gets "does X inherit/propagate Y" wrong —
  verify against source.

## #222 — AMD-Windows autodiff gradients: a scatter-address bug, root-caused to slang-rhi

The issue title is misleading. slangpy#222 "AD doesn't work, gradients are always 0"
(AMD RX 6600 / Win11) framed the bug as zero gradients, but the decisive numbers say
otherwise: on the docs `polynomial` example the correct grad is `[12,16,20,24]`
(sum=72), and Shannon's AMD iGPU produced **Vulkan `[72,0,0,0]`** and **D3D12
`[0,0,0,0]`**. `[72,0,0,0]` = every gradient computed correctly then all atomic-added
into element 0 — a scatter *address* bug (`12+16+20+24==72` is what proves the
mechanism), NOT zero gradients. The "always 0" framing only ever matched the D3D12 arm.
The real diagnosis lived in a Discord thread never linked back to the issue. Scope: NOT
all AMD — a discrete AMD 9070 XT on Linux got the correct result; scoped to the
AMD-Windows driver. The transferable lesson: a bug's title/label is a claim to verify,
not a finding — compute what a nearby defect would produce and check the actual numbers
[#222 title is wrong — grads collapse into element 0](../learnings/1786461616442-slangpy-222-title-is-wrong-amd-windows-grads-colla.md).

The Vulkan arm is fully root-caused, and it is a **slang-rhi** bug. In
`src/vulkan/vk-device.cpp:822-830` the `SIMPLE_EXTENSION_FEATURE` macro (which gates
its body on the `s.m` device-feature bit) is instantiated with `m =
shaderBufferFloat32Atomics` (BASE float atomics: load/store/exchange) but its body
pushes `Capability::SPV_EXT_shader_atomic_float_add` (the atomic-ADD capability). So
slang-rhi advertises float-atomic-ADD off the WRONG (base) device bit; the specific
`shaderBufferFloat32AtomicAdd` runtime bit is never read anywhere. On a device where
base atomics = true but AtomicAdd = false (RDNA2 iGPU), Slang is told atomic-add is
supported, legally emits `OpAtomicFAddEXT` (unconditional once the profile carries the
atom — no runtime check, no fallback), and the driver silently mis-executes. A
**coarse-feature trap**: `Feature::AtomicFloat` is a single bit set off the base
atomics bit, so a SlangPy-side `hasFeature(Feature::AtomicFloat)` guard would STILL
pass on an add-less device — the fix needs finer granularity in slang-rhi, not a
SlangPy guard. Process lessons: a capability atom in a SPIR-V profile is NOT evidence
the runtime device supports the op (vulkaninfo overrides inference-from-symptom); the
D3D12 arm is separate and root-causing Vulkan does not root-cause it; and the fix is
cross-repo (route the upstream draft through the slang chain, flows back via a pin
bump)
[#222 root cause — slang-rhi advertises float-atomic-ADD off the base bit](../learnings/1786485429694-slangpy-222-root-cause-slang-rhi-advertises-float-.md).

## #665 "Failed to get binding data" — D3D12-only fixed-pool exhaustion, silently swallowed

The RHI error `[ERROR] (rhi) layer: Failed to get binding data` (slangpy#665, D3D12
training loops) is 100% upstream slang-rhi, not SlangPy-native and not the Slang
compiler. It is emitted in `command-buffer.cpp` `writeComputeState`/`writeRenderState`/
`writeRayTracingState` when `getBindingData()` fails, and the handler logs then does a
bare `return;` WITHOUT writing the pipeline command — the dispatch is silently skipped
and execution continues, so you get silently-wrong results, not an exception (worse
than a throw). SlangPy provides zero backpressure: `NativeCallData::exec` creates a
fresh command encoder per dispatch and `submit_command_buffer` never waits, while
descriptor arenas are only reclaimed when the tracking fence retires the submission —
so a tight loop lets in-flight buffers accumulate faster than they retire. Immediate
user workaround: call `device.wait_for_idle()` (or periodic `wait_for_submit(id)`)
inside the loop. Do NOT call it a "leak": reclamation IS fence-driven; prior
measurement shows CUDA/Vulkan analogues are high-water-mark, not unbounded — frame it
as "allocation outpacing fence-based reclamation on a FIXED D3D12 heap"
[#665 descriptor-arena exhaustion silently swallowed](../learnings/1787226423616-slangpy-665-failed-to-get-binding-data-descriptor-.md).

The error is **structurally D3D12-only**, and that matters for repro planning. The log
line lives in a backend-agnostic encoder path, which misleads you into thinking any
backend can hit it, but the failure that reaches it (`getBindingData` →
`BindingDataBuilder::bindAsRoot` returning SLANG_FAILED) is only produced by D3D12's
fixed shader-visible heaps. Vulkan's `DescriptorSetAllocator` grows pools on demand
(never returns SLANG_FAILED up through getBindingData); CUDA has no shader-visible
descriptor heap at all and uses a growable `ArenaAllocator`. Do NOT attempt a
Linux/CUDA/Vulkan repro of this specific error — it cannot fire there. Repro vehicle is
Windows/D3D12 only (`step_05_latent_texture.py`); log `device.report_heaps()` per
iteration
[#665 is structurally D3D12-only](../learnings/1787763717844-slangpy-665-failed-to-get-binding-data-is-structur.md).

Two candidate exhausting resources were fingered before the true one was found, and the
sequence is the lesson. First hypothesis was the descriptor heaps: D3D12 allocates TWO
fixed shader-visible GPU heaps — CBV/SRV/UAV = 1,000,000 but the **sampler heap = only
2,048**, so a texture-heavy kernel (Texture2D+Sampler per dispatch) would exhaust the
sampler heap ~500× sooner than the big one
[#665 sampler heap is the tight bottleneck](../learnings/1787226766619-slangpy-665-d3d12-sampler-heap-is-the-tight-bottle.md).
But the maintainer's runtime A/B (dropping the D3D12 constant-buffer page size 4 MiB →
64 KiB let 10 frames complete vs baseline failing at frame 2) pinned the causal
resource as the **per-command-buffer 4 MiB constant-buffer pool** (tracked upstream as
slang-rhi#844) — NOT the descriptor/sampler heap. Static code-reading got the mechanism
*shape* right (allocation outpacing fence-based reclamation on bounded per-command-
buffer pools, driven by zero-backpressure per-dispatch submit, not an unbounded leak)
but the *specific resource* wrong. The rules: without a runtime repro, state the
mechanism shape confidently but label the specific resource as a hypothesis, not a
confirmed root cause; an A/B page-size experiment is the decisive discriminator between
candidate pools; and re-read the *actual* latest issue comments before posting, because
a sibling `nv-slang-bot` session may have re-asserted the wrong hypothesis as the last
bot word (shared-bot-identity hazard confirmed live)
[#665 static triage got the shape right, resource wrong](../learnings/1788354683528-slangpy-665-static-triage-got-the-mechanism-shape-.md).

## CPU-backend dispatch regression (#1136/#1137/#1138)

Every compute dispatch on `DeviceType.cpu` throws `RuntimeError: Device reports zero
compute dispatch groups in X` at `slangpy.cpp:103` — a hard regression in slangpy
0.43.0 (0.42.0 was fine), GPU backends unaffected. Root cause: in slang-rhi the CPU
device is the **only** backend that never populates
`DeviceLimits::maxComputeDispatchThreadGroups`, and `DeviceLimits` has no default
member initializers, so it stays `{0,0,0}`. slangpy PR #995's large-dispatch clamp then
computes `min(0, huge) == 0` → the `SGL_CHECK(dispatch_groups_x > 0)` throws. The
durable fix mirrors Metal, which already hardcodes `{0xffffffff, 0xffffffff,
0xffffffff}` because it too has no hardware grid bound — when a "software" backend lacks
a real limit, the `0xffffffff` sentinel is the established pattern. A slangpy-only "just
relax the SGL_CHECK" fix is a trap: fixing only the X check moves the throw to the
sibling Y check (also 0), and `generator.py` emits `dispatch_group_x_stride = 0`
(corrupts the group-id flatten) — so a slangpy-side defensive fallback must cover X, Y,
AND the generator, whereas the RHI-side fix covers all three at once
[#1136 CPU backend zero dispatch limit](../learnings/1788474155417-slangpy-cpu-backend-zero-device-dispatch-limit-bre.md).

The fix PR (#1137) surfaced pytest-classification facts worth reusing: `plugin.py`'s
`pytest_runtest_setup` treats a test as a *device* test ONLY if its function has a
`device_type` parameter — without it, the test is classed non-device and SKIPPED under
any `--device-types` selection. So a CPU-specific test MUST be
`@pytest.mark.parametrize("device_type", [DeviceType.cpu])` (and take `device_type`) to
run under scoped selections; `DEFAULT_DEVICE_TYPES` never includes cpu on any platform,
which is why the regression shipped. The slangpy fallback (treat 0 as unbounded:
X→ceiling, Y→UINT32_MAX) is a provable no-op once rhi reports a real limit. Also
observed: slang-rhi disables CPU in its OWN test harness on Linux ("Known issues with
CPU backend on linux") — a harness gate, not a slangpy runtime restriction — and
`test_pass_float_array` SEGFAULTS in CPU array marshalling once the dispatch throw is
removed, a separate pre-existing CPU defect
[#1136/#1137 CPU dispatch zero DeviceLimits + pytest classification](../learnings/1788480806317-slangpy-cpu-dispatch-zero-devicelimits-stale-local.md).

That unmasked segfault (slangpy#1138) is a layer-localization exercise. A SlangPy
functional-API call segfaults on `DeviceType.cpu` but works on every GPU backend
(`float first(float x[3])` called with a Python list). The static playbook: rule out
slangpy_ext marshalling if the write path is reflection-driven and backend-agnostic
(bounds guards *throw*, they don't segfault); rule out slang-rhi CPU binding if the
uniform rides the generic ordinary-data memcpy (scalar arrays aren't special-cased); and
pin to the slang compiler CPU / host-callable target, because what's CPU-unique is the
host-callable compile and the layout the compiler reports for a fixed-size `float[N]`
uniform (a bad reflected offset crashes at write-time or in the compiled kernel). The
cheapest confirmatory experiment is a reflection probe (print `getElementCount()`/
`getElementStride(UNIFORM)`/offset — zero/garbage confirms the CPU-target layout bug).
The signature "GPU-works / CPU-crashes with an opaque-bytes RHI path and a
backend-agnostic slangpy path" strongly implicates a compiler CPU/host-callable target
bug — fix CPU crashes at the legalizer/consumer, not by rejecting the shape upstream
[#1138 localizing a CPU-only segfault to a layer](../learnings/1788481634992-localizing-a-cpu-only-slangpy-segfault-to-a-layer-.md).

## Triage discipline: silently-fixed orphans, unintegrated vendored deps, and DeepWiki

Three triage learnings share a theme — verify against primary source before treating an
issue as open work or crediting a confident claim.

For a design/investigation meta-issue whose surface is the `external/slang-rhi`
submodule, check upstream slang-rhi PR history FIRST — the asks may already be built.
slangpy#805 ("apply allocator improvements across all slang-rhi backends") is largely
solved upstream: D3D12MA is merged and wired, but VMA is vendored (`external/vma/`
exists) yet NOT wired — the Vulkan backend still allocates via raw `vkAllocateMemory()`,
with the heap wiring stuck in a stale OPEN PR. Two takeaways: a vendored dependency in
`external/` is not proof it's integrated (grep the call sites — here `src/vulkan/` for
`vmaCreate`/`VmaAllocator`), and for cross-repo meta-issues the right triage output is
"no SlangPy PR possible; escalate upstream-coordination + priority" — don't route the
fixer to patch `external/slang-rhi` from a SlangPy PR
[#805 allocator meta-issue largely solved upstream](../learnings/1787226230030-allocator-meta-issue-slangpy-805-is-largely-alread.md).

A stale architecture-refactor issue is a prime silently-fixed candidate. slangpy#795
("move tensor types from extension layer into core SGL") is a fixed-not-closed orphan:
the requested nanobind-free `Tensor` + `TensorDesc` already exist on `main` (the doc
comment "This class deliberately contains no language-binding dependency" is verbatim
the issue's goal), landed by three PRs inside the issue's milestone, none of which
referenced the issue → 0 cross-references → orphaned. The method note that mattered:
DeepWiki + subagents all reported "already done" but referenced the NEW names while the
issue used OLD names — the mismatch is itself the tell; re-derive from primary source
(grep 0 old names in `src/`, `git log -S`, `gh api issues/<n>/timeline`) before
publishing, and check checkout shallowness first so `git log -S` dating is reliable
[#795 tensor-move silently-fixed orphan](../learnings/1787226338570-slangpy-795-tensor-move-already-landed-silently-fi.md).

On load-bearing "does X inherit/propagate Y" questions, verify against source — DeepWiki
gets these confidently wrong. For slangpy#886, DeepWiki claimed
`device.create_slang_session()` "inherits the include paths from the Device's default
SlangSession if add_default_include_paths is True." It does NOT: the binding builds the
`SlangSessionDesc` and calls straight through with no device-path copy, and
`add_default_include_paths` only adds `platform::runtime_directory()/"shaders"`, not the
slangpy package dir. `SHADER_PATH` is injected at exactly one place — the Python
`create_device` wrapper — which seeds only the device's *default* session; the clean fix
inherits `device.slang_session.desc.compiler_options.include_paths`
[#886 create_slang_session does not inherit include paths (DeepWiki wrong)](../learnings/1787226621145-slangpy-create-slang-session-does-not-inherit-devi.md).

**Source learnings (12):**

- [slangpy#222 title is wrong — AMD-Windows grads collapse into element 0, not "always 0"](../learnings/1786461616442-slangpy-222-title-is-wrong-amd-windows-grads-colla.md) — `[72,0,0,0]` is a scatter-address bug; verify a title against the actual numbers.
- [slangpy#222 root cause: slang-rhi advertises float-atomic-ADD off the BASE atomics bit](../learnings/1786485429694-slangpy-222-root-cause-slang-rhi-advertises-float-.md) — a capability atom ≠ runtime support; a coarse `Feature::AtomicFloat` guard can't fix it; cross-repo fix.
- [slangpy#665 "Failed to get binding data" = descriptor-arena exhaustion, silently swallowed](../learnings/1787226423616-slangpy-665-failed-to-get-binding-data-descriptor-.md) — bare `return;` skips the dispatch; zero backpressure in `NativeCallData::exec`; not a leak.
- [slangpy#665 D3D12 sampler heap (2048) is the tight bottleneck, not the 1M CBV/SRV/UAV heap](../learnings/1787226766619-slangpy-665-d3d12-sampler-heap-is-the-tight-bottle.md) — an early (later-superseded) hypothesis; log report_heaps() to see which heap saturates.
- [slangpy#665 is structurally D3D12-only — not reproducible on Vulkan/CUDA](../learnings/1787763717844-slangpy-665-failed-to-get-binding-data-is-structur.md) — Vulkan/CUDA allocators grow on demand; do not attempt a non-D3D12 repro.
- [slangpy#665 static triage got the mechanism shape right but the resource wrong](../learnings/1788354683528-slangpy-665-static-triage-got-the-mechanism-shape-.md) — maintainer A/B pinned the 4 MiB constant-buffer pool (slang-rhi#844); label the resource a hypothesis without a repro.
- [Allocator meta-issue slangpy#805 is largely already solved upstream in slang-rhi](../learnings/1787226230030-allocator-meta-issue-slangpy-805-is-largely-alread.md) — a vendored dep in external/ ≠ integrated; verify call sites; escalate cross-repo coordination.
- [slangpy#795 tensor-move already landed (silently-fixed orphan)](../learnings/1787226338570-slangpy-795-tensor-move-already-landed-silently-fi.md) — new-name vs old-name mismatch is the tell; re-derive from primary source before publishing.
- [slangpy create_slang_session does NOT inherit device include paths (DeepWiki wrong)](../learnings/1787226621145-slangpy-create-slang-session-does-not-inherit-devi.md) — verify inherit/propagate claims against source; SHADER_PATH seeds only the default session.
- [SlangPy CPU backend: zero device dispatch limit breaks all dispatches (#1136)](../learnings/1788474155417-slangpy-cpu-backend-zero-device-dispatch-limit-bre.md) — CPU never sets maxComputeDispatchThreadGroups; mirror Metal's 0xFFFFFFFF sentinel; a slangpy fallback must cover X, Y, generator.
- [SlangPy CPU dispatch: zero DeviceLimits + pytest device classification (#1136/#1137)](../learnings/1788480806317-slangpy-cpu-dispatch-zero-devicelimits-stale-local.md) — a device test needs a `device_type` param to run under scoped selections; CPU excluded from DEFAULT_DEVICE_TYPES.
- [Localizing a CPU-only SlangPy segfault to a layer (#1138)](../learnings/1788481634992-localizing-a-cpu-only-slangpy-segfault-to-a-layer-.md) — GPU-works/CPU-crashes with opaque-bytes RHI + backend-agnostic slangpy ⇒ compiler CPU/host-callable target bug; reflection probe is cheapest.
