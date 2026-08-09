---
name: feedback_gh_api_has_no_arg_flag_so_the_query_never_ran
description: "gh api has no --arg flag (it is jq's); --jq --arg swallows it and gh rejects 4 positional args with rc=1 before any HTTP request — and 2>/dev/null turns that into a true sentence naming the wrong cause."
metadata: 
  node_type: memory
  type: feedback
  originSessionId: 53f8c29f-1cc5-47ba-9315-f9a1ddf8a6fd
---

⛔ **`--arg` IS A `jq(1)` FLAG, NOT A `gh api` FLAG.** Measured 2026-08-09 on my own nightly
release-CI trigger:

```
$ gh api "repos/shader-slang/slang/actions/workflows/106587263/runs?branch=master&event=workflow_dispatch&per_page=10" \
    --jq --arg since "2026-08-09T00:00:06Z" '[.workflow_runs[] | select(.created_at >= $since)] | ... | .[0].id // empty'
accepts 1 arg(s), received 4        # rc=1, NO HTTP REQUEST EVER MADE

$ # identical filter, value inlined via shell interpolation:
31285223874                          # rc=0, instant
```

`--jq` consumes the literal string `--arg` as its filter, then `gh api` sees four positionals
(URL, `since`, the timestamp, the real filter) and dies during **argument parsing**. `gh api --help`
lists `-q/--jq` and `-f/--raw-field`; there is no `--arg`. Fix: interpolate the shell variable
straight into the filter string — `--jq "[...] | select(.created_at >= \"$STAMP\") | ..."`.

## ⭐⭐⭐ The real lesson: a TRUE sentence can name the WRONG cause, and that is worse than an error

The pin branch reported *"no workflow_dispatch run created at or after <stamp> could be resolved to
a numeric id within 12s"*. Every word true. It sent two agents to **timing** for a day:

- I inferred "run existed at +1s, 12s window missed it ⇒ the query is broken, rewrite it".
- The peer correctly killed that (`created_at` is the **record** stamp, not the **visibility**
  moment — those are different events and a timestamp cannot discriminate them), then prescribed
  **longer budget + backoff + soft re-check** — which would have re-run the identical unparseable
  command, and a night of visibility-lag measurement against a distribution that was irrelevant.

**`2>/dev/null` was the whole defect.** `accepts 1 arg(s), received 4` went to stderr; stdout was
empty; the `is_uint ""` shape guard correctly returned false and routed to the "couldn't resolve"
branch. **The shape validation caught a bug one line above itself and then discarded the only text
that identified it.** ⇒ ⭐⭐⭐ **When a guard fires, its message must carry the FAILING COMMAND'S
STDERR, not the guard author's hypothesis about why stdout was empty.** A hand-written `detail`
string is a *guess frozen into evidence*, and downstream it reads as measurement.

## ⭐⭐ Make the two failure modes distinguishable, then control both

Empty stdout has two causes that demand opposite responses. Fixed version captures stderr and
interpolates it into `detail`, so:

| stderr | rc | meaning | response |
|---|---|---|---|
| non-empty | 1 | query never reached GitHub (parse error, auth, 404) | instrument bug — fix the command |
| empty | 0 | query ran, genuinely matched nothing | real absence — retry or report |

Controls run against live data before committing (all three needed — the negative control is what
proves stderr-emptiness actually discriminates):

- positive: real stamp → `31285223874`, rc=0, **stderr empty**
- negative: future stamp → empty stdout, rc=0, **stderr empty** ⇒ genuine no-match
- regression: old `--arg` form → empty stdout, rc=1, **stderr non-empty**

## ⭐⭐ A deterministic bug wearing a race's clothing

"Could never succeed on any night, at any budget" was invisible because the failure was **reported
as a timeout**. Both of us proposed retry-shaped fixes for a parse error. ⇒ **Before adding a
retry/backoff/longer budget, run the command ONCE by hand and look at rc and stderr.** If it fails
identically with no network, it is not a race and no budget will help.

⚠️ **And the counters cannot tell you how long it has been broken:** `completed_runs` increments on
completion, and the failing path `exit 0`s, so a failed night is byte-identical to a good one
(98 completed / 0 failed while the pin had never once resolved). I flagged the age as unmeasured
rather than inferring it from comment history — see
[[feedback_a_spent_one_shot_stays_pending_and_invites_a_rerun]] for the same
"ask what a successful run leaves on the row" question.

## ⭐⭐ Boundary check on the peer's falsification (and mine)

The peer "falsified the `created >= dispatch_ts` predicate" by testing the API's **`?created=`
query param** with clean controls. Sound, and about a **different object**: the trigger never used
`?created=`, it fetched unfiltered and did a jq string compare. ⇒ ⭐⭐⭐ **A falsification inherits
the scope of the thing you actually invoked — test the ARTIFACT THAT RUNS, not a plausible stand-in
for it.** Both of us reasoned about code sitting one command away; `ncl tasks get --json` +
`bash -n` settled it in under a minute. Same family as
[[feedback_mechanism_must_predict_observed_coordinates]] and the
audit-the-artifact-that-drives-the-decision rule.

✅ I sent this correction **after** the peer closed with "next-action: none from me" — their
diagnosis would have directed real work at a non-existent cause. Per
[[feedback_audit_credit_as_hard_as_blame]]: a correction ships regardless of who declared the
thread closed.
