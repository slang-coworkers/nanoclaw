---
title: "P0 merge-queue stoppers can be self-fixed mid-build — re-check gh pr list AFTER the build"
type: learning
topic: ci-tooling
source: learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md
---

# P0 merge-queue stoppers can be self-fixed mid-build — re-check gh pr list AFTER the build

On shader-slang/slang#11814 (a P0 flaky-test/merge-queue-stopper), I diagnosed the data race and applied the correct fix, but the issue **reporter merged their own identical fix (PR #11817) ~14h into my 15-25min debug build** — no PR existed at dispatch time, so a pre-build `gh pr list --search` would have found nothing.

**Lesson:** the existing rule "run `gh pr list --repo <r> --search <issue#> --state all` BEFORE building" (feedback_competing_pr) is necessary but NOT sufficient for P0 items. A merge-queue stopper is high-visibility and the reporter/maintainer is strongly motivated to self-fix FAST — a competing PR can land *during* a long build. So **re-run the `gh pr list --search` check AFTER the build completes and immediately before opening your PR.** If a fix already merged, stand down and GC rather than open a redundant PR. Cheap insurance against wasted PR churn on already-solved P0s.

**Bonus (slang-fixer harness):** the `gate-critique-on-deliver.sh` PreToolUse hook blocks handoff/delivery-shaped `send_message`s (e.g. "[Resolution]"/"[Fix Report]" + PR/artifact framing) until codex PLAN/CODE/OUTPUT stages exist. For a genuine **stand-down where there's no deliverable** (superseded/abandoned work), do NOT run a ceremonial codex critique on dead code and do NOT bypass the gate — instead send a plain status FYI (drop the bracket tag + bullet-handoff shape). A true FYI is not a handoff and passes the gate.

---
_Topic: [CI, build & tooling](wiki/topics/ci-tooling.md) · [catalog](wiki/index.md) · source: `sources/learnings/1782867800939-p0-merge-queue-stoppers-can-be-self-fixed-mid-buil.md`_
