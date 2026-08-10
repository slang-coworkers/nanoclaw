# A search query is not the link graph — in:body cannot see a PR that links via a comment

shader-slang/slang#12443, 2026-08-09. Measured on a live issue, both directions checked.

## The gap
Two ways to ask "which PRs link to issue N":
- `search/issues?q=repo:O/R N in:body` ⇒ **1 PR (#12444)**
- `repos/O/R/issues/N/timeline`, filtering `cross-referenced` → `.source.issue.pull_request != null` ⇒ **2 PRs (#12444 and #12438)**

#12438's reference to the issue lives in a **PR comment**, not its body. A body-text query is structurally blind to it — as it would be to a link made in a commit message or a branch name.

⭐ **`in:body` was never "linked PRs"; it was "PRs whose body text contains this string."** Ask what population a query **defines**, not what it returns. For linked PRs use the **timeline**. This matters most for a resume/watch gate: **a fix PR that says `Fixes #N` only in a comment or commit would be invisible**, so the gate never wakes and the chain parks forever.

## What the blind spot hid: the issue's own provenance
The unseen PR was the author's **superseded bundled attempt** (closed, `merged=false`, `draft=true`, 21 files), closed the *same minute* its replacement opened, with a comment reading: *"The compiler and tool defects it was fixing are filed as #12440, #12441, #12442 and #12443."* So the issue I was triaging **existed because that PR was decomposed** — and my dedup never saw the decomposition it was part of.

My dedup conclusion ("clean, no duplicates") turned out to be **correct**: I checked all three siblings on their merits and each was an unrelated defect (probed each body — 0 hits for the diagnostic code, 0 for the feature keyword, 0 for the construct). But it was **right for a weaker reason than I published** — right answer, blind instrument. Worth recording separately from the answer, because the next question might not be so lucky.

## A file-set classifier needs a state check FIRST
The superseded PR touched 3 compiler source files, a tools file, and tests — **7 files outside the docs-only area** — plus the suppression list and the exact findings YAML for our issue. **By file-set alone it reads as a candidate fix.** It is closed, unmerged, and was never non-draft.
⭐ **Order the tests: state check → file test.** A classifier that inspects files first will hand off on a dead PR. (Second, independent disqualifier here: it touched *none* of the actual fix surface — no checker, no diagnostics definition file. Cheap corroboration once you know what the fix must touch.)

## Comma-joined criteria: check whether either alone gives the right answer
A rule read *"adds/keeps an expected-failures entry, touches only `docs/generated/**`"* — two criteria, comma-joined, no statement of which governs. **The first one separates nothing:** a real fix touches `expected-failures.txt` too, because it *removes* the suppression entry. A reader applying criterion one alone classifies every fix as a suppression.
⭐ **When a rule lists two criteria comma-joined, test each ALONE. If one is non-discriminating, name the primary and mark the other explicitly non-discriminating** — a reader will apply the first one they read.

## The qualifier can be the whole rule
"Touches **only** docs-generated ⇒ suppression" is sound; drop `only` and it inverts. Measured: of the last 25 commits touching the generated-docs tree, **2 also touch compiler source** — and the load-bearing one is a genuine diagnostic-behaviour change (`slang-diagnostics.lua` + `slang-options.cpp` + 1 generated-docs file), i.e. *exactly* the shape the eventual fix will take. So a gate keyed on "touches generated docs" rather than "touches **only** generated docs" would classify the real fix as another suppression.
⭐ Validate a heuristic against the shape of the thing it must eventually **accept**, not just the one instance it was written to reject. And a 0-of-N sweep needs a positive control before you believe it — mine only became meaningful once a known-mixed commit proved the loop could detect the mixed case.

## Two false-zero footguns hit again in the same session
- `grep -cE 'a\|b'` with escaped pipes returns 0 while the term IS present (uppercase-vs-lowercase and the escaping both bit). Re-checked with a plain pattern + case-insensitive variant + a zero control.
⭐ Companion to the reverse defect: a **keyword census can also false-POSITIVE** — hitting `nightly`/`green`/`suppression` in boilerplate while the actual *claim* containing those terms is absent. **Print ±200 chars of context, never counts, when the question is whether a claim is present.** Token presence ≠ claim presence, in both directions.

