# [approver/challenger-miss] I asserted a crash mechanism without reading the call path — the counterfactual test that catches it

# [approver/challenger-miss] A plausible adjacent defect is not a root cause

**Symptom.** Reviewing slangpy#1090 R2, a new test crashed the pytest worker on
Vulkan. While reading the pinned slang-rhi I found a genuine defect nearby:
`VKBufferHandleRAII()` initializes only `m_api`, and the Vulkan native-handle import
assigns only `m_buffer.m_buffer`, leaving `m_memory` indeterminate — and `mapBuffer`
maps `m_memory`. I wrote that into the decision as *the* root cause. It was wrong.
Two independent reviewers refuted it (codex on the call path; the orchestrator with a
crashpad stack naming a different function).

**Root cause of my error.** I verified the defect existed but never verified it was on
the path the test takes. `to_numpy()` → `Buffer::get_data()` → `read_buffer_data()` →
rhi `readBuffer()`, which creates a **separate staging** `VKBufferHandleRAII`, inits
it properly, and maps *that* — never the imported buffer's `m_memory`. The defect is
real and unfired. The actual abort was an `Undefined` `ResourceState` reaching a
Vulkan barrier as destination (`vk-utils.cpp:419` `SLANG_RHI_ASSERT(src)`), because
`BufferDesc::default_state` defaults to `undefined` and the Vulkan import path skips
`fixupBufferDesc()` — which metal and wgpu do call.

The seductive part: my story was mechanically coherent, cited real line numbers, and
explained a real bug. Coherence is not causation.

**How to catch it — the discriminating question.** Before naming a root cause, ask:
*does my mechanism predict the observed pass/fail pattern across ALL cases, and does
some other mechanism predict it better?* Here the per-device cut was handed to me and
I hadn't used it:

    d3d12 PASSED | cuda PASSED | metal PASSED | _invalid[vulkan] PASSED
    only test_buffer_from_native_handle[DeviceType.vulkan] ABORTS

The `m_memory` story explains none of that — `m_memory` is equally uninitialized on
d3d12, which passes. The `fixupBufferDesc` story explains three of the four (metal
calls it; d3d12 skips it but maps `Undefined → COMMON`; vulkan skips it and asserts),
and the fourth has its own verified reason (cuda never reaches rhi — the new
not-implemented guard raises first). A mechanism that cannot explain why the *passing*
cases pass is not yet a root cause.

Concretely, three cheap steps that would have saved the round:
1. **Read the call path from the failing test line to the crash**, not from the
   suspicious code outward. I reasoned outward from the defect I'd found.
2. **Get a stack if one exists.** Windows emitted a crashpad report; Linux didn't. I
   had only looked at Linux and stopped. One platform's silence is not the absence of
   evidence — check every failing leg for a richer artifact.
3. **Count the legs before theorizing.** I reported 2 failing legs; there were 4. The
   two I missed were the ones carrying the stack.

**Fix.** In the challenger step, when a crash is the evidence: enumerate every
failing *and passing* configuration first, then require the mechanism to account for
the boundary between them. Record adjacent-but-unfired defects in a separate field
(`second_unfired_defect`) so they are still reported without contaminating the causal
claim — the decision I shipped does this deliberately. And when a reviewer refutes a
mechanism, withdraw it visibly (a correction notice in the artifact) rather than
silently overwriting; the withdrawal is itself evidence for the next reader.
