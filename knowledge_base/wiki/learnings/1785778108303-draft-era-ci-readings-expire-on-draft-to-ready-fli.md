---
title: "Draft-era CI readings expire on draft-to-ready flip"
type: learning
topic: ci-tooling
source: learnings/1785778108303-draft-era-ci-readings-expire-on-draft-to-ready-fli.md
---

# Draft-era CI readings expire on draft-to-ready flip

## The trap

shader-slang/slang skips build/test CI on **draft** PRs (`ci.yml` gate: `github.event.pull_request.draft != true`). A manual `gh workflow run ci.yml` on a draft produces a **cosmetic priority-yield**: only `wait-for-human-priority` + `check-ci` "fail", every build/test job is `skipped`. Correctly reading that as "not a real failure" is well known.

The **less obvious half**: that reading has a short shelf life. The moment anyone flips the PR **non-draft**, the real `pull_request` CI fires and can go fully green — but your earlier note still says "CI hasn't produced a full build/test pass."

## What it cost

On slang#12246 I reported "CI has not run a full build/test pass; if you want real signal a maintainer needs to trigger it." A maintainer had already flipped the PR ready, and full CI had passed on the approved head — builds + `test-slang` on Linux/macOS/Windows, Falcor, benchmark, compile-regression, sanitizer, formatting, label checks, **0 failures**. My caveat would have sent a reviewer hunting for green signal that already existed, and could have stalled a merge that was ready. Caught on review; retracted on-thread.

## Rule

**Re-read check-runs at the CURRENT head before making any CI claim** — especially after a draft→ready transition, and especially in a report a human will act on.

```bash
gh api repos/<owner>/<repo>/commits/<sha>/check-runs --paginate \
  --jq '.check_runs[].conclusion' | sort | uniq -c
# and list anything not success/skipped:
gh api repos/<owner>/<repo>/commits/<sha>/check-runs --paginate \
  --jq '.check_runs[] | select(.conclusion!="success" and .conclusion!="skipped") | [.conclusion,.name] | @tsv'
```

Telling the two states apart:

| | priority-yield (draft) | real pass (non-draft) |
|---|---|---|
| `check-ci`, `wait-for-human-priority` | **failure** | **success** |
| `build-*` / `test-*` jobs | all `skipped` | present and `success` |

Two secondary gotchas:
- **Lots of `skipped` runs is NOT evidence CI didn't run.** `f3b5b51188` showed 45 success / 45 skipped / 0 failures — normal for matrix legs plus draft-era leftovers. Count *failures*, don't eyeball the skip count.
- **Don't manually dispatch on a non-draft** to "get signal" — the push already triggered the real run; a `workflow_dispatch` there just adds a confusing red yield on the head.

## Generalizable point

A CI status is a claim about a *specific commit at a specific time*, not a durable property of the PR. Any state change someone else can make (draft flip, rebase, force-push, re-run) invalidates it. Before repeating an earlier CI conclusion in a human-facing report, re-derive it — a stale "it's not ready" is more damaging than saying nothing, because reviewers act on it.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785778108303-draft-era-ci-readings-expire-on-draft-to-ready-fli.md`_
