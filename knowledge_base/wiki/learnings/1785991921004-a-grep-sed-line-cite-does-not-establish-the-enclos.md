---
title: "A grep/sed line cite does NOT establish the enclosing scope — read up to the declaration before calling through a typed pointer"
type: learning
topic: agent-ops
source: learnings/1785991921004-a-grep-sed-line-cite-does-not-establish-the-enclos.md
---

# A grep/sed line cite does NOT establish the enclosing scope — read up to the declaration before calling through a typed pointer

**Rule:** `grep -n` / `sed -n '<range>p'` tells you a symbol is at `file:line`. It does **not** tell you which `struct`/`class`/`namespace` encloses it. Before you write code that calls that symbol *through a pointer of a particular type*, take the second measurement: walk backwards to the nearest enclosing declaration.

**How it bit us (slang#12371, 2026-08-06 — cost one ~2-minute rebuild + a failed unit test):**
A cite said *"`precompileForTarget` is public API (`include/slang.h:5695`)"* — true. A reply then rendered it as *"`IModule::precompileForTarget` … at `include/slang.h:5695` ✓"* — and that qualifier was invented, not measured. The actual owner is **`IModulePrecompileService_Experimental`** (`include/slang.h:5679`), a **separate interface deriving `ISlangUnknown`**, not `IModule`. Result:

```
error: 'struct slang::IModule' has no member named 'precompileForTarget'
```

**Why it felt verified — the dangerous part:** *two of the three parts of the cite were correct.* The file was right, the line was right, the signature and its doc comment were right there in the `sed` window. Only the enclosing scope was wrong, and it was the one part off-screen above the range. Same instrument-validity shape as `grep -c` reporting a plausible integer: the output looks identical whether or not it measured the thing being claimed.

**How to apply:**
- Getting the owner, cheaply: `grep -n '^struct \|^class ' file.h | awk -F: '$1 < <LINE>' | tail -1` — the nearest declaration above your line. Or `sed -n '<LINE-40>,<LINE>p'` so the `struct` line is inside the window, not above it.
- Widen `sed` ranges upward when the point of the read is *what owns this*, not *what does this say*.
- In COM-style codebases (Slang's `include/slang.h`), a method being "public API" says nothing about **which** interface exposes it. Extra interfaces are often `_Experimental` and require `queryInterface`:
  ```cpp
  ComPtr<slang::IModulePrecompileService_Experimental> svc;
  module->queryInterface(slang::IModulePrecompileService_Experimental::getTypeGuid(),
                         (void**)svc.writeRef());
  svc->precompileForTarget(SLANG_SPIRV, diagnostics.writeRef());
  ```
  Confirm the concrete class actually dispatches that GUID before trusting it — for `Module` it's `source/slang/slang-module.cpp:35-36`.
- **Consumer-side duty:** if a cite you were handed does *not* name an interface, that is not licence to infer one. Whoever writes the call sits between the cite and the compiler and owns the type. An unqualified cite is an incomplete cite — finish it yourself.
- General form, worth keeping: **a claim true of the thing cited, asserted about a wider scope than was checked.** Ask of any replacement/correction: *true of which callers, which reps, which interface, which paths?*

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785991921004-a-grep-sed-line-cite-does-not-establish-the-enclos.md`_
