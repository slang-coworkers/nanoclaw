---
name: feedback_control_the_instrument_not_the_reasoning
description: "Every defect in a session of measurement work sat in the INSTRUMENT, not the reasoning — none findable by re-reading the argument. \"Check your work\" and \"run a positive control on your instrument\" feel identical from the inside; only the second works. Catalog of instruments that lie + the control checklist."
metadata:
  node_type: memory
  type: feedback
  title: Run a control on the instrument — re-reading the reasoning cannot find a measurement defect
  tags:
    - verification
    - instruments
    - controls
    - evidence
    - containment
  originSessionId: 68b2a50a-31d8-4902-bb23-826127e1e4a6
---

# "Check your work" is the wrong instruction. "Run a positive control on your instrument" is the right one.

**Observed 2026-08-04/08** (slang#11616/#11617/#12344/#12345 threads). 17+ enumerated defects across four
agents, in sessions where all were *explicitly discussing this exact failure shape.* **Not one was found
by re-reading the reasoning; every one by returning to the artifact.** Reasoning has no access to this
defect class at all — the inferences read fine on every re-read; the *measurements* were wrong, and an
argument cannot inspect its own instrument. From the inside "check your work" and "control the instrument"
feel identical, which is why the pattern survives competent, motivated people. **It is structural, not
personal** — each agent committed the shape *while articulating it*, so it must be a checklist executed
with a positive control per claim, not a principle held in mind.

## Catalog — the instruments that lie (each produced output that read like data)

- **`ls` one directory published as a tree-wide negative** (the lib was in `lib/`).
- **mtime read as provenance** (a build date cannot date a fetch/install).
- **compare API does no rename detection** — right number, invented "counting both halves" cause.
- **bracketed login `nv-slang-bot[bot]` matches nobody** — returns 0 for an author with 157 commits. Prefer
  the RESOLVED identity (`committer.login`/`author.login`) over free-text `commit.committer.name`; they can
  share a value and disagree. `committer.login == "web-flow"` is a *positive* marker of a server-side commit.
- **`git log`/`git show` suppress merge-commit diffs by default** — a search about whether *merges* can be
  pushed was blind to merges. Pass `-m` whenever merges are in scope.
- **`sed -n 'a,bp'` / `git show` output carries NO line numbers** — never cite a line number read from a
  range-printer; `grep -n` anything you intend to cite. (Four instances in one exchange.)
- **`.files[]` capped at 300 records** on both `commits/<sha>` and `compare/<base>...<head>`, no error, no
  `incomplete_results`; `?per_page=300` does not lift it. `.stats` (additions/deletions/total *lines*) is
  NOT a control for the file *count*.
- **A FOURTH truncation axis:** `compare` withholds per-file `patch` while keeping the record, reporting
  `additions:0 deletions:0` (~58% under-report measured; 124 files, far under 300). ⭐⭐⭐ **A record-count
  control cannot detect per-file truncation — a guard armed for one truncation axis is inert against
  another and reads identically.** The trigger is total payload, not file count: a 101-file compare was
  clean, a 41-file one truncated. Sound controls only: missing `patch` key · `changes == 0` on a
  `status: modified` entry · blob-sha inequality via `contents/<path>?ref=<sha>` (ground truth no diff tool
  mediates). Cf. [[feedback_a_guard_can_be_inert_and_read_as_passing]].
- **`wc -m` silently counts BYTES under a non-UTF-8 locale** (returns `wc -c`); pass `LC_ALL=C.UTF-8`.
  `grep -o '[^\x00-\x7F]'` under POSIX matches individual *bytes* of multibyte sequences (15,123 vs a true 33).
- **`gh api` has no `--arg` passthrough** — inline the value; two agents got two different errors for one
  missing feature, so **report a tooling limit by citing the capability check, not the error string.**

## The control checklist (run at the point of claiming)

- ⭐⭐⭐ **A zero without a non-zero control is not evidence.** Run the *same query* where a hit is guaranteed
  (e.g. `--diff-filter=M` on a commit known to modify the path). Two sub-checks, because they fail
  differently: **7a** can the instrument return non-zero at all (positive control on the *same* filter)?
  **7b** can its output carry the claim (wrong ref/format/suppressed diffs)?
- ⭐⭐⭐ **"Zero" was never special — UNIFORMITY is.** Six identical `IDENTICAL`s, a uniform `0/866`, a clean
  sweep of zeros all read as strong signal and are equally consistent with an instrument that *cannot vary*.
  Ask both, out loud: **"same command?"** (a control through a sibling tool tests the sibling) and **"is a
  difference GUARANTEED in this control case?"** (right command, wrong pole = uninformative null). If either
  is no, the control is decoration. Cf. [[feedback_a_discriminator_is_a_claim_about_a_log_run_it]].
- ⭐⭐⭐ **When two instruments disagree, do not pick the plausible story — get ground truth** (blob shas, raw
  bytes, `contents` endpoint). A contradiction is symmetric; recency, authorship, "which side is usually
  right" are not evidence. **A prior tells you which instrument to check FIRST, never which answer to
  publish.** A plausible mechanism with corroborating structure is *not* the discriminating check.
- ⭐⭐⭐ **A control that CANNOT FAIL is not a control.** Run any published guard once against a case where it
  MUST fail, not only one where it passes. (`.stats` was offered as a control for a file count it provably
  can't discriminate — the defect appeared *inside the warning written against it*.)
- ⭐⭐⭐ **Confirmation is when verification is cheapest and feels least necessary.** Suspect any check whose
  first act confirms what you already believed; the reassuring result is exactly where verification feels
  unnecessary. Two tools agreeing to the byte is itself suspicious — evidence they measured the same THING,
  which may not be the thing you wanted.
- ⭐⭐ **A ladder of increasingly precise numbers is a symptom, not progress** (74→86→71→59→51). When
  refinements haven't closed a question, ask what the measurement is OF, or find the case that already
  answers it — "we are fastest at refining a number and slowest at asking what it is of."
- ⭐⭐ **Before asserting CONTAINMENT** ("our case is a subset of this precedent"), enumerate the dimensions
  the claim depends on FIRST, then check each (path · ext · status A/M/D · authorship · resolved committer ·
  push-vs-server-side · which App · 7a · 7b). A precedent matched on ext+path and failed on status. Cf.
  [[project_12192_e55215_constantbuffer_no_source_location]].
- ⭐⭐ **Advising an action raises the bar above holding an opinion** — an unearned recommendation costs
  someone else's work. Before advising on a precedent, check the precedent exercised the mechanism you rely on.

## Two taxonomies for how instruments fail

**MATCHER vs LEVEL errors** (08-05). A *matcher* error matches the wrong text → often structurally
impossible output that announces itself → fix by anchoring (`^## ` not `## `). A *level* error matches
correctly but answers a **narrower question than asked** → plausible output → silent → fix by asking "what
level is this question at, and is that the level I measured?" ⭐⭐⭐ **A correct answer to the wrong-level
question is the failure mode that looks most like success** (four in one chain: unit-test-proves-function-
clears vs *does it run*; direct-parents-zero read as dark vs reachable at *any* depth). The most common
single failure was the **line-wrap false zero** — `grep -ciF` returns 0 across a newline; always collapse
and squeeze first: `tr '\n' ' ' < f | tr -s ' ' | grep -ciF '<phrase>'`. **Design test for any probe:** *if
this were wrong, would the output be ABSURD or merely a DIFFERENT NUMBER?* Prefer the probe whose failure
mode is nonsense; plausible-failing probes need a peer or second measurement.

**ARTIFACT vs ROLE/STATE errors.** Artifact errors are self-limiting (anyone can re-read; a bad instrument
produces odd-looking output). **ROLE and identity claims are outward-facing and fail silently** — nothing in
the tree disagrees — and are the only ones that reach a human. The tell: citing a person/number/state from
memory of an *adjacent* artifact (same subsystem, same week — the adjacency is the hazard). Mandatory
read-before-cite precisely because nothing feels uncertain: `gh api .../pulls/N --jq
'.requested_reviewers,.assignees,.user.login'`. Distinguish **three roles** on one PR — requester ≠
reviewers ≠ affected-test author.

## Claims about your OWN work — recall has no error signal

⭐⭐⭐ **ROOT MECHANISM (08-04):** across ~14 corrections between two agents, **every error was a claim about
a state the claimant had not opened** — a file, a container, an env var, one's own contribution. The
"diligence slot" is a corollary: caveats, corrections, reassurances, forwarded verifications are
disproportionately claims about *unopened* state, because the framing already asserts the checking happened
— **the slot that signals diligence is audited least.** Proximity to the rule does not help: a peer stated
"a config fact confirmed on one edge is a fact about one edge" and violated it four paragraphs earlier.
⇒ **"Remember the rule" was never the mechanism; a store of maxims is useful only insofar as each names a
COMMAND to run.**

- ⭐⭐⭐ **ENUMERATION, NOT RECALL.** Before claiming what an artifact CONTAINS, open it; before claiming what
  you CONTRIBUTED, list it. Subtract your own writes before attributing a delta (a phantom "concurrent
  writer" was entirely the claimant's own +2.6KB). A peer's retraction is a claim too — segment which of
  your legs actually depended on it rather than withdrawing all or none.
- ⭐⭐⭐ **The DETECTABLE TELL: a past-tense verb of completed action about your own work IS the trigger to
  open the artifact** — "I banded the sections", "I've put that in the report", "nothing in my memory
  mentions X", "that's already covered". A denial of a record counts ("no record" → `grep -ril` returned 217
  files including its own refuting row). The fix is mechanical: convert the past-tense verb into a grep
  before the sentence ships.
- ⭐⭐⭐ **A verdict you AUTHORED has no adversary but a command.** A stored figure describing your own store
  is self-certifying (an index claimed 81 archived PRs, self-bumped that session; truth 80 — only `grep -c`
  finds it). *State the check, never the verdict* — even for verdicts that currently hold, because
  correct-and-fragile is indistinguishable from correct-and-robust from inside the text. Publish an
  unattributable number with "I can't say why" rather than manufacturing a cause.

## Two edge cases the thesis does NOT cover

- **The artifact MOVED between two correct reads.** A read of a live artifact is a measurement with a
  TIMESTAMP, not a fact — re-read again before dispatching work premised on its state. When two tiers
  disagree about a live artifact, the first hypothesis is neither instrument: the artifact changed. **Do NOT
  resolve with `updated_at`** — it is bumped by any activity and there is no body-specific edit timestamp;
  compare the CONTENT you each measured (a distinguishing grep count: `NOSCOPE ×0` vs `×20` discriminated
  instantly).
- **A correct number attached to the wrong CONSEQUENCE MODEL.** After establishing a gate is absent, read
  what the gate DOES when it fires — "not gated on PRs" and "harmless until the nightly" are separate claims;
  no amount of controlling the grep finds a defect that lives in the consequence model.

## Count / identifier discipline

- **Publish the ENUMERATION, or no number at all.** An *incremented tally* (ten→thirteen→fourteen→…, each
  the previous plus the defect in front of it, with no list behind it) is not a count. If you keep a count,
  keep the register that produces it *as you go*. The distribution is what transfers, not the magnitude. Cf.
  [[feedback_compaction_target_yields_to_load_bearing_content]], [[feedback_search_code_total_count_is_not_a_file_count]].
- **Never write an external identifier from memory** (path, comment id, run id, SHA) — `ls`/`grep` at the
  moment of citing. **Suspect suspiciously ROUND numbers** in any millisecond/serial id (a fabricated
  `…430000` learning path looked right; real stamps are `…422368`). **Verify a link's TARGET CONTENT, not
  just that the path exists** — a resolving link to the wrong document is worse than a dead one because the
  sweep goes quiet. Sweep the whole class after finding one instance.

## A wrong-reason pass actively CERTIFIES (08-08)

A vacuous pass fails to *test*; a **wrong-reason pass certifies** — every routine re-check comes back green
and nothing ever looks off (a diagnostic fired via *emptiness*, not the *interface-ness* the test claimed).
⭐⭐⭐ **Mutation testing catches a wrong-reason pass iff you mutate the element your CLAIM names, not the
element your ASSERTION names** — mutating the assertion target is a non-discriminating control. Before
mutating, write down the sentence you want to be true and mutate its subject. (An over-accepted share of
blame is the same class of inaccuracy as an over-claimed share of credit — see
[[feedback_audit_credit_as_hard_as_blame]].)

See also: [[feedback_green_job_skipped_backend_zero_coverage]] (could the harness DISCRIMINATE?).
