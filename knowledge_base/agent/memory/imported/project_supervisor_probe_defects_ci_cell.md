---
name: project_supervisor_probe_defects_ci_cell
description: "Three confirmed defects in the /supervise-issues probe, all STILL LIVE in the shipped skill at 2026-10-03: (1) 'same run id ⇒ nobody re-dispatched' is false — a rerun bumps run_attempt on the same id; (2) 'latest non-skipped run' borrows an ancestor's green past a draft head — key on head.sha; (3) pull-universe.sh's $-anchored thread regex silently drops sub-thread keys (12 real sub-chains + 6 topic threads on my edge). Plus the lessons the fixer and I took from diagnosing them."
metadata:
  node_type: memory
  type: project
---

# Supervisor probe: three confirmed defects (2026-08-11)

`slang-fixer` refuted the first two on two chains; I verified both on my edge before accepting.
The third took both of us. **Re-checked 2026-10-03: all three are still in
`/home/node/.claude/skills/supervise-issues/`** — `SKILL.md` §2b still says "same run id … nobody
re-dispatched" and "latest non-`skipped` CI run"; `scripts/pull-universe.sh` still has
`re.match(r"gh-issue-(.+/.+)-(\d+)$", t)`. Until fixed, distrust those three cells.

## 1 — A rerun keeps the run id and bumps `run_attempt`

```
run 30555601781  run_attempt=2  created 2026-07-30T15:13:21Z  run_started 23:22:56Z (8h later)
```
So id stability across ticks proves nothing, and the ❌ stale rule nudges for a rebase that
already happened — on exactly the retried runs the rule cares most about. **Fix: compare
`(id, run_attempt)`.** Related: [[feedback_a_rerun_in_flight_is_not_a_rerun_that_cleared]].

## 2 — "Latest non-skipped run" reaches back past a draft head

```
PR #11617 head 4bd18cba1e (draft)  check-runs on head: {skipped: 44, success: 4}
credited run 30888884926  head_sha 7cfb025521  success   ← two commits back
run 30972108017 on the real head: SKIPPED
```
Four nudges told the fixer "latest CI is green" when the head had no real CI. No reordering
fixes it. **Fix: key on `head.sha` and report "no signal on head"** instead of borrowing an
ancestor's result. Same family as a green that belongs to a different object than the one under
review.

## 3 — A two-stage filter, permissive then strict, drops sub-thread keys silently

My nudge said sub-thread `gh-issue-shader-slang/slang-12150/ovhk89-credit` had no outbound; it
had one (`sess-1785851342400-hheoxc` seq 3, 2026-08-04T14:19Z), so the key sat `awaiting_us` for
7 days. I eliminated four candidate mechanisms and stopped at "unresolved" rather than guessing a
fifth. The fixer found it: stage 1 (`startswith("gh-issue-")`) admits the sub-key, stage 2 (the
`$`-anchored regex) drops it.

⭐⭐⭐ **Every diagnostic probe checks the predicate named after the property, gets "yes", and
treats that as "so it was scanned".** All four of my eliminations were downstream of a set the
thread never entered. When a probe's precondition is checked by a different predicate than the
one that admits the record, verifying the named predicate proves nothing.

**My edge: 791 stage-1 keys, 773 kept, 18 dropped** (the fixer could see only 10). They split:
- **12 rescuable** sub-chains with a parent issue number (e.g. `…/slang-10027/diag-retry`,
  `…/slang-12073/resume`, `…/slang-12231-supersede`, `…/slangpy-1079/upstream-slang`);
- **6 topic threads** with no issue number (e.g. `…/slang-backend-codegen-perf`,
  `…/slangpy-sgl-tests-teardown`), correctly excluded.

**Fix needs both:** relax stage 2 to map a sub-key to its parent
(`^gh-issue-(.+?/.+?)-(\d+)(?:[/-].*)?$`), **and** log every still-dropped key. Relaxing alone
turns the 6 topic threads into phantom issues; logging alone leaves 12 sub-chains invisible.
Related parse defect: [[project_scan_py_subthread_key_parse_falsepositive]];
enrichment failure: [[project_supervisor_pull_universe_enrichment_fail]].

## The critique gate blocked read-only verification (resolved)

The gate denied a `gh api …/pulls/…` **read** because its `pulls` pattern matches command text and
it counts memory-file writes as edits → [[project_critique_gate_pulls_pattern_builtin_floor]].
The fixer first escalated a hash deadlock, then ran a fresh round and it cleared — the blocking
condition was freshness (`edits_since_critique: 2`), not the hash. ⭐ **Re-read the reason string
on every refusal: a gate with N conditions emits N messages and only one is current**
([[feedback_gate_remedy_may_be_disjunctive_reread_it]]). The codex-transcript attestation
escalation was dropped; it self-heals per round.

## Lessons from the exchange

- **A negative result is a complete answer.** The fixer was wrong four times on one fact, each
  retraction supplying a new mechanism; a retraction that is itself a mechanism is the
  least-audited claim → [[feedback_a_retractions_own_prose_regenerates_the_retracted_claim]].
  "Sufficient mechanism measured, cause unconfirmed" is the honest ceiling when the state needed
  to confirm it (`supervisor-state.json`) is not in your container.
- **An untested capability-negative** ("a fresh round will deadlock") has no failure signature
  because readers comply by not trying. Run it.
- **A script that prints a hardcoded conclusion is a fabricated measurement.** Scope the redo
  to the instrument's reach: "my inbox has no maintainer message" ≠ "GitHub has none".
- **A timeline `actor` is an identity, not an agency claim** — it cannot tell a manual click
  from automation under that login.
- **A decline needs the same evidence as an acceptance.** A sibling declined #12150/#12340/#12339
  on "I took no action" (unmeasured recollection); `git ls-remote` proved they were its.
- **A false claim in an always-loaded index row survives compaction stripped of its evidence** —
  the index is a router, never a source. Fix the leaf's `description:` so the retraction
  propagates to the generated shards.

## Holds endorsed (operator-gated)

#11617 stays draft (drifted 19→36 behind in five days; syncing per tick drops commits into
pdeayton's open review; 0 replies in 6 days). #12294 stays a draft offer to the assignee under
#10842. "Rebase → it'll go green" was untested: no master `ci.yml` run since 2026-06-23, so
falcor-on-master was unknown.
