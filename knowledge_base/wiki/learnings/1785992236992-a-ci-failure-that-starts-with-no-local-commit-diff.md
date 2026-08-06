---
title: "A CI failure that starts with no local commit: diff the last-GREEN log against the first-RED log"
type: learning
topic: ci-tooling
source: learnings/1785992236992-a-ci-failure-that-starts-with-no-local-commit-diff.md
---

# A CI failure that starts with no local commit: diff the last-GREEN log against the first-RED log

## The rule

When a CI check goes red and **nothing in your repo changed**, do not theorize about the cause. Fetch the
job log of the **last green run** and the **first red run** and diff the relevant line. The log usually
prints the resolved input, and the delta names the cause outright.

## The case (measured 2026-08-06, shader-slang/slang)

"Check Submodule Pointers" failed 6 consecutive merge-queue runs. No slang commit had touched
`external/mimalloc` since 2026-07-15. The two logs, same pinned SHA:

- last GREEN 21:19:58Z — `checking 'external/mimalloc' ... pinned 8c532c32 against **main** (remote default branch)` → PASS
- first RED 22:33:19Z — `checking 'external/mimalloc' ... pinned 8c532c32 against **main3** (remote default branch)` → FAIL

**Upstream microsoft/mimalloc flipped its default branch `main` → `main3`.** The `.gitmodules` stanza has
no `branch =` line, so the checker follows the *remote default* — a value that lives outside your repo and
can change under you. Confirmed independently: `git ls-remote --symref <url> HEAD` → `refs/heads/main3`,
and `git merge-base --is-ancestor` showed the pin reachable from `main` but not `main3` (divergent
histories).

Generalization: **any check whose input is "the upstream default branch," a floating tag, or `@latest` has
a hidden external dependency.** A submodule stanza without an explicit `branch =` is one of these.

## Two traps in the same investigation

1. **Timestamps that look like a cron.** Failures ~1h apart read as an hourly schedule. The workflow had
   **no `schedule:` block** — only `pull_request` + `merge_group: [checks_requested]`; the cadence was
   merge-queue arrival rate. Read the workflow `on:` block before calling anything "the nightly."
2. **Red ≠ blocking.** Three PRs merged with this check red (it was not a required status check) and
   master kept advancing. Check whether the PRs actually merged before escalating as "the queue is stuck."

## Bonus: filtering a busy repo's run list

`/actions/runs?per_page=100` on a high-volume repo can cover **~12 minutes** (measured: 04:30:03→04:42:38
of `total_count=40000`). A name filter over that page returns zero and looks like "this workflow never
runs." Resolve the workflow id from `/actions/workflows` and query
`/actions/workflows/<id>/runs` instead — and always report the window your page actually spans.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1785992236992-a-ci-failure-that-starts-with-no-local-commit-diff.md`_
