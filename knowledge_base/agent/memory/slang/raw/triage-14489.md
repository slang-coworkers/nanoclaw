---
type: triage
---
# Triage: shader-slang/slang#14489 — SV_Depth silently dropped when fragment main has explicit `: SV_Target` result semantic
Date: 2026-11-16 | Category: bug | Severity: high (silent miscompilation, no diagnostic) | Priority: P2 | Component: frontend (parameter binding/layout; manifests in SPIR-V + GLSL emit)

## What's broken
A fragment entry point returning a struct whose fields carry `SV_Target` + `SV_Depth`,
with an explicit function-result semantic `Output main(Input) : SV_Target`, silently
loses its depth output on SPIR-V and GLSL targets: `SV_Depth` becomes an ordinary
varying at Location 1; FragDepth/gl_FragDepth is never emitted. No warning or error.
Removing the `: SV_Target` modifier fixes it. Reproduced on current master.

## Repro (freshly rebuilt slangc, exit 0, no diagnostics on ALL targets)
- Binary: built 2026-11-16 from cdca151fb (= v2026.22-21-gcdca151fb, in sync with
  cached origin/master 2026-11-14). Caveat: `slangc -v` prints configure-time
  `2026.13.1-50-g3649fb982` — stale, not a freshness signal (known pitfall).
- Shaders at /tmp/opencode-14489/repro14489-{bad,good,float4}.slang
- `slangc repro14489-bad.slang -profile sm_5_0 -target spirv|glsl|hlsl -entry main -o ...`
  → exit 0 everywhere; only benign E50011 "SPIR-V version too old".

## Evidence (bad vs good)
- GLSL bad: `layout(location = 1) out float entryPointParam_main_depth_0;` and NO
  `gl_FragDepth` write. GLSL good: `gl_FragDepth = _S1.depth_0;`.
- SPIR-V bad: `OpEntryPoint Fragment %main "main" %entryPointParam_main_color
  %entryPointParam_main_depth %input_UV` + `OpDecorate %entryPointParam_main_depth
  Location 1` — no FragDepth. SPIR-V good: `OpDecorate %gl_FragDepth BuiltIn
  FragDepth` + `OpStore %gl_FragDepth %float_0`. `spirv-val` passes BOTH silently.
- HLSL emit bad: struct KEEPS `float depth_0 : SV_Depth;` but signature becomes
  `Output_0 main(Input_0 input_0) : SV_TARGET` — duplicated/ambiguous semantics in
  the emitted text; DXC behavior unverified (no DXC locally).
- float4-return variant (`float4 main(Input) : SV_Target`): compiles fine everywhere.
- Final-IR layout smoking gun: bad case has `%depth → varLayout(...,
  systemValueSemantic("SV_Target", 1), ...)` — the field's SV_Depth was OVERWRITTEN
  with SV_Target1; good case has `systemValueSemantic("SV_Depth", 0)`. IR key
  decorations still say SV_Depth in both — the loss is in the LAYOUT, and emitters
  bind by layout.

## Root-cause chain (facts, file:line on cdca151fb)
1. slang-parameter-binding.cpp:3571-3576 — entry point result laid out via
   processEntryPointVaryingParameterDecl with decl = the FUNCTION; its
   `: SV_Target` modifier becomes state.optSemanticName (the "outer" semantic).
2. slang-parameter-binding.cpp:2221-2231 — `if (decl && !state.optSemanticName)`
   is false for every result field, so each field's OWN explicit semantic is
   skipped and the outer semantic is applied with sequential indices (policy
   documented at :2193-2201: "outer-most semantic wins", `o.a→OUTPUT0, o.b→OUTPUT1`).
3. depth gets systemValueSemantic("SV_Target", 1) → emitters map it to Location 1;
   no depth output → no FragDepth/gl_FragDepth; no diagnostic anywhere.

## Candidate approaches
### A: Diagnose the clobber (recommended)
- Where: slang-parameter-binding.cpp:2221-2231 (or the validateEntryPoint area,
  slang-check-shader.cpp:1747-1797, per #11855 aggregation pattern; diagnostic
  defined in slang-diagnostics.lua).
- Delta: when an outer semantic would override a field's explicit DIFFERENT
  semantic — especially a system value (SV_Depth/SV_Position/...) — emit an
  error/warning ("result semantic 'SV_Target' overrides field 'depth' semantic 'SV_Depth'").
- Tradeoffs: minimal blast radius; silent miscompile becomes a diagnostic; policy
  stays for the no-field-semantics case. Risk: none for well-formed code.
### B: Field semantics win for entry-point RESULT structs
- Where: slang-parameter-binding.cpp:2221 (scope the precedence flip to function
  result semantics only, not `out` params).
- Delta: bad case compiles correctly (SV_Depth honored); `: SV_Target` becomes
  inert (warn?). Tradeoffs: reverses the documented outer-wins policy for results;
  matches HLSL where struct results bind via member semantics. Risk: behavior change
  for code relying on sequential enumeration over a result struct (rare, and it was
  arguably already broken for system-value fields).
### C: Front-end validation — reject result semantic on struct results with explicit field semantics
- Where: slang-check-shader.cpp validateEntryPoint aggregation (~:1787); mirror
  `err("duplicate-targets", 50, ...)` in slang-diagnostics.lua:303.
- Delta: error at check time; catches the whole class. Tradeoffs: rejects
  previously-accepted (mis-behaving) code — "misuse was never valid" per #6216;
  flag breaking-change-label decision to maintainer, don't set unilaterally.
- Risk: may be stricter than needed (user semantics on fields get clobbered today too).

## Recommended path
A — fastest correct fix, no adjacent-surface regressions; optionally pair with C
for struct results. B alone changes a documented policy — maintainer call.
Accept when: bad.slang produces the diagnostic on all targets; good.slang and the
float4 variant byte-identical to today (good keeps FragDepth); new tests cover the
diagnostic (tests/diagnostics/) and FragDepth presence (fixer to locate neighbor
tests); existing suite passes (tests/bindings, full run).

## Sources
- Local repro + IR dumps (/tmp/opencode-14489/*.ir.txt, -dump-ir), spirv-tools dis/val from build.
- Prior related, NOT duplicates: #11691 (conflict-collapse of directional depth modes,
  slang-emit-spirv.cpp:5957), #11855 (duplicate-depth validation gap,
  collectDepthOutputSemantics slang-check-shader.cpp:650), learning 1782211031715.
- Issue body NOT fetchable during this triage: GitHub API 401 (gateway credential
  failure — reported to operator); title/content per parent's task description.
