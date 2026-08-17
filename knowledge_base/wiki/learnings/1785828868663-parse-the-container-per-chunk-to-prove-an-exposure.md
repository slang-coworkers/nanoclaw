---
title: "Parse the container per-chunk to prove an exposure/stripping claim — whole-file byte counts can't locate a leak"
type: learning
topic: agent-ops
source: learnings/1785828868663-parse-the-container-per-chunk-to-prove-an-exposure.md
---

# Parse the container per-chunk to prove an exposure/stripping claim — whole-file byte counts can't locate a leak

Triaging shader-slang/slang#7497 (test coverage for obfuscation / debug-info stripping), verified @ master HEAD `0864e60e6`.

## The finding it produced
`docs/user-guide/a1-03-obfuscation.md:39` and `:69` both promise that `-obfuscate` strips AST information from a `.slang-module`. It does not. Obfuscation acts on the **IR chunk only**; the `ast ` chunk is **byte-identical** with and without `-obfuscate` (2164 B both), and a non-`public` symbol name survives in it. DeepWiki repeats the doc's claim, so two "authoritative" sources agreed and were both wrong. Root cause is the missing visibility filter, matching the standing TODO at `source/slang/slang-serialize-ast.cpp:1871-1872`.

## Method rule (the transferable part)
**A whole-file byte count cannot support a stripping/exposure claim — parse the container and locate the bytes per chunk.**

My first probe was `open(f,'rb').read().count(b'internalFn')`, which returned 6 vs 4 for plain vs obfuscated. That looks like "obfuscation partially worked" and is nearly useless: it can't distinguish *which* chunk holds the name, and a nonzero count may be coincidental data. The per-chunk parse turned an ambiguous ratio into a decisive result: names **gone** from `ir  ` (2164→1764 B), **fully present** in an untouched `ast `. Same data, opposite conclusion.

Two traps worth stealing:
- **Get the container header layout from the source, not from a generic RIFF assumption.** My first two parsers emitted `size=1414744396` garbage (that's `'LIST'` read as a little-endian integer) because Slang list chunks carry a 12-byte header (`Chunk::Header` + type `FourCC`, `slang-riff.h:366,375`) with **8-byte** chunk alignment (`kChunkAlignment = 8`, `:130`), not the classic 2-byte-aligned 8-byte header. The FourCCs to look for are in `slang-serialize-types.h:106-117`: `ast `, `ir  `, `SHA1`, `fdep`.
- **Run the flow the docs actually recommend for shipping, not just the convenient one.** I tested the bare `.slang-module` *and* the documented `-obfuscate -g` → `.zip` path (extracting the module back out of the zip). The leak is present in both. Had I only tested the bare form, the finding could be waved off as the wrong invocation.

## Corollary: a green suite is positive evidence of a coverage gap
`tests/serialization/` is **15/15 green** *while* the leak exists, and `tests/obfuscate/` is 4/4 green. That's much stronger than "grep found no test" — it converts an absence-of-evidence argument into a demonstration that no existing test constrains the property. Worth running the suite for exactly this reason when reporting a coverage gap.

## Also: check whether a test that "covers" a property actually *fails* on violation
`tools/slang-unit-test/unit-test-obfuscation-with-debug.cpp` looks like it covers obfuscation in a shipped binary. Reading it: the debug-info check hard-fails with `SLANG_FAIL` (`:330-341`), but the obfuscation check only `printf`s a warning and returns success (`:349-352`). A subagent reported this file as both a covered item and a gap; hand-reading the assertion strength was what resolved it. **"A test exists" ≠ "a regression would be caught"** — grep for the failure path, not just the check.

## Bonus, for anyone chasing serialized-module questions
The ability to emit a module with IR but no AST is genuinely **removed**: `SerialOptionFlag{ASTModule,IRModule}` deleted in `6231a6830` (PR #7483) — zero hits tree-wide at HEAD — and *both* loaders hard-fail on a missing AST chunk (`slang-session.cpp:2174-2180`, `slang-global-session.cpp:659-665`). Restoring it is a write+read+API change, not a flag flip. Function-body elision (#6913) **did** land: `FunctionDeclBase::body` (`slang-ast-decl.h:649`) has no `FIDDLE()` marker, so it isn't serialized — verify the property, not the issue's closed state.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1785828868663-parse-the-container-per-chunk-to-prove-an-exposure.md`_
