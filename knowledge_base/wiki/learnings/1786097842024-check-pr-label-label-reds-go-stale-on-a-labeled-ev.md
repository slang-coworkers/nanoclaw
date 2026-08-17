---
title: "check-pr-label/label reds go stale on a 'labeled' event — filter=latest returns BOTH the red and the green"
type: learning
topic: misc
source: learnings/1786097842024-check-pr-label-label-reds-go-stale-on-a-labeled-ev.md
---

# check-pr-label/label reds go stale on a 'labeled' event — filter=latest returns BOTH the red and the green

## The trap

`check-pr-label.yml` triggers on `on: pull_request: types: [opened, labeled, unlabeled, synchronize, ready_for_review]`. So when a human adds the missing `pr: non-breaking` label, the workflow **re-runs on the same head sha** and goes green — but the original failing check-run row is still attached to that sha.

`GET /commits/<sha>/check-runs?filter=latest` returns **both rows** (same `name`, different backing `run_id`). A name-keyed red scan therefore reports a PR as policy-blocked when it is actually green.

Measured 2026-08-07 across 82 non-draft open PRs: **10 of 88 raw reds were phantoms**, dropping red PRs from 30 → 24. Six were this exact class:
- #11915 — red 08:28:23Z, GREEN 10:00:34Z (label added by `jvepsalainen-nv` at 10:00:32Z, 2 s earlier)
- #12363, #11964, #11373, #11087, #10885 — same shape, plus 3 extra stale rows on #10787

I had *declined* #11915 at 08:23Z on `labels=[]`. That decline was correct then; by 10:00Z it was **moot, not wrong** — the distinction matters when writing the ledger.

## The fix

Group check-runs by `(pr, workflow_id, event, name)`, take newest by `started_at`, and require the backing run to be `completed` **and** the newest run id for that `(pr, workflow_id, event)`. Two independent suppression rules are needed, because the second class is different:

- **#12409**: `check-ci` red belonged to CI run `31167706729` whose own conclusion was **`cancelled`**, superseded by run `31167707937` on the same sha. Log said `filter: cancelled` then 35 legs `skipped` — the aggregator failed having **tested nothing**. Not rerunnable (cancel-in-progress no-op), and a rerun would race the live run.

## Cheap tells

- Check the **live label set** before trusting a `check-pr-label` red — one `gh api /pulls/N --jq '[.labels[].name]'`.
- Identify a bare job name by its workflow **path**, not its name: `review` on #12409/#12389/#12347 all resolved to `.github/workflows/claude-pr-review.yml` (out of scope, never rerun). `review` alone doesn't identify a workflow, same way `check-formatting` exists in two.

---
_Topic: [Uncategorized](wiki/topics/misc.md) · [catalog](wiki/index.md) · source: `sources/learnings/1786097842024-check-pr-label-label-reds-go-stale-on-a-labeled-ev.md`_
