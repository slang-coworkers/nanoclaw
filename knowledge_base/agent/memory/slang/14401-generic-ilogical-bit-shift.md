---
type: chain
description: "Human-filed (JasperKr, no labels/assignees) 11-08 00:23Z: `T:ILogical` (or IInteger) generic operand rejects `>>` — 'no overload for >> applicable to arguments of type (T, uint)', although the user guide says ILogical provides all bit operations. TRIAGED 00:33Z bug/low/P2 (cmt 6715095387); core.meta.slang has no generic ILogical shift operators. Triager handed to slang-fixer (session iyvxbu). Draft PR #14402 (peer review); open maintainer question on bool-left shift overloads."
resource: raw/triage-14401.md
tags: [generics, ilogical, iinteger, operators, bit-shift, core-module]
---

# shader-slang/slang#14401 — bit shift on a generic `T : ILogical` / `IInteger`

**11-08 00:23Z issue_opened → `slang-triager` on `gh-issue-shader-slang/slang-14401`.** R6: no hold. Memory grep on
14401 had no hits; live assignees, labels, events and comments were empty; the only session on the thread was my own.

Repro (reporter, Slang 2026.21): `uint TestFunc<T:ILogical>(T first, uint second) { return first >> second; }` with
`slangc repro.slang -no-codegen`.

- **00:33Z TRIAGED** (master ae4e57957): bug / low / frontend (core module) / P2. Labels `reproduced` + Type Bug.
  Bot comment https://github.com/shader-slang/slang/issues/14401#issuecomment-6715095387 (verified, nv-slang-bot[bot]).
  - Gap: `core.meta.slang:3846-3980` has generic `T:ILogical` `& | ^ ~ ! && || &= |= ^=` but no `<< >> <<= >>=`. The concrete
    shifts (:3324-3409) need `__BuiltinIntegerType`. Same for `IInteger` and enums. Not a regression (missing since #2389, 2022).
  - Reporter error, separate: the `uint` return (`T` has no conversion to `uint`; E30019 even for `&`).
  - Workaround posted: `first.shr(int(second))` returning `T`.
  - Dedupe: none. Related #12591, #12859 (`slang.numerics` has generic shifts).
- Triager → **slang-fixer** directly (fixer session `sess-1794097943103-iyvxbu`, canonical thread, sole owner). Plan:
  four rank -10 generic shift overloads with a scalar integer amount, forwarding to `shl`/`shr`. Constraints: `bool << n`
  stays `int`; concrete shifts keep binding the intrinsics. The stale claims in `06-interfaces-generics.md:1405-1412` are
  folded into the same PR. `T >> T` per-component is out of scope (maintainer question).

- 02:10Z triager correction: the first repro used a stale Release slangc. A rebuild at ae4e57957 gives identical results,
  so the verdict, the label and the comment stand. Issue comment 6715095387 was edited 02:02Z to point at #14402 (verified).
- **Draft PR #14402** "Add generic shift operators for ILogical" (`fix/issue-14401`, `pr: non-breaking`, closes #14401),
  opened 01:53Z by the fixer. pr-mapping → fixer session iyvxbu (verified). Peer review is in flight.
  - **Open maintainer question (the PR body marks it as blocking merge):** the shift fast path promotes a `bool` operand
    to `int` (`slang-check-expr.cpp:5042`), so infix `b << n` no longer selects a user shift operator with a `bool` left
    parameter; `b + n` already behaves this way. Is that acceptable? A "no" may also bear on the `pr: non-breaking`
    label, because it changes which overload existing code binds.

Next: the fixer reports when peer review is done. Then the PR is ready-flip pending (weekly list; P2, not a regression),
and the bool question goes to maintainers on the PR.
