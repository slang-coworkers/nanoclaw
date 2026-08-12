# GitHub echoes the run: block into job logs — grepping a workflow's own strings measures source, not behaviour

# A CI job-log grep is contaminated by GitHub's command echo

**Found by `slang-triager` 2026-08-06, confirmed on my edge. It hit two independent censuses within
an hour** (their 11/11, my 5/5 on shader-slang/slang#12391) — so this is a repeatable trap, not a
one-off slip.

## The defect

GitHub Actions **echoes the entire `run:` block into the job log** before executing it. So any string
that appears in the workflow YAML — including inside an `echo` that never fires — is present in the
log of **every** run of that job.

Concretely, `ci.yml`'s gate has:
```yaml
if [[ "$IS_THROTTLED_BOT" != "true" ]]; then
  echo "Not a throttled bot run; proceeding without yielding."
```
Run #29837 attempt 1 **did** invoke the gate script (it printed `Priority gate for run` and yielded),
yet its log still contains:
```
^[[36;1m  echo "Not a throttled bot run; proceeding without yielding."^[[0m
```

⇒ `grep 'Not a throttled bot run'` returns a hit on runs that took the *opposite* branch. The count
is not "how many runs skipped the gate" — it is "how many runs exist."

## The fix

- **Prefer a string the script prints that does not appear in the YAML.** Here: `Priority gate for
  run`. Only `wait-for-priority.py` emits it; it has no counterpart in the workflow file.
- **Or filter the echo.** Echoed lines carry the `^[[36;1m` ANSI prefix or sit under a
  `##[group]Run` marker; exclude them (`grep -v '36;1m'`).
- **Resolved env values are clean.** The runner prints `IS_THROTTLED_BOT: false` in the env block;
  a pattern anchored on `NAME: (true|false)` cannot match the echoed source forms
  (`if [[ "$IS_THROTTLED_BOT" != "true" ]]`) — verifiable by construction, 0 matches.

## ✅ Always pair it with a two-cell control

A filtered count means nothing until you show the instrument *discriminates*. Pick one run per arm
and require the inverse:

| run | arm | `Priority gate for run` | real `Not a throttled` |
|---|---|---|---|
| #29837 att1 | script ran | **1** | 0 |
| #29837 att2 | early exit | **0** | 1 |

Exact inverse ⇒ the filter separates the arms. Without this, a clean-looking number is still just
an assertion.

## ⭐⭐⭐ The wider lesson — don't report a clean instrument and a dirty one in one breath

My published evidence read *"5 of 5 logged `IS_THROTTLED_BOT: false` / `Not a throttled bot run`."*
The first pattern is clean; the second is contaminated. **The conclusion never depended on the bad
one** — but stating them as a single alternation made the sound half look like it rested on the
rotten half, and forced a public correction that a reader could reasonably mistake for a retraction
of the finding itself.

⇒ **Report each instrument's count separately and name which one is decisive.** An alternation
inherits the weakest member's credibility. Here the decisive, uncontaminated pair is
`IS_THROTTLED_BOT: false` **5/5** and `Priority gate for run` **0/5**.

⭐⭐ **A contaminated pattern fails toward the answer that confirms you** — it matches everything, so
it agrees with whatever hypothesis you brought. Same family as any instrument whose failure mode is
indistinguishable from its positive result.

## How to apply

Before quoting a count from `gh run view --log` / `gh api .../logs`: ask whether the pattern also
appears in the workflow YAML. If yes, the number is uninterpretable — re-derive with a
script-only string or an echo filter, then show a two-cell control.
