---
title: "Slang #11493 builtin-operator fast path silently bypasses user operator overloads on builtin scalar/vector/matrix types"
type: learning
topic: slang-compiler
source: learnings/1782894605011-slang-11493-builtin-operator-fast-path-silently-by.md
---

# Slang #11493 builtin-operator fast path silently bypasses user operator overloads on builtin scalar/vector/matrix types

**Symptom (discussion #11840):** A user-defined global `operator*(float4x4,float4x4)` that had worked for ~2 years stopped taking precedence over the built-in component-wise matrix multiply after upgrading Slang 2026.9 → 2026.11. The overload is silently ignored — no diagnostic.

**Root cause:** PR #11493 (commit `61ad43dbc`, "Hard-code a fast path for builtin scalar/vector/matrix operators", first in v2026.11) added `SemanticsExprVisitor::convertToBuiltinArithmeticOp` (source/slang/slang-check-expr.cpp:4605), called from `visitInvokeExpr` at :5007 and returning at :5008 — **before** `CheckTerm`/`ResolveInvoke` (:5044+). For a builtin arithmetic/comparison/bitwise/shift/unary operator on builtin scalar/vector/matrix operands it rewrites the expr to a `BuiltinOperatorExpr` and skips overload resolution entirely. So ANY user overload of a builtin operator on builtin operand types is now bypassed (matrix `*` is just where a user noticed). The fast path already defers matrix operators to normal resolution in GLSL operator scope (:4634-4637, :4723-4730) so glsl.meta.slang overloads apply — but the analogous "defer when a user overload for the operand types is in scope" case was not handled.

**Why it's a regression, not intended:** #11493 is a compile-time perf optimization with stated goal "byte-identical codegen"; silently overriding a valid in-scope user overload is a semantic change → unintended.

**Fix direction:** fast path should consult lookup for a user-defined (non-core-module) `operator OP` candidate on the operand types and defer to normal overload resolution when one exists; or at minimum diagnose rather than silently ignore.

**Interim workaround:** call `mul` directly (their `operator*(m0,m1)=mul(m1,m0)` means `proj*modelview` == `mul(modelview,proj)`), or pin to Slang ≤ v2026.10.

**Investigation traps I hit:** (1) A stale build/Release+build/Debug binary `git describe`d as `5230a81f2` (2026-06-05, BEFORE #11493) yet was already broken — turned out to be a dev WIP build with the fast path applied as uncommitted changes (no committed operator/overload/meta change exists in that sub-window; describe reports the last commit, not uncommitted state). Don't trust a prebuilt binary's describe as proof of its source when its behavior contradicts the committed history — bracket by shipped release tags instead. (2) Related prior learning `1781703451468` documents the same fast path silently declining float-bitwise → E39999; this PR has a recurring "fast path fires/declines when it shouldn't" defect class.

---
_Topic: [Slang compiler & language](../topics/slang-compiler.md) · [catalog](../index.md) · source: `sources/learnings/1782894605011-slang-11493-builtin-operator-fast-path-silently-by.md`_
