---
title: "CORRECTION: enum:bool switch fix arm is (bool)!=0 NOT &1 — verify load-bearing claims before posting"
type: learning
topic: verification
source: learnings/1785320231054-correction-enum-bool-switch-fix-arm-is-bool-0-not-.md
---

# CORRECTION: enum:bool switch fix arm is (bool)!=0 NOT &1 — verify load-bearing claims before posting

**Supersedes the `& 1` recommendation in the earlier learning "enum:bool switch fails E39999 — TypeCastIntVal::tryFoldImpl lacks BaseType::Bool case".** The root cause in that note is correct (convertValue lacks a `BaseType::Bool` case). The recommended *fix arm* was WRONG.

**Wrong:** `case BaseType::Bool: resultValue = resultValue & 1; return true;` (I claimed `& 1` was load-bearing for tests/bugs/11043 and a C++ `(bool)` cast would be wrong).

**Correct:** `case BaseType::Bool: resultValue = (resultValue != 0); return true;` — the C boolean cast, matching every sibling case in the `convertValue` switch.

**Why (verified empirically on HEAD build 6dba5d212, prompted by slang-fixer challenging the memo):**
1. `& 1` is NOT load-bearing for tests/bugs/11043-enum-constant-wraparound.slang — that test PASSES at HEAD with no `Bool` case in `convertValue` at all. Bool enum-tag wraparound is enforced UPSTREAM by `_incrementEnumerator` (source/slang/slang-check-decl.cpp:12388-12390 sets `significantBits = 1` for `BaseType::Bool`). So `TestEnumBool.Value2` (implicit 2) is already masked to 0 BEFORE `convertValue` runs; the lambda only ever sees {0,1} for the enum-switch bug.
2. `convertValue` is the SHARED implicit-cast-to-bool fold path (slang-check-expr.cpp:2570-2571) and explicit-cast path (:3241). At HEAD `(bool)2 == true` and `(bool)4 == true`. A `& 1` arm would fold `(bool)2 → 0 → false` — an ACTIVE REGRESSION of direct bool casts. `!= 0` preserves that and is identical to `& 1` for the {0,1} values the bug actually involves.

Regression test should keep `(bool)2==true`/`(bool)4==true`/`(bool)0==false` static_asserts to lock the `!= 0` semantics.

**METHOD LESSON (the real takeaway):** I posted a load-bearing empirical claim ("`& 1` required, `(bool)` cast wrong") in a public GitHub verdict WITHOUT running the counterfactual (I never tested `(bool)2` at HEAD, and misread a SIGPIPE `EXIT=141` from `| head` as an 11043 failure). The fixer built the fix and caught the inversion. Before asserting a load-bearing tool/semantics claim publicly — especially "X is required / Y would regress" — RUN the counterfactual test. See CLAUDE.local.md correction-learning 1784...-CORRECTION (verify-or-hypothesize load-bearing tool claims). This is the second instance of that same failure mode; treat "this would regress / this is required" claims as hypotheses until a run confirms them.

---
_Topic: [Verification & evidence discipline](../topics/verification.md) · [catalog](../index.md) · source: `sources/learnings/1785320231054-correction-enum-bool-switch-fix-arm-is-bool-0-not-.md`_
