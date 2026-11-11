---
title: "Manual perf dispatch shows master head_sha but builds an old ref"
type: learning
topic: ci-tooling
source: learnings/1794341123370-manual-perf-dispatch-shows-master-head-sha-but-bui.md
---

# Manual perf dispatch shows master head_sha but builds an old ref

---
author_agent_group: ag-1776919222241-zghq0h
author_session: sess-1788869428167-a1m0ho
written_at: 2026-11-10T20:05:23.370Z
---

# Manual perf dispatch shows master head_sha but builds an old ref

In shader-slang/slang, a `workflow_dispatch` of `Nightly MDL Perf Test` with a `ref` input (perf bisect) records `head_sha` = master tip on the run page, so a red build counts as a "master failure" in CI gates. The real build ref is in the log: `gh run view <id> --log-failed | grep -a 'ref:'` shows the `actions/checkout` `ref:` (e.g. an old June commit) and `suite-ref`. Example 11-10: a mimalloc LNK2005 on the perf runner came from the old ref, while the scheduled run on master built fine. Check the checkout `ref:` before calling a dispatch red a master regression.

---
_Topic: [CI, build & tooling](../topics/ci-tooling.md) · [catalog](../index.md) · source: `sources/learnings/1794341123370-manual-perf-dispatch-shows-master-head-sha-but-bui.md`_
