# An inconclusive CONTROL means "this construction can't test it", not "the claim is false"

# An inconclusive control means "this construction can't test it", not "the claim is false"

Earned on shader-slang/slang#9866 triage (2026-08-04), where I nearly published a false negative about a
peer reviewer's correct finding.

## What happened

A codex critique claimed a parser defect also leaked through **subscript** brackets:
`Cond<arr[(1 > 2)]>` should be a parse error. I tested it with a `static const` GLOBAL array and got a failure —
but the **control** `Cond<arr[1]>` *also* failed, with `error[E39999]: expression does not evaluate to a compile-time
constant`. Correctly, I did not record the claim as confirmed. But I was about to record it as **UNVERIFIED /
"plausible but untested"**, with a note that the construct "appears untestable".

That framing was wrong, and it is a false-capability-negative — the worst class, because others act on it by
**not trying**. The reviewer then supplied a construction that works: a **LOCAL** `const int a[] = {...}` inside the
entry point. With it, the controls pass (`a[1]` OK; `a[1] @@@ 2` parse-error) and the result is decisive:
`a[(1 < 2)]` OK, **`a[(1 > 2)]` parse-error**. The claim was true all along; only my *construction* was incapable.

## The rule

When a control fails, you have learned something about **your apparatus**, not about the **claim**. Three distinct
outcomes must not be collapsed:

| control | target | conclusion |
|---|---|---|
| passes | passes | claim false (real negative) |
| passes | fails | claim true (real positive) |
| **fails** | anything | **no information — apparatus can't discriminate; go get a better construction** |

So: **never convert an apparatus failure into a verdict about the claim** — not "false", and not even
"unverified/untestable" without first asking for or building a different construction. Where the claim came from a
peer, asking them for a working construction is the cheapest move; they usually have one, because they measured it.

## Companion traps from the same session (same family — instrument, not phenomenon)

1. **A whole matrix whose baseline fails carries zero information but reads like a dramatic finding.** My first
   isolation matrix showed *every* row failing, which looked like a huge blast radius; the cause was "implicit global
   shader parameter / no entry point". Fixed by adding `static` + a real entry point. **Always put a must-pass and a
   must-fail control in the matrix and read them FIRST.**
2. **`grep -c` over an empty `git show` is `0`, indistinguishable from "absent".** I "measured" a parser gate as
   absent at `v2024.1` (**tag does not exist**) and at the initial import (**file was named `parser.cpp`, not
   `slang-parser.cpp`**). Pair every ref probe with `| wc -c` and `git ls-tree -r --name-only <ref>`.
3. **Don't publish an unmeasured comparative claim.** I wrote "C++ has the same restriction inside template argument
   lists". Measured (g++ `-std=c++17 -fsyntax-only`): `X<1 > 0>` → error, but **`X<1 >= 0>` → exit 0, ACCEPTED**, and
   `X<(1 > 0)>` → exit 0. C++ fences bare `>` only. One `g++` run would have caught it; the critique caught it instead.
4. **`slangc -v` is not proof of what a binary contains** — it printed `2026.13.1-50-g3649fb982` (a real commit, but
   an ancestor) because the version is baked at **configure** time by `cmake/GitVersion.cmake`. Verify freshness from
   the **object file's mtime vs the HEAD commit date**.

## How to apply

Before recording any negative or "couldn't test", state the control and its outcome. If the control failed, the
honest note is *"my construction X cannot exercise this because Y — needs a different construction"*, and then you go
find one. Reserve "unverified" for claims where a **working** apparatus produced no signal.
