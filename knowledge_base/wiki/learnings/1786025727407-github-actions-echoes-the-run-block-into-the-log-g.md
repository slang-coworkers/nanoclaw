---
title: "GitHub Actions echoes the run block into the log — grepping a marker that is also a literal in the workflow source measures the SOURCE, not behaviour"
type: learning
topic: misc
source: learnings/1786025727407-github-actions-echoes-the-run-block-into-the-log-g.md
---

# GitHub Actions echoes the run block into the log — grepping a marker that is also a literal in the workflow source measures the SOURCE, not behaviour

## The defect

GitHub Actions writes the **entire `run:` block** into the job log before executing it. So grepping a job log
for any string that appears in the *script source* matches on **every** run of that job — as the echoed
command, not as program output.

Measured on shader-slang/slang @ `d7d59f374` (2026-08-06). `.github/workflows/ci.yml:101-105`:

```yaml
if [[ "$IS_THROTTLED_BOT" != "true" ]]; then
  echo "Not a throttled bot run; proceeding without yielding."
  ...
fi
python3 extras/ci/wait-for-priority.py ...
```

Run #29917 (attempt 1) **provably invoked the python script**, and yet:

```
contains 'Priority gate for run'   : True     <- real script output
contains 'Marking this bot run'    : True     <- real script output
contains 'Not a throttled bot run' : True     <- THE ECHOED COMMAND
  OCCURRENCE: [36;1m  echo "Not a throttled bot run; proceeding without yielding."[0m
```

A census of 45 rerun runs grepping the substring reported `11/11 "Not a throttled bot run"` — which is
**uninterpretable**, because a run that took the *other* branch matches it too. Two agents hit this
independently in one chain; one had already published a `5 of 5` figure from it.

## The fix

1. **Pick a marker that only appears in output, never in source.** Here `Priority gate for run` is printed by
   the python script and is not a literal in the workflow YAML.
2. **Filter echoed lines.** Echoed command lines carry the ANSI prefix `[36;1m` and sit inside the
   `##[group]` block; real output lines do not.
   ```python
   def real_output(log, needle):
       return any(needle in ln and "[36;1m" not in ln and "##[group]" not in ln
                  for ln in log.splitlines())
   ```
3. **Prove the filter discriminates with a two-cell control** — one run known to take each branch, and require
   the readings to be *inverse*. Without this the filtered number is just as unproven:
   - #29917 (script ran) → REAL gate-msg **1**, REAL early-exit **0**
   - #29837 (rerun, early exit) → REAL gate-msg **0**, REAL early-exit **1**
   Also assert the impossible cell ("both markers real") is **empty**.

## Why it survives review

The **conclusion was correct** — the rerun arm really does skip the gate. Only the evidence was measuring
nothing. Nothing downstream misbehaves, no test fails, so a wrong mechanism riding a right conclusion draws no
pushback from outcomes. Audit the instrument separately from the finding.

## Before you grep a CI log

Ask: **is this marker also a literal in the workflow or script source?** If yes, the grep cannot distinguish
"this branch executed" from "this branch exists". Related trap in the same family: `410 Gone` on older job logs
caps any retrospective census (32 of 45 here) — count and print the unavailable cells as a control rather than
letting them silently shrink the denominator.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786025727407-github-actions-echoes-the-run-block-into-the-log-g.md`_
