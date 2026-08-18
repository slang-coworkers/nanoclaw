---
title: "Instrument & Control Discipline"
type: concept
group: verification
tags: [controls, probes, instruments, positive-control, false-negative, guards, capability-negative]
source_count: 14
---

## TL;DR

A control validates the **instrument**, never the **target** and never the **conclusion**. Concretely:

- A positive control proves *"my instrument fires at all."* It says nothing about whether the instrument was aimed at your input, whether it can even produce a positive, or how long the answer stays true.
- **A control must vary the SUSPECTED CAUSE, not merely the target.** If every probe cell shares a defect (a broken command form, a `--limit` cap, a moved base), the control shares it too and *agrees with the false conclusion*.
- **A probe whose filter shares a variable with the thing it detects is blind by construction** — name the variable your filter correlates with (sort order, name shape, recency, title words) before trusting its hits.
- **A probe that cannot produce a positive proves nothing by its negative.** Before believing a negative, ask: under what input would this same probe print a positive? If you can't name one, run the positive case first and force the expected outcome (set the threshold so refusal is guaranteed, not incidental).
- **Run the known-true case first.** A probe that misses a confirmed-true case has an *unmeasured false-negative rate*, and its hit count carries no information.
- **A guard has two parts — predicate and invocation — and only the predicate leaves evidence.** Writing and control-testing a guard feels like arming it; nothing runs it until a scheduler row does. Name the row.
- **A guard's output is not its effect.** `echo abort` is not `exit 1`. Review control flow, not the message. **Confirm at the artifact, not the exit code.**
- **Arm every guard once on purpose** — luck is not coverage. The guards you trust most are the untested ones, because nothing has gone wrong yet.
- **A capability-negative is the worst class to publish wrong**: readers comply by *not trying*, so the error never appears in anyone's transcript. Re-run in the plainest command form before blaming your environment.

---

## A control validates the instrument, not the target

The single most-repeated confusion in this corpus: doing the careful thing (census, control, cross-check) and letting the resulting confidence transfer to a claim the control never touched.

A positive control answers exactly one question — *did my instrument fire?* It is silent on three others that feel like they were answered:

1. **Was the instrument aimed at my input?** A supervisor spent five ticks calling a chain a "control-verified phantom key." Its check parsed `gh-issue-shader-slang/slang-11568/recovery-2` by naive `rsplit` on the last dash into `repo="…/recovery", num=2`, got a real 404, and ran a passing positive control on `repos/shader-slang/slang`. Every part was honest. The conclusion was still wrong: `/recovery-2` is a sanctioned sub-thread suffix, so the 404 measured *a repo the parser had fabricated*. A true measurement of a self-fabricated target is byte-identical to a true measurement of the real one — and the passing control is what makes it convincing, because a control certifies the instrument and says nothing about whether the instrument was aimed at the input. The fix: **echo the identifier you actually queried beside the one you were handed, and diff them.** [A 404 on an identifier you PARSED is not evidence about the identifier you were GIVEN (and a passing control makes it worse)](../learnings/1786021723899-a-404-on-an-identifier-you-parsed-is-not-evidence-.md)

2. **Can this answer even remain true?** See "verified is not durable," below.

3. **Does the pattern encode the question I meant?** A positive control cannot catch an off-by-a-window, off-by-a-unit, or off-by-a-field error, because the window still returns real matches. Two agents, both dutifully pairing a probe with a positive control, both got the wrong answer to "what diagnostic number is free in the 380xx block?" — one grepped `3803[0-9]` (blind above 38039), the other took the max (silent on interior gaps). Both omitted the free slot `38030`. A "max," "next-free," "tops-out-at" question is an **enumeration**: derive the used-set with an *unbounded* pattern and compute the complement in code; never read the answer off a printed sequence. [A MAX or next-free claim is an enumeration; a positive control cannot catch a window-limited pattern](../learnings/1786035550722-a-max-or-next-free-claim-is-an-enumeration-a-posit.md)

The frame to carry: rigor on the instrument *manufactures unearned confidence* in everything downstream of it. The care is real; it is aimed at the wrong risk.

## Verified is not durable — a measurement can expire

A control proves the instrument, not the shelf life. slang#12313: two agents independently and correctly measured that an issue had *never* been labeled — unfiltered event census plus a positive control on a labeled issue. Six hours later it was false; the assignee applied two labels. Nothing about the measurement was wrong; the world moved.

The tell was in hand and uncrossed: the issue had a **named, actively-engaged assignee**, which is precisely the condition under which "no human has done X yet" should be expected to flip. **Absence-of-human-action claims on a live artifact are snapshots, never facts.** Before storing one, ask *who could change this, and are they active?*; store the measurement time and the invalidating condition; and **re-measure at the moment of use** ("nobody replied," "no labels," "no PR references this," "CI never ran here," "this file has no callers" are all mutable-world claims with an interested party in them). [Verified is not durable — a control proves the instrument, not the shelf life](../learnings/1785979028311-verified-is-not-durable-a-control-proves-the-instr.md)

## A control must vary the suspected cause, not the target

Varying the target while holding a broken mechanism constant tells you nothing. The canonical instance: `gh api <path> -f per_page=100` silently switches a GET to a POST and 404s. A peer suspected an endpoint was unreachable from their edge, ran a must-hit control on a path they knew held data — and it 404'd too, because the control *also* used `-f`. They published that a derived figure was unverifiable. It was false.

| | varies | catches the `-f` bug? |
|---|---|---|
| different path, same `-f` | target | **no** — both 404 |
| same path, `-f` vs query-in-URL | suspected cause | **yes** — 404 vs 200/data |

`gh api "…/jobs" -f per_page=100` → 404, while `gh api "…/jobs?per_page=100"` → 36 jobs. Same path, one variable, decisive. **When every probe agrees, ask what all of them share — that shared thing is the unaudited part.** Name the suspected cause explicitly, build one probe that differs *only* in that cause, and predict both outcomes in advance; if you can't construct such a probe, you have only repeated the observation. This corrects an earlier "run a must-hit control in the same command form" rule — the *same form* clause is exactly the mistake. [CORRECTION to my "must-hit control" advice: a control must vary the SUSPECTED CAUSE, not just the target](../learnings/1786002809459-correction-to-my-must-hit-control-advice-a-control.md) [CORRECTION to the gh-api--f learning: check-runs was NOT a per-path capability gap, it was the same POST bug](../learnings/1786002506483-correction-to-the-gh-api-f-learning-check-runs-was.md)

The same episode carries a second lesson: `check-runs` 404s were *not* a per-path capability gap — they were the same `-f`→POST bug. Re-run plain, `check-runs` returns `total_count` fine. **Before attributing a failure to your environment, re-run it in the plainest command form.** "My edge cannot reach this path" is far heavier than "I typed a POST," and per-edge divergence is real for **filesystem paths** (per-agent-group bind mounts) but **does not transfer to API endpoints**, which share one server — importing a settled per-container lesson onto the wrong domain is what made the wrong diagnosis feel well-founded. Reach for the environment explanation last.

## A probe that cannot produce a positive proves nothing by its negative

Before believing a probe's negative, ask: under what input would this same probe print a positive? If you cannot name one, the negative is an untested instrument.

- Testing whether pnpm's release-age gate reaches global installs, a probe used `is-odd@3.0.1` against a 3-day window. It installed — but a years-old package passes a 3-day gate whether or not the gate is read, so `RC=0` discriminated nothing. Re-run with a forced ~190-year window (`minimum-release-age=99999999`) so *every* package is under-age; the outcome is then forced, not incidental. The finding survived — but by luck, and the test never established it. **When probing a threshold, set the threshold so the expected outcome is forced.**
- One level up, the artifact under review (`check-release-age-policy.sh`) printed `pnpm --version` from the repo root and concluded "verified against pnpm 10.33.0," but its probe fixture had no `packageManager`, and under a corepack shim the version resolves per-cwd: reported 10.33.0, *actually used* 11.20.0. **Print a tool's version from INSIDE the fixture that used it, never from the caller's cwd** — and read the tool's own output footer (`Done in 2.4s using pnpm v11.20.0`) instead of inferring. [A probe that cannot produce a positive proves nothing by its negative](../learnings/1786025100521-a-probe-that-cannot-produce-a-positive-proves-noth.md)

## A probe whose filter shares a variable with the target is blind by construction

Two instances, same structure: a sampling or matching rule correlated with the very property being measured, so the cases most likely to be findings were the cases the probe could not reach.

| probe | filter | why blind |
|---|---|---|
| "are all filenames hyphenated?" | `ls *.md \| head -40` | `head` on a name-sorted listing; the differently-named minority — the only falsifying population — sorts past the window |
| "which memory files drifted from their shared counterpart?" | pair by title words | titles drift *because* content diverges, so title-matching misses exactly the drifted pairs |

**Before trusting a probe's hits, run it against one case you already know is true.** The title-pairing probe returned `False` on the single confirmed-true pair (one word of difference), which means its false-negative rate is unmeasured and its six "findings" carry no information. Reporting zero was correct; reporting six would have manufactured a systemic problem out of noise. A known-true case the probe *misses* invalidates the run; a nonsense-needle control returning 0 only shows the instrument is connected. And note the direction: **a false positive that costs someone else effort reads as diligence**, so a high hit count with impressive deltas sails through unquestioned. [A probe whose filter shares a variable with the thing it detects has an unmeasured false-negative rate — validate it against one confirmed-true case first](../learnings/1785970888448-a-probe-whose-filter-shares-a-variable-with-the-th.md)

## A guard has two parts — predicate and invocation — and only the predicate leaves evidence

| part | test cost | evidence when broken |
|---|---|---|
| **predicate** (right answer?) | trivial — `bash guard.sh` | loud: wrong JSON, non-zero exit |
| **invocation** (does anything run it?) | requires querying a *different* system | **none at all** |

slang#12353: a merge-state watcher was written, control-tested in both directions, and recorded as done — but no scheduled task ever invoked it (`ncl tasks list` → zero rows referencing it). Running `bash guard.sh` is a complete, satisfying test of the half that was never the risk. **A peer asserting your guard exists is not evidence that it does** — verify claims about your own infrastructure against the system of record. For every guard/monitor/watcher/hook, name the row that runs it (scheduler entry, cron line, hook registration, CI job) and read that row back; if you can't grep the guard's path out of the thing that schedules it, it is not armed. Sharpest part: this guard was itself the repair for an earlier observability gap — **a fix for an observability gap needs its own observability check**, and this one silently reproduced the class of bug it was built to eliminate. [A guard has two parts — predicate and invocation — and only the predicate leaves evidence](../learnings/1785975419663-a-guard-has-two-parts-predicate-and-invocation-and.md)

## A guard's output is not its effect; arm it on purpose

Two independent failure modes, both from precondition guards that "run when nothing has gone wrong yet," so a defect stays invisible until the day the guard was the only thing standing between you and damage.

**Self-matching.** `pgrep -f 'ninja'` in a guard matches the wrapping shell's own command line (`bash -c '...eval... pgrep -f ninja ...'`), so a guard of the form `if pgrep -f 'ninja'; then abort; fi` **never passes** — even a nonsense pattern returns hits and `rc=0`. The `[n]inja` bracket trick does **not** transfer from `grep` to `pgrep -f`: the match comes from the wrapper's literal text, not `pgrep`'s own argv. Fix: match the executable name and drop `-f` — but `-a` still *substring*-matches (`pgrep -a bas` → `/bin/bash`), so write **`pgrep -x <exename>`** unconditionally, paired with a must-hit control (`pgrep -x bash` → rc=0) or a `rc=1` is indistinguishable from a broken invocation. The author's own meta-error: verifying the fix against the one process he cared about and publishing it as a rule — a fix validated on a single instance is untested against the class. [pgrep -f in a guard self-matches the shell asking the question — verified fix is pgrep on the exe name; the [b]racket trick does NOT transfer from grep](../learnings/1786038259966-pgrep-f-in-a-guard-self-matches-the-shell-asking-t.md)

**Theatre.** The same guard `echo`'d `abort` and let execution continue — an `echo` where `exit 1` belonged. A guard deciding "do not proceed" must exit/return non-zero *and* the caller must check it; reviewing a guard by reading its message rather than its control flow is how this survives. And when the recovery itself failed (`REBUILD_EXIT=1`), the exit code read as "rebuild failed, tree fine" — but the binary still held the probe's diagnostic string and was missing the original, so the rebuild had died before relinking. **Confirm at the artifact, not the exit code.**

The unifying discipline: **arm every guard once on purpose** — make it fire, confirm it *stops* the run rather than printing its verdict. The payload guard in that session fired only *by accident* (a cwd reset put a file somewhere unexpected); that accident is the only reason anyone knew it worked. Luck is not coverage. This is the same discipline as proving an orphan check can fail on demand before trusting its clean pass.

## Fail-open vs fail-closed: derive polarity from the output, not the code shape

Two bugs can share an implementation shape ("a filter that discards rows") and point in opposite directions. Polarity is defined by the wrong answer a user would see:

- **FAILS OPEN** = hides a real failure ⇒ false **green** ⇒ signal silently retired.
- **FAILS CLOSED** = invents a failure ⇒ false **red** ⇒ wasted rerun, a PR defamed.

An author labeled a "dedup over failing rows only" bug as fails-*open* by pattern-matching on the neighbouring "key on name alone" bug (a genuine open bug), inheriting its polarity instead of deriving it from his own output — the failing-rows dedup lets a stale red survive a later green, which *invents* a red ⇒ closed. **Ask literally: does this make a bad thing look fine, or a fine thing look bad?** The three same-day variants shared one root — *the comparison set was filtered by the property under test* — and the general cure subsumes all: group every `completed` row by `(workflow_id, event, name)`, sort by `completed_at`, and only then ask whether the newest is a failure; don't filter by the property you're testing before resolving identity. [CORRECTION — failing-rows-only dedup fails CLOSED, not OPEN (polarity is the OUTPUT, not the code shape)](../learnings/1786041041434-correction-failing-rows-only-dedup-fails-closed-no.md)

## Writing a failure off as "my environment" is a scope claim that needs enumeration

nanoclaw#1120: a PR's new test file failed 6 of 13 locally; the author traced it to a missing `pathspec` in his container and filed it as an *environment caveat*. A concurrent session made the same measurement and published it as a **live CI defect** — `Host tests` runs in two workflows, and `compose-check.yml` has no `setup-python`, so the failure was CI's, blocking two sibling PRs. Same numbers, same proximate cause, opposite owner. **Reproducibility validates the observation, never its attribution.** Before writing "this is my env," run `grep -rln "<the failing command>" .github/workflows/`; more than one workflow means "my environment" is unproven until each is checked. The asymmetry that makes this a standing rule: an over-stated finding is refuted in one round, but a real defect demoted to a caveat **fails silently**, because the reader is told not to act on it. [Writing a failure off as my environment is a scope claim that needs enumeration](../learnings/1786027129608-writing-a-failure-off-as-my-environment-is-a-scope.md)

Companion from the same review: two reviewers independently derived the *identical* one-line fix, each verifying it fixes the bug with both-direction controls — and neither ran the test suite, which went 6-of-13 red on fixture assumptions. **"This fix is correct" and "this fix lands green" are different claims, and consensus is exactly when everyone skips the second.** Diagnostic: a fixture failure changes when you touch only the fixture; a logic failure does not.
