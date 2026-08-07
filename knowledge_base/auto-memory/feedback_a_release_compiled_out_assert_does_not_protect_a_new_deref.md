---
name: feedback_a_release_compiled_out_assert_does_not_protect_a_new_deref
description: "slang#12155's bounds guard derefs a null typeLayout because the SLANG_ASSERT one line above is compiled out in Release — a preceding assert is not a null-check for code you add after it"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 35469e7f-5e4c-4768-9736-7c4a31447a3b
---

# A preceding `SLANG_ASSERT` is not a null-check for the line you add after it

**2026-08-06, slang#12155** (fix for #8183). The PR adds a bounds guard to `ensureStructHasUserSemantic` (`source/slang/slang-ir-legalize-varying-params.cpp`):

```cpp
SLANG_ASSERT(typeLayout);                             // pre-existing, line ~3298
if (index >= (Index)typeLayout->getFieldCount())      // <-- ADDED by the PR: null deref
{ index++; continue; }
auto fieldLayout = typeLayout->getFieldLayout(index); // master crashed HERE
```

`typeLayout` comes from `as<IRStructTypeLayout>(varLayout->getTypeLayout())` at **`:3270`**. When the entry point's original return type was **not** a struct, the `as<>` yields **null**. The new `getFieldCount()` call derefs null (`si_addr=0x4`, chain `getFieldCount()`→`getFieldLayoutAttrs()`→`findAttrs<IRStructFieldLayoutAttr>()`→`getOperandCount()`).

✅**RE-VERIFIED by Main 2026-08-06 at PR head `a859c21797` in a fresh clone, both revisions:** the guard is at `:3302` (`if (index >= (Index)typeLayout->getFieldCount())`), `SLANG_ASSERT(typeLayout)` at `:3298`, `typeLayout` from `as<IRStructTypeLayout>(varLayout->getTypeLayout())` at `:3270`. Master `d7d59f374` has the assert at the same `:3298` followed by the **dead duplicate** `typeLayout->getFieldLayout(index);` at `:3299` then the real read at `:3300`. Control: `typeLayout->` occurrences between function head and the assert = **0** on *both* revisions ⇒ the PR's `getFieldCount()` is genuinely the **first** dereference on the null path, so it is the new owning line, not merely a co-victim. Call sites confirmed 2 (`:4133` struct branch, `:4155` fall-through).

⛔**"Compiled out" UNDERSTATES it — Main-verified at `source/core/slang-common.h:363-372`:**
```cpp
#ifdef _DEBUG
#define SLANG_ASSERT(VALUE) do { if (!(VALUE)) [[unlikely]] ::Slang::handleAssert(...); } while(0)
#else
#define SLANG_ASSERT(VALUE) SLANG_ASSUME(VALUE)   // <-- Release
#endif
```
⇒ ⭐⭐⭐**In Release the assert is not absent protection, it is an OPTIMIZER PROMISE on a premise that is false here.** The new line sits under a statement telling the compiler the null case cannot happen — so the guard doesn't merely fail to check, it is UB-licensed. `SLANG_RELEASE_ASSERT` is the one that survives.

⇒ Measured against a build of the PR: it fixes the struct-return shapes (139→0) but **the two non-struct-return `out`-param shapes still SIGSEGV (139→139)** — and the crash **moved one line earlier**, from master's positional *read* onto the PR's own bounds *check*. Identical user-visible symptom, different failure.

⭐⭐⭐ **A guard placed after an assert inherits none of the assert's protection in Release.** The assert made the invariant *look* established, which is exactly why the new line read as safe. In this codebase `SLANG_ASSERT` is debug-only (`SLANG_RELEASE_ASSERT` is the one that survives) — so any code added *below* an assert and *above* the original first use must re-establish the precondition itself, or use `SLANG_RELEASE_ASSERT`.

✅ **Detector that would have caught it pre-merge:** the shape "master crashed at line N; my fix adds a check at N−1 that dereferences the same object" means the fix has the *same* precondition as the code it guards. Ask: *does my new line dereference anything the old crash site dereferenced?* If yes, the guard must come before the deref, not be one.

⭐⭐ **Root-cause framing this reinforces (CLAUDE.md's own rule):** the guard is consumer-side patching of a malformed shape. The real defect is that `lowerOutParameters` merges a field into a **synthesized** return struct while `resultLayout` still describes the original **non-struct** return — a producer that never records layout for what it appends. A bounds guard cannot fix a layout that describes the wrong type; it can only decline to read it.

## The trigger, isolated by predict-then-test
3 cells, one binary, all matching the prediction: struct return + `out` ⇒ `0`; non-struct return, no `out` ⇒ `0`; **non-struct return AND ≥1 `out` param ⇒ `139`**.

## ⛔ MY CALL-SITE ATTRIBUTION WAS WRONG — corrected by the PR author, verified in source
I forwarded that the crash sits at the **`:4016` fall-through** site, with the rebuild gated inside a `:3994` struct-branch that `return`s. **Wrong. It is the SAME `:3994` site the fix targets.** Two independent proofs at HEAD `d7d59f374`:
1. **Ordering:** `legalizeShaderOutputParamsForMetal` → `lowerOutParameters` runs in the per-entry-point loop at **`:5155`**, with **`alwaysUseReturnStruct = true`** (`:5110`); `context.legalizeEntryPoints(entryPoints)` runs **after**, at **`:5162`**. ⇒ by the time the struct/non-struct branch is evaluated, `returnType` **is already the synthesized struct**, so it takes the `as<IRStructType>(returnType)` branch and reaches the **first** call site. It never reaches the fall-through.
2. **`:4016` cannot be the crash site at all:** that site **builds its own fresh layout** — `structTypeLayoutBuilder.addField(key, resultLayout)` → `.build()` → `IRVarLayout::Builder varLayoutBuilder(&builder, typeLayout)` → `ensureStructHasUserSemantic(structType, varLayout)`. Its `typeLayout` is non-null **by construction**, so a null deref there is impossible.

**Corrected chain:** `lowerOutParameters` synthesizes `{result, extra}` and never records layout → `resultLayout = entryPointLayout->getResultLayout()` still describes the **original non-struct** return → no nesting ⇒ `returnStructType == flattenedStruct` ⇒ **the rebuild is skipped by its own `if`, not by a returning branch** → `as<IRStructTypeLayout>` on a non-struct layout ⇒ null.

⇒ ⭐⭐⭐**This is WORSE for the patch than my version was.** "Wrong call site" would mean the guard is merely unprotected on a path the fix doesn't own. The truth is the guard is **on the exact path the fix was supposed to own**, and the rebuild *declines to run precisely where it is needed* — the layout describes the wrong **type**, not merely the wrong **field count**. ⭐⭐**A corrected attribution can strengthen a finding; do not treat a peer's correction as a walk-back.**

⚠️**My `:3994`/`:4016` were another revision's coordinates** (author's HEAD: `:4133`/`:4155`). ⇒ **trace by symbol, not by line number, when two parties hold different revisions** — CLAUDE.md says this and I still published raw line numbers as if shared.

**Related:** [[project_12400_wgsl_out_param_ptr_function]] (full matrix + provenance controls), and the standing rule that a `slangc` under a PR worktree's `build/` may be a fetched release tarball, not a build of the PR — check `slangc -v` plus a guilty control (a patch-only string that must be **absent** on master).
