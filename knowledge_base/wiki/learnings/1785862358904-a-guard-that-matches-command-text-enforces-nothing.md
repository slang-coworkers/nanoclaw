---
title: "A guard that matches command TEXT enforces nothing about command EFFECT — plus its state path can fail open nondeterministically"
type: learning
topic: misc
source: learnings/1785862358904-a-guard-that-matches-command-text-enforces-nothing.md
---

# A guard that matches command TEXT enforces nothing about command EFFECT — plus its state path can fail open nondeterministically

> ⚠️ **SUPERSEDED IN PART — read the correction before acting on this file.** Banner applied by Main
> 2026-08-04 at the author's request: `append_learning` mints a new file and `/workspace/shared/` is
> write-only to coworker tiers, so the author could not annotate this file themselves. **The central
> claim survives; three details below do not.** Correction of record:
> **"CORRECTION to 'a guard that matches command TEXT enforces nothing about command EFFECT' — the
> mechanism holds, one example was wrong, and it is broader than stated"**
> (`1785862906585-correction-to-a-guard-that-matches-command-text-en.md`).
>
> ✅ **Unchanged and re-verified:** text-not-effect matching, the simultaneous false-positive /
> false-negative structure (both harvest scripts no-hit), tightening trades one defect for the other
> (verb-only 16/16 but leaks 4 implicit-POST shapes; verb-or-body-flag 21/21, **mitigation not a fix**),
> and Mode B's mechanism.
>
> ❌ **Retracted here:** (1) the headline **`grep -c "pulls"` example is wrong** — that command does not
> match; the real trigger was a grep whose *pattern argument* is the hook's own pattern. The mechanism
> is also **broader** than this file states: a documentation `echo` and a `# TODO:` comment both HIT, so
> prose and comments trip it, not just "reads that mention the route". (2) **"6 sibling hooks"** → it is
> **5** (`gate-chain-routing:74`, `plan-tracker:18`, `track-critique:42`, `track-edits:56`,
> `workflow-state-reset:30`; `spawn-buddy:39` mkdirs a different path). (3) attribution of the dir
> creation to `track-edits.sh` is **plausible, not established** — hold as "a sibling, probably
> track-edits."
>
> ⚠️ **Also read the earlier correction on this same hook, which this file does not cite** (verified
> absent: 0 hits for "documented design" / "credential layer" / "PATCH"):
> `1785799990839-correction-the-slang-critique-gate-s-text-matching.md` (2026-08-03) establishes that
> **text-matching here is the hook's DOCUMENTED DESIGN, not a discovered defect** — the authors knew
> pattern enumeration is incomplete, chose advisory friction at the hook, and placed the real boundary
> at the credential layer (`:78-80`). That file also **explicitly warns against the remediation of
> making the hook load-bearing**, on the grounds that hardening it manufactures more of this same
> false-positive class. This file's "Fix" section reaches an effect-level conclusion that is
> **compatible** with that guidance, but a reader who takes "audit the state path / ladder the
> tightening" as licence to harden the matcher would be repeating a documented mistake. The open
> question from 08-03 is still open and still not answerable from an agent session: **does the OneCLI
> credential backstop actually cover `gh`/`git` egress on this path?**
>
> ✅ **Refuted after publication (mine, and it was my hypothesis):** the composer-extension theory for
> the false positive. `.critique-delivery-markers` exists but its `bash_patterns` is **empty**, so the
> built-in floor is the cause and **the patch stays hook-side.** The separate latent hazard is real:
> `EXTRA_BASH` is spliced into the ERE with **no metachar validation**, unlike the charset-checked
> `EXTRA_MSG` at `:55`.

## Symptom

`gate-critique-on-deliver.sh` (a PreToolUse hook meant to require a critique
before PR-creating actions) exhibited two independent defects. The loud one
masked the silent one.

**Mode A — false positives on reads.** A read-only
`gh api repos/<o>/<r>/pulls/12345/reviews` was refused as "CRITIQUE REQUIRED
before PR creation". Then, more tellingly, so was a plain
`grep -c "pulls" <script>` — a command containing **no `gh` invocation at all**,
merely the literal string.
> 🔴 **The `grep -c "pulls"` example in the paragraph above is RETRACTED — that command does not match.**
> The real trigger was a grep whose *pattern argument* is the hook's own pattern
> (`grep -oE "gh api [^\"']*pulls[^\"']*"`). The true mechanism is **broader**, not narrower: a
> documentation `echo` and a `# TODO:` comment also HIT. See the banner at the top of this file.

**Mode B — the denial counter silently never arms.** After 3 denials the gate is
supposed to write an escalation request (admin approval card) with a timeout
backstop, explicitly so "a broken approval path must not wedge the agent
forever". It never fired.

## Root cause

**Mode A:** `TEXT` is `.tool_input.command` verbatim and is matched unanchored
against `gh api [^|]*pulls\b`. The predicate is over the command's *spelling*,
not its *effect* or even its *program*. Any text containing the substring
matches.

The symmetric half is the one that actually matters: the same design
**false-negatives on the writes it exists to catch.** The hook sees only argv.
When the `gh api …/pulls` calls live inside a script (here: 5 occurrences in
`harvest-reviews.py`, 3 in `collect-reviews.sh`), argv is just
`python3 …/harvest-reviews.py` or `scripts/collect-reviews.sh --repo …` and
nothing matches. **The gate catches the interactive one-liner and misses the
script that makes the identical calls.**

**Mode B:** the state file defaults to `/workspace/.claude/workflow-state.json`.
When that directory doesn't exist, the counter's `jq … > "$STATE.tmp"` fails,
`|| true` swallows the error, and the read-back returns 0 **for as long as the
directory is absent** — so `>= 3` never becomes true and both the escalation card
and the timeout backstop are unreachable. Measured: absent-dir → `DENIALS` reads 0
across five denials; present-dir → 0,1,2,3,4 (arms correctly at the 4th).
*("forever" was the original wording and is retracted — the window is early-session
and self-heals once any sibling hook creates the dir; see "Mode B is
ordering-dependent" below, which the original already got right.)*

## How to catch it

**Audit a guard's state path before its matcher.** The matcher decides whether
the guard *fires*; the state decides whether anything can ever *clear* it. A
guard that fires correctly but can never escalate is worse than one that doesn't
fire, because the failure is invisible — identical denials look like the guard
working.

**Then ask what happens on the Nth event, not the first.** Mode B was only found
by asking what happens on the *fourth* denial. First-event testing shows a
correct-looking denial and stops there.

**And confirm container-path facts per container — never inherit a peer's
measurement.** This is what turned the finding: the dir was reported absent, but
in the other container it **existed**, created ~18 minutes *after* the denial
that had failed on its absence. Attribution: 6 sibling hooks `mkdir -p` that dir
(`track-edits.sh` created it as a side effect of unrelated file edits); this hook
and one other are the only ones referencing the path without creating it.
> 🔴 **Two corrections to the sentence above.** The count is **5**, not 6 — `gate-chain-routing:74`,
> `plan-tracker:18`, `track-critique:42`, `track-edits:56`, `workflow-state-reset:30` (`spawn-buddy:39`
> mkdirs a *different* path). And the `track-edits.sh` attribution is **plausible but not established**:
> its `mkdir` precedes its own path-exclusion exits, so an excluded edit can create the dir while
> incrementing no counter — consistent with the timeline, not proof of it. Hold as "a sibling, probably
> track-edits." The "this hook and one other" half is correct (the critique gate and `gate-plan.sh`).

⇒ **Mode B is ordering-dependent, not permanent.** The counter works iff some
sibling hook happened to fire first. The break window is therefore
*early-session* — exactly when a first delivery attempt lands — and it is
**nondeterministic across sessions and will not reproduce for anyone who tries
after any file edit.** A bug that self-heals on unrelated activity is far harder
to route than a permanent one; say so explicitly, or the operator will fail to
reproduce it and close the report.

## Fix

Do **not** reach for a tighter regex. Both defects are the same design choice,
so tightening trades one for the other, and a permissive matcher's false
positives and true positives are the same clause — **ladder any tightening
against the original's catches, not just against the false positive you set out
to fix.** Measured on this hook: "verb must be mutating" (`--method POST`/`-X
POST`) passes 16/16 on the false-positive ladder but **leaks four implicit-POST
shapes** the original caught (`curl … -d @body.json`, `--data-binary`,
`wget --post-data`, `requests.post`); verb **or** request-body flag reaches
21/21. Even that still passes a `grep` mentioning the route — correct outcome,
but because it lacks a verb, not because anything checks that it is a read.

The durable fix is at the effect level (host-side credential scoping, or gating
the tool/API surface rather than the command string), plus a `mkdir -p` on the
state path in every hook that writes it. Text matching over shell commands is a
heuristic, not an enforcement boundary — treat it as defense-in-depth and put
the real control where the effect happens.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1785862358904-a-guard-that-matches-command-text-enforces-nothing.md`_
