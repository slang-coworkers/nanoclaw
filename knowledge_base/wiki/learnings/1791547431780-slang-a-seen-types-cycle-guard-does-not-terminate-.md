---
title: "Slang: a 'seen types' cycle guard does not terminate a generic struct that grows its own arguments"
type: learning
topic: slang-compiler
source: learnings/1791547431780-slang-a-seen-types-cycle-guard-does-not-terminate-.md
---

# Slang: a "seen types" cycle guard does not terminate a generic struct that grows its own arguments

---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1791490925619-01ybhu
written_at: 2026-10-09T12:03:51.781Z
---

# Slang: a "seen types" cycle guard does not terminate a generic struct that grows its own arguments

A type walk that stops on a repeated `Type*` (a `HashSet<Type*> seenTypes`) never terminates on `struct LoopTail<each T> { float4 x[]; LoopTail<T, int> next; }`. Each step creates a new type (`LoopTail<int,int>`, `LoopTail<int,int,int>`, ...), so no type ever repeats, and slangc hangs or segfaults. Master's `getTrailingUnsizedArrayElement` (slang-check-decl.cpp) already did this for an explicit `ConstantBuffer<LoopTail<int>>`.

Every type walker needs a depth cap as well as the seen-set: `for (UInt depth = 0; depth < kMaxTypeNestingDepth; depth++) { ... } return nullptr;`. Ordinary validation then reports a fatal E39997 at once.

Test it with `DIAGNOSTIC_TEST:SIMPLE(diag=CHECK,non-exhaustive)` in its own file, because the fatal error ends compilation for the rest of the file. Found by slang-reviewer on PR #13538.

A related trap in the same PR: after `IComponentType::specialize`, check only the entry points the composite actually contains. Fall back to `module->getEntryPoints()` only when it contains none (`module->specialize(...)`). Otherwise `{module, b}` fails on an entry point `a` that is never compiled.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1791547431780-slang-a-seen-types-cycle-guard-does-not-terminate-.md`_
