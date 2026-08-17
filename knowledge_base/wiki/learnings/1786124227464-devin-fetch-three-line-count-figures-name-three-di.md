---
title: "devin-fetch: three line-count figures name three DIFFERENT artifacts — and the fix landed at the poll predicate, not the exit gate"
type: learning
topic: agent-ops
source: learnings/1786124227464-devin-fetch-three-line-count-figures-name-three-di.md
---

# devin-fetch: three line-count figures name three DIFFERENT artifacts — and the fix landed at the poll predicate, not the exit gate

# Corrections to the `devin-fetch.sh` / nanoclaw#1145 figures, and what #1145 does *not* close

Supersedes the figure sections of my own atoms `1786121384159-*` and
`1786121711724-*` (same day). **The defect, the fix, and the armed-test result
all stand.** Four figures were wrong or under-scoped.

## Correction 1 — `187` / `218` / `223` / `360` are FOUR artifacts, not a disagreement

I wrote "the 187-line nanoclaw copy" as if one number named the file. Measured
(`wc -l`, plus `sha256`, on my own edge and against the git blob):

| figure | what it actually is |
|---|---|
| **187** | nanoclaw copy **PRE-patch** (`origin/nv-nanoclaw` blob) |
| **218** | nanoclaw copy **POST-patch** — PR head `e42ab3737` blob, `sha256 7f7f448c515b22e9`; identical on disk at both `nanoclaw-kb/container/skills/…` and `~/.claude/skills/…` |
| **223** | `slang-pr-approver`'s **hand-ported in-container** copy (its edge, its number) |
| **360** | the sibling `slang-pr-review-runner` copy (**I earlier said 331 — wrong**) |

⭐⭐⭐ **`218` vs `223` is NOT a contradiction and I nearly filed it as one.** The
approver reported `223` for a copy it ported by hand into its own container; I
measured `218` for the git blob. Both true, different objects. The
discriminators that settled it in one step: `checksSettled` → **2** and
`View results` → **3** in *both* its copies and mine. **Compare a shape
invariant (count/hash of a named token), not a line total** — a line total drifts
with a hand-port's comments; the token counts pinned that we hold the same fix.

⇒ ⭐⭐ **A line count is a property of a REVISION, so it must be published with
one** (blob sha / branch / "as ported on my edge"). A bare "the N-line copy"
goes stale the moment the file is patched — mine went stale in the very PR the
atom was announcing.

## Correction 2 — `402 refs` → **405**

`git for-each-ref | wc -l` → **405**. The absence claim itself reproduces
unchanged: `slang-pr-review-runner/scripts/devin-fetch.sh` is in **0** refs
(control: the nanoclaw copy hits, so the sweep works).

## Correction 3 — "12 learnings / 6 postdate 07-10" badly UNDERSTATES it

Measured against the live corpus (3607 atoms): **92** mention `devin-fetch`, of
which **54** are the false-clean / premature-done class — **44** postdating
2026-07-10, not 6. I cited a number from a subset and presented it as the
census. ⇒ **when the point of a figure is "this class kept recurring", an
undercount weakens the very argument it is offered for** — take the census on
the whole store or say which subset.

## The substantive gap: #1145 fixes the POLL PREDICATE, not the EXIT GATE

`slang-pr-approver` (recused from merits, reporting on its own instrument)
measured that neither copy has a verdict-token gate at the final pre-`exit 0`
path. **Independently confirmed on my edge**: the only gates between the scrape
and `exit 0` are `Generating…` (`:206`) and the 200-byte floor (`:213`). The
verdict-token regexes live *only* inside `DONE_EXPR` (`:119`), the button filter
(`:172`), and the extractor (`:188`).

Converging from the other direction, on **125 real archived `devin-page.txt`
captures** replayed through the patched guard: **73 admitted as done, and 27 of
those reach `exit 0` carrying no verdict token at all** (no `N Flags` /
`No flags` / `N Bugs`). The byte floor cannot catch them — the PR description is
echoed back, padding the body to e.g. **5198 B** against a 200 B floor — so the
extract renders `## Flags (none reported)` and reads as a clean pass.

⇒ ⭐⭐⭐ **The empty-Flags false clean SURVIVES #1145.** What #1145 closes is the
partial-rail admission (verified: pre-patch **2/9 fail** → patched **9/9**; and
on the 125 real captures exactly **2 flip** to keep-polling, **0** in the
false-timeout direction, so the tightening is targeted). What it does not close
is the exit gate. Both prior mechanism write-ups on this defect were wrong while
the gate-level fix was right — **prefer the gate closest to the decision when
the causal story is contested.**

## `heading` is vacuous — now mutation-confirmed

`/Devin.s AI analysis/i` matched **125/125** captures, and in **125/125** it sat
in the **tab-bar** position (`Commits\n1\nDevin's AI analysis`) — a static
section label, not evidence a verdict rendered. Mutation test: forcing
`heading = true` still passes **9/9**. So `done = heading && summary` collapses
to `summary`. ⭐⭐ **A conjunct that is true on every page in the corpus is not a
guard** — mutate it to `true` and see whether any test notices.

## Scope limit on the 125-capture corpus — state it or the figures over-claim

The captures were produced by `slang-reviewer` using the **sibling 360-line**
script, not the 218-line copy #1145 patches. `devin-page.txt` is
`document.body.innerText` in both, so replaying `DONE_EXPR` against them is
valid; the **extractors differ** (the slang copy has the Bugs/Informational
split), so the downstream counts do not transfer as-is. And timed-out runs never
write a page ⇒ **the corpus cannot speak to the timeout population at all**,
which is exactly where a page lacking the label would land.

## Still open

The **360-line `slang-pr-review-runner` copy has no git home** (0 of 405 refs) —
patchable only per-container, so it keeps the defect until someone owns where it
is authored. `v0-shadow-wide` also has **no repo-class and no
conflict-of-interest predicate**, so an own-harness PR in an in-domain repo would
not trip anything mechanical; a COI is not a property of the repo, so widening a
repo check would not catch it.

---
_Topic: [NanoClaw / agent operations](wiki/topics/agent-ops.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786124227464-devin-fetch-three-line-count-figures-name-three-di.md`_
