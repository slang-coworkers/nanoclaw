---
title: "Serialized-Module & Obfuscation Verification (.slang-module chunks, -obfuscate, stripping claims)"
type: concept
group: slang-tooling
tags: [obfuscation, serialization, slang-module, riff, chunks, ast-chunk, ir-chunk, stripping, debug-info, coverage-gap, deepwiki, verification]
source_count: 1
---

# Serialized-Module & Obfuscation Verification (.slang-module chunks, -obfuscate, stripping claims)

Slang serializes a compiled module into a RIFF-style container (`.slang-module`) built from named chunks — `ast `, `ir  `, `SHA1`, `fdep`. Claims about what `-obfuscate`, debug-info stripping, or a serialization flag actually *do* to that container are easy to get wrong: the surface tools (a whole-file byte count, the docs, DeepWiki) all give plausible-but-wrong answers. The discipline is to parse the container per chunk and read the source, not the prose.

## TL;DR

- To prove a stripping / exposure claim on a serialized `.slang-module`, parse the container **per chunk** — a whole-file byte or substring count cannot say *which* chunk holds a name, and turns a decisive result into an ambiguous ratio (6 vs 4 reads as "partially stripped" and means nothing).
- `-obfuscate` acts on the **`ir  ` chunk only**; the `ast ` chunk is byte-identical with and without it, so a non-`public` symbol name survives in the AST. The doc claim that `-obfuscate` strips AST information is **wrong** (missing visibility filter; standing TODO at `slang-serialize-ast.cpp:1871-1872`).
- Take the container header layout from the **source**, never a generic RIFF assumption: Slang list chunks carry a 12-byte header (`Chunk::Header` + a type `FourCC`) with 8-byte alignment, not the classic 2-byte-aligned 8-byte header. FourCCs are enumerated in `slang-serialize-types.h`.
- Run the flow the docs recommend for **shipping** (e.g. `-obfuscate -g` → `.zip`, extracted back out), not just the convenient bare `.slang-module`, or the finding gets waved off as the wrong invocation.
- A green suite while the defect exists is positive evidence of a **coverage gap** — strictly stronger than "grep found no test," because it demonstrates no existing test constrains the property.
- "A test exists" is not "a regression would be caught": grep for the failure path (`SLANG_FAIL`), not the check — a `printf`-and-return-success check covers nothing.
- Verify serialized-module properties against the **artifact**, not the issue's closed state or a doc. IR-without-AST emission is genuinely removed (`SerialOptionFlag{ASTModule,IRModule}` deleted, both loaders hard-fail on a missing AST chunk); function-body elision did land (`FunctionDeclBase::body` has no `FIDDLE()` marker, so it is not serialized).
- Documentation is not a behavior oracle, and a wiki/QA layer (DeepWiki) that repeats a doc's claim is not an independent second source.

## A stripping claim needs a per-chunk parse — a whole-file count cannot locate a leak

Triaging shader-slang/slang#7497 (test coverage for obfuscation / debug-info stripping) at master `0864e60e6` produced a live documentation-versus-behavior discrepancy: `docs/user-guide/a1-03-obfuscation.md:39` and `:69` both promise that `-obfuscate` strips AST information from a `.slang-module`, and **it does not**. Obfuscation acts on the **IR chunk only** — the `ast ` chunk is byte-identical with and without `-obfuscate` (2164 B both) and a non-`public` symbol name survives in it. Root cause is the missing visibility filter, matching the standing TODO at `source/slang/slang-serialize-ast.cpp:1871-1872`. DeepWiki repeats the doc's claim, so two nominally authoritative sources agreed and were both wrong ([parse the container per chunk to prove an exposure claim](../learnings/1785828868663-parse-the-container-per-chunk-to-prove-an-exposure.md)).

The transferable rule is the method that got there. The first probe was `open(f,'rb').read().count(b'internalFn')`, returning **6 vs 4** for plain versus obfuscated — which reads as "obfuscation partially worked" and is nearly useless: it cannot say *which* chunk holds the name, and a nonzero count may be coincidental data. The per-chunk parse turned that ambiguous ratio into a decisive result — names **gone** from `ir  ` (2164→1764 B), **fully present** in an untouched `ast `. Same data, opposite conclusion. Two traps inside the parse are worth stealing:

- **Take the container header layout from the source, not from a generic RIFF assumption.** The first two parsers emitted `size=1414744396` garbage — that is `'LIST'` read as a little-endian integer — because Slang list chunks carry a 12-byte header (`Chunk::Header` plus a type `FourCC`, `slang-riff.h:366,375`) with **8-byte** chunk alignment (`kChunkAlignment = 8`, `:130`), not the classic 2-byte-aligned 8-byte header. The FourCCs are enumerated at `slang-serialize-types.h:106-117`: `ast `, `ir  `, `SHA1`, `fdep`.
- **Run the flow the docs actually recommend for shipping, not just the convenient one.** Both the bare `.slang-module` and the documented `-obfuscate -g` → `.zip` path (extracting the module back out) leak. Testing only the bare form leaves the finding wavable as the wrong invocation.

Two coverage-argument rules came out of the same probe. **A green suite while the leak exists is positive evidence of a coverage gap:** `tests/serialization/` is 15/15 green and `tests/obfuscate/` 4/4 green *with* the leak present, which converts an absence-of-evidence argument ("grep found no test") into a demonstration that no existing test constrains the property — worth running the suite for exactly this reason when reporting a gap. And **"a test exists" is not "a regression would be caught":** `tools/slang-unit-test/unit-test-obfuscation-with-debug.cpp` looks like coverage for obfuscation in a shipped binary, but its debug-info check hard-fails with `SLANG_FAIL` (`:330-341`) while its obfuscation check only `printf`s a warning and returns success (`:349-352`). A subagent reported that file as both a covered item and a gap; hand-reading the assertion strength resolved it. Grep for the failure path, not the check.

For anyone chasing serialized-module questions from this area: emitting a module with IR but no AST is genuinely **removed** — `SerialOptionFlag{ASTModule,IRModule}` was deleted in `6231a6830` (PR #7483), zero hits tree-wide at HEAD, and both loaders hard-fail on a missing AST chunk (`slang-session.cpp:2174-2180`, `slang-global-session.cpp:659-665`), so restoring it is a write+read+API change rather than a flag flip. Function-body elision (#6913) **did** land: `FunctionDeclBase::body` (`slang-ast-decl.h:649`) has no `FIDDLE()` marker, so it is not serialized — verify the property, not the issue's closed state.

**Source learnings (1):**
- [`-obfuscate` does not strip the `ast ` chunk despite `docs/user-guide/a1-03-obfuscation.md:39,69` promising it (2164 B identical, non-`public` name survives); prove a stripping claim by parsing the container per chunk, never by a whole-file count.](../learnings/1785828868663-parse-the-container-per-chunk-to-prove-an-exposure.md)
_Catalog: [[wiki/index.md]]_
