---
name: project_12238_generic_selector_over_rejection
description: "PR #12246 (reject non-integer switch condition) over-rejects: E30607 also fires on a generic/associated/struct selector including `T : IInteger`. Approver ABSTAIN_POLICY:OPEN_GAP 08-04, Main-corroborated on an independent baseline binary. Awaiting a human call on whether the narrowing is intended."
metadata: 
  node_type: memory
  type: project
  tags: 
    - slang
    - 12238
    - 12246
    - switch
    - generics
    - approver
    - open-gap
  originSessionId: 7c60dd16-8d5c-4bb3-b934-5056a88a40a4
---

# #12238 / PR #12246 — E30607 over-rejects a generic-typed switch selector

**State 2026-08-04:** `slang-pr-approver` recorded **ABSTAIN_POLICY / `OPEN_GAP`** at head
`f3b5b511886d`, mode `live_late`, policy `v0-shadow-relaxed`, source tier Devin-only
(harvest exit 20 — production review skips bot-authored `fix/issue-12238`). Nothing posted to
GitHub. Ledger row `(shader-slang/slang, 12246, f3b5b511886d)`.

## The finding

The PR replaces a `TODO(tfoley)` in `visitSwitchStmt` (`slang-check-stmt.cpp:403`) with an early
reject:

```cpp
auto conditionType = stmt->condition->type.type;
if (conditionType && !as<ErrorType>(conditionType) &&
    !isValidCompileTimeConstantType(conditionType))
{
    getSink()->diagnose(Diagnostics::SwitchConditionNotInteger{...});
    return;
}
```

**The predicate is the whole story** (`slang-check-decl.cpp:12071`):

```cpp
bool SemanticsVisitor::isValidCompileTimeConstantType(Type* type)
{ return isScalarIntegerType(type) || isEnumType(type); }
```

- `isScalarIntegerType` → `as<BasicExpressionType>(unwrapModifiedType(type))`, else **false**.
- `isEnumType` → `as<DeclRefType>` then `as<EnumDecl>`, else **nullptr**.

A generic type parameter `T` is a `DeclRefType` whose decl is a `GenericTypeParamDecl`, **not** an
`EnumDecl` and **not** a `BasicExpressionType` ⇒ **both branches false ⇒ E30607**. So `switch` over
`T : IInteger` — a parameter *constrained to be an integer* — is newly rejected. Same for an
associated type and a plain struct. This is a **structural** consequence of the predicate, verifiable
without building anything.

## Main's independent corroboration (different instrument than the approver's)

The approver built slangc at the pinned head. I did **not** rebuild; I used the **pre-existing
`build/Release/bin/slangc`** and first established which side of the change it represents — the
honest version of "which binary am I holding":

- working tree: `grep -n 'SwitchConditionNotInteger' source/slang/slang-check-stmt.cpp` → **absent**
- binary: `strings … | grep -ci 'must be an integer or enum'` → **0**, with a **non-zero control**
  (`grep -c 'error'` → 13, so `strings` works)

⇒ it is a genuine **pre-PR baseline**. Results (`-target hlsl -entry main -stage compute`):

| probe | baseline result |
|---|---|
| `switch (t)` where `T : IInteger` | **compiles clean, rc=0** |
| `switch (sel(t))`, default-only, side-effecting selector | **clean, and emits BOTH writes** |
| ordinary `int` / `enum` / `typedef int` switches | clean (positive control) |
| `switch (float)` | clean at baseline = exactly the #12238 bug (negative control) |

The decisive emit, from the default-only generic switch:

```hlsl
outputBuffer_0[int(1)] = MyInt_code_0(t_0);   // selector still evaluated
outputBuffer_0[int(0)] = int(42);             // default body still runs
```

⭐⭐**This is what kills the "degenerate no-op" defence.** A `default:`-only `switch` is *not*
semantically empty: the selector is evaluated (observable side effects) and the default body
executes. Code of this shape can be load-bearing, so rejecting it is a real language narrowing.

## Why ABSTAIN and not BLOCK/APPROVE — and why I agree

csyonghe **APPROVED at this exact head** (`commit_id` = `f3b5b511886d`, verified via
`pulls/12246/reviews`), which genuinely resolves the reject-vs-coerce **design fork** that the
#12238 chain said not to pick unilaterally. So this is **not** the "unresolved design fork"
precedent. But the PR body, the review, and the threads discuss only `bool`, `uint64_t`, and
`float`; the generic/associated/struct narrowing is **nowhere mentioned**.

⭐⭐**Reading a sign-off on the *intended* change as a sign-off on an *unintended* narrowing is a
round-up.** Abstaining costs one human glance; approving silently ships a language restriction no
reviewer discussed. Correct call. `ATTRIBUTABLE_TO_DIFF: no` for the CI failures — the abstain is
about language semantics, not CI.

**Open question for the human:** should the predicate accept a type parameter whose constraints
guarantee an integer, or defer the check to specialization (where `T` is known)?

⭐⭐**Why the constraint is invisible at the predicate — and why this makes the fork WELL-POSED
rather than open-ended** (Main-derived, approver-confirmed independently via deepwiki): the checker
type-checks a generic body **at its definition site**, before specialization. At that point the
selector's type is still a `DeclRefType` over `GenericTypeParamDecl`, and the predicate is keyed on
**representation** (`as<BasicExpressionType>` / `as<EnumDecl>`) — so `T : IInteger`'s conformance is
never consulted. The rejection is therefore **architecturally consistent AND over-broad; those are
not in tension.** The fork reduces to exactly two options: consult the conformances at the check, or
defer the check to where `T` is known.

## Process lessons from this decision (both tiers, same shape)

⭐⭐⭐**Two inferred-then-relied-upon premises in one afternoon, in opposite directions.** Mine:
"zero diagnostic text" inferred from a summary line, restated as observation
([[feedback_a_discriminator_is_a_claim_about_a_log_run_it]]). The approver's: the default-only
switch "is a semantic no-op," inferred and then used as the severity basis in an artifact where
every other load-bearing claim was measured. Its own DECISION_REVIEW attacked exactly that premise
and it **tested rather than deferred**, which inverted WOULD_APPROVE → ABSTAIN.

⭐⭐**Peripheral rigor manufactures confidence in the unmeasured center — and it fired on the tier
that was applying the rule outward.** The approver re-derived the Falcor flake, corrected my
discriminator, and built an off-diagonal control, all while the one sentence carrying the severity
call sat unmeasured. **The direction that reduces scrutiny receives the least.**

⭐**Corpus-sweep scoping:** its "0 instances across 196 switches" searched only `default:`-only
switches — **narrower than the class**, so it was true of the query, not the class. A count
authenticates a command over a scope; name the scope.

⭐⭐**A structural read beat a 40-minute build.** The approver reached the finding by building slangc
at the head and diffing 14 probes; the predicate is **total**, so `isValidCompileTimeConstantType`'s
two `as<>` casts settle it by inspection. **When a predicate is total, reading beats running** — the
build is corroboration, not the instrument of first resort. (The empirical pass still earned its
keep: it produced the emit showing the switch is not a no-op, which no amount of reading would have
surfaced.)

⭐⭐**The approver's own tell for the next case, worth adopting:** *"every other claim in that
artifact cited a file:line or a command; that one cited nothing."* **A sentence with no instrument
behind it, sitting in a document where everything else has one, is the sentence to attack.** That is
a cheap structural check on your own output — not a matter of vigilance.

⛔**My defect in this exchange: I credited the finding as its probes `sx2`/`sx3` — those were MY
`/tmp` scratch filenames; its probes are `sx1`/`sx2` and no `sx3` exists.** Label drift, not
substantive disagreement, and it never reached this memo (which describes shapes in prose). See
[[feedback_never_cite_a_peers_artifact_by_your_own_local_name]] — **reproducing a finding does not
license naming the artifact.**

## Diagnostic message vs predicate — a real (cosmetic) discrepancy, Main-adjudicated

The approver ran its own citation-uniformity tell against its own `investigation.md`, caught an
uncited sentence there ("the predicate is exactly integer-or-enum"), and instrumented it. **Both its
cites check out and the finding is correct:**

| claim | instrument | result |
|---|---|---|
| predicate accepts integer **or bool** or enum | `slang-check-decl.cpp:12045` (local, pre-PR) | ✅ verbatim: `return isIntegerBaseType(baseType) \|\| baseType == BaseType::Bool;` |
| message says only "integer or enum" | PR diff, `slang-diagnostics.lua` | ✅ verbatim: `"'switch' condition must be of an integer or enum type, but is of type '~type:Type'"` |

⭐**Polarity is what makes it cosmetic, and it must be stated or the finding reads as a bug:** `bool`
**satisfies** the predicate, so a bool switch is **accepted and never diagnosed**. The discrepancy
runs toward *permissiveness* ⇒ **no shader is ever rejected with a wrong explanation.** The bool
carve-out is the deliberate #12237 accommodation (accept-and-legalize). Not a decision input.

⭐⭐**A `file:line` cite is SHA-RELATIVE.** Its `slang-diagnostics.lua:3377-3382` resolves to
*unrelated content* on my pre-PR tree — because the PR **adds** that block (`@@ -3374`, +7 lines).
The cite is right post-PR. ⇒ **when a cite lands on unrelated content, establish which side of the
change your tree is on before calling it wrong**; and pair line numbers with the symbol name, which
survives renumbering.

## Calibration join (agreed with the approver)

If #12246 **merges unchanged**, that is a **clean withhold**, not a false-safe — the abstain routed a
real unreviewed narrowing to a human who accepted it. If a **follow-up addresses the
generic/struct/associated class**, the abstain is vindicated. Either way the row joins against the
human verdict at merge/close; neither outcome retroactively makes ABSTAIN wrong.

Related: [[project_12238_float_switch_condition_invalid_spirv]] ·
[[project_12237_bool_switch_spirv_assert]] · [[project_9999_switch_without_cases_diagnostic_fork]] ·
[[feedback_approver_never_posts_route_reviewer]]

## ✅ JOIN 2026-08-04 12:15:28Z — MERGED UNCHANGED. The ABSTAIN was a MISS, booked as one.

**Main-verified:** merged by **skiminki-nv** (the #12238 reporter), merge commit `645ac5eef2b1`, 1 commit,
same 3 files, +39/−1. **Zero** post-decision reviews, **zero** issue comments after 08-03T17:27Z,
**zero** review threads ever created. ⇒ **no human ever addressed the generic/struct class, and nothing
moved because of it. Nobody was waiting on the question.**

⇒ **human-disagreement, NOT a clean withhold.** The approver scored it as a miss rather than claiming
the withhold-precedent, and explicitly ruled that its own "ABSTAIN on a maintainer-flagged fork →
merged = clean withhold" row does **not** cover this case (there the fork was open and pending; here
csyonghe had already resolved it and the abstain rested on a new edge of the approver's own discovery).
⭐⭐**Declining to shelter under your own precedent when it doesn't fit is the behaviour that makes a
calibration ledger worth keeping.**

### ⭐⭐⭐ The real lesson: SEVERITY ≠ EXISTENCE. The gap was real and still not decision-relevant.

Everything measured held up — `T : IInteger` genuinely rejected, confirmed on two compilers by two
tiers. **All true, and not a reason to withhold.** The approver's own three-tier severity ladder, which
it filed as the correction:

| tier | shape | correct disposition |
|---|---|---|
| **(a)** | already failed **pre-PR** ⇒ not a regression at all | not a finding |
| **(b)** | compiles today but degenerate / semantically broken | advisory + name the follow-up |
| **(c)** | compiles today, sane pattern, plausibly shipped | `OPEN_GAP` |

It filed the whole class as (c); it was mostly (a) and (b).

✅**MAIN-VERIFIED TIER (a), on my pre-PR binary — and it collapses most of the class in one command:**
a generic switch carrying an integer `case` label **already** failed before this PR:
`error[E30019]: type mismatch in expression — expected an expression of type 'T', got 'int'` (rc=255).
⇒ **the (a) check costs one compile and should run FIRST**; only the *no-case-label* residue survives it.

✅**MAIN-VERIFIED corpus sweep, WIDER than the approver's** (it swept only `default:`-only): **184 switch
sites** across `tests/` + `source/slang/`, of which **2** have no `case` label — both in
`tests/bugs/empty-switch.slang`, both with **`int` selectors**, which the predicate still accepts. ⇒
**ZERO instances of the newly-rejected class anywhere in the corpus**, which independently supports the
maintainer's (b) placement.

### ⭐⭐⭐ The answer was written in the repo as a comment, and both tiers reached it by building a compiler

`tests/bugs/empty-switch.slang:17-18`, in-tree, predating all of this:

> `// This is kind of silly - but it is a valid construct.`
> `// We want to check condition expression is executed though`
> `switch (++a) { }`

That is the project stating (i) a case-less switch **is a valid construct** and (ii) **the condition
expression is executed** — i.e. exactly the refutation of the "semantic no-op" premise, and exactly the
"is this a sane shipped pattern?" evidence. The approver reached it by compiling at the PR head; I
reached it by compiling at baseline. **Neither of us grepped the test corpus for the shape first.**
⭐⭐**A repo's own test comments are a cheap authority on whether a construct is intended — check them
before building a compiler to find out.**

### Two things underweighted (approver's own list, recorded because they generalize)

- **The PR's PURPOSE was to narrow.** An over-narrow edge on a deliberately-narrowing change is a
  follow-up, not a blocker.
- **It already carried `pr: breaking change`.** Maintainers had pre-signed for breakage; "slightly wider
  than the body describes" sits inside that envelope.
- ⭐**"Undiscussed on the PR" correctly RAISES a question but carries NO severity** — maintainers
  routinely don't enumerate edges they find acceptable. The narrower rule survives: don't read an
  approval of the intended change as blanket sign-off on an unintended one.

### ⭐⭐⭐ Where the failure actually sat — and it breaks the tidy ending we'd both endorsed

DECISION_REVIEW correctly killed the over-permissive "no-op" premise. The approver then went to the
**conservative extreme instead of re-running the severity tiers on the corrected facts.**
⇒ ⭐⭐⭐**A refuted "clear" does not imply "withhold" — it implies RE-DERIVE.** The miss was not the
retraction; it was **the second judgement, made in the correction slot.**

⛔**This retires my closing frame.** I had endorsed "every defect this session lived in CI attribution,
while the decision rested on source-and-binary and never moved." **False:** the correction-slot failure
hit the *decision itself*. The pattern is not evidence-class-specific — **it is a property of the
correction slot**, which held for five of my claims and for the approver's verdict alike. See
[[feedback_a_phantom_correction_deletes_true_evidence]].

### ⭐⭐⭐ STRENGTHENED 12:25Z — the test does not merely COMMENT, it ASSERTS (and one scope limit)

Main-verified: `tests/bugs/empty-switch.slang.expected.txt` contains **`1 2 3 4`**, and the shader is
`int a = index; switch (++a) {} switch (index) { a += 10; } outputBuffer[index] = a;` under
`//TEST(compute):COMPARE_COMPUTE_EX` on **four** backends (`-slang`, `-vk`, `-cpu`, `-cuda`).

**The arithmetic is a bound, and it pins BOTH claims at once** for `index = 0..3`:

| if… | buffer would be |
|---|---|
| `++a` **not** evaluated | `0 1 2 3` |
| pre-case `a += 10` **did** run | `11 12 13 14` |
| **actual expected** | **`1 2 3 4`** = `index+1` |

⇒ **only satisfiable if the case-less switch's selector IS evaluated and the pre-case statement is
NOT.** So this isn't the project *stating* an intent in prose — it is a **maintainer claim kept true
by machine on four backends**, which outranks both tiers' hand-built probes. The file is untouched by
#12246 (diff = `slang-check-stmt.cpp`, `slang-diagnostics.lua`, the new diagnostic test only).

⚠️**SCOPE LIMIT — Main's, and it must travel with the finding.** The test's selector is `int`, which
the predicate accepts, so **the test never regresses under this PR**. Its authority therefore covers:

1. ✅case-less `switch` is a **valid construct** and its **selector is executed** — machine-enforced.
2. ✅⇒ the "semantic no-op" premise is **refuted**.
3. ⛔**NOT established:** that a *generic-selector* case-less switch is an intended shipped pattern.
   That remained a judgement call, and a maintainer placed it at tier (b).

⭐⭐**Don't let a strengthened finding over-reach.** The test is decisive about the construct and
silent about the generic case — conflating the two would repeat the round-up this whole chain is
about.

⭐⭐⭐**Cost, measured on my own clone: `git grep -lEi "valid construct" -- 'tests/**/*.slang'` →
`real 0m0.031s`** (the approver measured 0.065s on theirs) **versus a ~40-minute compiler build.**

⭐⭐⭐**The root cause is a QUERY-TARGET error, not diligence** (approver's diagnosis, and it is the
sharpest thing in the chain): **it grepped the corpus for SHAPES — counting `switch` sites and
`default:`-only forms to bound blast radius — and never grepped for INTENT PROSE about the shape. Two
different queries; it ran one and believed it had searched.** Ladder now filed: **(1)** grep test
comments for intent language → **(2)** look for an executable assertion + its expected data →
**(3)** check whether the shape already fails pre-change → **(4)** only then build the changed
compiler. Both of us ran (4), then (3).

⭐⭐⭐**General form, the most portable lesson here: REACHING FOR THE MOST RIGOROUS INSTRUMENT IS NOT
THE SAME AS REACHING FOR THE RIGHT ONE.** A 40-minute build that confirms a 31ms grep is not rigour —
it is a search that was never run. This is the standing "SEARCH THE STORE BEFORE DERIVING" rule with
the target swapped from the learnings store to **the repo's own test corpus**, and neither tier
recognized it in the new clothes ⇒ **when a rule has a target, enumerate the targets it applies to.**

**Cost accounting:** one human glance not taken, ~2h of no-op, nothing posted to GitHub. Cheap — and the
asymmetry still favours over-abstaining over a false-safe. **Booked as a miss anyway.**
