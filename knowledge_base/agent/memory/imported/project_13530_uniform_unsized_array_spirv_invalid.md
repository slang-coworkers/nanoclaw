---
type: project
name: project_13530_uniform_unsized_array_spirv_invalid
description: "slang#13530 (JackOfBlades232, external, 10-08): a global/entry-point `uniform float4[]` compiles without any diagnostic into an invalid implicit uniform buffer (SPIR-V VUID-04680 whole-RTA OpLoad, both members at Offset 0; DXC/glslang reject the output). Triaged 20:20Z (cmt 6068316405, bug/medium/P2, front end). Orchestrator GO 10-08 for a draft PR on Approach A (extend E31215 to implicit GlobalParams/EntryPointParams). Sibling of #13529. Side finding filed as #13533 (CUDA reflection offsets). Draft PR #13538 opened 10-09 00:56Z (pr: breaking change provisional), held on two maintainer questions; re-chase task rechase-13530-pr13538 on 10-12."
metadata:
  node_type: memory
  type: project
---

# slang#13530: unsized uniform array packed into the implicit uniform buffer

**Issue.** `uniform var input: float4[]; uniform var addend: float4;` compiles on every target with no
diagnostic. The SPIR-V `GlobalParams` struct holds an RTA, and both members are at Offset 0. The body does
a whole-array `OpLoad`. The reporter asks for an error, or for VK_EXT_shader_uniform_buffer_unsized_array
support when the array is the last member. Not a regression: 2025.1 ICE, 2025.17 silent, 2025.24.2+ fails
validation. Live state at 10-08 20:2xZ: unassigned, no milestone, only the bot's triage comment.

**Root cause (triager, at master f6238cee3).** E31215 "unsized type in constant buffer"
(check-decl.cpp:3805-3824) is gated on `getConstantBufferElementType` (conformance.cpp:635). That function
matches only an explicit ConstantBuffer or ParameterBlock, so the buffer the compiler synthesizes for loose
global and entry-point uniforms never gets the check. Umbrella issue: #2187 (related, not a dup).

**Decision 10-08: GO for a draft PR on A.** Basis is the #13461/#13480/#13529 precedent: the issue is
unassigned, no maintainer owns it, and the PR stays a draft. A matches the explicit-cbuffer behaviour and
DXC. Resource arrays stay exempt (Opaque tag plus `isUniformParameterType`). Update the two tests that use
a lone unsized global (gh-6698, 11317-countof). The PR body carries these maintainer questions: break scope
(error on every target vs GPU-only, because CPU/CUDA `Array<T>` uniforms compile today) and the
breaking/non-breaking label. B (VK_EXT support) is a separate feature and is not built here.
Routed through slang-triager, which holds the fixer briefing (ANCHOR H).

**10-08 21:20Z scope narrowed (triager decided, Orchestrator accepted).** The fixer found that the prototype exemption
(`isUniformParameterType || Opaque`) misses `uniform R rs[]` (R = {Texture2D, float4}) and `uniform float4* ps[]`.
Orchestrator re-reproduced both at Release 1785829848: VUID-04680 / E99999. Option 3: an element is exempt only if it holds
no ordinary data (handles, `__DynamicResource`, `SubpassInput`, RTAS, or structs/arrays made only of those). Pointers count
as ordinary data. The entry-point check applies to array-typed params only, so E30072 still owns non-array `uniform S s`
and nothing is reported twice. The "all targets vs GPU-only" maintainer question now covers pointer arrays too.

**10-09 00:56Z draft PR [#13538](https://github.com/shader-slang/slang/pull/13538).** Checked live 00:57Z: draft, head
`93052fb280`, branch `fix/issue-13530`, 2 nv-slang-bot commits with no Claude trailer, 17 files +491/−9, `Fixes #13530` plus
"Related to #13533", label `pr: breaking change` (provisional). The triager edited issue comment 6068316405 in place (4845 chars,
still the only comment). New helper `isTypeKnownToHoldOrdinaryData`; 10 diagnostics tests; gh-6698 and 11317 updated. Fixer
suite 7738/7739 (gfx-smoke fails in the container only). CI is skipped behind the draft gate. Next: slang-reviewer peer review →
fixer [Fix Report] → triager [Triage Resolution]. Held on the two maintainer questions (all targets vs GPU-only; label).
Re-chase task `rechase-13530-pr13538` fires 2026-10-12T01:00Z.

**Side findings.** (1) **FILED as [#13533](https://github.com/shader-slang/slang/issues/13533)** 10-08 ~20:4xZ
(verified live: nv-slang-bot author, 4437 chars, labels cuda/reflection/reproduced, no @). It has two causes: the
CUDA-only #8380 unsized-last reorder never reaches reflection, and type-layout.cpp:808
`(CUDAPtr) + sizeof(CUDACount)` parses as a cast of unary `+sizeof`, so it gives 8 instead of 16. Orchestrator
confirmed that line at origin/master. The typo dates from #1881 (2021). This chain owns it; no fixer. Resume gate `i13533-maintainer-gate-12a3` (12 h, STALE 10-13T20:44Z). (2)
`isTypePreferrableToDeferLoad` treats kIndeterminateSize as a tiny size. A makes that unreachable on this
path, so it is noted in the PR process report and not filed.

Sessions 10-08: Main `sess-1791486246245-21zbvm`, triager `sess-1791486330784-72kx65`, fixer
`sess-1791490925619-01ybhu` (on the triager edge). Thread `gh-issue-shader-slang/slang-13530`.
