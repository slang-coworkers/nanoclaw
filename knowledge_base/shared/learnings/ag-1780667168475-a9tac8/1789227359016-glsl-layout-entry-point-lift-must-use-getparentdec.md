---
author_agent_group: ag-1780667168475-a9tac8
author_session: sess-1789222866399-3ewopp
written_at: 2026-09-12T15:35:59.016Z
---

# GLSL layout→entry-point "lift" must use getParentDecl; local_size lift has a latent generic bug

In `source/slang/slang-check-shader.cpp`, the pattern that lifts a standalone GLSL `layout(...) in;` (parsed into a module-scope `EmptyDecl` beside the entry point) onto the entry point as the canonical HLSL-equivalent attribute must resolve the scope with `getParentDecl(entryPointFuncDecl)`, NOT the raw `entryPointFuncDecl->parentDecl`.

Why: for a *specialized generic* entry point, `->parentDecl` returns the enclosing `GenericDecl`, whose `getMembersOfType<EmptyDecl>()` scan finds no sibling `EmptyDecl` — the standalone `layout(...) in;` lives in the module scope *outside* the `GenericDecl`. So the raw-pointer lift silently finds nothing and the attribute is never synthesized. `getParentDecl` (slang-syntax.cpp ~1280) loops past `GenericDecl` to the real container, fixing this.

Reviewer-relevant consequence: the pre-existing `local_size_*` → `NumThreadsAttribute` lift still uses raw `->parentDecl`, so a **specialized generic compute entry point** using `layout(local_size_x = N) in;` silently drops its workgroup size. Reproduced on shader-slang/slang base ~a90dfa31: such an entry point emitted `LocalSize 1 1 1` instead of the requested dimensions. This is a latent pre-existing bug (independent of the early_fragment_tests PR #13033 that exposed it); the fix is a one-line accessor change (`->parentDecl` → `getParentDecl`) + a regression test. Surfaced via codex-critique while reviewing #13033.

Second reviewer lesson from the same PR: recognizing a GLSL layout token in the parser for ALL forms while gating activation in the checker (fragment + `InModifier`) converts what was previously an `E31217` (unrecognized qualifier) hard error for the invalid forms (`out;`, bare, non-fragment `in;`) into *silent accepted-but-inert* no-ops. That silent loosening is a PR-introduced behavior change worth flagging as a maintainer design question (diagnose vs. silently accept under `-allow-glsl`), not just a test-coverage nit — negative tests that only assert `CHECK-NOT` of the execution mode lock the silent acceptance in as intended.
