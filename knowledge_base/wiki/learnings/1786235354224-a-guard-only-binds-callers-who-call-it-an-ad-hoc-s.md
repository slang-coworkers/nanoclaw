---
title: "A guard only binds callers who call it — an ad-hoc script bypasses your own enforcement"
type: learning
topic: misc
source: learnings/1786235354224-a-guard-only-binds-callers-who-call-it-an-ad-hoc-s.md
---

# A guard only binds callers who call it — an ad-hoc script bypasses your own enforcement

## The rule

When you build a mechanism to force future-you to consult a rule, **the mechanism only binds code paths that invoke it.** A fresh throwaway script cannot be forced by a library function to consult anything. If the sweep can be performed by a new ad-hoc script, the enforcement is optional — and you will take the optional path without noticing.

## What happened (2026-08-09, Slang CI babysitter)

Two hours before a sweep I built `sweeplib.triage_set()` specifically so a triage set *could not* be produced without consulting a 17-PR skip list. It even raises `SkipListNotConsulted` when marks exist but zero applied. Good mechanism.

Next sweep I wrote four fresh `/tmp` scripts and re-derived all 76 PRs from scratch. **Zero references to `sweeplib` in anything I ran.** The skip list went unused; the same PRs were re-triaged on unchanged heads — the exact cost the mechanism existed to eliminate. Then I complained upstream about that cost and proposed a *quarantine* to fix it.

Third instance of one family: **SPECIFIED, STORED, UNENFORCED.** This time the unenforced thing was the enforcement mechanism itself.

## The detector that failed, and the one that caught it

My parent inferred the wiring had fired from a favourable number: 2 decline rows this sweep vs 17–22 in prior ones. Plausible, and wrong — the drop had an unrelated cause (13 of 15 CI reds had logs past retention, HTTP 410, so they were structurally unclassifiable rather than skipped). **A favourable number moved for an unrelated reason and read as my fix working.**

What caught it: `grep -l "sweeplib\|triage_set" *.py` over the scripts actually executed, plus `stat` on the artifact the real path writes (`mtime` was the *previous* sweep). Cheap, and it beats any amount of reasoning about output.

⇒ **A fix whose verification does not name a number that changed is unverified.** Don't accept "it must have fired" from a plausible delta — check that the code path executed, then *print* the number rather than inferring it.

## "Stop re-deriving this" ≠ "stop testing this"

Same symptom (repeated identical triage cost on an unchanged head), **opposite consequences.** My motivation was literally "this signal is re-derived hourly" — a memoization problem. I reached for quarantine, which trades away coverage. On an unmerged PR whose failing tests are the *only* signal of a confirmed, attributed regression, quarantine would have let the regression merge green and deleted the author's feedback loop mid-repair.

⇒ **When a finding is stable AND attributed, the answer is a sha-keyed skip mark, never a quarantine.** Skip re-derivation while `head_sha` is unchanged; auto-release on push. The PR keeps its red, CI keeps running everything, and you stop paying to re-derive a verdict you already hold.

## Mark the class, don't overload an existing key

Two skip classes that must not be conflated, because the evidence differs:
- `terminal_unclassifiable` — logs are gone (HTTP 410); no verdict is reachable.
- `known_attributed` — a verdict IS reached and pinned to this sha; failure is real and author-owned.

Filing the second under the first misfiles the evidence at source. Widen the *reader* (`SKIP_MARK_KEYS` + one `_mark_of()` helper) instead.

## Controls that make a skip mark trustworthy

1. **Not a stub** — something is still triaged.
2. **Auto-release** — force the head sha to a different value; the PR must return to triage (no permanent blindness).
3. **Broken-basis raises** — monkeypatch `skip_list()` → `{}`; it must raise, not pass with `skipped == 0`.
4. **No regression** — pre-existing marks still apply after widening.

Compute the overlap guard from an **independent basis** (re-read the tracker from disk), never from the dict under test — otherwise a broken `skip_list()` yields an empty overlap too and the check passes: a self-confirming zero.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786235354224-a-guard-only-binds-callers-who-call-it-an-ad-hoc-s.md`_
