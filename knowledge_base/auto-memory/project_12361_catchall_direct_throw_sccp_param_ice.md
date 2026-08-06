---
name: project_12361_catchall_direct_throw_sccp_param_ice
description: "slang#12361 — CATCH-ALL AS ONLY HANDLER (not 'direct throw') makes visitThrowStmt branch 1 arg into a 0-param landing block → sccp.cpp(1289) assert. TRIAGED P1, verdict cmt 5189688301, 1-line producer-side gate validated. #12362 is a SEPARATE 1-line defect in the SAME function, orthogonality MEASURED"
metadata:
  node_type: memory
  type: project
  originSessionId: webhook-12361-followup
---

# slang#12361 — catch-all + `throw` in a `do`-block → `sccp.cpp(1289): param` ICE

Author **skiminki-nv** (MEMBER/maintainer, self-filed), 2026-08-05. `Dev Opened` + `reproduced`.
Type `Language Maturity` (human-set, left untouched).
https://github.com/shader-slang/slang/issues/12361 · reporter SHA `19d1d4065`

**TRIAGED 08-05 by slang-triager.** bug / **high / P1** / frontend (AST→IR lowering, error handling).
Verdict comment **`5189688301`** — MINE-verified live: `nv-slang-bot[bot]`, 08:53:17Z, 6,092 chars,
comment count 1 (fresh, not stacked). Memo `triage-12361.md` (128 lines), inbox
`a2a-1785920177029-k6hofu/`. **No fixer dispatched** (author owns his own PRs, #12328 precedent).

## Trigger — narrower than the title, and narrower than MY framing

⛔**CATCH-ALL AS THE ONLY HANDLER is the trigger — not "direct throw".** I framed it as
direct-throw-vs-via-function; the triager's 10-cell matrix corrected that: **typed catch alone
passes; typed-catch-THEN-catch-all passes** (the arg lands on the typed handler); catch-all as the
only handler fails. Target- and opt-independent (hlsl/spirv/glsl/metal/cuda, `-O0..-O3`).
⭐⭐**A fixer reading "direct throw" looks in the wrong place; "catch-all landing block has 0 params"
points straight at the gate.** Key cells: A/C3/D/H/I → 255; B/E/G/C4/F → 0.

## Root cause — two-site asymmetry; SCCP is the DETECTOR, lowering is the PRODUCER

- `slang-lower-to-ir.cpp:8965` (`visitThrowStmt`) — `emitBranch(handler.errorHandler, 1, &loweredVal)`
  passes **1 arg unconditionally**.
- `:9024-9025` + `:9043-9048` (`visitCatchStmt`) — landing block gets a param **only
  `if (catchHandler.errorType)`**; `errorType` is null exactly when `stmt->errorVar` is null, which
  **is** catch-all (`slang-ast-stmt.h:309`).
- `slang-ir-lower-error-handling.cpp:106` (the `try f()` path) **already tests
  `failBlock->getFirstParam()`** and branches with **0 args** at `:122-126`.
⇒ the `try` path got the treatment, the direct-`throw` path never did — which is exactly why the
reporter's own `try f()` contrast compiles. Consumer: `slang-ir-sccp.cpp:1279-1289`.

✅**My assert-contract hypothesis was CONFIRMED AS A MEASUREMENT, not adopted on reading:** the
triager instrumented the assert site (reverted) — failing cases print `argCount=1 paramCount=0`;
**5 passing controls print zero mismatches.** ⭐⭐**I supplied a plausible reading and explicitly
labeled it unverified; the value came from the peer refusing to inherit it.** That is the standard —
a parent's hypothesis is an input to measurement, never a substitute for it.

## Fix — Approach A (producer-side gate), validated then reverted

```cpp
if (handler.errorType) builder->emitBranch(handler.errorHandler, 1, &loweredVal);
else                   builder->emitBranch(handler.errorHandler);
```
All 11 cells compile; slangi semantics `before → in-try → in-catch → after`, post-`throw` correctly
unreachable, typed catch still receives 42/99 incl. nested catch-all-inside-typed. Regression:
error-handling 34/34, language-feature 2190/2190, tests/bugs 640/640.

⛔**Rejected B (always give the catch-all landing block a param)** — a catch-all can receive
*unrelated* error types (`catch-all.slang:18`/`:43` funnels `MyError1` **and** `MyError2` into one
handler), so one typed param forces an existential/`anyValue` box or per-type adapter blocks to carry
a value the handler **cannot observe** (`throw` always requires an expression,
`slang-parser.cpp:7579` ⇒ no bare re-throw can reach it). ⛔**Rejected C (loosen the SCCP assert)** —
masks a real SSA violation; `slang-ir-util.cpp:1770` assumes the same agreement.

## ⛔ #12362 — SEPARATE 1-line defect in the SAME function; orthogonality MEASURED

**#12362** "Do-catch that has catch handlers but may also throw hangs the compiler", skiminki-nv,
filed **08:11Z mid-triage**, OPEN, `Dev Opened` + `reproduced`, 1 nv-slang-bot comment.
`findErrorHandler` (`slang-lower-to-ir.cpp:834`) increments **`handler = context->catchHandler->prev`
instead of `handler->prev`** ⇒ the walk cannot advance past the 2nd handler (MINE-verified at source;
the loop is `for (auto handler = context->catchHandler; handler != nullptr; handler = context->catchHandler->prev)`).
Needs ≥2 non-matching handlers — matches his own words.

**Two-way differential (triager's, measured):** patching **only** the increment turns #12362's repro
124 → 0 **while #12361 still ICEs 255**; fixing only #12361 leaves #12362 hanging. ⇒ two independent
one-line defects in one function, orthogonal fixes, **neither a dup** (hang vs assert, different line).
Posted on #12361's verdict (fragment 14) so nobody merges them.
⭐⭐⭐**Twice in one day a shared *surface* (same function, same author, same week) was mistaken for a
shared *cause*, and only a two-state differential separated them** — cf. #12343-vs-#12361. **Same
function is weaker evidence of sameness than it feels.**

⭐⭐⭐**#12362 was found only by RE-RUNNING DEDUP AFTER THE CRITIQUE STAGE.** The original sweep was
scoped to an assert-in-SCCP ICE and **structurally could not see a hang**; `findErrorHandler in:body`
returned 0 and read as confirmation. ⇒ **a reviewer's adjacent finding is a NEW claim carrying its own
dedup obligation** — dedup is per-claim, not per-issue. `catch handler hang in:title` is what found it.

## Adjacent, reported NOT folded in

- **IR validator gap:** `validateCodeBody` (`slang-ir-validate.cpp:342`) checks branch targets are in
  the same code body but **never compares branch arg count/types against target params** — which is
  why this class reaches whichever later pass walks it. Suggested as its own issue (verdict fragment 15).
- Stale comment `slang-lower-to-ir.cpp:610` claims the handler block takes an `errorType` param
  without noting it only does so when `errorType` is non-null.

## ⚠️ Method warnings — inherited, worth propagating

- ⛔**`-dump-ir` yields an EMPTY file on an aborting compile** (routes via `DiagnosticSinkWriter`,
  never flushed) — same limitation hit on #12343. **Instrumenting the assert site is the way in.**
- ⛔⭐⭐⭐**TWO STALE-BINARY NEAR-MISSES, one of which would have published a false contradiction of the
  reporter** — a `cp` restored pristine *source* while the *binary* still carried the fix, so #12362's
  repro read "clean compile" (i.e. nearly told skiminki his own repro doesn't reproduce). Separately a
  working-tree edit was **silently reverted mid-session** by a sibling running the standing
  `git reset --hard origin/master` on the **shared clone**. ⇒ **`git diff` answers about SOURCE and
  says NOTHING about the BINARY; mtime is noise after any reset; `slangc -v` is CONFIGURE-time.**
  Establish freshness **behaviorally** (HEAD is #12328 ⇒ a semicolon-less `throw` must be rejected)
  and **bracket every run with a guard probe whose expected result is FAILURE.**
- ⚠️**`/tmp` was wiped externally mid-session**; artifacts moved to `/workspace/agent/scratch-12361/`.
  ⚠️**The shared clone is NOT pinned:** I found local HEAD at **`d2b405d31`** (#12252, 07:09Z) — one
  commit *ahead* of the triage SHA `19d1d4065`, which is an ancestor. Re-check `git rev-parse HEAD`
  before quoting any "verified at" SHA of your own.

## RESUME

**RESUME = maintainer call on the one-line producer-side gate, or skiminki-nv opens his own PR.**
Nothing owed by us. If a PR appears, check it doesn't silently fold in #12362's increment fix.

Related: [[project_12343_catch_interface_exception_cfg_merge_hang]] (adjacent, separate cause),
[[project_12330_entrypoint_throws_not_diagnosed]] (**orthogonal — settled by cell C3**),
[[project_12326_generated_mirror_nightly_break]] (same HEAD), [[project_12326_throw_statement_missing_semicolon]].
