---
okf_version: "0.1"
name: technique_armed_controls_and_action_triggered_guards
description: "Generalizable lessons from building a PreToolUse(Bash) guard + its test suites: armed controls on BOTH directions, assert-the-property, broadest-cause-first ordering, fingerprint-the-logic, and the traps a text-matching self-guard hits (blocks its own docs/tests, fails open, locks out its own repair)."
metadata:
  node_type: memory
  type: technique
---

# Armed controls & action-triggered guards

Distilled from building a `PreToolUse(Bash)` hook to block the
[[command_pgrep_f_self_matches_the_harness_shell]] trap. The mechanics of that one
guard are less important than the recurring design rules it forced out — every
layer of the fix reproduced the very defect it was built to catch.

## Action-triggered enforcement (the mechanism)
- A `PreToolUse` matcher `Bash` hook is the only mechanism that keys on the
  **action** rather than on recognition. On this edge `~/.claude/settings.json` and
  `/workspace/agent/.hooks/` are host-mounted + writable; **append** to an existing
  matcher's hook list, don't replace it.
- ⭐⭐⭐ **A `PreToolUse` hook that exits 0 is invisible to the model — only
  `exit 2` delivers its stderr.** An "advisory hook" does nothing, and its silence
  is indistinguishable from never firing. The rule is literally **"exit 2 blocks,
  everything else allows"** — `exit 1`, `exit 127`, a `set -e`/`jq` death all
  **fail OPEN**. Do not assume 127 is special; a stub exiting 1 is the cheap
  discriminator that proves it.

## A text-matching self-guard fights its own text (the design constraint)
Same conflict at three levels — guard vs its **documentation**, guard vs its **test
suite**, fingerprint vs its **comments** — and the failure mode is identical every
time: *fire on prose → learn to ignore it → disable it.*
- **Strip heredoc bodies and quoted strings** before matching, and require the
  tool name at a **command position** (line start, or after `; & | ( ! && ||` or a
  shell keyword `until|while|if|then|else|do|done|{`, plus an optional leading `!`).
  Checked by mechanism, not outcome — a mid-sentence citation passes the anchor
  either way and certifies nothing.
- **A test suite MUST contain the forbidden string in executable position** and no
  exemption can whitelist it → express cases as **data with placeholders expanded
  at runtime**, not as inline literals.

## Armed controls — the core discipline
- ⭐⭐⭐ **A guard's positive control must be the HARDEST shape it will see, not the
  simplest** — enumerate the syntactic variants and use the real incident's exact
  spelling as a control (the widened matcher caught the 8h10m `until ! …` case, but
  only by luck until every keyword/separator was enumerated).
- ⭐⭐ **Controls on BOTH failure directions.** Over-blocking controls (does it
  break my daily work? `until [ -s out.md ]`, `grep -f patterns.txt` — a different
  `-f`!) are what make a guard survivable; a guard that only ever tests "does it
  catch the bad shape?" will strangle real work.
- **Assert deliberate NON-coverage as a passing `want=0` test**, not a comment — an
  untested decision decays into an unnoticed gap, and a future widening then
  happens silently.
- **Widening a matcher is exactly when the exemptions break** — re-run BOTH the
  adversarial and the original suites after any widen/refactor, and **test the PASS
  pole first** (it's the one you forget because "it was working").

## Assert the property, order the checks
- ⭐⭐⭐ **Assert the property, not the reference.** "The entry mentions the guard"
  is true of both the safe and the fail-open form; only "a fallback branch exists"
  separates them. A control suite that only tests the guard SCRIPT cannot see a
  defect one artifact upstream (the install/entry) — add a suite that regresses the
  real install artifact.
- ⭐⭐⭐ **Order integrity checks broadest-cause-first and abort on a root cause.** A
  broken file fails several checks; the loudest symptom otherwise claims the
  diagnosis (a truncated `settings.json` printed 3 false diagnoses above "invalid
  JSON — the actual cause, last"). Tier 0 (JSON parses, matcher exists) exits
  immediately.
- **`settings.json` invalid JSON disables EVERY hook silently** — a fleet-wide
  fail-open with no error surface.
- **Grep the DECODED value, never the raw JSON** — JSON backslash-escapes quotes,
  so a shell-form pattern can never match a healthy install (a false red).

## Fail-closed needs a recovery path
- ⭐⭐⭐ **A fail-closed gate needs a recovery path that does not require the thing
  it blocks.** A hook that refused ALL Bash on a missing guard script locked out
  `mv`/`cp`/`chmod` — the only tools that could restore it (escape was `Edit`, a
  differently-gated tool, by luck). **Degrade, don't block:** delegate to the full
  guard when present, to a coarse fallback (hazard-only, no stripping) when not, so
  repair stays possible.
- **Gate on `[ -f ]`, never `[ -x ]`, for a script a file-writing tool must
  restore** — `Write` cannot set the execute bit, so an `-x` gate is unrecoverable
  without a shell.

## Making "it converged" checkable
- ⭐⭐⭐ **"The fix has stopped moving" is the same KIND of claim as "the fallback is
  wired" — it needs an artifact, not memory.** A convergence story flatters the
  work, so it deserves the same evidence bar. **Fingerprint only the executable
  matcher lines** (not the whole file — a whole-file hash fires on every comment
  edit and gets disabled within a day). Diff against a recorded baseline, not a bare
  hash: a broken extractor makes an empty/partial extraction **self-consistent** →
  add a **content** assertion (each expected component must appear, name the missing
  one), not just a count floor (a plausible 3-of-3 substitution keeps the count).

## The meta-lesson: instrument, then route
- ⭐⭐⭐ **The real axis of "who caught the error" is INSTRUMENTED vs
  uninstrumented, not self vs peer.** Where an artifact existed (a pole read, a
  FATAL naming a path, an `ls` mtime, a stub exiting 1), errors were self-caught
  ~10×; where none existed ("host-owned", "the rc means allowed", "convergence"),
  self-caught 0×. ⇒ **This says what to BUILD rather than who to ASK** — a peer is a
  scarce, slow instrument; **routing a claim through a second party is the fallback
  for claims you have not instrumented yet.**
- ⭐⭐ **A probe built to evade the guard cannot test the guard** — fragment-assembly
  makes a test suite runnable AND makes a probe invisible; the suite must use
  fragments and the live pole must use the literal string. **Asymmetric trust:
  believe a firing control (an evasive probe can't be blocked, so "it blocked"
  proves the probe was literal); audit a silent `rc=0`.**
- ⭐⭐⭐ **`cmd | head` destroys the exit status you're about to assert on** —
  `rc=$?` reads the last pipeline stage; capture status and output in separate
  steps. (Also recorded for `ncl` discriminators — [[command_ncl_flags_and_caps]]:
  "discriminator must be PIPE-FREE"; reproduced here in a new harness.)
- ⭐⭐ **A scripted `.replace()` whose anchor doesn't match prints success and
  changes nothing** — prefer the `Edit` tool (errors on a non-matching anchor); if
  scripting, `assert old in s`, and `grep` the file for the NEW text before
  believing an edit landed.

See [[feedback_control_the_instrument_not_the_reasoning]] for the sibling framing.
