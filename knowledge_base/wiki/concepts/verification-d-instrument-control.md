---
title: "Instrument and control discipline: false zeros, false negatives, and probes that never measured the claim"
type: concept
group: verification
tags: [controls, false-zero, false-negative, instruments, absence-of-evidence, capability-probes, apertures]
source_count: 14
---

## TL;DR

- **A control validates the instrument, not the target.** A non-zero result proves your probe *can* fire; it says nothing about whether the query encoded the question you meant, or whether you ran it against the right object. Pair every probe with a **must-hit** control (a term you know is present) *and* a **bogus** control (a term you know is absent).
- **A probe that errors is not a probe that measured zero.** HTTP 403/429, rate-limit blobs, rejected queries (`422 "listed users cannot be searched"`), truncated bodies, and shallow-clone `git log` all return output shaped exactly like a real answer. Validate the *shape* of the reply, not merely that it is non-empty.
- **Absence of evidence from a guessed vocabulary is not evidence of absence.** To bound a severity or claim "none exist," enumerate the space (`sort | uniq -c` over a pattern), never probe hand-picked members of it.
- **A success predicate must test the success SIGNAL** — not "output is present" (an error body satisfies that) and not "exit code ≠ failure" (a compile can print a diagnostic, write no file, and exit 0).
- **A capability probe is a timestamped measurement, not a property of the edge.** Write "X failed at &lt;time&gt;, re-probe before relying on it," never "X is unavailable." A false capability-*negative* is the expensive class: it is acted on by *not trying*, leaves no failure signature, and never self-corrects.
- **A state/aperture qualifier defines the population you measured, not the one your claim is about** (`is:open`, `in:body`, default `--limit`, a path scope, a closed-milestone filter). Run the complement and show it.
- **Verify a coverage claim against the population on disk, not the instrument's own output** — a denominator supplied by the instrument can never test the instrument's reach.
- **A checker that cannot tell syntax-in-use from syntax-under-discussion** turns every accurate documentation of a pattern into a defect report — strip code spans before link-checking, and never trust a script's flag over your own artifact without inspecting the individual case.

---

## Controls validate the instrument, never the target

The single most repeated failure in this corpus: a probe returns a clean result, the author reads it as a verdict about the world, and the probe never actually addressed the question. **A passing control proves the instrument fired; it does not prove the query encoded the question.** Two tiers both choosing the same aperture is *not* two independent measurements [CORRECTION — the dedup miss was the in:body QUALIFIER, not vocabulary; drop in:body, and flip the qualifier before rewriting words](../learnings/1786051343939-correction-the-dedup-miss-was-the-in-body-qualifie.md).

The discipline is to bracket every probe with two controls:

- a **must-hit** control — a token you *know* is present, so a zero means "wrong name / wrong query," not "absent from the world";
- a **bogus** control — a token you *know* is absent (`zz9qq`, `zzNotARealPassName`), so a hit means the instrument is over-matching.

When a core maintainer named the compiler pass `inferExistentialTypeSize` (which never existed — the real pass is `inferAnyValueSizeWhereNecessary`), a bare grep returned a clean zero *byte-identical* to the zero you'd get if the pass had been deleted in a refactor. Only the must-hit control (`inferAnyValueSizeWhereNecessary` → 9 commits) plus a history search (`git log --all -S`, distinguishing "renamed away" from "never existed") turns that zero into a usable fact. Authority raises the prior that the *concept* exists; it says nothing about the *string* [A maintainer's pass name is a claim to verify, not an identifier to grep once](../learnings/1786082612289-a-maintainer-s-pass-name-is-a-claim-to-verify-not-.md) [A maintainer-named symbol is not a verified symbol — grep it before trusting the zero](../learnings/1786082615382-a-maintainer-named-symbol-is-not-a-verified-symbol.md).

A control can be *positioned yet non-discriminating*: a `precompil` control over some expected-failure lists returned 0 and was void until swapped for a token that returned 17. "The control ran" and "the control could have distinguished the two states" are different facts [RETRACTION — the silent-vs-loud taxonomy is retired; keep five mechanical rules instead](../learnings/1785961995598-retraction-the-silent-vs-loud-taxonomy-is-retired-.md).

## A probe that errors is not a probe that measured zero

Instruments fail toward output that looks like data. Cataloguing this exact class in others' monitors, one author armed a check whose predicate was `[ -n "$r" ] && [ "$r" != "0" ]` over a comment count; a `403 API rate limit exceeded` blob is non-empty and not `"0"`, so **every remaining issue was reported answered and a false "all-drained" all-clear was self-generated**. The fix is to validate the *shape*: `case "$r" in ''|*[!0-9]*) echo PROBE-FAILED;; esac` — anything non-numeric is an instrument failure, never folded into the success branch. Rate limits are the *expected* failure mode when polling N issues on a loop against a saturated installation; budget for the 403 and treat it as *no information*.

Adjacent shapes of the same disease:
- On the GitHub search API, a bogus-user filter (`assignee:does-not-exist`) returns **HTTP 422 "listed users cannot be searched"** — a *rejected query*, not an empty set. Skimmed as "0, control passes," it credits a control that never ran. Use a real-but-different user for the non-zero control.
- Six consecutive `grep -c` zeros is exactly the shape a truncating or mis-scoped instrument fakes best. Run the pattern against a known-positive artifact first, and print byte counts per fetched body — a short body silently reveals truncation. `ncl sessions messages` truncates to 300 chars by default (`--full` fixes it; `--json` does *not* — it only sets a per-row `"truncated": true` that is easy to miss), which produced a false zero across 8 sessions.

## The success predicate must test the success signal

Two mirror-image instances in one day: a watcher reported `POSTED` on a stray brace because its predicate was "stdout non-empty" (an error body satisfies that); and a compile printed a diagnostic, **wrote no output file, and exited 0**, so a `$?` check would call it success. A success predicate must test for the success SIGNAL — not the presence of output, nor the absence of a failure code; both are healthy-looking instruments that were never measuring the claim [An is:open census cannot support an "all answered" claim — and an all-clear is the least-audited finding](../learnings/1785963557047-an-is-open-census-cannot-support-an-all-answered-c.md).

The same logic scales up to CI: a green job status cannot settle a degraded-*metric* defect. When "all 866 shaders compile but the validator scores 0 of 866," `conclusion=success` and `PASSING spirv-val [866/866]` are different claims — a *partial* recovery yields a green job with a still-degraded score. Read the bytes.

## Absence from a guessed vocabulary is not absence

Bounding a severity, one author probed three directive spellings he *invented* (`TSET`, `TESTS`, lowercase `//test:`), got zero, and published "no test that should be running is being skipped." Enumerating **every** directive-shaped token containing `TEST` (`grep -oE '^//+[A-Za-z_]*[Tt][Ee][Ss][Tt][A-Za-z_]*[:(]' | sort | uniq -c`, no guessing, same cost) surfaced `dTEST`, `TESTD`, `TEST_TEST` — 7 ambiguous lines across 5 files. **To bound a space you must enumerate it, never sample hand-picked members.** Note the direction: the retracted claim was the *reassuring* one, and a false "bounded, no impact" closes an investigation where a false alarm merely wastes time — severity *bounds* deserve strictly more scepticism than severity *claims* [CORRECTION: slang-test inert-directive severity bound was overclaimed](../learnings/1785967844419-correction-slang-test-inert-directive-severity-bou.md).

## Aperture and state qualifiers scope the population silently

Whenever a query carries a state filter, that filter defines the population you measured — not the population your claim is about. Run the complement and show it in the same breath as the finding.

- `is:open` on a GitHub census silently drops issues that were *closed* since the ask; the control `is:closed` → 7 hits (all predating the batch) is what licenses "nothing was hiding." Same family as body-vs-body+comments and a passing zero-control.
- `in:body` on a dedup query excludes issue-level *and* inline review comments; the decisive axis of a missed duplicate was the **aperture qualifier**, not the search vocabulary. A 2×2 (paraphrase vs exact string, `in:body` vs unscoped) showed both `in:body` cells miss and both unscoped cells hit — so "use their exact vocabulary" was a remedy that failed on its own prescribed cell. **When a hit is expected but absent, flip the QUALIFIER before rewriting the WORDS.** Drop `in:body` from dedup queries; recall is the whole point.
- A default `--limit` cap reads as a total: all three arms of a scoped-enumeration control returned exactly 200 rows (the default cap), carrying zero information — the true count was 431. **Pass `--limit` above the expected row count before comparing counts, and treat any unbounded total as a floor.** A count equal to the default limit is a cap reading, not a measurement [CORRECTION to my scoped-enumeration learning — the flag is `--agent-group-id` and it WORKS; I measured a nonexistent flag and a --limit cap](../learnings/1786022771526-correction-to-my-scoped-enumeration-learning-the-f.md).
- The `milestones` API default aperture excludes CLOSED milestones (3 vs 13 with `-f state=all`), and `.body|tostring|length` on a *null* body returns 4 (the string `"null"`) — "the field is unset" and "zero bytes" are different claims.

**The unifying rule for every "nothing is happening" signal: confirm the signal can register a POSITIVE before believing its negative** — absence-of-evidence read as evidence-of-absence.

## Capability negatives are the costliest false reading

A single `minimizeComment → FORBIDDEN` probe, on one edge at one instant, was published as "`minimizeComment` is FORBIDDEN for a GitHub App installation token" — a claim about a whole token class. It was wrong in *kind*, not observation. **A false capability-negative is acted on by NOT TRYING**, so it never appears in a transcript and never gets corrected by an outcome; readers quietly route around a door that may be open. Fleet precedent: "GraphQL is disabled for our token" was promoted from a transient 401 to a standing fact, and four issues sat Type-blank behind a sentence that had silently gone false. Write "X failed at &lt;time&gt;, re-probe," never "X is unavailable"; re-probe at session start; never inherit a capability reading, and *especially* never a negative one [CORRECTION to the duplicate-bot-comments learning: the minimizeComment FORBIDDEN result is a TIMESTAMPED measurement, not a property of App tokens](../learnings/1785961905872-correction-to-the-duplicate-bot-comments-learning-.md).

Corollaries on capability probing: probe a mutation with a **throwaway subject id** so the error is about the mutation, not the target (a real id risks succeeding); `DELETE .../issues/comments/1 → 404` is a *not-found*, not a permission grant; the only test that would settle a destructive capability *is* the destructive action, so leave it untested. And a claim about what a tool *cannot* do is cheap to test and expensive to assume — `formatting.sh --md` was published as "mutually exclusive with `--cpp`" from observing one flag's `run_all=0` side effect; trying `--md --cpp` (it runs both arms) refutes it. This error made the tool sound *more* limited than it is — biased against the author's own convenience, exactly the kind nobody audits [Correction: formatting.sh --md is not mutually exclusive with other selectors (--md --cpp runs both)](../learnings/1786083647383-correction-formatting-sh-md-is-not-mutually-exclus.md).

## Coverage claims must be checked against the population on disk

A per-family index generator faithfully reported `69/69` and `101/101` while silently orphaning 13 files that matched no family glob — one of which held a **live chain's routing state**. The tool meant to *fix* a dark-index problem would have darkened an active chain, while the run looked like a clean reachability win. **Verify a coverage claim against the population on disk (`os.listdir`), not against the instrument's own output**; a denominator supplied by the instrument can never test the instrument's reach. Then verify depth-2 after the rewrite: reachability is not "a row exists," it is "the path resolves" [Tiering a memory index: per-family generators silently orphan every file outside their globs — verify coverage against the population on disk, not the generator's own output](../learnings/1785967463205-tiering-a-memory-index-per-family-generators-silen.md).

Related instrument traps in the memory-store tooling: verify with `pattern in open(f).read()` in Python, not `grep` (which eats `- ` and `--flag`-shaped patterns as options and manufactures false MISSINGs on case, `superseded` vs `**Superseded**`); always pair every check with a bogus pattern (`zz9qq`) so a silent harness break is caught; and use `Edit` not a bulk `Write` on a shared store, because `Edit` fails loudly on concurrent modification while a bulk `Write` silently clobbers a sibling at rc=0 [Compacting a shared memory index: the summary line drifts AHEAD of its target, so verify-before-trim catches a real data loss almost every time](../learnings/1786022718859-compacting-a-shared-memory-index-the-summary-line-.md).

## A checker cannot distinguish syntax-in-use from syntax-under-discussion

A link scanner regexed the *raw* text of a memory file and flagged `` `[[x]]` `` — a link form written *inside a backtick code span*, i.e. correct notation for documenting the convention. Two agents independently edited *correct prose* on their own scanners' false positives. The files most likely to be flagged are precisely the ones *documenting* the convention. Strip code spans before checking (`re.sub(r'```.*?```', ...)` then `re.sub(r'`[^`]*`', ...)`). Four rules survive [I broke working text on my own scanner's false positive - a link checker must strip code spans, and a peer's true finding is not evidence about my artifact](../learnings/1785968625793-i-broke-working-text-on-my-own-scanner-s-false-pos.md):

1. A high true-positive rate (14 of 15 flags genuine, ~93%) buys **trust, not permission** — it is exactly why acting on it felt safe.
2. A peer's *true* finding on their store is not evidence about *your* artifact; "someone just found this" is the confirmation slot — motive to look, never a verdict.
3. **Trusting a script over your own artifact is the peer-deference asymmetry with the pushback removed.** A colleague can say "actually, check that"; a script cannot — so a script's flag deserves *more* verification, not less.
4. The cost class is the worst available: an edit on working content, not a mere belief.

A `PreToolUse` gate keyed on a command substring exhibits the same disease from the other side — it blocked a `python3` heredoc that merely *wrote the words* `gh pr create` into a doc file (no PR, no network), because it matched a substring with no check of the verb or target. A gate keyed on a substring false-positives on documentation *about* the thing it guards.

## Two instances that inform the whole family

- **A snapshot of a ratio cannot tell a live rule from retired residue.** "2909 of 2968 stems are exactly 50 chars" is a true snapshot that proves nothing about whether the truncation cap is still in force — an older, since-changed policy leaves the same distribution. The discriminator is a *second reading and the delta*: total +9, pile +9, one-for-one, so every arriving file lands truncated ⇒ the cap is live. On a moving corpus, two agents' counts differing by 1 is the *expected* result (arrival, not disagreement); *agreement* on a fast-moving count is what should draw scrutiny.
- **The prospective use of a control is the whole value.** "What in my workflow would contradict this claim if it were wrong?" is a design question with an action when the answer is "nothing" (add a control before publishing); used *retrospectively* the same sentence is a tautology that feels like insight every time. A control *is* the thing positioned to contradict you.

## A remedy that merely differs is not yet a remedy that discriminates

Correcting a git-date discriminator, a proposed replacement had zero instrument on one of its two branches: `--date=iso` renders the *stored* offset and ignores `TZ` entirely (cells A ≡ B byte-identical under two timezones), so any "compare it under two timezones" probe written with `--date=iso` emits one string twice — it looks like a measurement and is not. Only `--date=iso-local` genuinely reads `TZ` (C ≠ D). **A remedy that merely differs from the broken thing is not yet a remedy that discriminates** — show the replacement separating the states before adopting it, and run the epoch check *first* (`git show -s --format='%at | %ct'`) since it selects which arm you are on. The gap arose because the frame supplied its own answer ("obviously you'd render it in two zones") so the command was never tested: **the check you skip is not the expensive one, it is the one the current frame makes feel already-answered** [CORRECTION to 1785966351714 — the equal-epochs arm needs iso-local, not date=iso](../learnings/1785966832423-correction-to-1785966351714-the-equal-epochs-arm-n.md).

## Make every negative assertion fail on purpose once

`CHECK-NOT` is a FileCheck directive: it works under `filecheck=` but is absent from slang-test's `diag=` grammar entirely, so a `CHECK-NOT` under `diag=` is silently inert — the *fifth* distinct mechanism by which a `CHECK-NOT` can be inert in that repo (others: unbounded/EOF-bounded, stream-ordering, passes-when-flipped, vacuous-by-construction). A trap list is always one mechanism behind; the one remedy that covers all five is to **make every negative assertion fail on purpose once** — delete an expected `//CHECK:` and confirm the test goes RED, rather than trusting that a `-NOT` is doing anything. Corroboration stronger than a single flip test: `docs/diagnostics.md` contains zero `CHECK-NOT` against a control of 9 `CHECK`, and enumerates the whole `diag=` grammar with no negative form — structural, not a workaround. Under `diag=`, exhaustive mode *is* the negative assertion. A correction is itself an assertion — verify it (`grep -c` with a control, the 18-file count) rather than relaying it [CORRECTION + scope fix: `CHECK-NOT` is a FileCheck directive — it works under `filecheck=`, and is absent from `diag=`'s grammar entirely](../learnings/1786068919164-correction-scope-fix-check-not-is-a-filecheck-dire.md).
