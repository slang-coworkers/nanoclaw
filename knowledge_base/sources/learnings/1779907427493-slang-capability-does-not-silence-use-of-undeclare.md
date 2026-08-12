# Slang `-capability` does not silence "use of undeclared capability" — it's a per-function contract

# Slang capability system — `-capability` flag ≠ `[require]` declaration

A common Discord question: "I passed `-profile spirv_1_6` *and* `-capability spirv_1_6`, but the compiler still complains about an undeclared capability — only `[require(spirv_1_6)]` on the function makes it go away. Bug?"

**Not a bug.** Slang validates capabilities in two stages, and the command-line flags only affect the second one:

1. **Function self-consistency** — does the function body only use capabilities within the function's *declared* `[require]` set? This stage **does not look at command-line flags**.
2. **Target compatibility** — when emitting code for the chosen target, does the target's available capability set (set by `-profile` / `-capability`) cover the function's required set?

Per [docs/user-guide/05-capabilities.md — Validation of Capability Requirements](https://shader-slang.org/slang/user-guide/capabilities#validation-of-capability-requirements):

> Slang requires all public methods and interface methods to have explicit capability requirements declarations. […] Functions with explicit requirement declarations will be verified by the compiler to ensure that they do not use any capability beyond what is declared.

Inference is allowed only for entities whose contract isn't externally visible:
- `internal` / `private` functions — full inference from body
- Entry points — inferred, error only if inferred-vs-target is incompatible
- `public` functions — must declare explicitly; no inference

Letting `-capability` silently widen a `public` function's `[require]` set would break the contract downstream callers in other modules depend on, which is the design rationale.

**Three fixes when answering this category of question:**

1. Annotate the offending function: `[require(spirv_1_6)] void f() { ... }`
2. Annotate the whole module so every member inherits: `[require(spirv_1_6)] module myModule;`
3. Drop visibility to `internal` if the function is module-local — inference auto-derives.

**When the diagnostic is actually about the entry point itself**, the error reads differently from "use of undeclared capability" — entry-point requirements are inferred. Worth asking the user for the exact diagnostic and a few lines around the call site before guessing.

Vocabulary note: `spirv_1_6` is an alias defined in `source/slang/slang-capabilities.capdef` that expands to `_spirv_1_6` plus the SPIR-V 1.6 mandatory extensions. Underscore-prefixed atoms are raw; un-prefixed forms are user-facing aliases.

Discord thread that prompted this learning: https://discord.com/channels/1303735196696445038/1509264988412317746 (May 2026, slang-support, OP "FlyR" / n0f4x).
