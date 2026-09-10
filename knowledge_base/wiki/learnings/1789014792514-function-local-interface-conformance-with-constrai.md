---
title: "Function-local interface conformance with constrained generic method crashes (null getSub in doesGenericSignatureMatchRequirement)"
type: learning
topic: slang-compiler
source: learnings/1789014792514-function-local-interface-conformance-with-constrai.md
---

# Function-local interface conformance with constrained generic method crashes (null getSub in doesGenericSignatureMatchRequirement)

---
author_agent_group: ag-1780667166418-apezq5
author_session: sess-1789014152925-7z522y
written_at: 2026-09-10T04:33:12.514Z
---

# Function-local interface conformance with constrained generic method crashes (null getSub in doesGenericSignatureMatchRequirement)

**Symptom (shader-slang/slang#12987):** A function-local `struct Op : IOp` where the interface requirement is a *constrained* generic method (`int apply<T:__BuiltinArithmeticType>(T)`) crashes slangc with a hard SIGSEGV / Windows access violation, **no diagnostic**, on ALL targets (spirv/hlsl/cuda). Moving `Op` to module scope, dropping `: IOp`, or dropping the constraint each makes it compile.

**It's a FRONT-END crash (not IR/emit)** — that's why it's target-independent. Don't chase the emitters.

**Root cause (grounded via symbolized backtrace + source + DeepWiki):**
- `doesGenericSignatureMatchRequirement` (`slang-check-decl.cpp` ~6152-6154) does `auto satisfyingSubType = getSub(m_astBuilder, satisfyingConstraintDeclRef); if (!satisfyingSubType->equals(requiredSubType)) ...`.
- `getSub`/`getSup` on a `GenericTypeConstraintDecl` return non-null ONLY after the decl reaches `DeclCheckState::SignatureChecked` (populated by `SemanticsDeclHeaderVisitor::visitGenericTypeConstraintDecl`). At **module scope**, the header-check pass advances a type's members' generic constraints before `ReadyForConformances`; for a **function-local** type nested in a function body that ordering guarantee is NOT established → `getSub` returns NULL.
- `Val::equals` (`slang-ast-base.h:436`): `return this == val || (val && this->resolve() == val->resolve());` — the `val &&` guard protects the ARGUMENT, not the RECEIVER. A null `satisfyingSubType` → `resolve()` on null `this` → segfault at `slang-ast-val.cpp:78`.

**Fix direction:** producer/ordering fix — `ensureDecl(satisfyingConstraintDecl, DeclCheckState::SignatureChecked)` before reading getSub/getSup in `doesGenericSignatureMatchRequirement` (that same function already does exactly this in its And-type-flattening path). Add a fail-loud assert afterward. A null-guard-only fix is the wrong layer — module-scope compiles prove the conformance is a supported feature.

**No-gdb crash localization that worked here (reusable):** container had no gdb. Built a tiny `LD_PRELOAD` SIGSEGV handler calling `backtrace()`+`backtrace_symbols_fd()` (`gcc -shared -fPIC`), ran the Debug slangc under it, then symbolized the `libslang-compiler.so(+0xOFFSET)` frames with `addr2line -f -C -e build/Debug/lib/libslang-compiler.so <offset>` (the `.so.*.dwarf` sidecar carries the debug info). Gave exact file:line for all 51 frames. Debug build segfaults where Release only "access violates" — same bug.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1789014792514-function-local-interface-conformance-with-constrai.md`_
