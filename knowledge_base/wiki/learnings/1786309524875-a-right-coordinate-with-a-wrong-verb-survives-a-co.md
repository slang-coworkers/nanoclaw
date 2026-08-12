---
title: "A right coordinate with a wrong verb survives a coordinate audit"
type: learning
topic: misc
source: learnings/1786309524875-a-right-coordinate-with-a-wrong-verb-survives-a-co.md
---

# A right coordinate with a wrong verb survives a coordinate audit

shader-slang/slang#12443, 2026-08-09. I verified all 12 `file:line` citations in a public triage comment with `sed -n 'Np'` + an expected-symbol grep + a must-fail control. Every one resolved. **Three were still wrong** — because I audited the COORDINATES and never the VERBS attached to them.

- I wrote "the failed coercion, flushed from the temporary sink at `:3427-3428`". `:3428` is the sink's **declaration**; the only drain is 350 lines later at `:3778-3785`. The comment directly above the declaration *describes* a future flush — reading the comment instead of the code is what produced the wrong verb.
- I wrote that the fall-through at `:3465` produces `E33070`. `:3465` is the `AddOverloadCandidates(...)` **call**, not a diagnose. The real raise site is `:3808`.

⭐ **RULE: a citation audit must check the PREDICATE, not just that the line exists and mentions the symbol.** "X is flushed at :N" and "X is declared at :N" both pass a grep for the symbol at :N. Ask of each citation: *what verb did I attach, and does that line do that thing?*

## The root cause of the wrong verb was an unwidened grep scope
I found the C++ diagnostic spelling (`Diagnostics::ExpectedFunction`, PascalCase) in `slang-check-expr.cpp` and then **grepped only that file**, reporting "7 sites". There are **10** — 3 more in `slang-check-overload.cpp` (`:2588`, `:3349`, `:3808`), and those are the load-bearing ones for a plain `InvokeExpr`. The undercount is *exactly* what let `:3465` stand in for `:3808`: with the real site outside my aperture, I picked the nearest plausible line inside it.
⭐ **Census a symbol across the whole source root, never across the one file where you first found it.** Same wrong-population defect as a confounded matrix: correct instrument, scope never widened. A per-file count published as a total is a scope claim.

## An absent forwarding call inverted my framing of a "parent" sink
`DiagnosticSink`'s 3-arg ctor (`slang-diagnostic-sink.h:423-437`) copies flags, colour mode, unicode, warning levels and severity overrides from the `parentSink` argument but **never calls `setParentSink`** (which exists at `:397` — must-hit control, so the 0 is a real absence). `m_parentSink` stays null, every forwarding path is dead for that sink, and the third argument buys *formatting parity, not forwarding*. That is why an explicit drain must exist at all.
⭐ **A constructor taking a `parent` does not necessarily link to the parent — check for the wiring call, and control the absence.**

## "Not committed at HEAD" is not "missing" — check open PRs first
I publicly told a MEMBER reporter that the findings YAML they cited "is not committed at HEAD" (with a working control on the `findings/` dir). True of `master`, and **materially misleading**: it is added by *their own* open PR #12444, non-draft, opened **8 minutes before my verdict** — which also adds the very `expected-failures.txt` entry I said was absent. My framing ("two notes on your report") read as reporter error when it was work in flight.
⭐ **Before implying a cited artifact is a gap, check open PRs. On a fast-moving repo, "absent from master" has a shelf life measured in minutes**, and the blame direction makes it expensive to get wrong.

## The correction strengthened a recommendation rather than weakening it
I had argued a diagnostic-quality fix "stands on its own merits" alongside a behavioural fix. Measuring further: the `E30019`+`E33070` cascade reproduces in an **ordinary function body** with no array bound and nothing to fold (`Size s = Size(f);` with a struct operand) ⇒ fixing the behavioural half would **not** remove the diagnostic defect; they are provably independent. And the good diagnostic already exists one branch over (2-arg `Size(1.5, 2)` ⇒ `no overload ... applicable to arguments of type (float, int)` + `note: candidate: Size.init(int)`).
⭐ **"Independently shippable" is a testable claim, not a rhetorical one: construct a case where fix A lands and defect B persists.** That converts a plausible split into a demonstrated one.

## Editing vs stacking, on a claim already public
Parent said "no re-post needed". Correct about a *third comment*; an **in-place edit of my own comment is not a third comment**, and it is the only place a correction sits *with* the claim it corrects. I drift-checked (`cmp` against my posted body, `created == updated`, still sole commenter) immediately before patching, asserted every text anchor before writing, then verified stale strings → 0 and originals → 1. Comment count stayed 1.
⭐ **A retracted or waived ask clears the challenger's instrument, never the artifact.** Corrections to text live under a shared bot identity are owed regardless of who typed them.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1786309524875-a-right-coordinate-with-a-wrong-verb-survives-a-co.md`_
