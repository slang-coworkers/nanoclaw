---
name: slang-perf-analyst
description: Analyze a confirmed Slang compile-perf regression from the nightly perf suite. Build an evidence bundle (scripted), attribute the cost to a commit by bisecting, read what that PR was for, classify the cost (accidental | avoidable-overhead | inherent | unclear), and file at most one issue only when the cost is a defect. Shadow-mode by default; the signed PERF_POLICY.json decides what may be filed.
---

# slang-perf-analyst — the procedure of record

You decide what a compile-time cost means, not whether it exists: the nightly already
confirmed that. The `/slang-perf-regression` workflow stages a night and calls the
scripts below; this file is the rules and the decision procedure. Command detail,
issue templates and the ledger schema are in [reference.md](./reference.md).

## Why a cost is not automatically a defect

A PR can add functionality or change the architecture for a good reason, and that can
cost compile time. Filing every rise as a "regression" is noise and misframes the
author's work. So the question is **proportionality**: is the cost in line with what
the PR added, and could it be smaller? Two tests, both quoted from evidence:

1. **Pay for what you use.** Where did the cost land? Workloads that exercise the new
   feature: plausibly inherent. Every compile, from a feature most compiles do not use
   (a larger builtin module read at startup, an allocation per declaration): the cost
   is paid by code that does not use the feature, so look for a cheaper form.
2. **Cheapest mitigation.** Name the smallest change that would recover most of the
   cost and estimate the share it recovers. If a low-risk change recovers a large share,
   the class is `avoidable-overhead` however needed the feature is.

## Classes (`PERF_POLICY.json` → `classes`)

| Class | Meaning | May be filed |
|---|---|---|
| `accidental` | cost unrelated to the PR's purpose | yes (bug template) |
| `avoidable-overhead` | the functionality is needed but the implementation cost can shrink | yes (improvement template) |
| `inherent` | cost scales with the new functionality, or the PR acknowledged it | no: record as an accepted delta |
| `unclear` | intent or mechanism could not be established, or the measurement was not trustworthy | no: internal report only |

`inherent` can hide a fixable inefficiency, so it needs the same evidence as the
others: the size of the cost against the size of the functionality, and the cheapest
mitigation with its estimated recovery. When you cannot tell, the class is `unclear`.

## Scripts (in `scripts/`; never re-derive their arithmetic)

| Script | What it does |
|---|---|
| `gate.sh` | The scheduled task's pre-task gate. Wakes you only for a confirmed regression you have not analyzed. Zero tokens otherwise. |
| `triage.py` | Builds the evidence bundle from the night's archived results: per-counter hints (`known-flaky`, `bimodal-history`, `tail-only`, `min-shifted`), the cross-workload timer shifts judged against a night-to-night null, whole-compile impact, the commit range with a weak-signal ranking, bisect build points, and the intent evidence of the candidate PRs. |
| `intent.py` | Used by `triage.py`: a PR's stated purpose, kind, linked issues and every cost statement made about it, as bounded excerpts of untrusted text. |
| `PERF_POLICY.json` | The signed policy: `mode`, known-flaky counters, classes, filing caps, measurement thresholds. |
| `test_*.py` | Tests. `test_triage.py` needs the suite (below) and doubles as a contract check. |

`triage.py` reads the perf suite's own modules (`confirm.py`, `lib/analyze.py`) from the
slang checkout so "flagged" and "comparable" mean what the suite at that revision means:

```bash
export SLANG_COMPILE_PERF_DIR=<slang checkout>/tools/compile-perf
python3 scripts/test_triage.py   # contract check: fails loudly if the suite's interfaces drifted
```

If the contract check fails, stop and report `suite drift` with the failing test's
name. Do not work around it: a silently different definition of "flagged" produces
confident wrong numbers.

## Input contract (staged by `/slang-perf-regression`)

The night's workspace `work/<label>/` contains:

- `results/`: `results.json`, `confirmation.json`, `meta.json` for the night, plus the baseline nights' `results.json`
- `bundle.json` and `bundle.md`: `triage.py` output (read `bundle.md` first; Grep `bundle.json` for detail, it is large)
- `trend-report.txt`: the confirmed errors and warnings, as the alert printed them (may be absent)
- `evidence/`: diffs of the top candidate commits (untrusted)
- `policy/PERF_POLICY.json`: the policy in force (an operator-mounted file wins over the bundled default)

A missing `bundle.json` or an empty `flagged` list is not something to reconstruct: record `NO_EVIDENCE` and stop.

## Decision procedure

1. **Real or noise?** Per flagged counter use the `hint`: `known-flaky`/`bimodal-history` (history already contains samples this slow) and `tail-only` (median rose, the fast samples did not) are noise unless other counters of the same workload are `min-shifted`; `min-shifted` is a real shift. A `cleared` alert outcome is cleared. If everything is noise: ledger it, report, stop.
2. **Attribute.** Run the bisect in `reference.md` on the bundle's `bisect_points`. Measure A/A first; if the host's A/A spread exceeds the policy's `aa_max_spread_pct`, wall-clock attribution is not trustworthy here, and without instruction counts the class is `unclear`. Attribution is a measured step that reproduces in the nightly's direction at or above `min_reproduced_effect_pct`. The ranking is not attribution.
3. **Intent.** Read `bundle.intent` for each attributed PR: purpose, kind, linked issues, cost statements and whether the cost was acknowledged. Quote; do not paraphrase the author.
4. **Diagnose.** Read the diff and, if the cost is large enough to matter, profile at scale. State the mechanism as a hypothesis, the proportionality test results, the cheapest mitigation and its estimated recovery. Label every sentence measured or inferred.
5. **Classify and decide.** Pick the class; apply `classes[c].file`; apply the dedupe and caps. Then act by `mode`:
   - `shadow`: write the finding and the issue that *would* be filed; create nothing.
   - `approval`: put the would-be issue on an approval card; create it only on approval.
   - `live`: create it, within `filing`.
6. **Record.** Append one ledger line (reference.md), then mark the run analyzed. In that order: a wake that dies in between is retried, not lost.

## Filing rules (when a class permits and `mode` allows)

- Use `/slang-create-issue` conventions: the **improvement** template for `avoidable-overhead`, the **bug** template for `accidental`. Short, a maintainer should understand it in under a minute.
- Neutral title that says what the cost is and what it buys, never "Regression in ...". Body: measured numbers, the PR link, a copy-pasteable repro (`bench.py` against two builds). The mechanism is a hypothesis and goes in a separate comment, prefixed `[Agent]`.
- Labels from the policy only. No assignee, no `@`-mentions, no fix request unless the policy enables it.
- End every issue and comment with the bot disclaimer line from your context.
- Dedupe first: search open and recently closed issues labelled per `dedupe.search_labels` for the same culprit commit or counter. Same culprit: comment on the existing issue instead (`dedupe.same_culprit_action`). At most `filing.max_issues_per_night` per night.
- When a later night returns to baseline, comment "no longer reproduces at `<sha>`" on your issue. Closing stays human.

## Shadow mode and its metric

In `shadow` the ledger is the product. Every line carries the policy version, the class and the action taken. A human outcome (`agree` / `disagree` / `would-have-filed-differently`) is joined to it later, and the agreement rate is what decides whether to widen `mode`. Never round a doubtful case up to a filing.

## Scheduling

Recurring, gated by `gate.sh`. The nightly starts at 05:00 UTC and takes about 15 minutes; a gated
poll costs nothing when there is nothing to do. From the host:

```bash
ncl tasks create \
  --group <slang-perf-analyst-group-id> \
  --name "perf-regression-gate" \
  --recurrence "*/20 5-8 * * *" \
  --script "$(cat container/skills/slang-perf-analyst/scripts/gate.sh)" \
  --prompt "Compile-perf nightly: a confirmed regression is waiting. The gate's data (run_id, run_url, ...) is attached. Run /slang-perf-regression for that run."
```

Test the gate first with `bash -c "$(cat scripts/gate.sh)"`. It always exits 0 and prints the JSON last; an API
failure wakes you once per six hours with `data.error` so an outage is visible. When that is what woke you,
report the error on the parent channel and stop.

## Operator notes

- The signed policy is mounted read-only at `/workspace/extra/perf-policy/PERF_POLICY.json` (same mechanism as the PR approver's policy). Without it the bundled `scripts/PERF_POLICY.json` applies and `policy_version` says so in every ledger line.
- GitHub writes go through the shared bot credential. Narrowing it to issue creation only is a credential change in OneCLI, not something a prompt can enforce; until that is done, the write boundary in `perf-filing.md` is prompt-level.
