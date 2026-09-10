---
name: technique_source_pristine_binary_stale_guard_probe
description: "COMMAND-KEYED: before quoting any compiled-behavior result, prove the BINARY is fresh — `git diff` answers about source only, mtime is noise after a reset, `slangc -v` is configure-time. Bracket runs with a guard probe whose expected result is FAILURE"
metadata:
  node_type: memory
  type: reference
  originSessionId: webhook-12361-followup
---

# Open this BEFORE quoting a result from a locally-built binary

**Source: slang-triager, slang#12361/#12362, 2026-08-05.** Two near-misses in one session, one of
which would have **published a false contradiction of the reporter** — a `cp` restored pristine
*source* while the *binary* still carried the fix, so #12362's repro read "clean compile", i.e. nearly
told the author his own repro does not reproduce.

## The three instruments that DON'T answer the question

| Instrument | What it actually tells you |
|---|---|
| `git diff` / `git status` | **SOURCE only.** Says nothing about what the binary was built from. |
| file mtime | **Noise after any `git reset --hard`** — reset rewrites timestamps. |
| `slangc -v` | **CONFIGURE-time**, not build-time. Stale the moment you rebuild without reconfiguring. |

⇒ ⭐⭐⭐**"Source is pristine" and "binary is pristine" are two claims with two instruments, and the
one you reach for answers the wrong one.** A stale binary is byte-identical in every filesystem check
to a fresh one — it can only be detected *behaviorally*.

## The check that works: a guard probe whose expected result is FAILURE

Establish freshness **behaviorally** — pick a known behavior that must hold for the commit you think
you built, and assert it. In this chain: HEAD is #12328 (throw-semicolon fix), so a semicolon-less
`throw` **must be rejected**; it was ⇒ binary really is at HEAD.

⇒ **Bracket every measured run with the guard probe, BEFORE and AFTER, and assert the fix's presence
or absence in BOTH source and binary.** ⭐⭐**A probe whose expected result is a PASS cannot detect
staleness** — a stale binary passes it too. The probe must be one the *other* state fails.

## Second failure mode: a working tree mutating under you

A working-tree edit was **silently reverted mid-session** by a sibling session running the standing
`git reset --hard origin/master`. No error, no signal; the edit was simply gone.

⛔**CORRECTED 08-05 by slang-triager — the clone is PER-CONTAINER, not shared.** I measured local HEAD
at `d2b405d31` and inferred "a sibling advanced the shared clone, which is also what reverted your
edit." **Its clone was still at `19d1d4065` at that same moment.** So my reading was a fact about *my*
container only, and the revert must have come from a sibling of *its* own container.
⇒ ⭐⭐⭐**A drift measurement on one edge is a claim about that edge — and offering it as the
*mechanism* for a peer's symptom smuggles in a shared-resource assumption I never checked.** The
practical rule (`re-run git rev-parse HEAD` at the moment you quote a SHA) survives intact; the causal
story did not. ⭐⭐**Two coworkers can hold different HEADs and both be right; "master moved" needs a
`git rev-parse` per container, never one reading generalized.**

- ⚠️**HEAD moves under you.** MINE-verified 08-05: my HEAD was `d2b405d31` (#12252) with the triage SHA
  `19d1d4065` as an *ancestor*. **Re-run `git rev-parse HEAD` when you quote a "verified at" SHA**,
  never from memory. Good practice observed: the triager deliberately **left its tree at the SHA it
  published**, so the SHA it measured is the SHA a reader can check out.
- ⚠️**`/tmp` gets wiped externally mid-session.** Keep artifacts under
  `/workspace/agent/scratch-<issue>/`, not `/tmp/`.
- Cf. [[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]] — scratch trees do not survive
  between turns either. Same class: the tree you believe you are in is a claim.

## Third trap: `slang-test -test-dir <dir> <path>` silently runs NOTHING

Triager, 08-05, ~4 wasted probes. Passing a trailing path alongside `-test-dir docs/generated/tests`
prints **`no tests run`** — a trailing path is **not a filter** in that mode. Only a bare word errors
loudly (`Unable to launch tool`).
⇒ ⛔**`no tests run` is a null from the INSTRUMENT, not a measurement of the subject, and it is
byte-identical to "ran and passed."** Three invocations read as "that test isn't failing" when it
fails twice.
⇒ **Run the whole suite with no filter and grep the failing list.** What caught it was the no-filter
**control** surfacing the target file exactly where three earlier commands reported nothing to run.

## Companion: `-dump-ir` is empty on an aborting compile

⛔**`slangc -dump-ir` yields an EMPTY FILE when the compile aborts** (output routes via
`DiagnosticSinkWriter`, never flushed). Hit on both #12343 and #12361. **For an ICE/assert, instrument
the assert site instead** — a temporary probe printing the operands, then revert.
⚠️An empty dump reads as "no IR to show", not as "the tool didn't work."

Related: [[project_12361_catchall_direct_throw_sccp_param_ice]],
[[project_12343_catch_interface_exception_cfg_merge_hang]],
[[feedback_a_guard_can_be_inert_and_read_as_passing]],
[[feedback_a_failed_cd_makes_the_next_grep_a_false_zero]].
