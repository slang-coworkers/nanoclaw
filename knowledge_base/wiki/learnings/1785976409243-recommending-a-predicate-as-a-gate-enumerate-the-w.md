---
title: "Recommending a predicate as a GATE: enumerate the whole switch, not the cases that match"
type: learning
topic: agent-ops
source: learnings/1785976409243-recommending-a-predicate-as-a-gate-enumerate-the-w.md
---

# Recommending a predicate as a GATE: enumerate the whole switch, not the cases that match

## The failure

On shader-slang/slang PR #12182 I recommended reusing an existing predicate as a linkage gate:

```cpp
if (auto func = as<IRFunc>(inst); func && !isPublicOrExportedFunc(func))
    m_writer->emit("static ");
```

The PR author implemented it, hit multiple-definition errors, and correctly diagnosed why: `isPublicOrExportedFunc` returns true for **any `public` Slang function** (`kIROp_PublicDecoration` is the first case in its switch), so every `public` function skipped the `static` and stayed externally linked.

**The generator of the mistake — this is the transferable part.** My earlier report said the predicate *"already treats `EntryPointDecoration` and `CudaDeviceExportDecoration` as public, matching the exclusions the gate needs."* Both facts were true. I had even **quoted the whole switch** in that same report. What I never did was enumerate the *other* cases to check whether any of them **also** match — and one of them (`PublicDecoration`) broke the gate.

> Naming the cases that match is **not** the same as verifying no other case matches.

A predicate is safe to reuse as a gate only if you've checked its **entire** domain, because a gate is a claim about everything it *excludes*, not just about the examples you had in mind.

## Checklist before reusing an existing predicate as a gate

1. **Read the whole body and list every case**, then for each one ask: "if a function has *this* decoration, is the gate's behaviour still what I want?" One "no" kills the reuse.
2. **Ask what axis the predicate encodes.** Mine encoded *module visibility* (who may import/reference a symbol); I needed *downstream translation-unit linkage* (may this symbol be defined once or many times across linked objects). Same word ("public"/"exported"), different question. A predicate whose name matches your intent may still answer a different question.
3. **Check prevalence of the cases you're waving off.** `public` isn't exotic — it's used throughout Slang's standard modules, so the broken path was the common one, not an edge case.
4. **Prefer a purpose-built predicate over a borrowed one** when the axis differs. The author's fix was a new, narrow helper checking only the two export decorations that genuinely mean "give this external downstream linkage."

## Second, compounding trap: a stale code comment is not a source of truth

While *correcting* my own error I introduced a new factual error. `slang-compiler-tu.cpp` has a comment reading "Mark all public functions as exported"; I cited it as evidence that a downstream-export decoration was visibility-derived. Reading the actual function (`attemptPrecompiledExport`) shows it tests only: is-a-func, has a body, not `unsafeForceInline`, simple (non-generic) types — **it never inspects `PublicDecoration`**. The comment is stale relative to the code.

Two rules from that:
- **Read the function body, not the comment above it**, whenever the comment is load-bearing for a claim.
- **An overclaim inside a correction is the least-audited claim you'll make.** Having just conceded one error, I was in "agreeing with the author" mode — and the agreeable/self-flagellating claim gets less scrutiny than a contested one. Audit the places you agree at least as hard as the places you push back.

Verified on shader-slang/slang PR #12182 at HEAD `13741fd8`, 2026-08-06.

---
_Topic: [NanoClaw / agent operations](../topics/agent-ops.md) · [catalog](../index.md) · source: `sources/learnings/1785976409243-recommending-a-predicate-as-a-gate-enumerate-the-w.md`_
