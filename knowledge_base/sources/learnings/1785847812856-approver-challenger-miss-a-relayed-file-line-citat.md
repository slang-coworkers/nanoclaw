# [approver/challenger-miss] A relayed file:line citation from HOST source did not resolve — and my first refutation instrument (GitHub code search) was DEAD, returning 0 on a positive control

# Three relayed host-source citations resolved to nothing — and the first tool I used to check couldn't have found them anyway

## What happened

An upstream tier settled an open question in my proposal by citing host implementation source:
- `src/webhook-github.ts:657` — `if (APPROVER_CI_GATE && event.headSha) { parkReviewable(...) }`
- `src/modules/pending-reviewable/ci-check.ts::requiredCheckRunGreen`
- `src/config.ts:318` — "`APPROVER_CI_GATE` defaults OFF"

The reasoning built on them was coherent and matched my own hypothesis (a maintainer-gated fork parks
forever because the required check-run is *absent*, and only a later `check_suite` re-triggers the
probe). Agreeable conclusion + precise citations = exactly the shape that gets accepted unchecked.

**Measured at the default branch (`nv-coworkers`) of `slang-coworkers/nanoclaw`, via a full recursive
tree enumeration (7,972 blobs):**
- `src/webhook-github.ts` — **does not exist.** The real file is `src/webhook-server.ts`.
- `src/modules/pending-reviewable/` — **does not exist.** `src/modules/` holds `agent-to-agent`,
  `approvals`, `interactive`, `mount-security`, `permissions`, `scheduling`, `self-mod`, `typing`.
- `src/config.ts` exists (5,517 B, 107 lines — so `:318` is past EOF) and contains **no**
  `APPROVER_CI_GATE`. Neither does `src/webhook-server.ts` (5,965 B).

So: **not stale line numbers — the paths and symbols are absent.** Possible benign explanations I
cannot distinguish from here: an unmerged branch, a different deployment repo, or a private fork. What
I can state is scoped: *not present on `slang-coworkers/nanoclaw@nv-coworkers` as of 2026-08-04T12:48Z,
by tree enumeration + raw-content reads.*

## ⛔ The bigger lesson: my FIRST refutation instrument was silently dead

Before the tree enumeration I ran `search/code?q=APPROVER_CI_GATE+repo:...` → `total=0`, and
`parkReviewable` → `total=0`. Two clean zeros. I nearly reported "confirmed absent."

Then I ran a **positive control** — searched for `ASSISTANT`, a symbol I had *already read out of
`config.ts` with my own eyes* — and got **`total=0` as well.** GitHub code search is simply not
indexing this repo. My zeros carried **zero information**; they were indistinguishable from real
absence and pointed the same direction as my prior, which is what made them dangerous.

⭐ **A zero-hit search needs a must-be-non-zero control, and the control must run through the SAME
instrument.** I hold this rule already ("a zero-hit grep needs a must-be-non-zero control") and had
filed it for local `grep`; I did not carry it to a *remote search API*. Same failure signature, new
surface — and the rule about scoping a rule to its failure signature rather than its first context
applies to itself here.

⭐ **Working instrument for "does this path/symbol exist in a repo I can't clone":**
```
gh api "repos/O/R/git/trees/<branch>?recursive=1" --jq '.tree[]|select(.type=="blob")|.path'   # enumerate
gh api "repos/O/R/contents/<path>" -H "Accept: application/vnd.github.raw"                     # read
```
Tree + raw content are **served, not indexed**, so they can't silently return an empty index. Verify
the read is real content and not a 404 body — a 404 JSON payload is ~127 bytes and `wc -c` looks like
a successful small file.

## Why it mattered here, not academically
The relayed finding was routed onward to an operator as justification attached to my proposal. A
citation is a claim someone else acts on *without re-deriving* — that is exactly why it must be
measured. The conclusion may well be true of whatever code actually runs; **the evidence offered for
it does not resolve**, and those are different states that a confident file:line makes look identical.

## Transferable
1. **A relayed citation is a hypothesis until located at current state** — including when it comes
   from a tier senior to you, and *especially* when it confirms your own hypothesis.
2. **Test your refutation instrument before trusting its negative.** Positive control, same tool.
3. **Absence claims get scoped to the method and the ref**: "not present at `repo@branch` as of
   `<ts>`, by tree enumeration + raw read" — never bare "doesn't exist."
4. **A file with fewer lines than the cited line number is a free tell** (107 lines vs `:318`).
