---
title: "Replicating a compiler's SPIR-V validation needs its OPTIONS, not just the in-tree binary (bare spirv-val false-positives on scalar block layout)"
type: learning
topic: slang-compiler
source: learnings/1786027276307-replicating-a-compiler-s-spir-v-validation-needs-i.md
---

# Replicating a compiler's SPIR-V validation needs its OPTIONS, not just the in-tree binary (bare spirv-val false-positives on scalar block layout)

## The trap

Building `spirv-val` from Slang's in-tree `external/spirv-tools` to avoid version skew is
necessary but **not sufficient**. Slang validates with a specific configuration, and a bare
`spirv-val` uses neither part of it:

```cpp
// source/slang-glslang/slang-glslang.cpp:174-178  (glslang_validateSPIRV)
spv_target_env target_env = SPV_ENV_VULKAN_1_4;
spvtools::ValidatorOptions options;
options.SetScalarBlockLayout(true);
options.SetFriendlyNames(true);
```

`SetScalarBlockLayout(true)` is load-bearing: it permits array strides that the *standard*
storage-buffer layout rules reject. Measured on the artifact from
`tests/optimization/arrray-storage-lowering.slang`:

| invocation | result |
|---|---|
| `spirv-val module.spv` | **rc=1** — "member 0 contains an array with stride 12 not satisfying alignment to 16" |
| `spirv-val --target-env vulkan1.4 --scalar-block-layout module.spv` | **rc=0** |

So a bare `spirv-val` reports a **legal** Slang module as invalid. In a survey of shipped
artifacts this is indistinguishable from a genuine finding — same clean `rc=1`, same real file.

## Use this invocation

```bash
VAL=./build/external/spirv-tools/tools/Debug/spirv-val   # build with: --target spirv-val
$VAL --target-env vulkan1.4 --scalar-block-layout module.spv
```

(Re-read the call site before relying on this — the env and options are code, not a constant.)

## The generalisable lesson

**"Use the in-tree binary" ≠ "validate the way the product validates."** Version-matching the
tool and mismatching its *options* changes the verdict just as decisively as version skew. When
replicating any check the product performs, replicate the **configuration**, and get it by reading
the product's call site rather than assuming tool defaults.

## What caught it

Not the shape of the error — it looked exactly like a real finding. It was that the failure
**reproduced at `-O0`**: a defect attributed to post-optimizer behaviour that persists with the
optimizer disabled is attributed wrong. Cheap discriminator, nearly skipped because I had already
"explained" the case another way.

Corollary for instrument checks: proving a validator **rejects garbage** shows it can fail; it does
**not** show it accepts what the product accepts. Check both directions — a known-good artifact
from the product must come back clean under your configuration.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1786027276307-replicating-a-compiler-s-spir-v-validation-needs-i.md`_
