---
name: feedback-verify-identity-never-position-stash-and-citations
description: "git stash is SHARED across all worktrees of a clone (refs/stash lives in git-common-dir), so stash@{0} is not yours — verify by branch + file set. Same rule as line citations: an index into a mutable list is as unreliable as a line number in a shifting file."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 73c43656-0b8f-4a5b-b4d5-1c374eb48e35
---

# Verify identity, never position — `stash@{0}` and `file:line` are the same bug

**Measured 2026-08-06, slang#12284.** A fixer working in an isolated worktree was about to `git stash pop` to restore its own fix, and caught that **`stash@{0}` is not automatically its own**. On that mount the stack held sibling sessions' work: `stash@{1}` = `fix/issue-11944`, `stash@{2}` = `fix/issue-12185`. A wrong pop **silently mixes another session's changes into your PR**, and the index isn't stable — any sibling stashing shifts every position.

## Why this is structural, not bad luck

I verified the mechanism rather than accept the anecdote:

```
$ git rev-parse --git-common-dir
.git                      # refs/stash lives HERE — the COMMON dir
```

⛔ **`refs/stash` lives in `$(git-common-dir)`, not in the per-worktree dir.** ⇒ **A git worktree does NOT isolate the stash stack.** Every worktree on a clone shares one stack, so worktree isolation — which *does* separate index, HEAD, and working tree — gives **zero** protection here. Anyone reasoning "I'm in my own worktree, therefore my stash is mine" is wrong by construction.

## The rule

⭐⭐⭐ **Verify identity; never trust position.** Before `stash pop`/`apply`, assert **both**:
1. the stash description names your branch (`fix/issue-<N>`), **and**
2. its file set is exactly the files you expect.

Refuse otherwise. `git stash list` + `git stash show --name-only stash@{n}` is the whole check. Prefer `git stash push -m "<unique-tag>"` on the way in so the way out is unambiguous — better still, avoid stash entirely for anything you care about (a throwaway commit on your own branch is addressable by SHA, which nothing else can renumber).

⭐⭐ **This is the SAME bug as a line citation, one domain over: an index into a mutable list is as unreliable as a line number in a shifting file.** Both are *positions* standing in for *identities*, both look plausible when wrong, and both are silently renumbered by other people's activity.

## Companion trap: consistency is not verification

Same chain — the fixer noted a citation was consistent with a `+67` shift (`AddOverloadCandidateInner` 2442→2509, `AddOverloadCandidate` 2525→2592) and was about to treat the agreement as confirmation.

⛔ **That is exactly the shape of the `diagnoseOnce` error** (cited `:1631`, actual `:1632` — wrong because it named a *different overload*, not because the tree moved). The +67 agreement is *expected* whenever both symbols precede the same insertion points, so it is equally compatible with the number pointing at the wrong symbol.

⚠️ **`slang-check-overload.cpp` has four similarly-named symbols** — `AddOverloadCandidateInner` (:2442), `AddOverloadCandidate` (:2525), and **two overloads of `AddOverloadCandidates`** (:3166, :3183). For the last pair a bare line number **cannot disambiguate even in principle**, same as the two `diagnoseOnce` overloads (:1615 / :1632).

⇒ **Confirm a citation by READING the line (`sed -n '<n>p'`), never by checking that the arithmetic agrees.** And when citing an overloaded symbol, **name which overload in prose** — a number silently selects among candidates and the reader cannot tell you chose wrong.

## ✅ MEASURED OUTCOME — the offset theory died empirically: 7 wrong citations

**Same chain, ~1h later.** The fixer ran the read-the-line pass on the restored tree and found **7 wrong citations** it had been about to ship:

| cited | actually pointed at | true line | drift |
|---|---|---|---|
| `:2532` `fastRemoveAt` | `{` | `:2536` | +71 |
| `:2558` `bestCandidate=nullptr` | `int cmp = CompareOverloadCandidates(…)` | `:2562` | +71 |
| `:2568` the drop | `}` | `:2572` | +71 |
| `:2592` `AddOverloadCandidate` | `context.bestCandidate = &…Storage;` | `:2596` | +71 |
| `:3778` report site | (off by one) | `:3779` | — |
| `:3744` `CompleteOverloadCandidate` call | `getDeclSignatureString(…)` | `:3819` | +75 |
| `:3938` ambiguous-generic loop | — | `:4013` | +75 |

⛔⭐⭐⭐ **PER-SITE DRIFT DIFFERS: +67, +71, +75 in ONE patch.** `:2442→:2509` was genuinely +67 — and that true agreement is precisely what vouched for the rest. **Every wrong number above was "consistent."** A patch inserting at several points produces a *different* offset per region, so **no single offset exists to apply, and a spot-check that agrees proves nothing about any other site.**

⇒ **Had it shipped, the PR body would have pointed reviewers at `{` and `}` inside the very function whose behaviour the report explains.** A citation landing on a brace is not a small error — it destroys the reader's ability to follow the argument at exactly the place the argument lives.

⇒ This is the empirical death of offset reasoning, stronger than the earlier sign-error instance: there the direction was wrong; here the *method* is wrong even when the direction and one sample are right.

## ⭐⭐⭐ "Verified" without "against what" is an underspecified label — and it licenses a use it never earned

**Same chain, found by the fixer auditing its own scratch log.** A table headed *"verified source facts"* held **base-tree** line numbers (read at `d7d59f374e`, before the patch existed). Correct for the unpatched file; **wrong for the PR.** The hazard: a resumed session copies from the nearest authoritative-looking table, so numbers already fixed once get re-shipped wrong. Relabelled base-tree with an explicit *"do not copy into the PR"* plus a pointer to the per-region drift.

⭐⭐⭐ **A label that describes provenance loosely licenses a use it was never verified for.** *"Verified"* without *"against which tree"* is exactly as underspecified as *"flake"* without *"by which test"* (see the disposition-naming rule in [[technique_ab_suite_delta_four_dispositions]]) — both name a *status* while omitting the *scope that makes the status true*.

⇒ **Stamp the scope into the label, not the surrounding prose:** "verified @ `<sha>`, base tree — not valid post-patch". Prose context is lost the moment someone copies the table; the label travels with the data.

### ⭐⭐⭐ TEST A DOCUMENT BY THE OPERATION THAT WILL BE PERFORMED ON IT

**Same session, the peer made the identical mistake twice**, then found the general fix. A scratch log's stale instructions (*"fill the ctor test's annotations"* — since become an **anti-test to delete**; retracted line offsets) were marked with a `⛔ SECTIONS BELOW ARE SUPERSEDED` **banner at the top**.

⛔ **A top banner protects the reader you imagine (top-down), not the reader who happens** — someone grepping "annotations" lands *directly* on the stale line, banner unseen. Exactly the access-pattern error already made with the citation table, where the fix was moving scope into the **column header** so a single-row copy carried it.

⇒ Fix: mark each stale claim **in place**, attached to the text that would be acted on:
`~~fill the ctor test's annotations~~ **[SUPERSEDED: ANTI-TEST — DELETE, do not annotate]**`

⇒ ⭐⭐⭐ **Then SIMULATE THE ACCESS PATTERN — don't reason about adequacy, run it.** The peer grepped the three dangerous terms (`annotations`, `ctor test`, `offset`) and confirmed each lands on a correction *before* the stale text. It would have called the banner sufficient **on inspection** — the same judgement that had already failed once. **This is the document equivalent of the fix-absent test gate**: don't argue the artifact is adequate, execute the thing that would expose it.

⚠️ Urgency scales with what the stale text *licenses*: here, annotating an anti-test would ship a test certifying the feature's **absence**, and re-deriving retracted offsets would point reviewers at braces. **A stale note that licenses a wrong action is worse than a missing one** — same reason to delete an unsound script rather than shelve it.

⇒ This is the general form of several failures in one day: *stale-by-events* citations, *per-container* paths naming different objects, an *aperture-dependent* line number, and a *cause-named* disposition bucket. In each case a true statement was carried into a scope where it was false, because the label didn't carry its scope.

## The distinction underneath all of it

⭐⭐⭐ **"Unverified" is a different state from "right", and they feel identical from the inside.** The fixer's own formulation, applied to a number that had *"arrived in prose rather than from a measurement."* A value that reached you via prose carries no marker saying which state it's in. ⇒ Track provenance per value; enumerate the unverified ones as a checklist rather than an intention.

Related: [[feedback_the_remedy_for_an_untrusted_number_is_re_measurement_not_arithmetic]] · [[technique_ab_suite_delta_four_dispositions]] (artifact-derived controls beat self-authored ones) · [[project_12284_cross_module_overload_silent_break_warning]].
