# -O0 clean is not evidence the emitter is correct: it skips the checker

## The trap

A bug report of the shape *"aborts inside spirv-opt at default optimization; `-O0` compiles
cleanly, so emission is fine and this is an optimizer bug"* is one of the most persuasive wrong
framings available, because the differential is real and reproduces. Measured on
shader-slang/slang#12372 (2026-08-05, master `b0e43d657`).

The `-O0` cell produced an 856-byte `.spv` and exit 0. But
`SLANG_RUN_SPIRV_VALIDATION=1` on that same module **FAILS**:

```
error: line 37: ID '9[%addOne]' has not been defined
```

while the same probe on a control shader without the construct passes. So `-O0` did not
validate the module — it **skipped the optimizer, which was the only thing looking at it.**
"Clean" meant "unexamined".

## The rule

**A passing cell only tells you what that configuration actually checked.** Before concluding
"stage X is correct because it succeeded", ask which validator ran in that cell. An exit code
of 0 from a pipeline whose checker is disabled is not a measurement of correctness — it is the
absence of one, wearing a success code. Same family as: a green CI check whose directives
exclude the failing configuration.

For SPIR-V specifically: `-O0` output is **not** validated by default. Always pair an
`-O0` "it works" claim with `SLANG_RUN_SPIRV_VALIDATION=1`, plus a control shader that MUST
pass so a failure is interpretable.

## How to find the real producer

Read the emitted assembly instead of trusting the exit code
(`-target spirv-asm ... -O0`). Here the invalid instruction was visible directly:

```
%27 = OpLoad %6 %gFn                 ; a loaded function pointer
%28 = OpFunctionCall %int %27 %25    ; call target is NOT an OpFunction
```

Logical SPIR-V has no function-pointer call, so no valid lowering existed in that form. The
assert (`ir_context.cpp:1106`, `ProcessCallTreeFromRoots`, `GetFunction()` returning null) was
spirv-opt **correctly noticing** a malformed call graph. Attributing the bug to the optimizer
would have sent a maintainer to the wrong subsystem entirely.

## The discriminating cell: find the sibling shape that WORKS

The root cause was localized by one variant, not by more reading. `specializeHigherOrderParameters`
is gated on IR content (`kIROp_Param` with `IRFuncType`), **not** on optimization level, so it runs
in both cells. But `isParamSuitableForSpecialization` causes an unsuitable call to be
**silently skipped** rather than diagnosed.

- argument = `static` global → `OpLoad` → **unsuitable** → survives to emit → invalid SPIR-V, abort
- argument = the function named directly → `IRGlobalValueWithCode` → **suitable** → specialized
  away → exit 0, 540 B, **validates**

One token of difference. When a bug has a near-identical sibling that works, the minimal
difference points straight at the guard, and it yields a *mechanism* rather than a location.

## Bonus control worth stealing

To prove a flag isn't simply being ignored, run the flag on the *control* shader: here `-O0` gave
**692 B** vs default's **540 B**. Output got *larger* without the optimizer ⇒ the optimizer
demonstrably runs at default. Without that cell, "default aborts / `-O0` fine" is also consistent
with "the optimizer never runs at all".
