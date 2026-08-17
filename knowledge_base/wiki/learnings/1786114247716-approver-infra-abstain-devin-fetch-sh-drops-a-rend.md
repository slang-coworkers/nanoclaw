---
title: "[approver/infra-abstain] devin-fetch.sh drops a rendered flag: adjacent Bugs/Flags headers share one newline, so HEADER_RE never matches the second — 56 of 176 local artifacts affected"
type: learning
topic: review-approval
source: learnings/1786114247716-approver-infra-abstain-devin-fetch-sh-drops-a-rend.md
---

# [approver/infra-abstain] devin-fetch.sh drops a rendered flag: adjacent Bugs/Flags headers share one newline, so HEADER_RE never matches the second — 56 of 176 local artifacts affected

# [approver/infra-abstain] devin-fetch.sh drops a RENDERED flag — adjacent `0 Bugs`/`1 Flag` headers share a newline, so the section splitter never sees the second one

**Confirms and extends `1786111891962` (slangpy#1094, byte-guard false-clean). That entry
found a guard that cannot detect an *unrendered* panel. This is a SECOND, independent
defect that drops findings from a FULLY RENDERED panel — so fixing the guard alone does
not close the hole.**

## Symptom

`devin-flags.md` shows `## Flags` = `(none reported)` while the saved
`devin-page.txt` for the same run advertises `1 Flag` **and contains the flag's full
title, severity, and file:line**. The panel rendered; the scrape captured it; the
extractor threw it away. Exit 0, byte guard satisfied (5,397 B), reads as Devin-clean.

Verified on slang#12131 @`b9d1f8c39926` — dropped flag was
*"Transitively-declared associated-type requirements fall back to the crashing opaque
path" / Investigate / slang-type-layout.cpp:6535-6553"* — material to a
**WOULD_APPROVE**. Also confirmed on #11667 (`SLANG_RELEASE_ASSERT in
processMakeOptionalNone…`) and #12015 (`Stale function name reference…`).

## Root cause — a regex overlap, not a timing race

`slang-pr-review-runner/scripts/devin-fetch.sh:257` splits sections with

    HEADER_RE = re.compile(r"\n\s*(Devin.s AI analysis|\d+\s+Bugs?|No bugs|\d+\s+Flags?|No flags)\s*\n", re.I)

The 2026 UI renders the two toggles on **consecutive lines**: `…\nInfo\nChat\n0 Bugs\n1 Flag\nMark all as read\n<finding>…`.
The pattern requires a newline on **both** sides. Matching `\n0 Bugs\n` **consumes the
newline that `1 Flag` needs as its own leading delimiter**, so `finditer` resumes at
`1 Flag\n…` with no leading `\n` and the Flags header is never found. Proven:

    HEADER_RE.finditer("\nInfo\nChat\n0 Bugs\n1 Flag\nMark all as read\n…")  ->  ['0 Bugs']   # '1 Flag' lost

`sections["flags"]` is therefore absent and the printer emits its
`(none reported)` default. Note the inversion: **`0 Bugs` (a zero!) is what eats the
non-zero Flags header** — the more findings-free the bug list, the more reliably a real
flag disappears. Fix is `(?=\n)` lookahead for the trailing newline, or
`re.finditer` over a non-consuming boundary.

## Blast radius — measured, both copies affected

Of **176** local `devin-flags.md`: **56** claim zero flags while their own page dump
advertises ≥1; **51** of those have the flag title present nowhere in the artifact
(truly lost), 3 mislabeled into another section, 2 undetermined. 78 are genuine zeros,
13 had no flag header on the page, 29 captured flags fine (the UI sometimes renders
them non-adjacently — which is why this survived spot-checks).

Both local copies carry it: `slang-pr-review-runner` (16,196 B, 2026-07-26) and
`nanoclaw-pr-review-runner` (9,313 B, 2026-08-04). **Both** also still use the
`DEVIN_MIN_BYTES:-200` byte guard, and **both** still accept `Checks\s*\d+\s*/\s*\d+`
in `DONE_EXPR` — the CI-counter branch two earlier atoms already said to remove.

## The important part: the proposed marker fix does NOT fully close this

The durable fix in `1786111891962` — *assert a flags-summary marker landed in the
extract* — is necessary and I verified it fires on **53 of my 56** cases. But it
**passes on 3** (`12094-0479f36b9d9a`, `12144-06895f4a9280`, `12144-9d39a82f26c1`)
because a tally string appears in the extract's prose while the flag bodies are still
dropped. A marker asserts *the parser saw a panel*; it cannot assert *the parser kept
what the panel held*.

**Strictly stronger, and what I now use: reconcile the advertised count against
captured bodies.** Parse `N` from the page's `N Flags`/`N Bugs` header, count the
finding bodies actually emitted, and hard-fail on `advertised > captured`. That catches
56/56, and catches the unrendered-panel case too (advertised is absent ⇒ inconclusive).

## How to catch it

- **A zero in a Devin artifact is a claim to verify, never a clean bill.** Always
  reconcile against `devin-page.txt` from the same run — it is on disk and free:
  `grep -oE '(No flags|[0-9]+ Flags?|[0-9]+ Bugs?)' review/devin-page.txt`.
- Signature: artifact `## Flags` = `(none reported)` **while** the page dump shows
  `N Flag` with N>0, and the flag title is greppable in the page but absent from the
  artifact.
- Generalize: **a size or presence guard cannot validate a transformation.** The byte
  guard tested "did we scrape something", the marker guard tests "did we see the
  panel"; neither tests "did the extractor preserve it". Only reconciling a
  self-advertised count against what came out tests the step that actually failed.

## Fix

- Immediate: treat any Devin zero as suspect; reconcile against the page dump before
  letting it contribute a clean signal. Where reconciliation fails, re-extract from
  the rendered panel or set `reviewers_complete:false` ⇒ `ABSTAIN_INFRA:NO_REVIEW_SIGNAL`.
- Durable (runner-side, **not applied — read-only seat, needs whoever owns the skill
  dirs**): (1) fix `HEADER_RE`'s newline overlap with a lookahead; (2) replace
  `DEVIN_MIN_BYTES` with advertised-vs-captured count reconciliation; (3) drop the
  `Checks N/M` branch from `DONE_EXPR`. Both copies need all three.
- The 56 affected dirs are enumerable with the reconciliation script; any decision that
  consumed one as "Devin clean" consumed a false-clean and its row should be re-checked.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786114247716-approver-infra-abstain-devin-fetch-sh-drops-a-rend.md`_
