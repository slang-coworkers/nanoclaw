---
name: project_12452_public_header_internal_linkage_asan_odr
description: "slang PR #12452 (jvepsalainen-nv) inline constexpr -> static constexpr in include/slang.h for mixed-ASan ODR (#11927). Approver ABSTAIN_POLICY/OPEN_GAP @fe1feac57c06 after reversing WOULD_APPROVE 3x. Public bot review asserts source-compat settled by in-tree enumeration; approver measured that inference unsound (address identity changes). Ledger write DENIED."
metadata:
  node_type: memory
  type: project
  originSessionId: 42cf3398-8bf0-4455-89af-513dd730461d
---

# slang#12452 — public-header constants get internal linkage

**PR:** https://github.com/shader-slang/slang/pull/12452 · author `jvepsalainen-nv` (human
contributor) · `include/slang.h` only, **+18/−2, 1 file** · `Fixes`-adjacent to **#11927**
(downstream mixed instrumented/non-instrumented ASan ODR report).

The change: `kDefaultTargetFlags` (inside `extern "C"`) and `kInvalidCoverageCounterIndex`
(namespace `slang`) go `inline constexpr` → `static constexpr`, plus explanatory comments.

## Decision — `ABSTAIN_POLICY` / `OPEN_GAP` @ `fe1feac57c06a99d091680e79e425adec58238ab`

`slang-pr-approver`, mode `live`, policy `v0-shadow-wide`, **6/6 clauses pass**. Primary
`github-actions[bot]` review commit-matched at the pinned head (`diff_hash 602468a3c340`),
0 🔴 / 1 🟡; Devin `0 Bugs / 0 Flags` + 2 informational. So the abstain came from Step 3
(challenger), not Step 1.

**The approver drew WOULD_APPROVE first and reversed it three times under critique** — its own
report names all three as its own artifacts contradicting each other:

1. **Scope.** It had enumerated in-tree uses (0 address-taken) and read that as settling
   *source compatibility*. It does not: `include/slang.h` is public API, its consumers are not
   enumerable, and internal linkage changes **address identity**.
2. **The gap.** It cleared the review's 🟡 as "pre-existing" — a characterization the review
   never made; generalizing it would exempt the whole finding class ⇒ `OPEN_GAP` is the code.
3. **Its own measurement.** It claimed the ASan mechanism was "observed end-to-end" while its
   own table refuted that (below).

## What was measured, and what was not — the load-bearing distinction

**Measured (language-level, g++ 12 + clang 14 in-container):** the linkage transition the fix
relies on — binding goes `UNIQUE`→`LOCAL` (g++ 12) and `WEAK`→`LOCAL` (clang 14). Address
identity across 2 TUs: address comparison `same=1` → **`same=0`**; the address as a non-type
template argument yields **distinct types per TU**; odr-use from a downstream inline function
becomes **IFNDR**. ⭐**Neither compiler diagnosed any of these** — the IFNDR test *silently
printed `same=1`* by linker folding, i.e. it passed by luck. **That is the hazard, not a
refutation.**

**NOT verified:** the PR's stated ASan mechanism. On clang 14 the **pre-fix** (claimed offender)
constant is **not size-redzoned** (4→4), while the **post-fix** internal one **is** (4→32 — and
harmlessly, since `LOCAL` symbols are never cross-module ODR-compared). The approver's retracted
reading had the redzone on the wrong symbol. Its clang ASan *runtime* was absent
(`libclang_rt.asan-x86_64.a` missing) so no runtime two-TU test ran; measurements were g++ 12 /
clang 14, **not CI's clang-18**.

⛔**This is NOT a claim the PR is wrong.** #11927 is a real downstream report; the PR body does
not name its platform; the author's own `nm` verification ran on a different platform. Two
separate facts, and the approver kept them separate.

## ⚠️ Unpublished delta — the public review asserts the opposite of the approver's finding

MINE-verified via `gh api repos/shader-slang/slang/pulls/12452/reviews`, 08-10T23:5xZ. The
`github-actions[bot]` review **at the decided head** carries, in its reviewer sub-note:

> *"All 15 uses of both constants across the tree are value reads … none take the address, so
> the internal-linkage change is source- and ABI-compatible."*

That is exactly the inference the approver retracted as unsound for a public header (in-tree
enumeration cannot bound out-of-tree consumers). ⇒ **the only public footprint on this PR
asserts source-compat is settled; the measured address-identity hazard is nowhere on GitHub**,
because the approver structurally never posts ([[feedback_approver_never_posts_route_reviewer]]).
Escalated to the operator as a decision (route a COMMENT-state note via `slang-reviewer`, or
accept the shadow-mode no-footprint default) rather than self-authorizing a write that
contradicts our own bot on a contributor's PR.

## Live state at decision time (mine, 08-10T23:5xZ)

`head fe1feac57c06` · `state open` · `draft false` · `mergeable_state blocked` ·
combined status **success**, 0 non-success/non-skipped check-runs · reviews: `github-actions[bot]`
COMMENTED @`0e495235ecff`, `coderabbitai[bot]` COMMENTED @`0e495235ecff`,
`github-actions[bot]` COMMENTED @`fe1feac57c06` — **zero human reviews.** Issue comments: one
`coderabbitai[bot]`. The 🟡 gap (no regression guard; all-ASan CI at
`ci-slang-sanitizer.yml:159` cannot build the mixed pair, so a silent revert would restore the
break) **is** publicly visible in the bot review.

## Ledger

**Write DENIED** — 5th instance of the standing `APPROVAL_LEDGER_WRITERS`-unset defect on 08-10;
see [[feedback_record_decision_ok_proves_emission_not_persistence]] for the mechanism, the union
recount and the operator action. Durable artifact moved off the inbox to
`/workspace/agent/approver-decisions/slang-12452-fe1feac57c06-decision.md` (16008 B).

## ⛔ The "15 vs 19 uses" corroboration does NOT survive — population-dependent, and non-load-bearing

The approver offered, as corroboration that the reviewer's sub-note under-counts, *"it says 15
uses where my script-measured figure at that commit is 19."* **I could not reproduce either
number, and the reason is that neither names its population.** Measured on my clone
(`/workspace/agent/slang`, `findmnt` → `/dev/vda1[…/groups/main]`, master `1ca1aa50e5db`;
**control: `git diff base…master -- include/slang.h tools/ source/` is EMPTY, and base
`569520560939` is present, so my use-population for the use-bearing paths IS the PR base's**):

| population (both constants summed, code lines only) | count |
|---|---|
| excl. `./build` + `./external`, excl. `include/slang.h` | **17** |
| excl. `./build` + `./external`, incl. header's own uses | **21** |
| everything (`build/` generated copies, `external/slang-rhi`, header) | **39** |
| comment-only lines (excluded from all of the above) | 6 |

`./build/Release/include/slang.h` is an *installed copy* of the public header and
`build/prelude/*.h.cpp` are generated files embedding it — include or exclude those and the total
moves by ~18. ⇒ ⭐⭐⭐**"15" and "19" are both defensible and neither is checkable, because the
population is the whole claim and neither party stated it.** Same class as my own prefixed-vs-bare
grep recipe: the filter lives inside the command, so the result carries no signal that it narrowed.

⛔**Worse, the corroboration is self-undermining.** The approver's reversal #1 established that
**in-tree enumeration cannot bound out-of-tree consumers** — so an enumeration count is not
evidence about source compatibility *in either direction*. Citing "their 15 vs my 19" as support
re-imports the retracted inference and hands the reviewer's framing (that the count settles
something) a foothold. The sound objection is that the sub-note **generalizes from an in-tree
population at all**, not that it got the population's size wrong. ⇒ ⭐⭐⭐**When you retract an
inference, you also lose the right to use its inputs as corroboration.**

✅**What I did add that is load-bearing** (mine, same clone): the odr-use shapes a bare
`grep '&<name>'` cannot see are **also absent in-tree** — reference binding
(`const T& x = <name>`), non-type template argument (`<…<name>>`), and `decltype(<name>)` all
return zero matches for both constants across `*.h/*.cpp/*.hpp`. So the in-tree "no address-taken"
claim survives a *stronger* probe than the one the approver had published as "the whole ABI check"
(a leaf it has since corrected). This strengthens "low risk in-tree" and leaves the out-of-tree
gap exactly where it was — which is the gap the abstain is actually about.

⛔**The first version of that probe was INERT and I shipped its zeros as evidence.** My pattern
required the operator token adjacent to the *bare* name, but every real use is `slang::`-qualified,
so all four branches were unmatchable: scored **0 on a purpose-built positive control**. Corrected
form allows `([A-Za-z_][A-Za-z0-9_]*::)*`, scores **1/1/1/1 positive / 0/0/0/0 negative**, and was
then **armed in situ** — control file copied into the tree → sweep returns 1/1/1/1; removed,
`git status` clean. The tree's `0/0/0/0` above is from the *validated* probe and only means
something because of that. Full derivation: [[feedback_a_retracted_inference_cannot_supply_corroboration]].

**Resume triggers:** a human review lands (esp. one relying on the source-compat sub-note) ·
head moves off `fe1feac57c06` · merge/close (ledger join) · operator answers the posting question.
