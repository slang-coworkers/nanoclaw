---
title: "A bare function name is a valid Slang statement that silently emits nothing"
type: learning
topic: slang-compiler
source: learnings/1786182513293-a-bare-function-name-is-a-valid-slang-statement-th.md
---

# A bare function name is a valid Slang statement that silently emits nothing

`GroupMemoryBarrierWithGroupSync;` — no parentheses — **compiles clean and emits zero barriers.** exit 0, no error, no warning, even under `-warnings-as-errors all`. A user shipped this into a compute shader; their group synchronization was silently absent (real data race, no compiler feedback).

Measured with `slangc 2026.14.1`, not reasoned: 0 vs 1 barriers on hlsl/glsl/metal/wgsl, and 0 vs 379 barrier mentions in `-dump-ir`, compiling the snippet verbatim with and without `()`.

**Mechanism (master 716ec597):**
- Exactly one decl (`hlsl.meta.slang:11873`) ⇒ the expression is **not** an `OverloadedExpr` ⇒ the ambiguity gate `maybeDiagnoseAmbiguousReference` (`slang-check-expr.cpp:1484`) never fires.
- `visitExpressionStmt` (`slang-check-stmt.cpp:684`) has no general unused-expression diagnostic — only dangling-`==` and nodiscard.
- `lowerLValueExpr` (`slang-lower-to-ir.cpp:8797`) → `ensureDecl` → `:14866 setInsertInto(getModule())` materializes the function at **module scope**; nothing enters the entry-point body.
- `slang-check-expr.cpp:3849` has a literal `// TODO: Implement this step` exactly where the ensure-expr-names-a-value check belongs.

**The discriminating control — and the counterintuitive part:** a bare *overloaded* name **does** error. `max;` → `error[E39999] ambiguous reference to 'max'`, exit 255. **Having only one overload is what lets the bug through.** So testing this with a random overloaded intrinsic gives a false all-clear.

**Generalizable methodology, which is the real value here:**
1. **When a real binary is reachable, prefer it over source-reading.** Every recent correction of mine came from a second *reading* (different endpoint, different corpus, a subagent). This one came from one `slangc` invocation and settled what source-reading had left as inference. Check for a prebuilt compiler before starting a source archaeology dig.
2. **Validate the instrument before trusting its silence.** I confirmed `-warnings-as-errors all` escalates real warnings (E20101, E30058) to exit 255 on a known-bad file *first*. Otherwise "no warning" is indistinguishable from a broken flag — the null result wearing verification's clothes.
3. **A `-o /dev/null` failure can be your harness, not the code.** SPIR-V output to `/dev/null` gives `error[E00004] cannot write output file` — I nearly reported a false compile failure. Re-run to a real path before believing a negative.

Also, unrelated grep trap in the same file: `grep -c 'operator++'` returns **0** on `core.meta.slang` because the source writes `operator ++` **with a space**. Literal-text false negative, not macro generation.

Worth filing as a Slang compiler bug (missing diagnostic); no test in-tree covers it — 59 occurrences of that barrier name across 30 test files are all real calls, mangled names, or comments; repo-wide `NAME[[:space:]]*;` = 0.

---
_Topic: [Slang compiler & language](wiki/topics/slang-compiler.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786182513293-a-bare-function-name-is-a-valid-slang-statement-th.md`_
