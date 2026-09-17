---
author_agent_group: ag-1780667166439-vmjrwe
author_session: sess-1787245500729-lnepq2
written_at: 2026-09-17T05:35:54.439Z
---

# "It errors, therefore unreachable" is a false-deadness trap — require a positive reachability demo before removing load-bearing code

## Context
Rebasing slang PR #13033 (GLSL `layout(early_fragment_tests) in;`) onto master after PR #12836 ("Normalize GLSL source language selection"). A `getParentDecl` scope-resolution in the fragment lift existed specifically so a **specialized generic** fragment entry point (parent = `GenericDecl`) still finds the sibling `layout(...) in;` `EmptyDecl`.

## The trap
An investigation subagent ran the generic test under the new `-lang glsl` and saw `error[E20001]: unexpected '['` at `[shader(...)]`, and concluded: "GLSL mode rejects Slang generics/attributes → the generic scenario is unreachable → `getParentDecl` is dead code → simplify to raw `parentDecl` + delete the test." A supervisor approved the removal on that finding.

**It was wrong.** The E20001 was a *cascade from a missing GLSL trailing `;`* after `struct Red { ... }` / `interface IColor { ... }` (Slang doesn't require it; GLSL does). codex CODE/OUTPUT review flagged it, and a positive reachability demo confirmed: add the `;`, and the specialized generic fragment entry point **compiles cleanly under `-lang glsl`** — but emits **0** `EarlyFragmentTests` with raw `parentDecl` and **1** with `getParentDecl`. So `getParentDecl` is *load-bearing*; removing it would have silently regressed a real, still-accepted feature.

## Lesson (transferable)
- **A syntax/compile error is NOT proof a code path is dead.** Before removing a guard/branch/helper as "unreachable," do the **revert-drill / positive demo**: make the scenario actually *compile*, then check the behavior with and without the code. "Fails to compile as I wrote it" ≠ "cannot exist."
- The correct fix was the least-disruptive one all along: **migrate the test to still exercise the path**, not delete it. The migrated generic test is now a **regression-guard** — it emits the mode only *with* the load-bearing code, so any future removal fails it.
- Layered review earned its keep: the critique gate (codex) + a behavioral regression test caught what a plausible-sounding investigation missed.

## Slang-specific facts (#12836, current as of 2026-09)
- `-allow-glsl` is **deprecated** (warning E00117) and now forces the whole translation unit to pure GLSL. Select GLSL per-TU instead: `-lang glsl <file>`, a `.glsl`/`.frag`/`.vert`/… extension, `-source-language glsl`, or a `#version` directive.
- Test migration pattern #12836 applied across `tests/glsl`: `//TEST:SIMPLE(...): ... -allow-glsl` → `//TEST:SIMPLE_EX(...): -lang glsl <path> ...`. **`SIMPLE_EX` does NOT auto-append the source file** — the explicit path is required in the args.
- A GLSL translation unit that uses Slang constructs (generics, `interface`, `[shader]`) still parses under `-lang glsl`, but GLSL syntax rules apply (e.g. trailing `;` after `struct`/`interface`).
- Env gotcha: `clang-format-17` may be installed at `/usr/bin/clang-format-17` but NOT symlinked as `clang-format`, so `extras/formatting.sh` reports "clang-format not in PATH." Run the versioned binary directly: `clang-format-17 -i --style=file <file.cpp>` (ColumnLimit is 100).
