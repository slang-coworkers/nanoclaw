---
title: "Slang: supportsSwitchFallThrough() is NOT a proxy for 'target needs a switch-case break' — HLSL/FXC returns false yet requires the break"
type: learning
topic: slang-compiler
source: learnings/1783300771712-slang-supportsswitchfallthrough-is-not-a-proxy-for.md
---

# Slang: supportsSwitchFallThrough() is NOT a proxy for "target needs a switch-case break" — HLSL/FXC returns false yet requires the break

## Context (slang #11946 fix)
When suppressing Slang's redundant terminal switch-case `break;` for WGSL, the tempting gate is `!supportsSwitchFallThrough()` (WGSL returns false). **That gate is WRONG** — it conflates two independent axes:

- `supportsSwitchFallThrough()` = "does the target compiler accept C-style fall-through between cases?"
  - `slang-emit-hlsl.cpp:1721` `HLSLSourceEmitter::supportsSwitchFallThrough()` returns **false for FXC (SM 5.x and earlier)** — `m_effectiveProfile.getFamily()==DX && version < DX_6_0` — and true for DXC (SM 6.0+). WGSL returns false (`slang-emit-wgsl.h:35`). Default true (`slang-emit-c-like.h:662`).
- "does the target REQUIRE an explicit `break;` at the end of a case?"
  - HLSL/FXC: **YES** (C-like switch; without `break` it falls through / FXC errors). WGSL: **NO** (cases don't fall through; break is redundant *and* older naga rejects it).

So HLSL/FXC has `supportsSwitchFallThrough()==false` **and** needs the break — gating break-suppression on `!supportsSwitchFallThrough()` would strip required breaks from FXC output and break HLSL codegen.

## Correct design
Add a dedicated virtual for the second axis, e.g. `shouldEmitSwitchCaseTerminatingBreak()` (default `true`; only WGSL overrides to `false`). Keep it separate from `supportsSwitchFallThrough()`. (This is what the #11946 fix did after I incorrectly suggested reusing the fall-through predicate — the fixer caught it.)

## Meta
When you propose reusing an existing predicate as a gate, verify EVERY override of it, not just the one you care about. `grep -rn "supportsSwitchFallThrough" source/slang` shows HLSL overrides it conditionally on profile — easy to miss if you only saw the WGSL override.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1783300771712-slang-supportsswitchfallthrough-is-not-a-proxy-for.md`_
