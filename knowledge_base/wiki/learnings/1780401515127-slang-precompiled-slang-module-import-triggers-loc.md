---
title: "Slang: precompiled .slang-module import triggers location-less diagnostics; verify commit-vs-tag ancestry before attributing a regression"
type: learning
topic: slang-compiler
source: learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md
---

# Slang: precompiled .slang-module import triggers location-less diagnostics; verify commit-vs-tag ancestry before attributing a regression

## Two reusable findings from triaging shader-slang/slang#11395 (IR-pass warnings with no file:line)

### 1. The trigger for "diagnostic has no source location" is often a PRECOMPILED BINARY MODULE
When an IR-pass diagnostic (param-group leak E31106/E31107, field-not-default-init E41021, even notes like E40011) reads an IR struct/field key's `sourceLoc`, that loc is **empty for structs deserialized from a precompiled `.slang-module`** — the serialized key's loc doesn't resolve in the consuming compilation, and the rich-diagnostics renderer silently omits file:line when loc.line==0.

Minimal repro pattern (single-file cases all show correct locations, so you MUST use a module):
```
# leakmod.slang
module leakmod;
public struct Material { public Texture2D albedo; public SamplerState samp; public float4 tint; }
# build:   slangc leakmod.slang -o leakmod.slang-module
# consumer.slang
import leakmod;
ConstantBuffer<Material> cb;
float4 main(float2 uv:TEXCOORD):SV_Target { return cb.albedo.Sample(cb.samp,uv)*cb.tint; }
# slangc consumer.slang -target hlsl -entry main -stage fragment  -> E31107 prints with NO --> location
```
Put the `ConstantBuffer` global inside the module too and E31106 also loses its location (all uses become module-internal/synthesized, so `findFirstUseLoc` finds nothing resolvable). Lesson: when a reporter "can't make a small repro" for a location-less diagnostic, try a precompiled-module import — it's the structural trigger that simple shaders miss. Regression-test such fixes as multi-file MODULE tests, not single-file.

### 2. ALWAYS verify commit-vs-release-tag ancestry before blaming a commit for a regression
I initially attributed #11395's E41021 bulk-firing to #11327 (default-ctor synthesis, dated May 29). But the reporter's release was v2026.10, **tagged May 28** — so #11327 post-dates the tag and is NOT in their build. `git log -1 --format=%ci <tag>` for the date, and `git merge-base --is-ancestor <commit> <tag>` to test inclusion. Doing this revealed all three diagnostics' current emitting forms were *introduced* after the user's good version (v2026.5.2, Mar 30) — #10679 (Apr 2) for E41021-emit, #10158 (Apr 24) for E31106/E31107 — so it's "new diagnostics with a loc-resolution gap," not "existing diagnostics lost their plumbing." A commit's author-date being inside a [good,bad] window does NOT mean it's in the bad release; check ancestry against the actual tag. (Shallow clones still carry tags, so ancestry checks work.)

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1780401515127-slang-precompiled-slang-module-import-triggers-loc.md`_
