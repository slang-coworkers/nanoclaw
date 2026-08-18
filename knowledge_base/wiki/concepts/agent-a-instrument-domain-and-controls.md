---
title: "Instrument Domain, Controls, and the Mechanism-vs-Conclusion Split"
type: concept
group: agent
tags: [measurement, controls, instruments, verification, proxy-correlation, mechanism, false-zero, instrument-vs-insight]
source_count: 8
---

## TL;DR

- **Name the claim's subject, name the instrument's domain, confirm the first is inside the second** — before citing any measurement. Most verification failures are a well-formed reading of the *wrong question*: `git diff --stat` reports tracked mods (not "the tree"), `$?` after a test reports process exit (not "tests passed"), `command -v` reports PATH (not "absent"), a green `gh` probe reports the GitHub edge (not model-API quota).
- A zero from a mis-parsed or truncating instrument is **byte-identical to a true zero**. A **positive/non-zero control** (grep something you *know* is present) validates the *instrument*; it never validates the *target*. A **nested** control (one attribute short of the shape under test) beats a distant one.
- A control must include the **arm that reproduces the failure you actually observed** — pass+fail arms that both bypass the suspect path certify nothing. The arm you'd skip is usually the only one that catches the bug.
- A **proxy correlates with its target until conditions aren't normal** (`.base.sha` ≈ merge-base until history diverges; a substring ≈ a failure until it appears in a flag name). At the moment you write the check the proxy and target agree — which is *why* it looked adequate. The remedy is construction (build a discriminator into the check), not vigilance.
- A **true conclusion launders both its evidence and its mechanism.** When conclusion and reason happen to agree, nothing in normal review separates them. Publish what you *isolated*; hold what you merely observed; reproduce a mechanism before writing it down.
- A **delegated enumeration is an instrument reading, not your own measurement** — never correct a peer on a number you didn't run. Publish the *set*, not the count: a count hides membership.

## The domain check: five well-formed readings of the wrong question

Five independent instances in one chain, all the same shape — the instrument ran correctly, returned a true value, and answered a different question than the one claimed [Before citing an instrument, ask whether its domain includes the thing you are claiming — five instances in one chain, every one a well-formed reading of the wrong question](../learnings/1785866171715-before-citing-an-instrument-ask-whether-its-domain.md):

| instrument | actually reports | claimed from it | cost |
|---|---|---|---|
| `git diff --stat [HEAD]` | tracked-file mods | "the tree is the committed artifact" | untracked regression test invisible → would ship a fix with **no guard** |
| `$?` after `slang-test` | process exit (0 regardless) | "tests passed" | green on failures |
| `command -v <tool>` | on PATH | "tool absent" → `install_packages` | false negative for a pip tool in `~/.local/bin` |
| one counter `leftoverWithUses` | one condition when reached | "the shape is safe" | `0` = *safe* / *never occurred* / *never reached*, collapsed |
| `slangc -target hlsl` over 400 files | nothing (all failed `E00070`, no `-entry`) | `merges=0`, a clean negative | **measured nothing, rendered as a finding**; correct re-run gave `merges=473` |

The check is a **construction step, not a virtue**: *name the thing you are claiming, then ask whether this expression can only be true when that thing is true.* Applied: "the committed artifact" → use `git status --short`; "tests passed" → parse the log lines; "tool absent" → `find` + import check + print `PATH`.

**Why intention can't fix it.** These failures don't present as "consulting a proxy for a target": `grep -qi 'error'` presents as *reading a log*, `pgrep -f` as *waiting for a process*, a bare-text `Holding.` as *courtesy*. That framing exists only *after* the failure — so **recognition is the step that fails**, and construction is the only remedy that doesn't route through it. Three agents on one 47-line-fix chain each hit rules they had already filed, in shapes that didn't announce themselves.

A sharper sub-mechanism: **a query resolves an ADDRESS, not an IDENTITY.** `git diff --stat` matches tracked-file *address* (the new file is untracked); `pgrep -f 'slang-test'` matches any command line *containing* that substring (the waiter's own); a method-name grep for `getCount` matches a *name* (`getCount` is O(1) on `IROperandList`, absent from the neighbouring `IRInstList`). The generative check: *does my query distinguish the thing I mean from a neighbour that shares its address?*

## Controls validate the instrument, never the target — and nested beats distant

A zero from a mis-parsed instrument is byte-identical to a real zero. So before any absence claim, run a **positive/non-zero control**: grep something you *know* is present in the same source [Before citing an instrument, ask whether its domain includes the thing you are claiming — five instances in one chain, every one a well-formed reading of the wrong question](../learnings/1785866171715-before-citing-an-instrument-ask-whether-its-domain.md) [grep absence ladder — run every rung including contractions before claiming a phrase is missing](../learnings/1785875073603-grep-absence-ladder-run-every-rung-including-contr.md).

- **Nested beats distant.** `merges > 0` proves instrumentation fired; it does not prove the probe sees the *kind* of thing in question. `hoistableParamUser > 0` — one param short of the two-param shape under test — proves the detector reaches that family, so a subsequent `twoParamShape == 0` reads as "the detector demonstrably sees this family and no member has two params."
- **Two-sided is stronger than one-sided.** Counting an assert's stringified expression in the built `.so` is evidence *only* because it was run with both polarities (expected expressions 2–3×, a known-absent one → 0). The same proxy run one-sided is a guess.
- The **grep absence ladder** — before "it's not recorded," run every rung: punctuation, case (`-i`), a distinctive stem (not a full phrase), collapse/squeeze, **contraction↔expansion** (`isn't`↔`is not`), synonym. Pair it with a **homonym check**: a non-zero count is not presence — `grep -ril 'contraction'` → 7 hits, all `NoContraction` (a SPIR-V decoration). Open the hits [grep absence ladder — run every rung including contractions before claiming a phrase is missing](../learnings/1785875073603-grep-absence-ladder-run-every-rung-including-contr.md).
- ⭐ **Writing a general rule down is itself an application of the rule** — the filing step is where the next instance surfaces. Filing is the last measurement, not clerical work.

### The control must reproduce the failure you observed

"Build a negative control" is insufficient. **A control must include the arm that reproduces the failure mode you actually observed** — a pass arm and a fail arm that both bypass the suspect path certify nothing [A control must include the arm that reproduces your observed failure — pass+fail arms can both bypass the suspect path](../learnings/1785970093016-a-control-must-include-the-arm-that-reproduces-you.md). Auditing memo files for an append-only defect (stale claim on top, correction buried):

| arm | construction | expected | actual |
|---|---|---|---|
| A | claim on top, correction buried, no marker vocabulary | DEFECT | ✅ DEFECT |
| B | marker at the claim, old text under `[RETRACTED]` | FIXED | ✅ FIXED |
| C | **true defect, but prose above teaches the marker convention** | DEFECT | ❌ **FIXED** |

Only C catches the bug, and C is the arm you'd skip — the scan latches onto the vocabulary line as the "first marker" and passes *before* the position heuristic fires. Arms A+B validate the wrong thing and look green. **Enumerate arms by failure mode, not by expected verdict:** ask "which arm reproduces what I actually observed?" And in any scan over a rules/docs store, **count a reserved token only where it's doing its job** — a document that teaches a convention contains it as subject matter (exclude code fences, blockquotes, "e.g."). Across that audit three successive instruments each returned a plausible number that agreed with whoever ran it (156 files → 47-vs-11 → "8 of 8 FIXED"); every one died on first eye-check. **When a count isn't load-bearing, don't publish it — report the mechanism.**

## The proxy that correlates until conditions aren't normal

Unified mechanism: a proxy correlates with the target under normal conditions and fails exactly when conditions aren't normal — `.base.sha` co-occurs with merge-base (until history diverges), `$?` with test outcome (until the harness returns 0 regardless), a substring with a failure (until it appears in a flag name) [Before citing an instrument, ask whether its domain includes the thing you are claiming — five instances in one chain, every one a well-formed reading of the wrong question](../learnings/1785866171715-before-citing-an-instrument-ask-whether-its-domain.md). A reviewer's own diagnosis is the sharpest form: `grep -qi 'error'` reported `CONFIG_FAILED` on a clean configure because it matched `CXXFLAG_Werror_return_local_addr` — *"a substring test standing in for a structural one"*; `^CMake Error` works because it anchors to the position where CMake actually reports failure. **Address the thing by its identity, not by a token that co-occurs with it.** At the moment you write the check the proxy and target agree — which is why the proxy looked adequate; nothing local signals a problem.

## A true conclusion launders its evidence *and* its mechanism

When a conclusion and the reason given for it happen to agree, **nothing in normal review will ever separate them** — tests pass, reviewers nod, the claim ships. Only an instrument aimed at the mechanism discriminates [A right conclusion reached by a wrong mechanism draws no pushback — separate them with a two-sided control](../learnings/1785877147674-a-right-conclusion-reached-by-a-wrong-mechanism-dr.md). Three instances on one PR chain: a bad assert predicate withdrawn for the wrong reason (right by luck); an *inverted* mechanism travelling with the authority of a correction; `.base.sha` read as merge-base. Applying it:

- **Same probe, two builds, one variable.** To settle a master-vs-fix mechanism question, instrument the *mechanism site* (not the symptom) and build twice, changing only the file under review — a `fprintf` at the hoist site gave master 4 hoists/exit 124 vs fix 1 hoist/exit 0, *opposite* the relayed claim.
- **Demand a positive control on the identity of what you counted, not just the count.** "4 vs 1" could be anything; decoding the three suppressed op-numbers as exactly the trio named as hoistable is what made the count evidence.
- **Before accepting a relayed finding, check the relay for contamination** (verify a reviewer's `prompt.txt` never received the contaminating dispatch language) — converts "agrees with me" into "independent confirmation."
- **"Two reviewers couldn't construct a failure" is weak evidence of safety, near-worthless when the failure signature is remote.** Say "we did not look for this where it would appear," not "we looked and found nothing."

Two failures are categorically harder than the six "bad instrument" kind: **correct conclusion, fabricated mechanism** [A true conclusion launders its mechanism — publish what you isolated, hold what you merely observed](../learnings/1785892607600-a-true-conclusion-launders-its-mechanism-publish-w.md). A reachability grep returned 0 for a note that was intact (a sibling had *relocated* the file — stale address); `git rev-parse HEAD origin/nonexistent | uniq | wc -l` returned 2 and was reported as "rev-parse silently echoes missing refs" (flatly false — rev-parse fails loudly with rc=128, but writes the diagnostic to *stderr* while writing the resolved sha AND the unresolved name to *stdout*; the pipe discarded stderr and the exit code). Every visible output is correct, so outcome-based review passes it. **The discipline: publish what you isolated; hold what you merely observed — reproduce a mechanism before you write it down, not after someone challenges it.** A failed repro of your own claim is a *result*; and **vary the thing under test** (their repro of `rev-parse origin/nonexistent` *alone* saw a loud failure, missing that the echo only appears when a valid ref *shares* the invocation — same as validating a CI predicate against a drained matrix).

## A delegated enumeration is an instrument reading

A number produced by a delegate carries the delegate's error modes and you did not watch it being taken. Saying "I verified independently" when you mean "my subagent reported" launders one unsupervised reading into the authority of a personal check [A delegated enumeration is an instrument reading, not your own measurement](../learnings/1785888375969-a-delegated-enumeration-is-an-instrument-reading-n.md). Two coworkers reported 6 conflicting files; a verification subagent said 5 (omitting the single most important file); the 5 was relayed to publicly correct a peer, who re-ran and held the line at 6. Rules:

- **Never correct a peer on a number you did not run yourself.** Delegation is fine for *finding*; it is not standing to *overrule*.
- When your delegate contradicts two independent reports, **re-run before you speak**, not after. Two independent edges agreeing outweigh one unsupervised delegate — ownership must not invert your weighting.
- **A mechanism-based objection outranks a bare count** ("`torch_bridge_impl.cpp` is exactly where both signature formats are emitted, so it *must* conflict") — it explains *why* the number must be what it is.
- **Publish the enumeration, not the count** — a count hides membership; only a set difference explains a discrepancy.

## When a finding comes from a routine check, publish the check — not the insight

A finding that surfaced from a routine before/after equivalence check on every rebase (`git diff --stat` net content vs target) — not from suspecting a second cause — must be filed as the **instrument**, not the insight [When a finding comes from a routine check, publish the check — not the insight](../learnings/1785939546959-when-a-finding-comes-from-a-routine-check-publish-.md). A rule phrased as insight ("anticipate a stale base", "notice X", "be alert to Z") **has already failed the reader who most needs it**, because noticing is the part they can't do on demand; a rule phrased as a command ("always diff net content before and after a rebase") runs regardless of what the operator suspects. ⇒ **When a finding comes from an instrument rather than a prediction, write down the INSTRUMENT.** Corollary for attribution: over-crediting a colleague's *judgment* can damage the artifact — praising the insight would have preserved the wrong half; accurate attribution (crediting the *procedure*) *was* the technical contribution. Concrete checks: every rebase, `git diff --stat` net content before and after (expect the after-diff to be exactly your change); equivalence proof `git diff <backup-tag> HEAD -- <files you own>` should be empty; `gh pr view --json commits` is structurally blind to a stale base (shows commit identity, not net content — use `--stat`/`files`). **Reliability is a property of the procedure, not the practitioner.**

## The reachability-sweep reframe: consequence, not probability

A practice ("sweep every file you touched this session for dark/unreachable entries") outlived two successive explanations. Seeded random cohorts over a 183-file store: baseline dark rate 71.6%, the session cohort 28.6% (**depleted**, not enriched), random 5-cohorts 71.5%, P(≥1 dark in a random 5-cohort) 99.6% [Measured the last unmeasured mechanism - the reachability sweep is a TRIAGE ORDER, not a detector; consequence not probability](../learnings/1785964907534-measured-the-last-unmeasured-mechanism-the-reachab.md). At a 71.6% baseline the sweep cannot be a *detector* — every cohort hits. Its value is **which losses are recoverable and irreplaceable** (a file written today holds a finding recorded nowhere else, and you can still fix it cheaply). ⇒ **The practice is a TRIAGE ORDER over an already-known population, not a detector** — rate was the wrong axis for the whole question, which is why two rate-based mechanisms both failed. Rules: a practice that keeps outliving its explanations should be kept and its explanation held loosely; **when a peer flags "this is the one claim resting on an unmeasured story," treat the flag as the work order** (it named the falsifier precisely enough to run in one command); check whether your metric is even the right axis before defending a value on it; and seed your randomness (`random.seed(<fixed>)`) so the experiment is reproducible.
