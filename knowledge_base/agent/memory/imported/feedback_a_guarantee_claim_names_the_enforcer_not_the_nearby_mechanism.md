---
name: feedback-a-guarantee-claim-names-the-enforcer-not-the-nearby-mechanism
description: Auditing the mechanism a report indicts is not auditing what enforces the invariant — enumerate every enforcer before recommending a disposition; rigor inside a frame suppresses questioning the frame
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 6671f318-efeb-4b8d-8a33-d95b81cddb95
---

# A claim about a guarantee names the ENFORCER, not the mechanism that happens to be nearby

**EVIDENCE BASE: ONE chain (slang#12366, 2026-08-05), two actors, three tiers,
observed twice at two altitudes.** Re-derive before executing. Direct escalation of
[[feedback_a_caveat_aimed_at_the_wrong_claim_reads_as_diligence]] — same mechanism,
one level up.

## What happened

An issue indicted `.claude/hooks/pre_tool_use.py` for failing to guarantee formatted
commits. Across an entire chain — my triage, a triager's verdict, a codex critique,
a maintainer round-trip — **we audited two LOCAL hooks with real rigor and never
asked what actually ENFORCES the invariant.**

It surfaced only when a maintainer asked a *different* question ("where is the git
hook, are they the same?"). Answering him required enumerating the enforcement
mechanisms — and there it was: `.github/workflows/check-formatting.yml` runs
`./extras/formatting.sh --check-only` on every non-draft PR to `master` **and** on
`merge_group`. Workflow `124338832`, active, **17,050 runs**, successes that day.

⇒ **Formatting is enforced repo-side regardless of either local hook.** Deleting
the orphan costs no guarantee. That was the strongest argument for the recommended
disposition, and nobody had it — while all four analyses were individually correct.

## The mechanism

⛔⭐⭐⭐**"Which mechanism is broken" is strictly narrower than "what guarantees the
invariant" — and answering the narrow question rigorously is exactly what suppresses
the wide one.** Thorough work on the indicted artifact *feels* like coverage of the
property, so the frame never gets questioned. A report hands you its frame; the
report's author had no obligation to enumerate enforcers, and inheriting their frame
inherits that gap.

⇒ **CHECK, before recommending any disposition on a mechanism: enumerate EVERY
mechanism that enforces the same invariant** — CI gates, server-side checks, review
requirements, merge-queue rules, bots. Then ask what deleting/fixing this one
actually changes. Often: nothing, which is decisive information.

**The generalized discriminating question** (the triager's phrasing, sharper than
mine): *which artifact does my sentence make a claim about — and is that the artifact
I opened?* **For a guarantee, the artifact is whatever ENFORCES it, never the thing
that happens to be nearby.**

Observed at two altitudes in one chain: verified a *mechanism* → claimed about a
*ticket* (#8637); verified two *mechanisms* → claimed about a *guarantee*. Both
times the measurement was sound and silently crossed a boundary it had no license
to cross. **Soundness does not confer scope.**

## Corollary — THREE states, not two (corrected 08-05; my first filing was a notch short)

⛔**I filed this as "a run count proves ENFORCEMENT." That is WRONG — a run count
proves the check EXECUTES.** The triager caught it *after* I'd published the rule.
There are **three** states:

| state | what proves it | what it means |
|---|---|---|
| **configured** | the trigger block in the YAML | it is *defined* to run |
| **executing** | run counts per event | it *does* run |
| **blocking** | the **required-status-checks list** / merge-queue required set | you **cannot merge** without it |

**Only the third means "unformatted code cannot land."** A workflow can be defined
and never fire (wrong filter, disabled, `if:` never true) — and it can run on every
PR, go red, and still be merged past if it is not *required*.

**State 3 is UNMEASURABLE from our edge, and I reproduced that:**
`gh api repos/shader-slang/slang/branches/master/protection` → **403 "Resource not
accessible by integration"** (same for `…/protection/required_status_checks`).
⚠️**That 403 is a CAPABILITY GAP, not evidence of absence** — nobody may later read
it as "no branch protection." **Control proving it is token scope and not the repo:**
`gh api repos/shader-slang/slang` returns fine (`public`, `master`), so the repo is
readable and only the protection endpoint is barred.

**Best available proxy, both controls run by me:** `merge_group` runs = **2,765**,
all on `gh-readonly-queue/master/pr-*`, all `success`; non-zero control
`pull_request` = **14,113**; **zero-control `schedule` = 0**, so the event filter
genuinely discriminates (`push` = 165; total 17,051 — the earlier "17,050" was the
all-events total, consistent, not a discrepancy). GitHub only runs merge-queue checks
for *queued* PRs ⇒ strong evidence of participation in the merge gate — **but a proxy,
not the required-checks list.**

⇒ ⭐⭐⭐**HONEST FORM: a trigger block proves configured; a run count proves
executing; only the required-checks list proves blocking — and when that list is
unreadable, SAY WHICH OF THE THREE YOU MEASURED.** Same family as naming the
aperture.

⭐⭐**Why this mattered even though the disposition held:** the disposition never
rested on state 3 (deleting the orphan costs no guarantee because *neither* local
hook was blocking either), so no public correction was warranted — the discrepancy
could not change the answer, and an edit would be churn on an artifact the maintainer
is actively reading. **But a rule filed one notch short gets EXECUTED later at full
confidence.** The cost lands on the next reader, not on this chain — which is exactly
why a too-strong rule is worth correcting even when the decision it supported was
right.

## Instrument note — print, don't count

⛔**`grep -c 'git add"'` on `pre_tool_use.py` returns 1 and reads as "it re-stages."**
Printing shows `:17` is a comment and `:22` a string literal in the matcher; the
file's only `subprocess.run` argv is the formatter, so it cannot re-stage **by
construction**. Control: the git hook's real call is at `:90`. ⇒ **PRINT, DON'T
COUNT — a count cannot distinguish a call site from a comment or a string mentioning
the same tokens.** Same false-signal family as flag-shaped patterns being eaten as
options by `grep -cF` (use `-cFe`): both turn a grep into a confident wrong answer
about presence.

## Also worth keeping — edit-in-place has a validity window

Three in-place edits of our own comment kept the count at 1 while **we** were last
commenter. Once a human replied, the correct move flipped to a **stacked** comment
(`updated == created`) — editing then would hide the response from anyone following
the thread. **Edit to avoid churn only while you are still the last commenter.**
