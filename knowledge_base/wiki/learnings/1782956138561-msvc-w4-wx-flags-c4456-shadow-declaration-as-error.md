---
title: "MSVC /W4 /WX flags C4456 shadow-declaration as error — invisible to local gcc/clang builds"
type: learning
topic: slang-compiler
source: learnings/1782956138561-msvc-w4-wx-flags-c4456-shadow-declaration-as-error.md
---

# MSVC /W4 /WX flags C4456 shadow-declaration as error — invisible to local gcc/clang builds

Slang's Windows-CL build legs compile with MSVC `/W4 /WX`, which treats **C4456** ("declaration of 'X' hides previous local declaration") — and C4457/C4458/C4459 (hides function param / class member / global) — as a hard **error**. Slang's gcc/clang build legs do NOT enable `-Wshadow`, so a variable-shadowing mistake compiles cleanly on every Linux/macOS build and only fails on `build-windows-*-cl-x86_64-gpu`.

Concrete miss (slang#11873): I hoisted `auto astBuilder = linkage->getASTBuilder();` at function-body scope in `validateEntryPoint`, which shadowed a pre-existing nested `auto astBuilder` later in the same function. 7 builds (linux gcc debug+release ×x86_64/aarch64/wasm, macOS clang debug+release) went green; both Windows-CL builds failed C2220→C4456. My local Debug build is gcc → I never saw it, and burned a CI round-trip + force-push.

Takeaways:
1. **A green local (gcc) build is NOT authoritative for shadow/warning errors** — the Windows-CL leg is. When a PR touches C++ and adds/hoists a local, sanity-check for shadowing before pushing.
2. **Cheap local pre-check:** run `-Wshadow -fsyntax-only` on the changed TU using its exact compile command from `build/compile_commands.json`:
   `CMD=$(python3 -c "import json;d=json.load(open('build/compile_commands.json'));print([e for e in d if e['file'].endswith('slang-check-shader.cpp')][0]['command'])"); cd build && eval "$CMD -Wshadow -fsyntax-only"`
   `-Wshadow` catches local-hides-local (== C4456) and member/param shadows. Empty output for your file = MSVC-clean. (Ignore pre-existing shadow warnings in unrelated headers.)
3. **Fix pattern:** don't introduce a function-scope local that encloses a nested block declaring the same name. Either give it a distinct name, or declare it in the tightest scope that uses it (e.g. inside the loop body) so it neither hides nor is hidden. Inlining the call is shadow-proof but can trigger an ugly clang-format deep-align if the line exceeds 100 cols — a short-named local in leaf scope stays on one line and formats cleanly.
4. When CI shows a Windows-CL-only failure while all gcc/clang builds pass, suspect an MSVC-specific diagnostic (shadow, unreferenced-local, signed/unsigned, `/permissive-` conformance) BEFORE assuming infra/flaky — read the actual `error Cxxxx` line via `gh api repos/<owner>/<repo>/actions/jobs/<jobId>/logs` (works even while the run is in progress).

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782956138561-msvc-w4-wx-flags-c4456-shadow-declaration-as-error.md`_
