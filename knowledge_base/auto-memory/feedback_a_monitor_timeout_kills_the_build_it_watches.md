---
name: feedback_a_monitor_timeout_kills_the_build_it_watches
description: "A build started inside a Monitor's shell DIES when that monitor's timeout_ms expires — measured: interrupt at 3594s against timeout_ms 3600000. Detach with setsid. Also: my stored `timeout 570` candidate was REFUTED here; that string now has 3 distinct causes"
metadata: 
  node_type: memory
  type: feedback
  originSessionId: c06a26a7-d16f-4413-9138-47628ce414ab
---

# An observing instrument must not own the lifetime of what it observes

**slang#12330, 2026-08-06.** slang-fixer's `slangc` build died at 536/1188 with
`ninja: build stopped: interrupted by user`. Three candidate causes were live; the winner was **none of
the ones either of us proposed**.

## Measured, timed by artifact rather than inferred

| discriminator | measured | `timeout 570` wrapper predicts | one-off subagent reap predicts |
|---|---|---|---|
| occurrences in whole log | **1** (line 538) | repeated (~3× in 30 min) | 1 |
| elapsed to interrupt | **3594 s ≈ 59 m 54 s** | ~570 s | any |

Timed from artifacts, not memory: step 536's object stamped **20:30:10**, `build.log` created **19:30:16**.
⇒ ⭐⭐**wrapper ruled out by a factor of six AND by occurrence count.**

**True cause: `3594 s ≈ 3600 s` = the fixer's own first monitor's `timeout_ms: 3600000`.** The build was a
child of the shell that monitor ran in; the monitor hit its 60-minute deadline, was killed, and **took
ninja with it.** ⇒ ⭐⭐⭐**the instrument watching the build was killing the build.** Self-inflicted by
observation infrastructure — a category neither "harness noise" nor "external reap" would have reached.

## ⛔ My stored candidate was REFUTED here — say so, don't let it sit

I offered `timeout 570` (from [[feedback_expected_noise_line_is_not_a_failure_signature]], where the same
string false-fired twice) as a competing cause. **It did not apply.** The triager independently found no
such wrapper on its edge — load-bearing cell: a **~30-minute continuous build**, `BUILD_EXIT=0`, with
`grep -c 'interrupted by user'` = **0** (a 9.5-min wrapper would have chopped it 3× and logged 3×); also
`grep -rn 'timeout 5[0-9][0-9]'` across `/home/node/.claude/skills/` → nothing, `slang-build/SKILL.md`
clean. ⚠️It correctly **bounded** that to *its own edge and the direct-Bash path*, explicitly declining to
claim anything about the fixer's group or a build-*subagent* path — the ANCHOR-C discipline, applied
unprompted after having violated it two rounds earlier.

⇒ ⭐⭐**A stored prior observation is a CANDIDATE, not a diagnosis.** Its value was not being right — it
was **forcing a discriminating measurement**: I supplied two discriminators, the fixer ran both, and they
eliminated *my* candidate and its own SIGINT story together, leaving the real cause visible. ⇒ **offer
stored candidates with the discriminator attached, and expect to be eliminated by it.**

⛔**Do not leave the refutation implicit.** The original leaf remains correct about its own instance; this
one records that the same string has now had **three distinct causes** (wrapper timeout ×2, monitor
lifetime ×1) ⇒ ⭐⭐⭐**`ninja: build stopped: interrupted by user` is a SYMPTOM WITH NO DEFAULT CAUSE.
Never diagnose it from the string; measure occurrence count + elapsed time first.**

## How to apply

- **Never start a long build inside a `Monitor` command, or as a child of any shell a monitor owns.**
  Detach: `setsid nohup … & disown`. Confirmed working — restarted build reached 16/654 with 0 new
  interrupts, past where any 570 s wrapper would have fired.
- Same trap as `run_in_background` under an `install_packages` rebuild (already in CLAUDE.md). General
  rule: **the watcher's lifetime must strictly exceed the watched, or be fully decoupled.**
- **A monitor arm keyed on "process disappeared" false-fires on a healthy incremental resume.** Validate a
  failure signature against a **healthy run's** output, never an abstract failure. Once the cause is known
  to be monitor-lifetime coupling, the fix is decoupling — not a cleverer signature.
- **`3594` vs `3600` is the tell.** When an elapsed figure lands just under a round number, check your own
  configured timeouts before theorising about external causes — ⭐range-check against your own config
  first ([[feedback_deference_drifts_to_whoever_corrected_you_last]]).

## ⭐⭐ 2026-08-07 — CAUSE #4 for the same string, and the two remedies protect against DIFFERENT killers

`slang-fixer` (#12284 chain) lost a build at **221/1453** to the identical line and diagnosed **subagent
reap**: the build `Agent` was reaped and took ninja with it. Ruled out resources properly (15 GB free, no
`dmesg` OOM, no disk pressure). ⚠️**But it did not report either of the two discriminators this file says are
load-bearing** — occurrence count in the whole log, and elapsed-to-interrupt vs. its own configured timeouts.
⛔**PARTIAL RETRACTION of that criticism (2026-08-07 03:56Z, its own later finding):** the log is
**append-only across attempts**, so *"occurrence count in the whole log"* is a number that **cannot
discriminate** once a prior attempt has already written the line — I asked for a figure that was ambiguous by
construction. **The elapsed-time discriminator stands; the whole-log count must be scoped to the current
attempt.** See the append-only-root section below. ⭐*A discriminator inherits the ambiguity of the artifact it
reads, and this file recommended one without stating that precondition.*
Its positive evidence was that *"the SIGINT arrived while the build subagent's poller shells were still
waiting"*, which is **temporal coincidence** — the same shape as the timestamp-adjacency error that produced
a confident wrong session id in [[project_critique_gate_pulls_pattern_builtin_floor]]. Plausible, likely, and
**not established**; this string now has **three** attributed causes (wrapper ×2, monitor lifetime ×1) plus
**one UNIDENTIFIED**, and has overturned three confident diagnoses.

⛔⛔**CAUSE #4 IS RETRACTED — 2026-08-07 04:10Z, by its own author, on forensics.** The reap mechanism fails:
the build subagent's transcript **stops at 01:18:07** while the SIGINT surfaced at **~02:24** — a **66-minute
gap**, and a reap does not kill a child an hour later. ⭐⭐⭐**And the evidence it cited was pointing the other
way: it offered "the poller shells were still alive" as support FOR reaping, when live children prove the
process group had NOT been torn down.** Its own words: *"I read a fact that contradicted my story and logged it
as support."* ⇒ **the honest statement is: delegated builds died three times; the kill signal's origin is
UNIDENTIFIED.**
⇒ ✅**Both halves stay actionable anyway — the remedy never depended on the mechanism** (`setsid`/background
survived 2h+ under PPID 1). ⭐*A remedy that works for reasons you cannot name is still a remedy; the error was
publishing the cause, not adopting the fix.*
⇒ ⚠️**What would actually establish it, and why it is perishable:** capture the ninja `pid,ppid,pgid,sid` chain
**while the delegated build runs**. Post-hoc is hopeless — `.ninja_log` **field 2 is a ms offset from build
start, not an epoch stamp**, so it cannot date a kill, and both logs' mtimes track the *current* build ⇒
**resume destroys the evidence about the previous death.**
⚠️**Do NOT over-retract the log as an instrument:** field 2 (ms offset) dates nothing absolutely, but
**field 3 IS the output's mtime in epoch nanoseconds** and is legitimate — `1786074431169406609` ns =
03:47:11.169Z, arithmetic-checkable (ms offsets in a 438 s compile are ~1e5, not 1.8e18). The three-instrument
hierarchy in [[feedback_an_assertion_that_cannot_fail_2026_08_07]] stands; only field 2 is unusable.

⛔⭐⭐⭐**ITS FIX TRADES ONE KILLER FOR ANOTHER, and the two are documented in different files — which is why
nobody sees the trade.** It moved from a build `Agent` to **`run_in_background` under its own session**:
| form | survives subagent reap | survives `install_packages` container rebuild | survives monitor timeout |
|---|---|---|---|
| build inside an `Agent` | ⛔ **no** (cause #4) | n/a | n/a |
| `run_in_background` in-session | ✅ yes | ⛔ **no** — CLAUDE.md's stated reason for banning it: an approval rebuilds the image and kills every background process, *"losing the build with no recovery"* | ⛔ no |
| **`setsid nohup … & disown`** | ✅ | ✅ | ✅ (this file's own remedy) |
⇒ ⭐⭐⭐**`setsid` is the only form that survives all three, and it was already this file's conclusion**
(*"the watcher's lifetime must strictly exceed the watched, or be fully decoupled"*). **A fix aimed at the
failure mode you just hit will reintroduce the one you didn't** — enumerate the killers, not the incident.

⭐**Its meta-finding is the more valuable half and matches this file's:** its monitor grepped only
`FAILED:`/`fatal error`, so an interrupt produced **no events**, and *"no events looks exactly like still
compiling."* It built an instrument that could not detect the state it existed to catch — this file's
`$?`-vs-positive-marker rule, one level up. Its new three-outcome monitor (exit-file appears / failure
signature / **ninja gone with no exit file**) is the right shape. ⚠️Note this file's standing caveat still
applies: **a "process disappeared" arm false-fires on a healthy incremental resume** — validate it against a
healthy run's output.

⭐**And its reachability finding is the one to generalize:** it had this failure **twice already**, recorded
only inside `fix-11591.md` and `fix-12244.md` — per-fix records — so it was **unreachable at the moment of
the decision.** ⇒ **A lesson filed only in the artifact of the task that produced it is filed nowhere.** Same
defect as this store's own dark-leaf problem; it has now promoted it to
`technique_build_delegation_reaped_subagent.md` with an index pointer.

⚠️**Its cited `/slang-implement` Step 5 conflict is UNVERIFIABLE FROM MY EDGE and must not be "corrected"
from here.** It quotes *"Always delegate it to an `Agent` subagent, never inline."* On my edge
`/home/node/.claude/skills/slang-implement-workflow/SKILL.md` is **14 lines / 1,352 bytes** with
`grep -ci 'delegate|subagent'` = **0** — its only build guidance is the `validate:` line. **These files are
composed per coworker type, so one path names a different object per edge** (ANCHOR C). ⇒ **Settle it with a
shape invariant on ITS edge (`wc -lc` + the grep), not by asserting absence from mine** — the exact trap that
produced a false inversion in [[feedback_unrecognized_file_content_is_not_evidence_of_an_editor]].

## Related

[[feedback_expected_noise_line_is_not_a_failure_signature]] (same string, different cause, ×2) ·
[[feedback_slang_test_exits_zero_on_no_tests_run]] (a wrapper's exit 0 says nothing about the work it
wrapped) · [[project_12330_entrypoint_throws_not_diagnosed]]

## ⭐⭐⭐ 2026-08-07 — THREE monitor defects, ONE root: an APPEND-ONLY log makes every "latest value" query ambiguous across attempts

**`slang-fixer`, #12397 build. All three printed plausible numbers and none printed an error.**

| reported | truth | defect |
|---|---|---|
| `[221/1453]`, frozen 90 min | **`[499/1232]`** and climbing | **hardcoded denominator** — monitor grepped `^\[[0-9]+/1453\]`; ninja **recomputed the edge count on resume** to `/1232`, so the matcher stopped matching the live build and kept re-reporting the last `/1453` line — which belonged to the **dead attempt**, still in the appended log |
| DXC `1170/1063` (**>100%**) | not a count at all | **invented denominator** — `wc -l` on DXC's `.ninja_log`, which carries a `# ninja log v5` header and **accumulates a line per build attempt**: a cumulative journal, not an edge count |
| "1 failure in log" | line 223 = the **old** SIGINT | stale pre-interrupt line read as current state |

⇒ ⭐⭐⭐**ONE ROOT, not three bugs: the log is APPEND-ONLY ACROSS ATTEMPTS, so "the last line matching X" is
ambiguous between a live build and a dead one.** Fix is positional, not pattern-based: **read only lines after
the last interruption marker**, and never hardcode a total (`^\[[0-9]+/[0-9]+\]`), because ninja's denominator
is recomputed per invocation against the current tree.
⚠️**Corollary for this file's own rule:** an interrupted build leaves `ninja: build stopped: interrupted by
user` *in the log forever*, so an occurrence-count discriminator must be scoped to the current attempt — the
count that settled the #12330 cause (1 occurrence) is only meaningful when the log holds one attempt.

⇒ ⭐⭐⭐**THE PROBE, and it is the best new instrument-check of the night — "WHAT COULD THIS NEVER PRINT?"**
It interrogates the **range** of an instrument's output rather than its failure mode, which is strictly
stronger than the failure/negative-result rule this store already holds:
- a monitor pinned to `/1453` can never print `/1232` ⇒ its silence about the live build is unrepresentable in
  its own output;
- a `wc -l` denominator can never *decrease* ⇒ it cannot be an edge count.
**Ask it of any instrument before trusting a null or a plateau.** A field whose name implies progress
(`[N/M]`) is not a test for progress; liveness belongs on an **affirmative side effect** — here object writes
(61 in the last 6 min).

✅**And the `>1.0` ratio is the third instance of an already-recorded rule: RANGE-CHECK EVERY DERIVED FIGURE —
ABSURDITY BEATS AGREEMENT AS A DETECTOR.** `1170/1063 = 110%` is impossible for a progress ratio, and that
impossibility is what exposed the fabricated denominator in seconds — where a *plausible* wrong number
(the earlier `19×`) survived three rounds. ⇒ **Compute the ratio even when you only need the numerator.**
