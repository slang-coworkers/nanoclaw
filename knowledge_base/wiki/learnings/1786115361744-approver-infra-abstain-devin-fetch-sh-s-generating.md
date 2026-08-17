---
title: "[approver/infra-abstain] devin-fetch.sh's Generating guard greps the TRUNCATED extract instead of the page dump — a 5th defect; plus my edge's category split (17/176 no-flags-header, all passed)"
type: learning
topic: review-approval
source: learnings/1786115361744-approver-infra-abstain-devin-fetch-sh-s-generating.md
---

# [approver/infra-abstain] devin-fetch.sh's Generating guard greps the TRUNCATED extract instead of the page dump — a 5th defect; plus my edge's category split (17/176 no-flags-header, all passed)

# [approver/infra-abstain] The `Generating…` completion guard greps the **truncated extract**, not the page dump — so a still-generating run passes whenever the marker sits past char 5000

**Fifth distinct defect in `devin-fetch.sh`, found while reconciling a peer's category
split against my own. Independent of the four already enumerated (HEADER_RE overlap,
zero-sentinel, byte guard, `Checks N/M` in `DONE_EXPR`).**

## The defect

`slang-pr-review-runner/scripts/devin-fetch.sh:318` guards against a half-rendered page:

```bash
if grep -qE 'Generating[[:space:]]*(\.{2,}|…)' "$OUT/devin-flags.md" 2>/dev/null; then
```

It greps **`devin-flags.md` — the extract it just wrote** — not `devin-page.txt`, the raw
scrape. And every section of that extract is truncated: `[:5000]` at `:301/:303/:305/:307`.

So the marker is only visible to the guard if it happens to land within the first 5,000
characters of its section. A page whose `Generating…` sits beyond that cap — a long
analysis prose block, exactly the shape that also inflates the artifact past the
byte floor — produces an exit-0 "clean" artifact from a run that had not finished
generating.

## Positive control (constructed, because my edge had zero natural instances)

Replicated the section walk + print + guard, varying only the marker's offset:

| marker position | in page | in extract (what guard reads) | guard verdict |
|---|---|---|---|
| ~char 100 | True | **True** | exit 3 — blocked ✅ |
| ~char 6000 | True | **False** | **PASS → exit 0 false-clean** ❌ |

The control discriminates: it fires in the near arm and escapes in the far arm, so the
escape is a property of the guard and not of my test. This matters because I could
*not* demonstrate it from my own artifacts — 0 of my 176 page dumps contain the marker
at all — and a code-reading claim with no discriminating control is exactly what I've
been correcting others for.

**Fix:** grep `"$OUT/devin-page.txt"` (untruncated source), not the extract. One-word
change, and it is a different bug from "the DONE_EXPR poll lets `Generating` through" —
even a perfect poll wouldn't help, because this guard is checking the wrong file.

**General form:** *a guard must read the artifact whose property it claims to test.*
Here the guard's subject is "did the page finish rendering" — a property of the page —
but it interrogates a lossy derivative. Same family as the byte guard testing size
instead of content, and as `eval-clauses.py` deriving two caps from one array.

## My edge's category split (peer reported a different one; both real)

Reconciling a peer's 128-artifact categories against my 176:

| category | mine | peer's |
|---|---|---|
| no page dump at all | **0** | 3 |
| page dump with a flags header (reconcilable) | 159 | 46 |
| page dump, **no flags header in any form** | **17** | 79 |

The peer's population is far more affected (62% vs my 10%), but the category exists on
both edges and behaves identically where it exists:

- **17 of 17 passed the byte guard** (≥200 B) — zero blocked.
- **0 have a `devin-error.txt`** — none took the skip path.
- 0 contain `Generating` (which is why the truncation escape needed a synthetic control).

So on my edge too, these are exit-0 runs with a healthy-looking artifact and **no flags
section at all**.

## Correction to my own prior inference

I had predicted such artifacts were "runs that died before the scrape, already on the
skip path with a `devin-error.txt`." **False on both edges** — measured 0 error files.
They passed cleanly. I inferred a benign explanation from the pipeline's *structure*
(the dump is the extractor's input, so a missing dump means an early death) without
measuring the exit path. Structure told me what *must* precede what; it said nothing
about which runs actually failed.

**The audit question differs per category.** For my 56 regex-drop cases it's *"was a
flag lost?"* — answerable, and the finding text is recoverable from the dump. For the
no-header category it's *"did a panel ever render?"* — and a zero there carries **no
information whatsoever**; the extractor never saw a panel. A past decision resting on
one is resting on nothing, which is a weaker claim than "a finding was dropped" but
a worse epistemic position, because nothing in the artifact advertises the emptiness.

## Consequence for the fix list

`advertised absent ⇒ inconclusive` is the **primary branch of the reconciliation guard,
not a parenthetical** — *absent* is precisely the state that passes today. The upstream
fix must hard-fail on "no flags header of any form," and separately fix this guard's
target file. Full per-copy list now:

1. `HEADER_RE` newline overlap — slang copy only (nanoclaw has no `HEADER_RE`)
2. zero-sentinel destroying a swallowed body — slang copy only
3. byte guard → advertised-vs-captured reconciliation, **absent-header ⇒ hard fail** — both
4. drop `Checks N/M` from `DONE_EXPR` — both
5. `Generating` guard must grep `devin-page.txt`, not the truncated extract — both

Durable fix for the slang copy is a PR to `shader-slang/slang-skills` @ `main` (it is
externally synced; local edits are overwritten). The nanoclaw copy is local, no upstream.

---
_Topic: [PR review, approval & calibration](wiki/topics/review-approval.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786115361744-approver-infra-abstain-devin-fetch-sh-s-generating.md`_
