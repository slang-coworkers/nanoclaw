---
name: project_12398_compile_time_for_int32_truncation
description: "slang#12398 (OPEN, skiminki-nv self-filed 08-06) — `$for`/`Range` iterator hardcoded to `int` at slang-check-stmt.cpp:329, truncated by static_cast<int32_t> at slang-ir.cpp:2532. SECOND defect: bounds lose their Type* at slang-lower-to-ir.cpp:8102-8103 so compare/increment are signed, silently dropping a non-empty int64/uint64-crossing range. Triaged + verdict posted (comment 5207541680), labels Dev Opened + reproduced. NO fixer dispatched — design-gated on a policy call the maintainer must make, and skiminki-nv authors his own fixes. RESUME: he replies picking infer/diagnose/annotate, or opens a PR."
metadata: 
  node_type: memory
  type: project
  originSessionId: fe9784d8-7146-4882-a562-3d20a469858b
---

# slang#12398 — compile-time `$for` truncates iterator values to int32

**State as of 2026-08-06 16:47Z** (read live at that time — see
[[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]] before restating any
field below): OPEN, labels `Dev Opened` + `reproduced`, Type `Language Maturity`
(human-set by the reporter), 1 comment — the triager's verdict
[5207541680](https://github.com/shader-slang/slang/issues/12398#issuecomment-5207541680).
Title is the **retitled** form, *"…truncates the iterator values…"*.

## The two defects (I re-verified all three citations against the local clone at `d7d59f374`)

1. **Iterator declaration.** `SemanticsStmtVisitor::visitCompileTimeForStmt` hardcodes the
   induction variable: `stmt->varDecl->type.type = m_astBuilder->getIntType();`
   (`source/slang/slang-check-stmt.cpp:329`). Lowering iterates in 64-bit
   (`for (IntegerLiteralValue ii = ...)`, `slang-lower-to-ir.cpp:8120`) but materializes each
   value as `getIntValue(varType, ii)` at `:8122` with `varType == int`, and
   `IRBuilder::getIntValue` applies `static_cast<int32_t>` for `kIROp_IntType`
   (`slang-ir.cpp:2532`). ⭐`getIntValue` is **not** the defect — truncating to the declared
   type is its documented contract, stated in the comment at `:2522`. The broken invariant is
   the *caller declaring `int`*.
2. **Bounds lose their signedness in lowering.** `getIntVal(stmt->rangeBeginVal)` at
   `:8102-8103` returns the raw `int64_t` payload and **discards each bound's `Type*`**, so the
   `rangeBeginVal >= rangeEndVal` compare at `:8105` and the `++ii` at `:8120` are *signed*.
   Consequence measured by the triager at the same SHA:
   `Range(int64_t(0x7FFFFFFFFFFFFFFE), uint64_t(0x8000000000000000))` → **zero iterations,
   exit 0, no diagnostic** — a non-empty range silently dropped whole. Control
   `Range(int64_t(10), uint64_t(13))` → 3 iterations proves that zero is a real result.

Two findings that sharpen the report: the **range ordering is genuinely 64-bit**
(`Range(0x180000005, 0x17FFFFFFF)` → 0 iterations, not ~4.3e9), and the iteration **count**
is right while the **values** are wrong (`Range(0xFFFFFFFE, 0x100000002)` → 4 iterations).
`0x80000000` is corrupted despite fitting in 32 bits *unsigned* ⇒ signedness, not only width.

## Why no fix was dispatched

Not a mechanical fix — a **language-policy call**. Widening `varDecl` alone is *insufficient*:
it fixes the reported values and leaves both signedness cases broken, because compare and
increment stay signed. A domain-preserving fix must carry the range domain *through* lowering
rather than discarding it at `:8102`. And the mixed-sign edge is a genuine behaviour choice:
`Range(int64_t(-1), uint64_t(2))` emits `-1,0,1` today, whereas Slang's usual arithmetic
conversions (equal width + mixed sign → unsigned, `unifyBaseType`,
`slang-check-expr.cpp:4579`) would make it **empty**. Someone must decide that.

Also: **skiminki-nv authors his own fixes** — he adopted the #12326 recommendation as PR
#12328 within the hour. Routing the design question to him beats handing a fixer a
policy-gated patch.

Coverage gap explaining the miss: only **two** files under `tests/` use `$for`
(`tests/compute/compile-time-loop.slang`, `tests/cross-compile/compile-time-loop.slang`) and
neither exercises a 64-bit range.

## Update — 2026-08-19 17:10Z (live re-read)

Issue now **assigned to `skiminki-nv`** (was unassigned on 08-06) — corroborates "reporter
authors his own fixes"; ownership is explicitly his. Still OPEN, `Dev Opened` + `reproduced`,
design question **still unanswered** (no infer/diagnose/annotate pick from him).

New human comment `5345492489` from **`jhelferty-nv`** (MEMBER): *"@skiminki-nv Jay and I
hadn't heard of `$for` before.."* — addressed to the reporter, **not** an `@nv-slang-bot`
mention (`is_pr:false`, only `@` is skiminki). Assessed as **ambient orientation between
maintainers**, not a chain input to us: it does not contest the diagnosis, add a repro, raise
scope, or make the design call. **NOT the resume trigger.** Disposition: monitor only — no
GitHub post (unwarranted to inject the bot into a human side-thread; skiminki is present to
answer his own colleagues). No disposition change.

## RESUME

- Reporter replies picking **infer / diagnose / annotate** (+ the mixed-sign signedness
  policy) → dispatch `slang-fixer` on `gh-issue-shader-slang/slang-12398`, and note that the
  annotate option needs a **parser/AST syntax change** in `parseCompileTimeForStmt`
  (`slang-parser.cpp:6862`). ⛔**The blocker is `:6872`,
  `NameLoc varNameAndLoc = expectIdentifier(parser);`** — the header demands a bare identifier
  immediately after `(`, so `$for (uint64_t i in Range(...))` is rejected **eight lines before**
  `ReadToken("Range")` at `:6881` is ever reached. `:6881` evidences the *other* half of the
  claim (`Range` is a keyword, so there is no `Range` type to extend). Verified at
  `d7d59f374`: no type-parsing path exists in the function body — `grep -cE
  'ParseTypeExp|TypeExp|isTypeName'` over `6862..6912` = **0** (⚠️widen the window to `6858` and
  it returns 1, but the hit is `:6859` inside the *preceding* function `peekTypeName` @`:6853`,
  whose sole caller is `:8835`, unrelated to this path — scope the window to the function or the
  cell lies).
  ⛔I originally wrote this RESUME line citing `:6881` as the blocker. A fixer handed that
  would have been staring at the keyword read while the obstacle sat one statement earlier —
  a **true line welded to a claim it does not support**. See
  [[feedback_a_cite_must_match_the_field_it_evidences_not_the_topic_it_is_near]].
- Or he opens a PR himself → route to `slang-reviewer` on the same thread.

## Not a dup — nearest relative

**#11990** (OPEN): `IArray`/`IRWArray` subscript requirement is 32-bit `int`. Same *shape*
(hardcoded `int`), different mechanism (interface *requirement*, truncation at the witness
boundary, **and it warns** — 30081) and different site. The same maintainer is already
hesitant about widening a hardcoded `int` there, which is context for how this one lands.

⚠️Search trap recorded by the triager: `"$for" in:body` → 6526 hits is a **void cell**, not a
finding — GitHub tokenization drops the `$`. Aim at `CompileTimeForStmt` / `compile-time loop`.

## Process notes from this chain

- ⛔ **My dispatch quoted a stale title** — the reporter renamed the issue 13 min after I
  composed it, and the triager's draft nearly corrected a title he'd already fixed. Full
  lesson: [[feedback_a_live_artifact_read_is_a_measurement_with_a_timestamp]] (fourth
  instance).
- The triager ran codex 3 rounds; codex found defect 2 (which the triager then re-measured
  itself) and the blocker on approach A. Codex also caught a **fresh wrong line number
  injected during the rewrite** — re-resolving citations *after* composition is what caught
  it, cf. [[feedback_correction_must_sweep_whole_file]].
