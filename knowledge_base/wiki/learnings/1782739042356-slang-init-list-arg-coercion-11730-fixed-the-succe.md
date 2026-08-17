---
title: "slang init-list arg coercion: #11730 fixed the success return's probe-safety but the ERROR return still leaks a real-sink diagnostic during canCoerce"
type: learning
topic: slang-compiler
source: learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md
---

# slang init-list arg coercion: #11730 fixed the success return's probe-safety but the ERROR return still leaks a real-sink diagnostic during canCoerce

`SemanticsVisitor::createInvokeExprForExplicitCtor` (source/slang/slang-check-conversion.cpp) has a build-vs-probe contract: overload resolution calls it first via `canCoerce` with `outExpr == nullptr` (a viability probe — must emit nothing, just return yes/no), then again with `outExpr` set to build the expr. PR #11818 (issue #11730) fixed the **success** return to honor that contract — `return true` is now un-nested from `if(outExpr)` (verified at PR head 9b24bb7c, ~:818), so a viable `{vector,scalar}→vector` coercion is no longer a false-negative during the probe.

**But the ERROR return path was NOT made probe-safe and remains a pre-existing inconsistency** (out of #11730 scope; not introduced by the PR). In the `if (tempSink.getErrorCount())` block (~:788-806), for a non-c-style type it calls `getSink()->diagnoseRaw(Severity::Error, ...)` to the **real** sink (~:795) — **not gated on `outExpr`** — and then `return true` (~:803). Consequence: probing a *non-viable* explicit-ctor candidate via `canCoerce` (outExpr==nullptr) during overload resolution **leaks a hard diagnostic before ranking**. Concretely, this blocks writing a clean overload-ranking positive test like `pick(float2)`/`pick(float3)` with `pick({a,b})` — the losing `float2` candidate's explicit-ctor check fails and leaks E30019 mid-probe.

Reviewer A's correctness pass independently flagged the same `diagnoseRaw`-reachable-on-probe-path region and classified it pre-existing/out-of-scope. The principled fix, if it gets a ticket, is to gate that `diagnoseRaw` (and the error-emit) on `outExpr != nullptr` so a probe stays diagnostic-free — mirroring exactly what #11730 did for the success path. Note `_coerceInitializerList` tries the three ctor helpers in order at ~:1416/1422/1429 (explicit → synthesized → abstract), and the "return true on error for non-c-style" exists deliberately to avoid falling back to the legacy element reader (which would produce unrelated errors).

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782739042356-slang-init-list-arg-coercion-11730-fixed-the-succe.md`_
