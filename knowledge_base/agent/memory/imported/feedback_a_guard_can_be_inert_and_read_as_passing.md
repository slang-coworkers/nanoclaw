---
name: feedback_a_guard_can_be_inert_and_read_as_passing
description: "A guard whose ARMED STATE depends on something it doesn't itself measure will report success while covering nothing — an inert guard and a passing guard are byte-identical from the reader's seat. Before citing any guard: compute the arming precondition PROGRAMMATICALLY, compare against EVERY candidate threshold, state which reading it was armed against, and verify it hit the asserted PATH. A guard has two parts — predicate AND invocation — and testing the predicate produces all the evidence while the invocation produces none. OVER-RETRACTION (collapsing weak-under-one-interpretation to no-evidence) is its own failure mode."
metadata:
  node_type: memory
  type: feedback
  originSessionId: 4f8e1c72-3b6a-4d19-9e05-7c2fa8b3d641
---

# A guard can be INERT and still read as PASSING — compute its arming state before citing it

🔴 **DISCHARGED PREMISE (settled from source).** The truncation thresholds that seeded this file were
never real — the SessionStart hook injects only `/workspace/agent/memory/{index.md,system/definition.md}`
at a 16,000-UTF-16-unit budget (see [[feedback_the_compaction_bound_targets_the_wrong_file]]). ⛔ **Do
not cite any NUMBER in this file as evidence about truncation.** ✅ **The RULES survive on their own
merits** — they are about guards and instruments, not that bound. Note the scope lesson the voiding
itself teaches: **a scoped retraction is not a general one** — when you void a file, enumerate the OTHER
subjects its numbers were used for and re-derive each. And: **rigor downstream of an unverified premise
is confident irrelevance** — every worked example here was rigorous and aimed at nothing.

## The rule

> **A guard whose armed state depends on something it does not itself measure will report success
> while covering nothing.**

An **inert** guard and a **passing** guard are **byte-identical from the reader's seat** — both emit
*"you are reading this, therefore the bad thing did not happen."* Only arithmetic the guard doesn't
perform separates them. Before citing any guard as evidence:

1. **Compute the arming precondition** at the moment of the test — programmatically, never by mental
   subtraction (one lost trailing newline made me "correct" a peer who was right; the formula is
   `last_line_start = total − len(last_line) − 1`).
2. **Compare it against EVERY candidate threshold**, not the convenient one. Two thresholds ⇒ two
   verdicts; a conclusion that doesn't name its threshold reads as a refutation of all of them.
3. **State which reading the test was armed against.**
4. **Inert under a threshold ⇒ NO evidence for it. Not weak evidence. None.**
5. **Verify the test hit the asserted PATH**, not merely a similar one. Never attach a "don't
   re-litigate" lock unless it did — that lock claims COVERAGE, not confidence, and disables the check
   indefinitely.

## The distinct failure modes (each caught on a real chain)

- ⭐⭐⭐ **A guard has two independent parts — the PREDICATE and the INVOCATION — and testing the
  predicate produces all the evidence while the invocation produces none.** A guard script written,
  control-tested both directions, and **never scheduled** (slang#12353) sits inert with no failing
  output. ⇒ **For every guard/monitor/watcher, name the ROW that runs it and read that row back** — the
  scheduler entry / cron line / hook registration / CI job, not the file. Writing a file *feels* like
  arming; a peer asserting your guard exists is not evidence it does.
- ⭐⭐⭐ **A clean/negative RESULT needs arming too, not just a guard.** A negative observation is
  evidence only if the condition it denies COULD HAVE OCCURRED when you looked ("no truncation notice"
  measured below the threshold; "`wc -m == wc -c`" under an unset locale). An inert clean result is more
  dangerous than a guard, because it just looks like good news. The direction (convenient vs feared)
  doesn't change the discount.
- ⭐⭐⭐ **A guard reused from a DIAGNOSIS inherits the diagnosis's assumptions.** A `cmp`-vs-bundled-
  default check was sound as a diagnosis and brittle as a standing guard — ship a new default and the
  stale pins stop matching, so it passes silently (a FALSE ZERO from the REFERENCE drifting, not the
  artifact changing). Ask of any guard: *what would have to change ELSEWHERE for this to silently stop
  working?* Bind the ROLE where you perform the operation, not in the prose around it.
- ⭐⭐⭐ **A verification is pinned to the SHAPE of the fix; when the fix moves (different file/mechanism),
  the evidence does not come with it.** Runtime proof for a call-site fix does not certify the same claim
  after review redirects it to normalize a flag elsewhere. Re-run every empirical claim after files move,
  and sweep the correction across reply + PR body + table + **commit message**.
- ⭐⭐⭐ **A CHECK and its CONSEQUENT must be separable in time, or the check is ornament.** `git status &&
  reset --hard` chained as one invocation destroyed three tracked files — the rule was known, quoted,
  and violated *mechanically*. Never chain a destructive op behind its own precondition (`test && rm`,
  `grep && overwrite`). Amplifier: the project clone is **per-agent-group, not per-session**, so a
  `reset --hard` can destroy a sibling instance of yourself — check `ncl sessions list` first.
- ⭐⭐⭐ **A PRESENCE check standing in for a BEHAVIORAL one passes and reads as diagnostic but tests the
  wrong dimension.** `hasattr(m,"_gh_slug")==False` (symbol gone) is equally consistent with the CORRECT
  helper having been deleted; the behavioral version (drive both, compare against GitHub) gives 7/7 vs
  5/7. Name the property the finding asserted and test THAT.
- ⭐⭐⭐ **The MUTATION check is the operational form of the revert drill, and it is cheap.** A passing
  selftest says nothing (this file's whole point); **seed the exact defect class the artifact exists to
  prevent and confirm it fails on the right thing.** Especially load-bearing when the subject is itself
  a checker. Removing the mechanism and confirming the test goes red is the only instrument that
  separates a working guard from a dead one.
- ⭐⭐⭐ **A CONTROL is a claim requiring its own verification; the first control that agrees with you is
  the least trustworthy.** Four "controls" flattered the author before one was valid. A/B against
  *pristine master*, never your own branch — a control sharing state with the treatment isn't a control.
- ⭐⭐⭐ **A TRUE CONCLUSION LAUNDERS ITS EVIDENCE.** I endorsed a CUDA-signature comparison as "the
  measured version of the defect" for a claim that was true — but the signatures are identical under
  *every* by-reference mode, so they were never a test (the IR dump discriminates). Ask of any evidence
  you endorse: *would this reading have DIFFERED if the claim were false?* Endorsing a coworker's
  evidence adds your authority without adding a check — run the discrimination question before telling
  them to publish verbatim.
- ⭐⭐⭐ **Aggregators select for the failure mode.** `min()` over runs makes a fast *failure*
  (`E00100`, exits 255 in 0.2s) the reported *best* time; report a cell only if every iteration exits 0
  AND produces a non-empty artifact. Whenever you aggregate over trials, ask which direction failure
  pushes the statistic (`min` on latency, `max` on throughput, "best of N" anything).
- ⭐⭐⭐ **`${VAR:-default}` makes a "blank the flag" control vacuous** — the colon form substitutes on
  EMPTY as well as unset, so `OPT= ./m.sh` silently ran *with* the default and the control could never
  fail. Use `${VAR-default}` (no colon) and run it once to confirm IT FAILS. A control never observed
  failing is indistinguishable from one that cannot fail.
- ⭐⭐⭐ **"ROUTED TO CI" is a claim about a CI *run* — open the checks and confirm a run EXISTS and is
  not `skipping`.** A held draft's checks never run and *cannot*; the promise ages into false coverage
  with no event marking the transition. PENDING is its own bucket, and *unrunnable* is a third.
- ⭐⭐ **A green test can be STRUCTURALLY incapable of catching the bug — read its DIRECTIVES.** A test
  carrying only bool→int *legalizing* target paths (`-cpu`/`spirv-asm`/`wgsl`) erases the defect before
  emit; its green is not counter-evidence. A test whose configuration list excludes the failing config
  is not coverage of it.
- ⭐⭐⭐ **A WRITE THAT DOES NOTHING DOES NOT FAIL** — a string-replace against a stale anchor silently
  no-ops and the script reports success. Verify every write by READING BACK the content you intended
  (`|| true` on a state write is an inert-guard factory). Assert the precondition or the postcondition;
  an operation with neither is unfalsifiable, and a halting assertion beats a correction that repairs.
- ⭐⭐⭐ **A self-referential figure is stale the instant the write lands** — but the deciding property is
  whether the figure is SCOPED TO AN EVENT: *"at install this file was 26,914 B"* (past tense, named
  event) is durable; *"measured at install (28,689 B)"* used as the current size decays. State the
  invariant, or scope the figure to an event; never an unscoped tally in an instruction block.
- ⭐⭐ **When a guard misfires, audit its STATE PATH before its MATCHER.** A `|| true`'d counter whose
  dir is absent early-session reads 0 forever and never arms the escalation — a bug whose window is
  early-session is harder to route than a permanent one (a failed repro reads as "not a bug"); report
  the window and the ordering dependency. And a permissive pattern's false positives and true positives
  are the same clause — ladder a tightened version against the ORIGINAL's catches, not just the false
  positives you set out to fix.
- ⭐⭐ **A dramatic result contradicting a specific, checkable claim triggers an INSTRUMENT AUDIT BEFORE
  BELIEF** — "53 of 53 files differ" was an empty-population read (diffing an empty dict against a
  populated one); an instrument that CANNOT find anything is byte-identical to one reporting total
  mismatch. **Every correction worth trusting was RE-DERIVED by its recipient, not accepted** — peer
  agreement by two instruments beats either measurement; peer agreement by deference is worth less than
  one.
- ⭐⭐ **OVER-RETRACTION is its own failure mode.** Collapsing "weak evidence under one interpretation"
  to "no evidence" discards a datapoint that becomes decisive once the mechanism is pinned — file to the
  safe default, but label it a CHOICE, not the finding. The mirror image of vacuous green: both
  misreport coverage. **WRONG-BUT-PLAUSIBLE is worse than GENERIC** — prefer no answer over a plausible
  wrong one at any boundary a human will trust.

## How to apply

```bash
# Arming check — run BEFORE citing, never trust a stored number
python3 -c "d=open('FILE','rb').read(); i=d.rfind(b'MARKER'); print(len(d), i, i>BOUND_A, i>BOUND_B)"
```

Related: [[feedback_a_size_figure_names_a_file_check_which_one]],
[[feedback_compaction_target_yields_to_load_bearing_content]],
[[feedback_control_the_instrument_not_the_reasoning]],
[[feedback_green_job_skipped_backend_zero_coverage]],
[[feedback_a_remedy_that_can_reproduce_its_own_bug]],
[[feedback_a_gate_on_someone_elses_reply_needs_its_own_resume_path]],
[[feedback_a_correct_action_does_not_validate_its_rationale]],
[[feedback_expected_noise_line_is_not_a_failure_signature]],
[[feedback_near_miss_number_is_a_boundary_not_noise]],
[[feedback_every_copy_on_my_disk_never_settles_what_a_run_did]].
