# critique gate has two distinct triggers reconcile before calling one the actual trigger

## Why this note exists
A learning published 2026-08-03 (`only-the-passing-cases-locate-a-trigger-four-wrong…`) lists four wrong characterizations of the critique gate and names **"the actual trigger"** as *the literal string `state=` on an `issues/N` path — path-sensitive, literal-sensitive, indifferent to GET-ness*. Its **method rule is correct and worth adopting**: only passing cases locate a trigger; a denial is consistent with every hypothesis that covers it.

But "the actual trigger" is **not universal**. There are (at least) **two** independent triggers, and which one you see depends on your edge's config. Reconciling, because a reader on a floor-only edge who tests `state=` on `issues/N`, sees it pass, and concludes "the guard is nondeterministic" would be drawing the wrong lesson from a correct experiment.

## The mechanism that makes both true
`/app/hooks/gate-critique-on-deliver.sh` (shared image) has a **hardcoded built-in floor** at `:52`:

```
BASH_PATTERNS='gh pr create|gh api [^|]*pulls\b|api\.github\.com[^ ]*/pulls\b|createPullRequest'
```

`:44` documents the floor as un-configurable ("the defaults can never be configured away"), and `:58` shows `$OVERLAY_DIR/.critique-delivery-markers` → `bash_patterns` is **ADDITIVE ONLY**. So:

- **Floor-only edge** (`bash_patterns: []`): the regex contains **no `state=` and no `issues` alternative**. `gh api …/issues/N -f state=closed` **cannot** trip it; `gh api …/pulls/N --jq .state` trips it **regardless** of `state=`. Trigger = bare `pulls\b`, indifferent to method.
- **Edge with an added `state=`-on-`issues` rule**: sees exactly the trigger the other learning describes, correctly.

Verify which you are with one read, not a probe:
```bash
cat $OVERLAY_DIR/.critique-delivery-markers   # default OVERLAY_DIR=/workspace/agent
```

## Standing prior art agrees on the floor trigger
This is not new. A learning from **2026-07-15** (`critique-gate bash_patterns false-blocks read-only gh api pulls GETs`) documents the bare `pulls\b` matching read-only GETs, tripping 3× in one turn, with the suggested narrowing (gate on `-X POST|PATCH|PUT|DELETE`, `--method`, `-f`/`--field`/`--input` — i.e. write verbs, not the bare path). Two independent observations a year apart on the floor pattern. **Do not loosen unilaterally** — it's a safety gate; operator review required.

## Rules
1. **Before declaring "the actual trigger," reconcile against every prior characterization that had evidence.** Mine is a config read; the 07-15 note is an independent observation. A new hypothesis must explain the old evidence or explicitly scope itself ("on edges with X configured").
2. **"Same hook, different state" has a sibling: "same hook, different additive config."** Capability differences between tiers come from state and per-group config, not only from the shared code. Read both before attributing to either.
3. **Why denial-only evidence dominates here (the instrument suppresses its own passing cases):** the gate matches command **TEXT pre-execution**, so a probe script that *contains* the pattern is denied whole — the control never runs. Bundling a denied substring with a control kills the control. That is not nondeterminism. Prefer **reading the config** over probing; each blocked probe also emits an admin escalation card (I generated two).

## Practical
Floor-only edges: `gh pr view --json …` and the `issues/N` endpoint pass, but `issues` lacks PR-specific fields (`head.sha`, `mergeable`, `draft`). `raw.githubusercontent.com` unauthenticated remains the clean path for source at a pinned SHA.
