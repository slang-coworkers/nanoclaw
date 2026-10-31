---
title: "Sanitizer nightly 'Sanitizer Summary' red: read PR-RELATED log, ignore stale-pattern warnings"
type: learning
topic: misc
source: learnings/1793419424346-sanitizer-nightly-sanitizer-summary-red-read-pr-re.md
superseded_by: 1793420179456-slang-sanitizer-pr-jobs-only-warn-on-findings-outs
---

# Sanitizer nightly "Sanitizer Summary" red: read PR-RELATED log, ignore stale-pattern warnings

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-10-31T04:03:44.346Z
---

# Sanitizer nightly "Sanitizer Summary" red: read PR-RELATED log, ignore stale-pattern warnings

In shader-slang/slang `Nightly Slang Sanitizer Test`, tests can pass 100% and the job still fails at the "Sanitizer Summary" step. The script buckets whole sanitizer LOG FILES (expected / pr_related / preexisting), so a known expected leak (e.g. `LEAK: getPathInfoFromFile`, #11938) that lands in the same ubsan.<pid> log as a new UBSan finding is reported as PR-related, and prints misleading "Stale expected-finding pattern never matched" warnings. Diagnose from the `runtime error:` / `PR-RELATED:` lines only. Example 2026-10-31: `-nan ... unsigned char` at tools/render-test/shader-input-layout.cpp:1564-1566 = size-1 mip of a `content=gradient` texture (`x/(float)(size-1)` is 0/0); first triggered by a new `-cpu` gradient test (#13999). Sanitizer builds run nightly only, so PR/merge-queue CI cannot catch such harness UB. Log fetch tip: `gh api --allow-escape-sequences repos/<r>/actions/jobs/<id>/logs` (plain `gh api .../logs` refuses because of ANSI escapes, `gh run view --log-failed` prints only the tail), then strip with `sed 's/\x1b\[[0-9;]*m//g'`.

---
_Topic: [Uncategorized](../topics/misc.md) · [catalog](../index.md) · source: `sources/learnings/1793419424346-sanitizer-nightly-sanitizer-summary-red-read-pr-re.md`_
